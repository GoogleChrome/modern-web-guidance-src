import fs from 'fs';
import puppeteer from 'puppeteer-core';

import { spawn, execSync } from 'child_process';
import path from 'path';
import config from './config.js';

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

async function extractJetskiVersionInfo(page, outputPath) {
  try {
    // 1. Ensure the window is focused to receive keyboard events
    await page.bringToFront();
    await page.waitForSelector('.antigravity-welcome-container', { visible: true, timeout: 15000 });

    // 2. Trigger Command Palette (Cmd + Shift + P)
    // Using individual down/up calls for the 'chord' to ensure Electron registers it
    await page.keyboard.down('Meta');
    await page.keyboard.down('Shift');
    await page.keyboard.press('p');
    await page.keyboard.up('Shift');
    await page.keyboard.up('Meta');

    // 3. Wait for the Quick Input widget to appear
    const paletteInput = '.quick-input-filter input';
    await page.waitForSelector(paletteInput, { visible: true, timeout: 15000 });

    // 4. Type the command with a slight delay to ensure the UI stays in sync
    await page.type(paletteInput, 'Help: About', { delay: 50 });
    await page.keyboard.press('Enter');

    // 5. Wait for the Monaco dialog detail to appear in the DOM
    const detailSelector = '#monaco-dialog-message-detail';
    await page.waitForSelector(detailSelector, { visible: true, timeout: 10000 });

    // 6. Extract the text
    const versionText = await page.$eval(detailSelector, el => el.innerText);

    // 7. Parse to JSON
    const lines = versionText.split('\n');
    const info = {};
    for (const line of lines) {
      // Split by first occurrence of ': '
      const separatorIndex = line.indexOf(': ');
      if (separatorIndex !== -1) {
        const key = line.substring(0, separatorIndex).trim();
        const value = line.substring(separatorIndex + 2).trim();
        info[key] = value;
      }
    }

    // 8. Write to file
    fs.writeFileSync(outputPath, JSON.stringify(info, null, 2), 'utf8');

    // 9. Close the dialog to leave the IDE in a clean state
    await page.keyboard.press('Escape');

    console.log(`Successfully saved Jetski info to ${outputPath}`);
    return info;

  } catch (error) {
    console.error('Failed to extract version info:', error.message);
    throw error;
  }
}

function killProcessOnPort(port) {
  try {
    const pid = execSync(`lsof -t -i :${port}`).toString().trim();
    if (pid) {
      console.log(`Killing process ${pid} on port ${port}...`);
      execSync(`kill -9 ${pid}`);
    }
  } catch {
    // Ignore error if no process found (grep/lsof returns exit code 1 if empty)
  }
}

async function startJetski(directory) {
  // Kill anything on the debug port first
  killProcessOnPort(config.jetskiDebugPort);

  console.log(`Starting Jetski with directory: ${directory}`);
  const jetskiProcess = spawn(config.jetskiBin, [
    `--remote-debugging-port=${config.jetskiDebugPort}`,
    '--password-store=basic',
    directory
  ], {
    detached: true, // Let it run independently
    stdio: 'inherit' // Enable output for debugging
  });

  jetskiProcess.unref(); // Don't wait for it to exit

  // Background task to dismiss the keychain dialog
  const appleScript = `
    tell application "System Events"
      repeat 15 times
        set found to false
        -- SecurityAgent is the system process that owns this dialog
        if exists (process "SecurityAgent") then
          try
            if exists (window "Keychain Not Found" of process "SecurityAgent") then
              click button "Cancel" of window "Keychain Not Found" of process "SecurityAgent"
              set found to true
            end if
          end try
        end if
        if found then exit repeat
        delay 1
      end repeat
    end tell
  `;
  spawn('osascript', ['-e', appleScript], { detached: true, stdio: 'ignore' }).unref();

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

    // Attempt to save Jetski info (only once per Test ID, effectively)
    // targetDirectory is: results/<testID>/<runNumber>/<scenario>/<promptType>/<agentType>
    // We want: results/<testID>/jetski_info.txt
    // Go up 4 levels: agentType -> promptType -> scenario -> runNumber -> testID
    const jetskiInfoPath = path.resolve(absoluteTargetDir, '../../../../jetski_info.json');

    if (!fs.existsSync(jetskiInfoPath)) {
      console.log(`Extracting Jetski info to: ${jetskiInfoPath}`);
      try {
        await extractJetskiVersionInfo(page, jetskiInfoPath);
      } catch (e) {
        console.error("Failed to extract Jetski info:", e);
        // Don't crash the run for this, just continue
      }
    } else {
      console.log(`Jetski info already exists at: ${jetskiInfoPath}`);
    }

    const inputSelector = '#chat [contenteditable="true"][role="textbox"]';
    const sendButtonSelector = '#chat button[data-tooltip-id="input-send-button-send-tooltip"]';
    const cancelButtonSelector = '[data-tooltip-id="input-send-button-cancel-tooltip"]';
    const allowOnceButtonSelector = 'button[aria-label="Allow once"]';

    const iframeSelector = '#antigravity\\.agentPanel, #antigravity\\.cascadePanel';

    console.log(`Waiting for Agent Panel iframe...`);
    let targetFrame = null;

    for (let i = 0; i < 20; i++) {
      const iframeElement = await page.$(iframeSelector);
      if (iframeElement) {
        targetFrame = await iframeElement.contentFrame();
        if (targetFrame && await targetFrame.$(inputSelector)) {
          break;
        }
      }
      console.log(`... Agent Panel iframe not found or loading, checking again in 3s (Attempt ${i + 1}/20)`);
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
    } catch {
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

    // Attempt to preserve chat log before closing Jetski
    try {
      console.log("Saving chat log...");
      // Ensure #chat exists in the target frame
      await targetFrame.waitForSelector('#chat', { timeout: 5000 });
      const chatText = await targetFrame.$eval('#chat', el => el.innerText || '');
      const chatLogPath = path.resolve(absoluteTargetDir, 'chat_log.txt');
      fs.writeFileSync(chatLogPath, chatText, 'utf8');
      console.log(`Saved chat log to: ${chatLogPath}`);
    } catch (e) {
      console.warn('Could not save chat log:', e.message);
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
