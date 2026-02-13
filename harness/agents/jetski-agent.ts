import fs from 'fs';
import os from 'os';
import path from 'path';
import puppeteer from 'puppeteer-core';
import type { Page } from 'puppeteer-core';
import { spawn, execSync } from 'child_process';
import { config, Agents } from '../config.ts';

import { createIsolatedHome, cleanupIsolatedHome, updateMcpConfig, createTrustedFolders, copyAgentContext, sleep, killProcessOnPort, parseAgentArgs, copyResultsToTarget, createWorkDir, copySkills } from '../lib/agent-shared.ts';

// Usage: node jetski-agent.ts <prompt> <runType> <targetDir> <templateDir>
const { userPrompt, runType, targetDir, templateDir } = parseAgentArgs('jetski-agent.ts');

/**
 * Sets up an isolated HOME and work directory to ensure test isolation.
 * @returns {string} The path to the temporary work directory.
 */
function setupIsolatedWorkDir(): string {
  const tempHome = createIsolatedHome('ghh-jetski');
  const workDir = createWorkDir(templateDir, tempHome, runType);

  const appSupportSource = path.join(os.homedir(), 'Library/Application Support/Jetski');
  const appSupportDest = path.join(tempHome, 'Library/Application Support/Jetski');
  const jetskiSource = path.join(os.homedir(), '.gemini/jetski');
  const jetskiDest = path.join(tempHome, '.gemini/jetski');

  fs.mkdirSync(appSupportDest, { recursive: true });
  fs.mkdirSync(jetskiDest, { recursive: true });

  // To bypass trusted folder checks
  createTrustedFolders(path.dirname(jetskiDest), [tempHome]);

  // Copy minimal authentication state
  const filesToCopy = [
    'Cookies',
    'Preferences',
    'machineid',
    'Network Persistent State'
  ];

  for (const file of filesToCopy) {
    const src = path.join(appSupportSource, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(appSupportDest, file));
    }
  }

  // Copy Local Storage and User (excluding workspaceStorage)
  try {
    execSync(`rsync -a "${appSupportSource}/Local Storage/" "${appSupportDest}/Local Storage/"`);
    execSync(`rsync -a --exclude='workspaceStorage' "${appSupportSource}/User/" "${appSupportDest}/User/"`);
  } catch (err: any) {
    console.warn('Warning: Failed to copy some Application Support directories:', err.message);
  }

  // Symlink Keychains to avoid "Keychain Not Found" dialog without requiring system permissions.
  // This allows the agent to access the decryption key for the copied cookies.
  const keychainsSource = path.join(os.homedir(), 'Library/Keychains');
  const keychainsDest = path.join(tempHome, 'Library/Keychains');
  fs.mkdirSync(path.dirname(keychainsDest), { recursive: true });
  try {
    fs.symlinkSync(keychainsSource, keychainsDest);
  } catch (err: any) {
    console.warn('Warning: Failed to symlink Keychains:', err.message);
  }

  // Copy essential .gemini state
  const geminiFiles = ['installation_id', 'user_settings.pb'];
  for (const file of geminiFiles) {
    const src = path.join(jetskiSource, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(jetskiDest, file));
    }
  }

  // Set environment variables
  process.env.HOME = tempHome;
  process.env.JETSKI_DIR = jetskiDest;

  // Add GEMINI context and MCP servers for guided runs
  if (runType === 'guided') {
    copyAgentContext(tempHome, Agents.JETSKI);

    if (config.enableSkills) {
      copySkills(tempHome, Agents.JETSKI)
    }

    updateMcpConfig(
      path.join(jetskiDest, 'mcp_config.json'),
      config.mcpServersToEnable,
      config.modernWebServerPath,
      config.mcpApiKey,
      Agents.JETSKI
    );
  }

  return workDir;
}



async function extractJetskiVersionInfo(page: Page, outputPath: string): Promise<any> {
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
    const versionText = await page.$eval(detailSelector, (el: any) => el.innerText);

    // 7. Parse to JSON
    const lines = versionText.split('\n');
    const info: Record<string, string> = {};
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
    try {
      fs.writeFileSync(outputPath, JSON.stringify(info, null, 2), 'utf8');
    } catch (e: any) {
      console.warn(`Warning: Could not save Jetski info to file: ${e.message}`);
    }

    // 9. Close the dialog to leave the IDE in a clean state
    // We try Escape first, then look for an OK button as a backup
    await page.keyboard.press('Escape');
    await sleep(500);

    // If it's still there (e.g. Escape didn't work), try clicking the OK button
    const okButton = 'button.monaco-text-button';
    const hasButton = await page.$(okButton);
    if (hasButton) {
      const text = await page.$eval(okButton, (el: any) => el.innerText);
      if (text === 'OK') {
        await page.click(okButton);
        await sleep(500);
      }
    }

    console.log(`Successfully extracted Jetski info.`);
    return info;

  } catch (error: any) {
    console.error('Failed to extract version info:', error.message);
    throw error;
  }
}

