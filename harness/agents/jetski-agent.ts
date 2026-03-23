import fs from 'fs';
import os from 'os';
import path from 'path';
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'url';
import type { Page } from 'puppeteer-core';
import { spawn, execSync } from 'child_process';
import { config, Agents } from '../config.ts';

import { createIsolatedHome, cleanupIsolatedHome, updateMcpConfig, createTrustedFolders, sleep, killProcessOnPort, parseAgentArgs, copyResultsToTarget, createWorkDir, copySkills, exportTrajectories, watchLogFile } from '../lib/agent-shared.ts';
import { MODERN_WEB_LOG_FILE } from '../../constants.ts';

// Usage: node jetski-agent.ts <prompt> <runType> <targetDir> <templateDir>
/**
 * Sets up an isolated HOME and work directory to ensure test isolation.
 * @returns {string} The path to the temporary work directory.
 */
function setupIsolatedWorkDir(templateDir: string, runType: string, targetDir: string): string {
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
  process.env.MCP_LOG_DIR = targetDir;

  // Add GEMINI context and MCP servers for guided runs
  if (runType === 'guided') {
    if (config.suite.enableSkills) {
      copySkills(tempHome, Agents.JETSKI)
    }

    updateMcpConfig(
      path.join(jetskiDest, 'mcp_config.json'),
      config.suite.mcpServersToEnable,
      config.environment.modernWebServerPath,
      config.environment.mcpApiKey,
      Agents.JETSKI
    );
  }

  return workDir;
}

/**
 * Bypasses common setup dialogs like "Trust authors" and "Welcome wizard".
 */
