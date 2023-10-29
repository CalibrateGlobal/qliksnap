require("dotenv").config();
const express = require("express");
var cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: "https://sense1.calibrateconsulting.com",
    credentials: true,
  })
);

let userPool = [];

app.post("/screenshot", async (req, res) => {
  console.log("Taking screenshot");
  console.log(req.body);

  let browser;

  if (process.env.DOCKER) {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/usr/bin/google-chrome', 
      args: ["--no-sandbox", "--disable-gpu"],
    });
  } else {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-gpu"],
    });
  }

  const page = await browser.newPage();

  await page.setExtraHTTPHeaders({
    Authorization: `Bearer ${process.env.QLIK_TOKEN}`,
    "X-Qlik-Xrfkey": "abcdefghijklmnop",
    // "Cookie": "X-Qlik-Session-jwt=0cc2516f-13d8-4cc8-9b5d-5b47689acc6a"
    // "X-Qlik-Session-jwt": "513c911b-e87e-47f5-9b7d-29cea1f4658e",
  });

  let tempUser = userPool.find((user) => user.userId === req.body.userId);

  /*   const tempCookie = {
    name: "X-Qlik-Session-jwt",
    value: "513c911b-e87e-47f5-9b7d-29cea1f4658e",
    domain: "sense1.calibrateconsulting.com",
    path: "/",
    expires: -1,
    size: 54,
    httpOnly: true,
    secure: true,
    session: true,
    sameSite: "None",
    sameParty: false,
    sourceScheme: "Secure",
    sourcePort: 443,
  };
 */
  if (tempUser && tempUser.sessionCookie) {
    await page.setCookie(tempUser.sessionCookie);
  }

  page.on("request", (request) => {
    const headers = request.headers();
    // console.log("headers", headers);
  });

  // Navigate the page to a URL
  // await page.goto('https://developer.chrome.com/');
  await page.goto(
    // "https://sense1.calibrateconsulting.com/jwt/sense/app/6729311b-f919-4bd2-93a8-872f7271856c/sheet/JzJMza/state/analysis",
    req.body.url,
    { waitUntil: ["networkidle0", "load", "domcontentloaded"] }
  );

  // Set screen size
  await page.setViewport({
    width: req.body.vpWidth,
    height: req.body.vpHeight,
  });

  /* // Query for an element handle.
  const element = await page.waitForSelector(".qs-skip-to-content-button");
  const element2 = await page.waitForSelector(".qs-header");
  const element3 = await page.waitForSelector("div[tid='qs-sub-toolbar']");

  // Use evaluate method to remove element
   await element.evaluate(el => el.remove());
   await element2.evaluate(el => el.remove());
   await element3.evaluate(el => el.remove()); */

  for (item of req.body.exclusionArray) {
    const element = await page.waitForSelector(item);
    await element.evaluate((el) => el.remove());
  }

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  await delay(1000);

  const cookies = await page.cookies();

  let tempSessionCookie = cookies.find(
    (cookie) => cookie.name === "X-Qlik-Session-jwt"
  );

  if (
    tempUser &&
    tempSessionCookie &&
    tempSessionCookie.value !== tempUser.sessionCookie.value
  ) {
    tempUser.sessionCookie = tempSessionCookie;
  }

  if (tempUser) {
    const userIndex = userPool.findIndex(
      (user) => user.userId === tempUser.userId
    );
    userPool[userIndex] = tempUser;
  } else if (req.body.userId && tempSessionCookie) {
    userPool.push({
      userId: req.body.userId,
      sessionCookie: tempSessionCookie,
    });
  }

  console.log("cookies", cookies);

  const imageBuffer = await page.screenshot();
  await browser.close();

  res.set("Content-Type", "image/png");
  res.send(imageBuffer);
  console.log("Screenshot taken");
  console.log("userPool", userPool);
});

app.listen(8000, () => {
  console.log("Listening on port 8000");
});