async function startJetski(directory: string, profileDir: string): Promise<void> {
  // Kill anything on the debug port first
  killProcessOnPort(config.jetskiDebugPort);

  console.log(`Starting Jetski with directory: ${directory}`);
  const jetskiProcess = spawn(config.jetskiBin, [
    `--remote-debugging-port=${config.jetskiDebugPort}`,
    `--user-data-dir=${profileDir}`,
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
    } catch (e: any) {
      console.log(`Connection attempt ${i + 1} failed: ${e.message}`);
      await sleep(1000);
    }
  }
  throw new Error("Timeout waiting for Jetski to start");
}

async function run(): Promise<void> {
  const workDir = setupIsolatedWorkDir();

  if (!workDir || !fs.existsSync(workDir)) {
    throw new Error(`Failed to initialize working directory: ${workDir}`);
  }

  try {
    // Use stable user data dir to persist state (welcome screen, etc.)
    const profileDir = config.jetskiProfileDir;
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }

    await startJetski(workDir, profileDir);

    const browserURL = `http://127.0.0.1:${config.jetskiDebugPort}`;
    const browser = await puppeteer.connect({
      browserURL,
      defaultViewport: null
    });

    // Find the main IDE window (workbench)
    let page: Page | undefined;
    for (let i = 0; i < 20; i++) {
      console.log(`Searching for workbench window (Attempt ${i + 1}/20)...`);
      const pages = await browser.pages();
      page = pages.find(p => p.url().includes('workbench.html'));
      if (page) break;
      await sleep(500);
    }

    if (!page) {
      throw new Error("Could not find the Jetski workbench window.");
    }

    // Attempt to save Jetski info (only once per Test ID, effectively)
    // If we are in the results structure (results/<testID>/<runNumber>/...), go up to the testID folder.
    // Otherwise, just put it in the target directory.
    let jetskiInfoPath = path.join(targetDir, 'jetski_info.json');
    const resultsMatch = targetDir.match(/(.*[/\\]results[/\\]test_[^/\\]+)/);
    if (resultsMatch) {
      jetskiInfoPath = path.join(resultsMatch[1], 'jetski_info.json');
    }

    if (!fs.existsSync(jetskiInfoPath)) {
      console.log(`Extracting Jetski info to: ${jetskiInfoPath}`);
      try {
        await extractJetskiVersionInfo(page, jetskiInfoPath);
      } catch (e: any) {
        console.error("Failed to extract Jetski info:", e.message);
        // Ensure we try to close any open dialogs that might be blocking the UI
        await page.keyboard.press('Escape');
      }
    } else {
      console.log(`Jetski info already exists at: ${jetskiInfoPath}`);
    }

    const inputSelector = '#chat [contenteditable="true"][role="textbox"]';
    const sendButtonSelector = '#chat button[data-tooltip-id="input-send-button-send-tooltip"]';
    const cancelButtonSelector = '[data-tooltip-id="input-send-button-cancel-tooltip"]';
    const allowOnceButtonSelector = 'button[aria-label="Allow once"]';

    // The double slashes are deliberate. These IDs include the dot.
    const iframeSelector = '#antigravity\\.agentPanel, #antigravity\\.cascadePanel';

    console.log(`Waiting for Agent Panel iframe...`);
    let targetFrame: any = null;
    for (let i = 0; i < 20; i++) {
      const iframeElement = await page.$(iframeSelector);
      if (iframeElement) {
        targetFrame = await iframeElement.contentFrame();
        if (targetFrame && await targetFrame.$(inputSelector)) {
          break;
        }
      }
      console.log(`... Agent Panel iframe not found or loading, checking again in 3s (Attempt ${i + 1}/20)`);
      targetFrame = null;
      await sleep(3000);
    }

    if (!targetFrame) {
      throw new Error("Could not find Agent Panel iframe after 60 seconds.");
    }

    // Focus and type
    console.log(`Typing prompt: "${userPrompt}"`);
    await targetFrame.type(inputSelector, userPrompt);
    console.log("Submitting...");
    await targetFrame.click(sendButtonSelector);

    // Wait for completion (cancel button to disappear)
    // First, wait for the cancel button to APPEAR (meaning it started)
    try {
      await targetFrame.waitForSelector(cancelButtonSelector, { timeout: 10000 });
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
      const chatText = await targetFrame.$eval('#chat', (el: any) => el.innerText || '');
      const chatLogPath = path.resolve(targetDir, 'chat_log.txt');
      fs.writeFileSync(chatLogPath, chatText, 'utf8');
      console.log(`Saved chat log to: ${chatLogPath}`);
    } catch (e: any) {
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

    copyResultsToTarget(workDir, targetDir);

  } catch (err) {
    console.error("Error during execution:", err);
    process.exit(1);
  } finally {
    killProcessOnPort(config.jetskiDebugPort);
    cleanupIsolatedHome(path.dirname(workDir));
  }
}

run();