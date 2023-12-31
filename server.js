import "dotenv/config";
import express, { json } from "express";
import cors from "cors";
import { createServer } from "http";
import { createServer as createServerHTTPS } from "https";
import { readFileSync } from "fs";
import { resolve } from "path";
import { launch } from "puppeteer";
import { createLogger, transports as _transports } from "winston";
import getTicket from "./lib/qlikFunctions.js";

const app = express();

app.use(json());

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN,
    credentials: true,
  })
);

// Set up logging
const logger = createLogger({
  /*  level: "debug", */
  transports: [new _transports.Console()],
});

// Create a session cache in order to reuse cookies from existing user sessions.
let sessionCache = [];

let browser;

// Create browser instance and reuse it for each request
const initBrowser = async () => {
  // Need to specify chrome executable path when running in docker container
  if (process.env.DOCKER) {
    browser = await launch({
      /*  headless: false, */
      executablePath: "/usr/bin/google-chrome",
      args: ["--no-sandbox", "--disable-gpu"],
    });
  } else if (process.env.EXEC_PATH) {
    browser = await launch({
      /*  headless: false, */
      executablePath: process.env.EXEC_PATH,
      args: ["--no-sandbox", "--disable-gpu"],
    });
  } else {
    browser = await launch({
      /*  headless: false, */
      args: ["--no-sandbox", "--disable-gpu"],
    });
  }
};

initBrowser();
// Note: browser is never being "closed" (i.e. await browser.close())

/**
 * @typedef {object} RequestBody
 * @param {string} userId - the userId of the user for whom the session will be created
 * @param {string} userDirectory - the userDirectory of the user for whom the session will be created
 * @param {string} url - the single integration URL, including all required url parameters (such as selections etc.)
 * @param {string} vpHeight - the height of the snapshot viewport
 * @param {string} vpWidth - the width of the snapshot viewport
 * @param {Array.<string>} exclusionArray - an array listing the css selectors of any elements that should be removed from the snapshot (optional)
 * @param {number} delay - length of delay (ms) to impose after page load to allow for visualisations to resize etc. (optional, default: 500ms)
 * @param {number} timeout - length of timeout before error is returned when utilising Puppeteer waitFor functions (optional, default: 10000ms)
 *
 * @param {string} endpoint - Screenshot endpoint, handling the main functionality of the application
 *
 * @function
 * @param {object} req - Request object
 * @param {RequestBody} req.body - Request body object
 * @param {object} res - Response object
 */
