require("dotenv").config({
    path: ".\\.env",
});

const puppeteer = require("puppeteer");
const cron = require("node-cron");
const AWS = require("aws-sdk");
const fs = require("fs");
const axios = require("axios");

const randomString = (length) => {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    let result = "";
    for (let i = 0; i < length; i++) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}

const wait = (time) => new Promise((resolve) => setTimeout(resolve, time));
const log = (data) => console.log(`[${new Date().toLocaleString()}]:`, data);

const s3 = new AWS.S3({
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.ACCESS_SECRET,
    endpoint: "https://storage.googleapis.com",
});

const uploadFile = (fileName) => new Promise((resolve, reject) => {
    const fileContent = fs.readFileSync(fileName);

    const params = {
        Bucket: "mypersonalstash",
        Key: `${randomString(10)}.png`,
        Body: fileContent,
        ContentType: "image/png",
    };

    s3.upload(params, (err) => {
        if (err) return reject(err);
        resolve(`https://cdn.domhoe.dev/${params.Key}`);
    });
});

const runTask = async () => {
    // Do the magic!
    log("Running task now!!!");
    const browser = await puppeteer.launch();
    log("Launched browser");
    const page = await browser.newPage();
    log("Opened new page");
    await page.goto(process.env.SCHEDULE_WEBSITE_AUTH); // I'm not going to risk any legal stuff by putting the URL here
    log(`Loaded schedule auth page`);
    // Once page loads, we enter our authentication information
    await page.type("[placeholder=\"Enter username\"]", process.env.USER_ID.toString());
    log("Entered username");
    await page.type("[placeholder=\"Enter password\"]", process.env.PASSWORD.toString());
    log("Entered password");
    await page.keyboard.press("Enter");
    log("Pressed enter");
    // Wait for the schedule to load
    await page.waitForNavigation({ waitUntil: "networkidle0" });
    log("Page has loaded successfully");
    await wait(4500);
    await page.mouse.move(474, 40);
    log("Moved mouse to 474, 90");
    await page.mouse.click(474, 90, {
        button: "left",
        clickCount: 1,
    });
    log("Clicked the \"Next\" button for next week's schedule");
    // I was stuck here for 2. Hours. I gave up and just decided to wait 7.5 seconds.
    // For reference - when the page loads, it doesn't include the schedule data..
    // that is in a separate request. As a result: https://media.giphy.com/media/VapqUNCDqOuKQ/giphy.gif
    await wait(7500);
    await page.screenshot({ path: "screenshot.png" });
    log("Took a screenshot after waiting 7.5 seconds");
    await browser.close();
    const location = await uploadFile("screenshot.png");
    log(`Successfully uploaded to ${location}.`);
    fs.unlinkSync("screenshot.png");
    await axios.post(process.env.SCHEDULE_POSTING_WEBHOOK_URI, {
        content: `@everyone ${location}`,
    });
    log("Sent webhook payload to Discord with schedule link");
}

// Schedule a CRON job for every Thursday @ 7 PM
cron.schedule("0 0 19 * * 4", runTask);

runTask();