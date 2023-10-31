require("dotenv").config();
const express = require("express");
var cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN,
    credentials: true,
  })
);

// Use a single session for all requests and reuse session cookie until it expires
let sessionCookie = {};

let browser;

// Create browser instance and reuse it for each request
const initBrowser = async () => {
  // Need to specify chrome executable path when running in docker container
  if (process.env.DOCKER) {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: "/usr/bin/google-chrome",
      args: ["--no-sandbox", "--disable-gpu"],
    });
  } else {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-gpu"],
    });
  }
};

initBrowser();
// Note: browser is never being "closed" (i.e. await browser.close())

/**
 * @typedef {object} RequestBody
 * @param {string} endpoint - the single integration URL, including all required url parameters such as desired selections etc.
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
  console.log("Taking screenshot");

  // How to check for open page instances / tabs
  // const openPages = await browser.pages();
  // console.log(openPages);

  // Creating the page instance for this request
  const page = await browser.newPage();

  // Adding authorisation header and Xrf key to request
  // This will create a session for the user associated with the "QLIK_TOKEN" jwt
  await page.setExtraHTTPHeaders({
    Authorization: `Bearer ${process.env.QLIK_TOKEN}`,
    "X-Qlik-Xrfkey": "abcdefghijklmnop",
  });
  // Note: It is necessary to include the Authorisation header to every request in order to handle situations in which an existing session cookie
  // may no longer be valid. The Auth header ensures that a new session cookie will be appended to the page in this scenario (which will then
  // replace the session cookie stored above for the purposes of reusing sessions)

  // If a session cookie exists, add it to the request
  // This ensures that the same session is used (rather than creating a new session for each request and exceeding the Qlik session limit)
  if (sessionCookie && sessionCookie.value) {
    await page.setCookie(sessionCookie);
  }

  // How to check request headers
  // page.on("request", (request) => {
  //   const headers = request.headers();
  // });

  // Navigate the page to the URL supplied in the req body
  await page.goto(
    req.body.url,
    // Wait for network activity to cease, as well as "load" and "domcontentloaded" events to fire before proceeding
    { waitUntil: ["networkidle0", "load", "domcontentloaded"] }
  );

  // Set viewport dimensions based an values in req body
  await page.setViewport({
    width: req.body.vpWidth,
    height: req.body.vpHeight,
  });

  // Wait for Qlik loading screen to disappear from page before continuing
  try {
    await page.waitForFunction(
      () => {
        // Get loading indicator element
        const loadIndicator = document.getElementsByClassName(
          "single-load-indicator"
        )[0];
        // Return true (and exit waitFor function) if the display property of this element is set to 'none'
        if (
          window.getComputedStyle(loadIndicator).getPropertyValue("display") ===
          "none"
        ) {
          return true;
        }
      },
      // Timeout value for wait function, default of 10000 ms
      { timeout: req.body.timeout ? req.body.timeout : 10000 }
    );
  } catch (e) {
    console.log("Error waiting for Qlik loading screen to disappear");
  }

  // Iterate through selectors in exclusionArray
  if (req.body.exclusionArray && req.body.exclusionArray.length > 0) {
    for (item of req.body.exclusionArray) {
      try {
        // Query page and wait for element handle
        const element = await page.waitForSelector(item, {
          timeout: req.body.timeout ? req.body.timeout : 10000,
        });
        // Use evaluate method to remove element
        await element.evaluate((el) => el.remove());
      } catch (e) {
        console.log(`Error removing selector: ${item}`, e);
      }
    }
  }

  // Introduce additional delay to allow for visualisations to resize after prior loading has taken place...
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  // Default delay of 500 ms
  await delay(req.body.delay ? req.body.delay : 500);

  // Get current page cookies
  const cookies = await page.cookies();

  // Generic Qlik session cookie name
  let cookieName = "X-Qlik-Session";

  // Append virtual proxy suffix to cookie name if present
  if (process.env.QLIK_VP && process.env.QLIK_VP.length > 0) {
    cookieName = `X-Qlik-Session-${process.env.QLIK_VP}`;
  }

  // Get the current Qlik session cookie (if present)
  let tempSessionCookie = cookies.find((cookie) => cookie.name === cookieName);

  // Replace session cookie if value does not match current page session cookie
  if (
    (sessionCookie &&
      sessionCookie.value &&
      tempSessionCookie.value !== sessionCookie.value) ||
    !sessionCookie.value ||
    !sessionCookie
  ) {
    sessionCookie = tempSessionCookie;
  }

  // Create screenshot image buffer
  const imageBuffer = await page.screenshot();

  // Send image buffer in response
  res.set("Content-Type", "image/png");
  res.send(imageBuffer);
  console.log("Screenshot taken");

  // Close current browser page
  await page.close();
});

app.listen(8000, () => {
  console.log("Listening on port 8000");
});
