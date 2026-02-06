import fs from 'fs';
import os from 'os';
import path from 'path';
import puppeteer from 'puppeteer-core';
import type { Page } from 'puppeteer-core';
import { spawn, execSync } from 'child_process';
import { config } from '../config.ts';
import { updateMcpConfig } from '../lib/mcp.ts';
import { fileURLToPath } from 'url';

// Parse arguments
// Usage: node jetski-agent.ts <directory> <prompt> [agentType]
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: node jetski-agent.ts <directory> <prompt> [agentType]");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

const [targetDirectory, userPrompt, runType = 'guided'] = args;
const absoluteTargetDir = path.resolve(targetDirectory);

/**
 * Sets up an isolated HOME directory to ensure test isolation while preserving authentication.
 * @returns {string} The path to the temporary HOME directory.
 */
function setupIsolatedHome(): string {
  // Use /tmp/ deliberately because os.tmpdir() on macOS can return paths that are 
  // too long for valid Unix socket paths, which causes issues for some JetSki/VS Code components.
  const tempHome = `/tmp/ghh-${Math.random().toString(36).substring(7)}`;
  fs.mkdirSync(tempHome, { recursive: true });

  console.log(`Setting up isolated HOME at ${tempHome}...`);

  const appSupportSource = path.join(os.homedir(), 'Library/Application Support/Jetski');
  const appSupportDest = path.join(tempHome, 'Library/Application Support/Jetski');
  const geminiSource = path.join(os.homedir(), '.gemini/jetski');
  const geminiDest = path.join(tempHome, '.gemini/jetski');

  fs.mkdirSync(appSupportDest, { recursive: true });
  fs.mkdirSync(geminiDest, { recursive: true });

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
    const src = path.join(geminiSource, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(geminiDest, file));
    }
  }

  // Create trustedFolders.json to avoid "untrusted folder" errors
  // Format is: { "/path/to/folder": "TRUST_FOLDER" }
  const trustedFolders = {
    [absoluteTargetDir]: "TRUST_FOLDER",
    [projectRoot]: "TRUST_FOLDER"
  };
  try {
    // geminiDest is .../.gemini/jetski, we need .../.gemini/trustedFolders.json
    const geminiRootDest = path.dirname(geminiDest);
    fs.writeFileSync(
      path.join(geminiRootDest, 'trustedFolders.json'),
      JSON.stringify(trustedFolders, null, 2)
    );
  } catch (e) {
    console.error('Failed to create trustedFolders.json:', e);
  }

  // Set environment variables for the child process and the current process
  process.env.HOME = tempHome;
  process.env.JETSKI_DIR = geminiDest;

  // Re-sync config's jetskiDir now that environment variables are set
  // (In TS we import it so we update the object)
  config.jetskiDir = geminiDest;

  return tempHome;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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
    fs.writeFileSync(outputPath, JSON.stringify(info, null, 2), 'utf8');

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

    console.log(`Successfully saved Jetski info to ${outputPath}`);
    return info;

  } catch (error: any) {
    console.error('Failed to extract version info:', error.message);
    throw error;
  }
}

function killProcessOnPort(port: number | string): void {
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

/**
 * @param {string} directory
 * @param {string} profileDir
 */
async function startJetski(directory: string, profileDir: string): Promise<void> {
  // Kill anything on the debug port first
  killProcessOnPort(config.jetskiDebugPort);

  console.log(`Starting Jetski with directory: ${directory}`);
  console.log(`User Data Directory: ${profileDir}`);

  const jetskiProcess = spawn(config.jetskiBin, [
    `--remote-debugging-port=${config.jetskiDebugPort}`,
    `--user-data-dir=${profileDir}`,
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
    } catch (e: any) {
      console.log(`Connection attempt ${i + 1} failed: ${e.message}`);
      await sleep(1000);
    }
  }
  throw new Error("Timeout waiting for Jetski to start");
}

async function run(): Promise<void> {
  let testHomeDir: string | null = null;
  try {
    // Setup isolated environment and MCP config
    testHomeDir = setupIsolatedHome();
    updateMcpConfig(path.join(config.jetskiDir, 'mcp_config.json'), runType, config.mcpApiKey);

    // Use stable user data dir to persist state (welcome screen, etc.)
    const profileDir = config.jetskiProfileDir;
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }
    await startJetski(absoluteTargetDir, profileDir);

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
    let jetskiInfoPath = path.join(absoluteTargetDir, 'jetski_info.json');
    const resultsMatch = absoluteTargetDir.match(/(.*[/\\]results[/\\]test_[^/\\]+)/);
    if (resultsMatch) {
      jetskiInfoPath = path.join(resultsMatch[1], 'jetski_info.json');
    }

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
      const chatLogPath = path.resolve(absoluteTargetDir, 'chat_log.txt');
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

  } catch (err) {
    console.error("Error during execution:", err);
    process.exit(1);
  } finally {
    killProcessOnPort(config.jetskiDebugPort);
    if (testHomeDir && fs.existsSync(testHomeDir)) {
      console.log(`
=== Cleaning up isolated HOME ===`);
      try {
        fs.rmSync(testHomeDir, { recursive: true, force: true });
        console.log('✅ Cleanup successful');
      } catch (cleanupErr) {
        console.error('Failed to cleanup isolated HOME:', cleanupErr);
      }
    }
  }
}

run();