app.post("/screenshot", async (req, res) => {
  logger.info(`/screenshot request body ${JSON.stringify(req.body)}`);
  logger.info(`/screenshot request headers ${JSON.stringify(req.headers)}`);
  if (!browser.connected) {
    res.status(400).send("Browser starting, please refresh in a few seconds");
    return;
  }

  const validationArray = [
    "userId",
    "userDirectory",
    "vpWidth",
    "vpHeight",
    "url",
  ];

  for (const item of validationArray) {
    if (!req.body[item]) {
      logger.error(`Error: ${item} not supplied`);
      res.status(400).send(`Error: ${item} not supplied`);
      return;
    }
  }

  // Get ticket using QPS API
  let ticket;

  try {
    ticket = await getTicket({
      userId: req.body.userId,
      userDirectory: req.body.userDirectory,
      logger,
    });
  } catch (e) {
    logger.error(`Error retrieving ticket: ${e}`);
    res.status(500).send("Error retrieving ticket");
    return;
  }

  // Append ticket to page URL for initial authentication
  // If successful, this will result in a session cookie being returned with the page request
  // Note: Although the ticket is appended to every request, it will be ignored if there is already a valid session cookie present
  let adjustedUrl = new URL(req.body.url);
  adjustedUrl.searchParams.append("QlikTicket", ticket);

  // How to check for open page instances / tabs
  // const openPages = await browser.pages();
  // console.log(openPages);

  // Creating the page instance for this request
  const page = await browser.newPage();

  // Logging page console output
  /*   page
    .on("console", (message) =>
      console.log(
        `${message.type().substr(0, 3).toUpperCase()} ${message.text()}`
      )
    )
    .on("pageerror", ({ message }) => console.log(message))
    .on("response", (response) =>
      console.log(`${response.status()} ${response.url()}`)
    )
    .on("requestfailed", (request) =>
      console.log(`${request.failure().errorText} ${request.url()}`)
    ); */

  // Adding Xrf key to request
  /*  await page.setExtraHTTPHeaders({
    "X-Qlik-Xrfkey": "abcdefghijklmnop",
  }); */

  // If a session cookie exists, add it to the request
  // This ensures that the same session is used (rather than creating a new session for each request and exceeding the Qlik session limit)

  let tempSession = sessionCache.find(
    (session) => session.userId === req.body.userId
  );

  if (tempSession && tempSession.sessionCookie) {
    await page.setCookie(tempSession.sessionCookie);
  }

  // How to check request headers
  // page.on("request", (request) => {
  //   const headers = request.headers();
  // });

  // Set viewport dimensions based an values in req body

  await page.setViewport({
    width: req.body.vpWidth,
    height: req.body.vpHeight,
  });

  page.setCacheEnabled(false);

  // Navigate the page to the URL supplied in the req body
  await page.goto(
    adjustedUrl,
    // Wait for network activity to cease, as well as "load" and "domcontentloaded" events to fire before proceeding
    { waitUntil: ["networkidle0", "load", "domcontentloaded"] }
  );

  const urlSplit = req.body.url.split("/");

  // Wait for Qlik loading screen to disappear from page before continuing

  if (urlSplit.includes("single")) {
    // Case for single integration URL
    try {
      await page.waitForFunction(
        () => {
          // Get loading indicator element
          const loadIndicator = document.getElementsByClassName(
            "single-load-indicator"
          )[0];
          // Return true (and exit waitFor function) if the display property of this element is set to 'none'
          if (
            window
              .getComputedStyle(loadIndicator)
              .getPropertyValue("display") === "none"
          ) {
            return true;
          }
        },
        // Timeout value for wait function, default of 10000 ms
        { timeout: req.body.timeout ? req.body.timeout : 10000 }
      );
    } catch (e) {
      logger.error(`Error waiting for Qlik loading screen to disappear: ${e}`);
    }
  } else {
    // Case for standard URL
    try {
      await page.waitForFunction(
        () => {
          // Get loading indicator element
          const loadIndicator = document.getElementById("qv-init-ui-blocker");
          // Return true (and exit waitFor function) if the loading indicator is no longer present
          if (!loadIndicator) {
            return true;
          }
        },
        // Timeout value for wait function, default of 10000 ms
        { timeout: req.body.timeout ? req.body.timeout : 10000 }
      );
    } catch (e) {
      logger.error(`Error waiting for Qlik loading screen to disappear: ${e}`);
    }
  }

  // Iterate through selectors in exclusionArray
  if (req.body.exclusionArray && req.body.exclusionArray.length > 0) {
    for (const item of req.body.exclusionArray) {
      try {
        // Query page and wait for element handle
        const element = await page.waitForSelector(item, {
          timeout: req.body.timeout ? req.body.timeout : 10000,
        });
        // Use evaluate method to remove element
        await element.evaluate((el) => el.remove());
      } catch (e) {
        logger.error(`Error removing selector: ${item}`, e);
      }
    }
  }

  // Introduce additional delay to allow for visualisations to resize after prior loading has taken place...
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  logger.info(`Sleeping for ${req.body.delay || 500}ms `)
  // Default delay of 500 ms
  await delay(req.body.delay ? req.body.delay : 500);
  logger.info("Awaken");

  // Get current page cookies
  const cookies = await page.cookies();
  logger.info(`cookies found on the page: ${JSON.stringify(cookies)}`)

  // Set Qlik session cookie name
  let cookieName = process.env.QLIK_SESSION_COOKIE_NAME
    ? process.env.QLIK_SESSION_COOKIE_NAME
    : "X-Qlik-Session";

  // Get the current Qlik session cookie (if present)
  let tempSessionCookie = cookies.find((cookie) => cookie.name === cookieName);

  // Replace session cookie if value does not match current page session cookie
  if (
    tempSession &&
    tempSessionCookie &&
    tempSessionCookie.value !== tempSession.sessionCookie.value
  ) {
    tempSession.sessionCookie = tempSessionCookie;
  }

  // Add / replace session for user in cache
  if (tempSession) {
    const sessionIndex = sessionCache.findIndex(
      (session) => session.userId === tempSession.userId
    );
    sessionCache[sessionIndex] = tempSession;
    logger.info("Session cookie stored now");

  } else if (req.body.userId && tempSessionCookie) {
    sessionCache.push({
      userId: req.body.userId,
      sessionCookie: tempSessionCookie,
    });

    logger.info("Session cookie not set, unable to store it")
  }

  // Create screenshot image buffer
  const imageBuffer = await page.screenshot();
  logger.info("Screenshot taken")

  // Send image buffer in response
  res.set("Content-Type", "image/png");
  res.send(imageBuffer);
  logger.info("Response sent back to the client");

  // Close current browser page
  await page.close();
});

app.get("/readyz", (req, res) => {
  res.json({
    ready: true,
  });
});

app.get("/healthz", (req, res) => {
  res.json({
    alive: true,
  });
});

const PORT = process.env.PORT || 8000;
const environments = ["dev", "test", "preprod", "production"];

let server;
let host;
let options = {};

const deployedEnv = process.env.NODE_ENV || "testing";

if (environments.includes(deployedEnv)) {
  const HTTPS_SSL_KEY_PASS = process.env.HTTPS_SSL_KEY_PASS || "";
  const HTTPS_SSL_CERT = resolve(process.env.HTTPS_SSL_CERT_PATH, "server.pfx");

  const options = {
    passphrase: HTTPS_SSL_KEY_PASS ? HTTPS_SSL_KEY_PASS : "",
    pfx: HTTPS_SSL_CERT ? readFileSync(HTTPS_SSL_CERT) : "",
  };

  server = createServerHTTPS(options, app);
  host = "https";
  server.listen(PORT, function () {
    logger.info(
      `Mashup Backend | Server started with protocol ${host} - Using port ${PORT}.`
    );
  });
} else {
  server = createServer(options, app);
  host = "http";
  server.listen(PORT, function () {
    logger.info(
      `Mashup Backend | Server started with protocol ${host} - Using port ${PORT}.`
    );
  });
}
