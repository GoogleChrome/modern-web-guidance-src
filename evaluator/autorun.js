const puppeteer = require('puppeteer-core');
const { spawn, execSync } = require('child_process');
const path = require('path');
const config = require('./config');

// Parse arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: node autorun.js <directory> <prompt>");
  process.exit(1);
}
const [targetDirectory, userPrompt] = args;
const absoluteTargetDir = path.resolve(targetDirectory);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function killProcessOnPort(port) {
  try {
    const pid = execSync(`lsof -t -i :${port}`).toString().trim();
    if (pid) {
      console.log(`Killing process ${pid} on port ${port}...`);
      execSync(`kill -9 ${pid}`);
    }
  } catch (e) {
    // Ignore error if no process found (grep/lsof returns exit code 1 if empty)
  }
}

async function startJetski(directory) {
  // Kill anything on the debug port first
  killProcessOnPort(config.jetskiDebugPort);

  console.log(`Starting Jetski with directory: ${directory}`);
  const jetskiProcess = spawn(config.jetskiBin, [
    `--remote-debugging-port=${config.jetskiDebugPort}`,
    directory
  ], {
    detached: true, // Let it run independently
    stdio: 'inherit' // Enable output for debugging
  });

  jetskiProcess.unref(); // Don't wait for it to exit

  // Wait for the debug port to be ready
  console.log("Waiting for Jetski to be ready...");
  for (let i = 0; i < 30; i++) {
    try {
      const browser = await puppeteer.connect({
        browserURL: `http://127.0.0.1:${config.jetskiDebugPort}`,
        defaultViewport: null
      });
      browser.disconnect();
      console.log("Jetski is ready.");
      return;
    } catch (e) {
      console.log(`Connection attempt ${i + 1} failed: ${e.message}`);
      await sleep(1000);
    }
  }
  throw new Error("Timeout waiting for Jetski to start");
}

async function run() {
  try {
    await startJetski(absoluteTargetDir);

    const browserURL = `http://127.0.0.1:${config.jetskiDebugPort}`;

    const browser = await puppeteer.connect({
      browserURL,
      defaultViewport: null
    });

    // Find the main IDE window (workbench)
    let page;
    for (let i = 0; i < 20; i++) {
      console.log(`Searching for workbench window (Attempt ${i + 1}/20)...`);
      const pages = await browser.pages();
      page = pages.find(p => p.url().includes('workbench.html'));
      if (page) break;
      await sleep(500);
    }

    if (!page) {
      console.error("Could not find the Jetski workbench window.");
      await browser.disconnect();
      return;
    }

    const inputSelector = '#chat [contenteditable="true"][role="textbox"]';
    const sendButtonSelector = '#chat button[data-tooltip-id="input-send-button-send-tooltip"]';
    const cancelButtonSelector = '[data-tooltip-id="input-send-button-cancel-tooltip"]';
    const allowOnceButtonSelector = 'button[aria-label="Allow once"]';

    const iframeSelector = '#antigravity\\.agentPanel';

    console.log(`Waiting for Agent Panel iframe...`);
    let targetFrame = null;

    for (let i = 0; i < 5; i++) {
      const iframeElement = await page.$(iframeSelector);
      if (iframeElement) {
        targetFrame = await iframeElement.contentFrame();
        if (targetFrame && await targetFrame.$(inputSelector)) {
          break;
        }
      }
      console.log(`... Agent Panel iframe not found or loading, checking again in 3s (Attempt ${i + 1}/5)`);
      targetFrame = null; // Ensure null if check failed
      await sleep(3000);
    }

    if (!targetFrame) {
      console.error("Could not find Agent Panel iframe after 15 seconds.");
      await browser.disconnect();
      process.exit(1);
    }

    // Focus and type
    console.log(`Typing prompt: "${userPrompt}"`);
    await targetFrame.type(inputSelector, userPrompt);

    // Click send
    console.log("Submitting...");
    await targetFrame.click(sendButtonSelector);

    // Wait for completion (cancel button to disappear)
    // First, wait for the cancel button to APPEAR (meaning it started)
    try {
      // WaitForSelector on frame
      await targetFrame.waitForSelector(cancelButtonSelector, { timeout: 5000 });
      console.log("Agent started working...");
    } catch (e) {
      console.log("Warning: Cancel button didn't appear quickly. Agent might have finished very fast or failed to start.");
    }

    // Now wait for it to disappear
    console.log("Waiting for agent to finish...");
    while (true) {
      const cancelButton = await targetFrame.$(cancelButtonSelector);
      if (!cancelButton) {
        console.log("Agent finished.");
        break;
      }

      const allowOnceButton = await targetFrame.$(allowOnceButtonSelector);
      if (allowOnceButton) {
        console.log("Found 'Allow once' button, clicking it...");
        await allowOnceButton.click();
      }

      await sleep(1000);
    }

    // Close Jetski
    console.log("Closing Jetski...");
    if (page) {
      // Cmd+Q
      await page.keyboard.down('Meta');
      await page.keyboard.press('q');
      await page.keyboard.up('Meta');
      console.log("Sent quit command to Jetski.");
    }

    await sleep(1000);
    await browser.disconnect();
    console.log("Disconnected.");

  } catch (err) {
    console.error("Error during execution:", err);
    process.exit(1);
  }
}

run();