async function bypassInitialDialogs(page: Page): Promise<void> {
  console.log('Bypassing initial dialogs...');

  // 1. Handle "Trust the authors" dialog persistently
  try {
    console.log('Checking for Trust dialog...');
    for (let i = 0; i < 5; i++) {
      const buttons = await page.$$('.monaco-button, .monaco-text-button, button, a');
      let found = false;
      for (const btn of buttons) {
        const text = await page.evaluate(el => (el as HTMLElement).innerText || (el as HTMLElement).textContent || '', btn);
        if (text && text.includes('Yes, I trust the authors')) {
          console.log(`Clicking Trust button (Attempt ${i + 1}): "${text.trim()}"`);
          await (btn as any).click();
          await sleep(3000);
          found = true;
          break;
        }
      }
      if (found) break;
      if (i < 4) await sleep(2000);
    }
  } catch (e: any) {
    console.log('Trust dialog handling skipped or failed:', e.message);
  }

  // 2. Bypass "Welcome" slides / Wizard / Terms
  try {
    console.log('Checking for Welcome/Setup Wizard...');
    for (let i = 0; i < 15; i++) {
      const nextButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button, a.monaco-button, .monaco-text-button, [role="button"]'));
        const targetTexts = ['Next', 'Get Started', 'Done', 'Accept', 'Continue', 'Skip', 'Trust'];
        return buttons.find(b => {
          const text = (b as HTMLElement).innerText || '';
          return targetTexts.some(t => text.includes(t));
        });
      });

      if (nextButton && (nextButton as any).asElement()) {
        const text = await page.evaluate(el => (el as HTMLElement).innerText, nextButton as any);
        console.log(`Clicking "${text?.trim()}" button (Attempt ${i + 1})...`);
        await (nextButton as any).click();
        await sleep(1500);
      } else {
        if (i === 0) console.log('No setup wizard buttons found.');
        break;
      }
    }
  } catch (e: any) {
    console.log('Error bypassing Welcome Wizard:', e.message);
  }

  console.log('UI stabilization wait...');
  await sleep(3000);
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
  killProcessOnPort(config.environment.jetskiDebugPort);

  console.log(`Starting Jetski with directory: ${directory}`);
  const jetskiProcess = spawn(config.environment.jetskiBin, [
    `--remote-debugging-port=${config.environment.jetskiDebugPort}`,
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
        browserURL: `http://127.0.0.1:${config.environment.jetskiDebugPort}`,
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
  const { userPrompt, runType, targetDir, templateDir } = parseAgentArgs('jetski-agent.ts');
  const workDir = setupIsolatedWorkDir(templateDir, runType, targetDir);
  let stopWatchingMcpLog = () => { };

  if (!workDir || !fs.existsSync(workDir)) {
    throw new Error(`Failed to initialize working directory: ${workDir}`);
  }

  try {
    // Use stable user data dir to persist state (welcome screen, etc.)
    const profileDir = config.environment.jetskiProfileDir;
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }

    await startJetski(workDir, profileDir);

    const browserURL = `http://127.0.0.1:${config.environment.jetskiDebugPort}`;
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

    await page.bringToFront();
    await bypassInitialDialogs(page);

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

    stopWatchingMcpLog = watchLogFile(path.join(targetDir, MODERN_WEB_LOG_FILE));

    const inputSelector = '[contenteditable="true"][role="textbox"]';
    const sendButtonSelector = '[data-tooltip-id="input-send-button-send-tooltip"]';
    const cancelButtonSelector = '[data-tooltip-id="input-send-button-cancel-tooltip"]';
    const agentPanelSelector = ':is(#chat, #conversation) #antigravity\\.agentSidePanelInputBox';

    let targetPanel: any = null;
    let targetInputBox: any = null;

    for (let i = 0; i < 60; i++) {
      targetPanel = await page.$(agentPanelSelector);

      if (targetPanel) {
        try {
          targetInputBox = await targetPanel.$(inputSelector);
        } catch (e: any) {
          console.error("Failed to find input box:", e.message);
        }
      }

      if (targetPanel && targetInputBox) {
        break;
      }
      console.log(`... Agent Panel conversation box not found or loading, checking again in 1s (Attempt ${i + 1}/60)`)
      await sleep(3000);
      if (i > 0 && i % 5 === 0) {
        await page.keyboard.press('Escape');
      }
    }

    if (!targetPanel) {
      throw new Error("Could not find Agent Panel conversation panel after 60 seconds.");
    }

    console.log(`Typing prompt: "${userPrompt}"`);
    const lines = userPrompt.split('\n');
    for (let i = 0; i < lines.length; i++) {
      await targetInputBox.type(lines[i]);
      if (i < lines.length - 1) {
        await page.keyboard.down('Shift');
        await page.keyboard.press('Enter');
        await page.keyboard.up('Shift');
      }
    }

    try {
      const sendButton = await targetPanel.waitForSelector(sendButtonSelector, { timeout: 10000 });
      console.log("Submitting prompt...");
      await sendButton.click();
    } catch {
      console.log("Warning: Submit button didn't appear or was not clickable.");
    }

    try {
      await targetPanel.waitForSelector(cancelButtonSelector, { timeout: 10000 });
      console.log("Agent started working...");
    } catch {
      console.log("Warning: Cancel button didn't appear quickly. Agent might have finished very fast or failed to start.");
    }

    console.log("Waiting for agent to finish...");
    while (true) {
      const currentPanel = await page.$(agentPanelSelector);
      if (!currentPanel) {
        console.log("Agent Panel disappeared, assuming finished or closed.");
        break;
      }

      const cancelButton = await currentPanel.$(cancelButtonSelector);
      if (!cancelButton) {
        console.log("Agent finished.");
        break;
      }

      // Check for "Allow This Conversation" button and click it if it appears
      try {
        const allowButton = await page.evaluateHandle(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          return buttons.find(b => {
            const t = b.innerText?.toLowerCase() || '';
            return t.includes('allow this conversation') || t.includes('allow once');
          });
        });

        if (allowButton && (allowButton as any).asElement()) {
          console.log("Found 'Allow' button, clicking...");
          await (allowButton as any).click();
          await sleep(1000);
        }
      } catch {
        // Ignore errors in polling for allow button
      }

      await sleep(1000);
    }

    // Attempt to preserve chat log before closing Jetski
    try {
      console.log("Saving chat log...");
      await page.waitForSelector(':is(#chat, #conversation)', { timeout: 10000 });
      const chatText = await page.$eval(':is(#chat, #conversation)', (el: any) => (el as any).innerText || '');
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

    stopWatchingMcpLog();
    await sleep(1000);
    await browser.disconnect();
    console.log("Disconnected.");

    copyResultsToTarget(workDir, targetDir);

    // Extract trajectory pb from isolated home
    const conversationsDir = path.join(path.dirname(workDir), '.gemini', 'jetski', 'conversations');
    exportTrajectories(conversationsDir, '*.pb', targetDir);

  } catch (err) {
    console.error("Error during execution:", err);
    process.exit(1);
  } finally {
    stopWatchingMcpLog();
    killProcessOnPort(config.environment.jetskiDebugPort);
    cleanupIsolatedHome(path.dirname(workDir));
  }
}

export async function collectJetskiGuides(dirPath: string): Promise<string[]> {
  // TODO: Implement skills guide collection for Jetski (need gLinux-only binary, cannot land in GH)
  console.log(`Jetski skills collection for ${dirPath} still needs to be populated.`);
  return [];
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  run();
}
