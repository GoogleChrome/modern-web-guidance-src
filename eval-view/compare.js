/// <reference path="./evals.d.ts" />
import { getAccessToken, capitalize, normalizeTrajectoryClient, parseResultKey, escapeHtml, $ } from './utils.js';

/**
 * @import { EvalsReport } from '../harness/lib/metrics.ts'
 * @import { StandardizedStep, TrajectorySummary } from '../harness/lib/trajectory-normalizer.ts'
 * @import { SelectedTrialPoint, CompareSide, SuiteReport, CompareStep, CompareTrajectory } from './evals.d.ts'
 *
 * @typedef {Object} AlignedStepPair
 * @property {CompareStep | null} stepA
 * @property {CompareStep | null} stepB
 *
 * @typedef {Object} DivergenceInfo
 * @property {number | null} primaryStepA
 * @property {number | null} primaryStepB
 *
 * @typedef {Object} AssertionResult
 * @property {string} message
 * @property {boolean} passed
 *
 * @typedef {Object} PlaywrightSpec
 * @property {string} title
 * @property {boolean} [ok]
 *
 * @typedef {Object} PlaywrightSuite
 * @property {PlaywrightSpec[]} [specs]
 * @property {PlaywrightSuite[]} [suites]
 *
 * @typedef {Object} PlaywrightReport
 * @property {PlaywrightSuite[]} [suites]
 */

// Cross-Run Performance Variance Diagnosis Dashboard JavaScript

/** @type {'assertions' | 'timeline' | 'code'} */
let currentTab = 'assertions';
let activeTask = '';
/** @type {string[]} */
let availableTasks = [];
/** @type {'milestone' | 'raw'} */
let timelineViewMode = 'milestone'; // 'milestone' | 'raw'
let guideName = '';
let isStatic = false;

/**
 * Factory for creating a side of the trial comparison
 * @param {'A' | 'B'} key
 * @param {string} label
 * @returns {CompareSide}
 */
function createCompareSide(key, label) {
  return {
    key,
    label,
    testId: '',
    trialId: '',
    runNum: '1',
    runIndex: undefined,
    agent: '',
    model: '',
    scoreParam: null,
    score: 0,
    runType: 'guided',
    runDir: '',
    suiteData: null,
    trajectory: null,
    chatLog: '',
  };
}

const sideA = createCompareSide('A', 'Trial A');
const sideB = createCompareSide('B', 'Trial B');

/**
 * Robust line-by-line markdown to HTML compiler with ANSI stripping & GFM Table support
 * @param {string | null | undefined} md
 * @returns {string}
 */
function renderMarkdown(md) {
  if (!md) return '';
  
  // Strip ANSI escape sequences (e.g. \x1b[36m)
  const cleanMd = md.replace(new RegExp(String.fromCharCode(27) + '\\[[0-9;]*[a-zA-Z]', 'g'), '').trim();
  
  const lines = cleanMd.split('\n');
  let html = '';
  let inList = false;
  let inParagraph = false;
  let inCodeBlock = false;
  let inTable = false;
  let codeLanguage = '';
  /** @type {string[]} */
  let codeContent = [];
  /** @type {string[]} */
  let tableHeaders = [];
  /** @type {string[]} */
  let tableAlignments = [];
  /** @type {string[][]} */
  let tableRows = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    // 1. Handle Code Blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        html += `<pre><code class="language-${codeLanguage}">${codeContent.join('\n')}</code></pre>`;
        inCodeBlock = false;
        codeContent = [];
      } else {
        inCodeBlock = true;
        codeLanguage = line.substring(3).trim();
      }
      continue;
    }
    
    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }
    
    // Escape HTML in non-code lines
    line = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
      
    if (!line) {
      if (inTable) {
        html += renderTableHtml(tableHeaders, tableAlignments, tableRows);
        inTable = false;
        tableHeaders = [];
        tableAlignments = [];
        tableRows = [];
      }
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      if (inParagraph) {
        html += '</p>';
        inParagraph = false;
      }
      continue;
    }

    // 2. Handle Tables
    const isTableLine = line.startsWith('|') && line.endsWith('|');
    if (inTable && !isTableLine) {
      html += renderTableHtml(tableHeaders, tableAlignments, tableRows);
      inTable = false;
      tableHeaders = [];
      tableAlignments = [];
      tableRows = [];
    }

    if (isTableLine) {
      if (inParagraph) { html += '</p>'; inParagraph = false; }
      if (inList) { html += '</ul>'; inList = false; }
      
      if (!inTable) {
        // Look ahead to check if the next line is a divider
        const nextLine = (lines[i+1] || '').trim();
        const escapedNextLine = nextLine
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        const isNextDivider = escapedNextLine.startsWith('|') && /^[\s|:-]+$/.test(escapedNextLine);
        
        if (isNextDivider) {
          inTable = true;
          tableRows = [];
          
          const cells = line.split('|').map(c => c.trim()).filter((_c, idx, arr) => idx > 0 && idx < arr.length - 1);
          tableHeaders = cells;
          
          const dividerCells = escapedNextLine.split('|').map(c => c.trim()).filter((_c, idx, arr) => idx > 0 && idx < arr.length - 1);
          tableAlignments = dividerCells.map(cell => {
            const left = cell.startsWith(':');
            const right = cell.endsWith(':');
            if (left && right) return 'center';
            if (right) return 'right';
            return 'left';
          });
          
          i++; // Skip the divider line
          continue;
        }
      } else {
        const cells = line.split('|').map(c => c.trim()).filter((_c, idx, arr) => idx > 0 && idx < arr.length - 1);
        tableRows.push(cells);
        continue;
      }
    }
    
    // 3. Handle Headings
    if (line.startsWith('#')) {
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        if (inList) { html += '</ul>'; inList = false; }
        if (inParagraph) { html += '</p>'; inParagraph = false; }
        const level = match[1].length;
        html += `<h${level}>${parseInline(match[2])}</h${level}>`;
        continue;
      }
    }
    
    // 4. Handle Lists
    const listMatch = line.match(/^([-*+])\s+(.*)$/);
    if (listMatch) {
      if (inParagraph) { html += '</p>'; inParagraph = false; }
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${parseInline(listMatch[2])}</li>`;
      continue;
    }
    
    // 5. Handle Horizontal Rules
    if (line === '---' || line === '***') {
      if (inList) { html += '</ul>'; inList = false; }
      if (inParagraph) { html += '</p>'; inParagraph = false; }
      html += '<hr>';
      continue;
    }
    
    // 6. Handle Paragraphs
    if (!inParagraph) {
      html += '<p>';
      inParagraph = true;
      html += parseInline(line);
    } else {
      html += '<br>' + parseInline(line);
    }
  }
  
  if (inTable) html += renderTableHtml(tableHeaders, tableAlignments, tableRows);
  if (inList) html += '</ul>';
  if (inParagraph) html += '</p>';
  if (inCodeBlock) html += `<pre><code>${codeContent.join('\n')}</code></pre>`;
  
  return html;
}

/**
 * Helper to compile a parsed markdown table into structured HTML
 * @param {string[]} headers
 * @param {string[]} alignments
 * @param {string[][]} rows
 * @returns {string}
 */
function renderTableHtml(headers, alignments, rows) {
  let html = '<table class="markdown-table">';
  
  // Header Row
  html += '<thead><tr>';
  headers.forEach((h, idx) => {
    const align = alignments[idx] || 'left';
    html += `<th style="text-align:${align}">${parseInline(h)}</th>`;
  });
  html += '</tr></thead>';
  
  // Body Rows
  html += '<tbody>';
  rows.forEach(row => {
    html += '<tr>';
    for (let idx = 0; idx < headers.length; idx++) {
      const cell = row[idx] || '';
      const align = alignments[idx] || 'left';
      html += `<td style="text-align:${align}">${parseInline(cell)}</td>`;
    }
    html += '</tr>';
  });
  html += '</tbody></table>';
  
  return html;
}

/**
 * @param {string} text
 * @returns {string}
 */
function parseInline(text) {
  // Bold: **text**
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic: *text*
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Inline code: `code`
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  return text;
}

/**
 * @param {CompareSide} side
 * @param {'A' | 'B'} key
 * @param {URLSearchParams} urlParams
 */
function initSideFromParams(side, key, urlParams) {
  side.trialId = urlParams.get(`trial${key}`) || (key === 'B' ? sideA.trialId : '');
  side.testId = side.trialId;
  const rawRunIndex = urlParams.get(`runIndex${key}`);
  side.runIndex = rawRunIndex ? parseInt(rawRunIndex, 10) : undefined;
  side.agent = urlParams.get(`agent${key}`) || '';
  side.model = urlParams.get(`model${key}`) || '';
  side.scoreParam = urlParams.get(`score${key}`);
  side.runType = /** @type {'guided' | 'unguided'} */ (urlParams.get(`runType${key}`) || 'guided');
  side.runNum = urlParams.get(`run${key}`) || (side.runIndex !== undefined ? String(side.runIndex) : (key === 'B' && sideA.trialId === side.trialId ? '2' : '1'));
}

/**
 * Extract query parameters
 * @returns {boolean}
 */
function initParams() {
  const urlParams = new URLSearchParams(window.location.search);
  guideName = urlParams.get('guide') || '';
  isStatic = urlParams.get('source') === 'static' || window.location.hostname.includes('github.io');

  initSideFromParams(sideA, 'A', urlParams);
  initSideFromParams(sideB, 'B', urlParams);

  // Initialize dropdown selections
  const elA = /** @type {HTMLSelectElement | null} */ (document.getElementById('run-type-a'));
  const elB = /** @type {HTMLSelectElement | null} */ (document.getElementById('run-type-b'));
  if (elA) elA.value = sideA.runType;
  if (elB) elB.value = sideB.runType;

  // Set up dropdown change listeners
  elA?.addEventListener('change', async (e) => {
    const target = /** @type {HTMLSelectElement | null} */ (e.target);
    if (target) {
      sideA.runType = /** @type {'guided' | 'unguided'} */ (target.value);
      await handleRunTypeChange();
    }
  });
  elB?.addEventListener('change', async (e) => {
    const target = /** @type {HTMLSelectElement | null} */ (e.target);
    if (target) {
      sideB.runType = /** @type {'guided' | 'unguided'} */ (target.value);
      await handleRunTypeChange();
    }
  });

  // Back button setup
  const backBtn = /** @type {HTMLAnchorElement | null} */ (document.getElementById('back-btn'));
  if (backBtn) {
    backBtn.href = `guide.html?guide=${guideName}&source=${isStatic ? 'static' : 'local'}`;
  }

  if (!sideA.trialId || !guideName) {
    $('#compare-title').innerText = 'Error: Missing Parameters';
    alert('Missing required parameters: trialA and guide are required.');
    return false;
  }

  // Update browser tab title with active guide name
  document.title = `${guideName} - AI Variance Diagnosis`;
  $('#compare-title').innerHTML = `Cross-Run Variance Diagnosis <span style="font-weight: 400; color: #64748b;">(${guideName})</span>`;
  return true;
}

/**
 * Handles reloading of workspace files and resetting diagnosis state when run type is toggled.
 * @returns {Promise<void>}
 */
async function handleRunTypeChange() {
  updateExecutiveSummary();
  await loadActiveTaskDetails();
  resetDiagnosisUI();
}

/**
 * Streams a ReadableStream response into a <pre> element with throttled rendering.
 * @param {ReadableStream<Uint8Array>} body
 * @param {HTMLElement | null} logElement
 * @returns {Promise<string>}
 */
async function streamBodyToElement(body, logElement) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let accumulatedText = '';
  let lastUpdate = 0;
  let updatePending = false;

  function updateDOM() {
    if (logElement) {
      logElement.textContent = accumulatedText;
      logElement.scrollTop = logElement.scrollHeight;
    }
    updatePending = false;
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    accumulatedText += decoder.decode(value, { stream: true });

    const now = performance.now();
    if (now - lastUpdate > 100) {
      updateDOM();
      lastUpdate = now;
    } else if (!updatePending) {
      updatePending = true;
      requestAnimationFrame(() => {
        if (updatePending) {
          updateDOM();
          lastUpdate = performance.now();
        }
      });
    }
  }
  updateDOM();
  return accumulatedText;
}

/**
 * @param {string} dirA
 * @param {string} dirB
 * @returns {Promise<void>}
 */
async function ensureRunDirectories(dirA, dirB) {
  if (isStatic) return;
  try {
    /** @type {Record<string, string>} */
    const headers = {};
    const token = typeof getAccessToken === 'function' ? getAccessToken() : null;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`/api/ensure-run?dirA=${encodeURIComponent(dirA)}&dirB=${encodeURIComponent(dirB)}`, { headers });
    if (!response.ok || !response.body) return;

    const diagnosisBox = document.getElementById('diagnosis-box');
    const diagnosisText = document.getElementById('diagnosis-text');
    const compareLoading = document.getElementById('compare-loading');

    if (diagnosisBox && diagnosisText) {
      diagnosisBox.style.display = 'block';
      diagnosisText.innerHTML = `
        <div style="font-size:0.9em; font-weight:600; color:#2563eb; margin-bottom:8px; display:flex; align-items:center; gap:8px;">
          <div class="spinner" style="width:16px; height:16px; border-width:2px; margin-bottom:0; border-top-color:#2563eb;"></div>
          <span>Synchronizing run files from GCS (Downloading if missing)...</span>
        </div>
        <pre id="compare-log-stream" style="font-family:monospace; font-size:0.85em; background:#ffffff; border:1px solid #bfdbfe; padding:12px; border-radius:6px; overflow-x:auto; max-height:250px; overflow-y:auto; margin:0; white-space:pre-wrap; color:#334155; line-height:1.4; box-shadow:inset 0 1px 2px rgba(0,0,0,0.05);"></pre>
      `;
      if (compareLoading) {
        const loadingMsg = compareLoading.querySelector('div:last-child');
        if (loadingMsg) loadingMsg.textContent = 'Downloading required run files from GCS... (See progress below)';
      }

      const logPre = document.getElementById('compare-log-stream');
      await streamBodyToElement(response.body, logPre);
    }
  } catch (e) {
    console.warn('Failed to ensure run directories locally:', e);
  }
}

/**
 * @returns {Promise<void>}
 */
async function loadTrialMetadata() {
  const resultsBase = isStatic ? 'results' : '';
  const srcParam = isStatic ? '' : '?source=local';
  
  const guideLinkEl = /** @type {HTMLAnchorElement | null} */ (document.getElementById('summary-guide-link'));
  if (guideLinkEl) {
    guideLinkEl.innerText = guideName;
    guideLinkEl.href = `guide.html?guide=${encodeURIComponent(guideName)}&source=${encodeURIComponent(isStatic ? 'local' : (new URLSearchParams(window.location.search).get('source') || 'local'))}`;
  }
  
  // Ensure suite directories exist locally
  await ensureRunDirectories(sideA.trialId, sideB.trialId);

  // Fetch Trial A suite metadata
  try {
    const responseA = await fetch(`${resultsBase}/${sideA.trialId}/evals.json${srcParam}`);
    if (responseA.ok) {
      sideA.suiteData = /** @type {SuiteReport} */ (await responseA.json());
    }
  } catch (e) {
    console.error('Failed to load Trial A suite data:', e);
  }

  // Fetch Trial B suite metadata
  try {
    if (sideA.trialId !== sideB.trialId) {
      const responseB = await fetch(`${resultsBase}/${sideB.trialId}/evals.json${srcParam}`);
      if (responseB.ok) {
        sideB.suiteData = /** @type {SuiteReport} */ (await responseB.json());
      }
    } else {
      sideB.suiteData = sideA.suiteData;
    }
  } catch (e) {
    console.error('Failed to load Trial B suite data:', e);
  }

  // Determine tasks belonging to this guide in Trial A and Trial B
  /** @type {Set<string>} */
  const tasksA = new Set();
  /** @type {Set<string>} */
  const tasksB = new Set();

  if (sideA.suiteData?.results) {
    Object.keys(sideA.suiteData.results).forEach(key => {
      const parsedKey = parseResultKey(key);
      if (parsedKey && parsedKey.guide === guideName) {
        tasksA.add(parsedKey.task);
      }
    });
  }

  if (sideB.suiteData?.results) {
    Object.keys(sideB.suiteData.results).forEach(key => {
      const parsedKey = parseResultKey(key);
      if (parsedKey && parsedKey.guide === guideName) {
        tasksB.add(parsedKey.task);
      }
    });
  }

  const allTasksSet = new Set([...tasksA, ...tasksB]);
  const commonTasks = Array.from(tasksA).filter(t => tasksB.has(t)).sort();

  availableTasks = Array.from(allTasksSet).sort();
  if (availableTasks.length === 0) {
    availableTasks = ['task'];
  }

  // Prefer a common task that exists in both trials as the default active task
  activeTask = commonTasks.length > 0 ? commonTasks[0] : availableTasks[0];
  
  // Populate sidebar
  populateSidebar();

  // Populate Executive Cards
  updateExecutiveSummary();

  // Load active task details
  await loadActiveTaskDetails();

  // Reset Diagnosis UI state
  resetDiagnosisUI();
}

/**
 * @param {SuiteReport | null | undefined} suiteData
 * @param {string} task
 * @returns {boolean}
 */
function checkTaskInSuite(suiteData, task) {
  if (!suiteData || !suiteData.results) return false;
  return Object.keys(suiteData.results).some(key => {
    const parsedKey = parseResultKey(key);
    return parsedKey && parsedKey.guide === guideName && parsedKey.task === task;
  });
}

/**
 * @returns {void}
 */
function populateSidebar() {
  const sidebarList = $('#task-sidebar-list');
  sidebarList.innerHTML = '';
  availableTasks.forEach(task => {
    const btn = document.createElement('button');
    btn.className = `task-btn ${task === activeTask ? 'active' : ''}`;
    
    const inA = sideA.suiteData ? checkTaskInSuite(sideA.suiteData, task) : true;
    const inB = sideB.suiteData ? checkTaskInSuite(sideB.suiteData, task) : true;
    
    let taskLabel = task;
    if (!inA && inB) {
      taskLabel = `${task} (Trial B only)`;
    } else if (inA && !inB) {
      taskLabel = `${task} (Trial A only)`;
    }

    btn.innerText = taskLabel;
    btn.onclick = () => switchTask(task);
    sidebarList.appendChild(btn);
  });
}

/**
 * @returns {void}
 */
function updateExecutiveSummary() {
  const displayRunA = sideA.runIndex !== undefined ? sideA.runIndex : sideA.runNum;
  const displayRunB = sideB.runIndex !== undefined ? sideB.runIndex : sideB.runNum;

  // Trial A
  $('#title-a').innerText = `${sideA.trialId.slice(0, 18)} (Run ${displayRunA})`;
  $('#meta-a').innerText = sideA.trialId.includes('test-') ? `Date: ${sideA.trialId.replace('test-', '').slice(0, 10)}` : 'Historical Suite';
  
  const displayAgentA = sideA.agent || sideA.suiteData?.agent || 'Unknown';
  const displayModelA = sideA.model || sideA.suiteData?.model || 'Unknown';
  $('#agent-model-a').innerText = `Agent: ${displayAgentA} | Model: ${displayModelA}`;

  // Trial B
  if (sideA.trialId === sideB.trialId) {
    $('#title-b').innerText = `${sideA.trialId.slice(0, 18)} (Run ${displayRunB})`;
    $('#meta-b').innerText = 'Within-Trial Non-determinism Check';
  } else {
    $('#title-b').innerText = `${sideB.trialId.slice(0, 18)} (Run ${displayRunB})`;
    $('#meta-b').innerText = sideB.trialId.includes('test-') ? `Date: ${sideB.trialId.replace('test-', '').slice(0, 10)}` : 'Historical Suite';
  }
  
  const displayAgentB = sideB.agent || sideB.suiteData?.agent || 'Unknown';
  const displayModelB = sideB.model || sideB.suiteData?.model || 'Unknown';
  $('#agent-model-b').innerText = `Agent: ${displayAgentB} | Model: ${displayModelB}`;

  // Calculate Scores for the specific guide across active run types and runs
  sideA.score = sideA.suiteData ? calculateGuideScore(sideA.suiteData, sideA.runNum, sideA.runType) : (sideA.scoreParam !== null ? parseInt(sideA.scoreParam, 10) : 0);
  sideB.score = sideB.suiteData ? calculateGuideScore(sideB.suiteData, sideB.runNum, sideB.runType) : (sideB.scoreParam !== null ? parseInt(sideB.scoreParam, 10) : 0);

  const badgeA = $('#score-badge-a');
  badgeA.innerText = `${sideA.score}%`;
  badgeA.className = `score-badge ${sideA.score >= 70 ? 'score-high' : 'score-low'}`;

  const badgeB = $('#score-badge-b');
  badgeB.innerText = `${sideB.score}%`;
  badgeB.className = `score-badge ${sideB.score >= 70 ? 'score-high' : 'score-low'}`;

  const delta = sideB.score - sideA.score;
  const deltaText = delta === 0 ? 'No change (0%)' : delta > 0 ? `+${delta}% Improvement` : `${delta}% Regression`;
  const deltaSpan = $('#summary-delta');
  deltaSpan.innerText = deltaText;
  deltaSpan.style.color = delta === 0 ? '#475569' : delta > 0 ? '#166534' : '#991b1b';

  const guideLinkEl = /** @type {HTMLAnchorElement | null} */ (document.getElementById('summary-guide-link'));
  if (guideLinkEl) {
    guideLinkEl.innerText = guideName;
    guideLinkEl.href = `guide.html?guide=${encodeURIComponent(guideName)}&source=${encodeURIComponent(isStatic ? 'local' : (new URLSearchParams(window.location.search).get('source') || 'local'))}`;
  }
}

/**
 * @param {SuiteReport | null | undefined} suiteData
 * @param {string | number} runNum
 * @param {string} [runType]
 * @returns {number}
 */
function calculateGuideScore(suiteData, runNum, runType) {
  if (!suiteData || !suiteData.results) return 0;
  
  let totalAsserts = 0;
  let passedAsserts = 0;
  
  const targetRunType = runType || 'guided';
  const targetRunNum = typeof runNum === 'number' ? runNum : parseInt(runNum, 10);

  Object.keys(suiteData.results).forEach(key => {
    const parsedKey = parseResultKey(key);
    if (!parsedKey) return;
    if (parsedKey.guide === guideName && parsedKey.runType === targetRunType) {
      const runs = suiteData.results[key] || [];
      const matchingRuns = (!isNaN(targetRunNum) && runs.some(r => r.runNumber === targetRunNum))
        ? runs.filter(r => r.runNumber === targetRunNum)
        : runs;

      matchingRuns.forEach(r => {
        if (r.results && Array.isArray(r.results)) {
          totalAsserts += r.results.length;
          passedAsserts += r.results.filter(check => check.passed).length;
        }
      });
    }
  });

  return totalAsserts > 0 ? Math.round((passedAsserts / totalAsserts) * 100) : 0;
}

/**
 * @param {string} task
 * @returns {Promise<void>}
 */
async function switchTask(task) {
  if (activeTask === task) return;
  activeTask = task;
  
  // Update sidebar active state
  document.querySelectorAll('.task-btn').forEach(btn => {
    btn.classList.toggle('active', (btn.textContent || '').trim() === activeTask);
  });

  await loadActiveTaskDetails();
  resetDiagnosisUI();
}

/**
 * @param {string | null | undefined} trialId
 * @returns {string}
 */
function getRunDateString(trialId) {
  if (!trialId) return 'Unknown Date';
  const match = trialId.match(/\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  if (trialId.includes('test-')) return trialId.replace('test-', '').slice(0, 10);
  return trialId.slice(0, 12);
}

/**
 * Helper to format human-readable title for split-pane views
 * @param {CompareSide} side
 * @param {CompareTrajectory | null} [trajOverride]
 * @returns {string}
 */
function getFormattedTrialTitle(side, trajOverride) {
  const traj = trajOverride !== undefined ? trajOverride : side.trajectory;
  const dateStr = getRunDateString(side.trialId);
  const resolvedAgent = side.agent && side.agent !== 'unknown' ? side.agent : (traj?.agent || side.suiteData?.agent || 'Unknown Agent');
  const resolvedModel = (side.model && side.model !== 'unknown' ? side.model : (traj?.model || side.suiteData?.model || 'Unknown Model')).replace(/^models\//, '');
  const activeRunNum = side.runIndex !== undefined ? side.runIndex : side.runNum;
  return `${side.label} (Run ${activeRunNum} - ${capitalize(side.runType || 'guided')}) — agent: ${resolvedAgent} model: ${resolvedModel} (${dateStr})`;
}

/**
 * @returns {Promise<void>}
 */
async function loadActiveTaskDetails() {
  $('#compare-loading').style.display = 'flex';
  $('#tab-content-assertions').style.display = 'none';
  $('#tab-content-timeline').style.display = 'none';
  $('#tab-content-code').style.display = 'none';

  const resultsBase = isStatic ? 'results' : '';
  
  // Format run directory paths using active run types
  const pathPartA = `${sideA.trialId}/${sideA.runNum}/${guideName}/${activeTask}/${sideA.runType}`;
  const pathPartB = `${sideB.trialId}/${sideB.runNum}/${guideName}/${activeTask}/${sideB.runType}`;
  
  sideA.runDir = `${resultsBase}/${pathPartA}`;
  sideB.runDir = `${resultsBase}/${pathPartB}`;

  // Update split-pane column titles to display both run number and run type
  const titleAStr = getFormattedTrialTitle(sideA);
  const titleBStr = getFormattedTrialTitle(sideB);

  const timelineTitleA = document.getElementById('timeline-title-a');
  if (timelineTitleA) timelineTitleA.innerText = titleAStr;
  const timelineTitleB = document.getElementById('timeline-title-b');
  if (timelineTitleB) timelineTitleB.innerText = titleBStr;
  const codeTitleA = document.getElementById('code-title-a');
  if (codeTitleA) codeTitleA.innerText = titleAStr;
  const codeTitleB = document.getElementById('code-title-b');
  if (codeTitleB) codeTitleB.innerText = titleBStr;
  const headerAssertA = document.getElementById('header-assert-a');
  if (headerAssertA) headerAssertA.innerText = titleAStr;
  const headerAssertB = document.getElementById('header-assert-b');
  if (headerAssertB) headerAssertB.innerText = titleBStr;

  // 0. Ensure run directories exist locally before fetching tab data
  await ensureRunDirectories(pathPartA, pathPartB);

  // 1. Load Assertions Comparison
  await loadAssertions(pathPartA, pathPartB);

  // 2. Load Trajectory Timelines
  await loadTrajectories(pathPartA, pathPartB);

  // 3. Load Code Output Diffs
  await loadCodeOutputs(pathPartA, pathPartB);

  $('#compare-loading').style.display = 'none';
  switchTab(currentTab);
}

/**
 * Recursively parses Playwright's JSON report and extracts a flat array of assertions.
 * @param {PlaywrightReport | null | undefined} report
 * @returns {AssertionResult[]}
 */
function parsePlaywrightResults(report) {
  /** @type {AssertionResult[]} */
  const assertions = [];
  if (!report || !Array.isArray(report.suites)) {
    return assertions;
  }
  
  /**
   * @param {PlaywrightSuite} suite
   */
  function collectSpecs(suite) {
    if (Array.isArray(suite.specs)) {
      suite.specs.forEach((spec) => {
        assertions.push({
          message: spec.title,
          passed: !!spec.ok
        });
      });
    }
    if (Array.isArray(suite.suites)) {
      suite.suites.forEach(collectSpecs);
    }
  }

  report.suites.forEach(collectSpecs);
  return assertions;
}

/**
 * @param {string} pathA
 * @param {string} pathB
 * @returns {Promise<void>}
 */
async function loadAssertions(pathA, pathB) {
  const resultsBase = isStatic ? 'results' : '';
  const srcParam = isStatic ? '' : '?source=local';
  const tbody = $('tbody#assert-tbody');
  tbody.innerHTML = '';

  /** @type {AssertionResult[]} */
  let resultsA = [];
  /** @type {AssertionResult[]} */
  let resultsB = [];

  // Fetch Run A results JSON
  try {
    let resA = await fetch(`${resultsBase}/${pathA}/${guideName}_results.json${srcParam}`);
    if (!resA.ok) {
      const filesResA = await fetch(`/api/run-files?dir=${encodeURIComponent(pathA)}&source=local`);
      if (filesResA.ok) {
        /** @type {string[]} */
        const filesA = (await filesResA.json()).files || [];
        const resFile = filesA.find((/** @type {string} */ f) => f.endsWith('_results.json'));
        if (resFile) resA = await fetch(`${resultsBase}/${pathA}/${resFile}${srcParam}`);
      }
    }
    if (resA.ok) {
      const rawA = /** @type {PlaywrightReport} */ (await resA.json());
      resultsA = parsePlaywrightResults(rawA);
    }
  } catch (e) {}

  // Fetch Run B results JSON
  try {
    let resB = await fetch(`${resultsBase}/${pathB}/${guideName}_results.json${srcParam}`);
    if (!resB.ok) {
      const filesResB = await fetch(`/api/run-files?dir=${encodeURIComponent(pathB)}&source=local`);
      if (filesResB.ok) {
        /** @type {string[]} */
        const filesB = (await filesResB.json()).files || [];
        const resFile = filesB.find((/** @type {string} */ f) => f.endsWith('_results.json'));
        if (resFile) resB = await fetch(`${resultsBase}/${pathB}/${resFile}${srcParam}`);
      }
    }
    if (resB.ok) {
      const rawB = /** @type {PlaywrightReport} */ (await resB.json());
      resultsB = parsePlaywrightResults(rawB);
    }
  } catch (e) {}

  // Update Assertion table column headers with task-specific pass rate
  const titleAStr = getFormattedTrialTitle(sideA);
  const titleBStr = getFormattedTrialTitle(sideB);
  if (resultsA.length > 0) {
    const passedA = resultsA.filter(r => r.passed).length;
    const taskScoreA = Math.round((passedA / resultsA.length) * 100);
    const headerA = document.getElementById('header-assert-a');
    if (headerA) headerA.innerText = `${titleAStr} [Task: ${taskScoreA}%]`;
  }
  if (resultsB.length > 0) {
    const passedB = resultsB.filter(r => r.passed).length;
    const taskScoreB = Math.round((passedB / resultsB.length) * 100);
    const headerB = document.getElementById('header-assert-b');
    if (headerB) headerB.innerText = `${titleBStr} [Task: ${taskScoreB}%]`;
  }

  // Merge assertions list to compare side-by-side
  const allAssertionMessages = Array.from(new Set([
    ...resultsA.map(r => r.message),
    ...resultsB.map(r => r.message)
  ]));

  if (allAssertionMessages.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#64748b;">No assertion results found for this task.</td></tr>';
    return;
  }

  allAssertionMessages.forEach(msg => {
    const checkA = resultsA.find(r => r.message === msg);
    const checkB = resultsB.find(r => r.message === msg);

    const tr = document.createElement('tr');
    
    // Check text
    const tdMsg = document.createElement('td');
    tdMsg.innerText = msg;
    tr.appendChild(tdMsg);

    // Trial A status
    const tdA = document.createElement('td');
    if (checkA) {
      tdA.innerHTML = checkA.passed ? '<span class="pass-icon">✓ PASS</span>' : '<span class="fail-icon">✗ FAIL</span>';
    } else {
      tdA.innerText = 'N/A';
    }
    tr.appendChild(tdA);

    // Trial B status
    const tdB = document.createElement('td');
    if (checkB) {
      tdB.innerHTML = checkB.passed ? '<span class="pass-icon">✓ PASS</span>' : '<span class="fail-icon">✗ FAIL</span>';
    } else {
      tdB.innerText = 'N/A';
    }
    tr.appendChild(tdB);

    tbody.appendChild(tr);
  });
}

/**
 * @param {CompareTrajectory | null | undefined} traj
 * @param {string} pathStr
 * @param {string} resultsBase
 * @returns {Promise<void>}
 */
async function enrichTrajectorySteps(traj, pathStr, resultsBase) {
  if (!traj || !Array.isArray(traj.steps)) return;
  const srcParam = isStatic ? '' : '?source=local';
  try {
    const logRes = await fetch(`${resultsBase}/${pathStr}/modern-web.log${srcParam}`);
    if (logRes.ok) {
      const logText = await logRes.text();
      const lines = logText.split('\n').filter(Boolean);
      /** @type {any[]} */
      const logCalls = [];
      for (const line of lines) {
        if (line.trim().startsWith('{')) {
          try { logCalls.push(JSON.parse(line)); } catch {}
        }
      }
      let searchIdx = 0;
      for (const step of traj.steps) {
        if (step.action && (step.action.name === 'get_best_practices' || step.action.type === 'web_search' || step.action.name === 'search_use_cases')) {
          if (logCalls[searchIdx]) {
            if (!step.outcome) step.outcome = { status: 'success' };
            if (typeof step.outcome !== 'string') {
              step.outcome.output = logCalls[searchIdx].result;
            }
            searchIdx++;
          }
        }
      }
    }
  } catch (e) {}
}

/**
 * @param {string} pathA
 * @param {string} pathB
 * @returns {Promise<void>}
 */
async function loadTrajectories(pathA, pathB) {
  const resultsBase = isStatic ? 'results' : '';
  const srcParam = isStatic ? '' : '?source=local';
  const container = $('#tab-content-timeline');
  container.innerHTML = '<div style="padding:20px; text-align:center; color:#64748b;">Loading aligned trajectories...</div>';

  /** @type {CompareTrajectory | null} */
  let trajA = null;
  /** @type {CompareTrajectory | null} */
  let trajB = null;
  let chatA = '';
  let chatB = '';
  let sessionUrlA = '';
  let sessionUrlB = '';

  try {
    const resA = await fetch(`${resultsBase}/${pathA}/trajectory_summary.json${srcParam}`);
    if (resA.ok) {
      trajA = /** @type {CompareTrajectory} */ (normalizeTrajectoryClient(await resA.json()));
      await enrichTrajectorySteps(trajA, pathA, resultsBase);
    }
  } catch (e) {}

  try {
    const resB = await fetch(`${resultsBase}/${pathB}/trajectory_summary.json${srcParam}`);
    if (resB.ok) {
      trajB = /** @type {CompareTrajectory} */ (normalizeTrajectoryClient(await resB.json()));
      await enrichTrajectorySteps(trajB, pathB, resultsBase);
    }
  } catch (e) {}

  try {
    const chatResA = await fetch(`${resultsBase}/${pathA}/chat_log.txt${srcParam}`);
    if (chatResA.ok) chatA = await chatResA.text();
  } catch (e) {}

  try {
    const chatResB = await fetch(`${resultsBase}/${pathB}/chat_log.txt${srcParam}`);
    if (chatResB.ok) chatB = await chatResB.text();
  } catch (e) {}

  try {
    const filesResA = await fetch(`/api/run-files?dir=${encodeURIComponent(pathA)}&source=local`);
    if (filesResA.ok) {
      /** @type {string[]} */
      const filesA = (await filesResA.json()).files || [];
      const sessionFileA = filesA.find((/** @type {string} */ f) => f.startsWith('session-') && !f.includes('-subagents-') && f.endsWith('.html')) || filesA.find((/** @type {string} */ f) => f.startsWith('session-') && f.endsWith('.html'));
      if (sessionFileA) sessionUrlA = `${resultsBase}/${pathA}/${sessionFileA}`;
    }
  } catch (e) {}

  try {
    const filesResB = await fetch(`/api/run-files?dir=${encodeURIComponent(pathB)}&source=local`);
    if (filesResB.ok) {
      /** @type {string[]} */
      const filesB = (await filesResB.json()).files || [];
      const sessionFileB = filesB.find((/** @type {string} */ f) => f.startsWith('session-') && !f.includes('-subagents-') && f.endsWith('.html')) || filesB.find((/** @type {string} */ f) => f.startsWith('session-') && f.endsWith('.html'));
      if (sessionFileB) sessionUrlB = `${resultsBase}/${pathB}/${sessionFileB}`;
    }
  } catch (e) {}

  sideA.trajectory = trajA;
  sideB.trajectory = trajB;
  sideA.chatLog = chatA;
  sideB.chatLog = chatB;
  renderTimelineRows(container, trajA, trajB, chatA, chatB, sessionUrlA, sessionUrlB);
}

/**
 * @param {CompareTrajectory | CompareStep[] | null | undefined} trajOrStepsA
 * @param {CompareTrajectory | CompareStep[] | null | undefined} trajOrStepsB
 * @param {'milestone' | 'raw'} [mode='milestone']
 * @returns {AlignedStepPair[]}
 */
function alignTrajectorySteps(trajOrStepsA, trajOrStepsB, mode = 'milestone') {
  /** @type {{ steps: CompareStep[], initialPrompt?: string }} */
  const trajAObj = (trajOrStepsA && !Array.isArray(trajOrStepsA)) ? trajOrStepsA : { steps: Array.isArray(trajOrStepsA) ? trajOrStepsA : [] };
  /** @type {{ steps: CompareStep[], initialPrompt?: string }} */
  const trajBObj = (trajOrStepsB && !Array.isArray(trajOrStepsB)) ? trajOrStepsB : { steps: Array.isArray(trajOrStepsB) ? trajOrStepsB : [] };

  let listA = trajAObj.steps || [];
  let listB = trajBObj.steps || [];

  if (mode === 'milestone') {
    const filterFn = (/** @type {CompareStep} */ s) => s.action?.canonicalCategory && s.action.canonicalCategory !== 'incidental_noise' && s.action.canonicalCategory !== 'launch';
    const filteredA = listA.filter(filterFn);
    const filteredB = listB.filter(filterFn);
    if (filteredA.length > 0 || filteredB.length > 0) {
      listA = filteredA;
      listB = filteredB;
    }
  }

  const m = listA.length;
  const n = listB.length;
  if (m === 0 && n === 0 && !trajAObj.initialPrompt && !trajBObj.initialPrompt) return [];

  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  const gapPenalty = -2;

  /**
   * @param {CompareStep} sA
   * @param {CompareStep} sB
   * @returns {number}
   */
  function matchScore(sA, sB) {
    let score = 0;
    const catA = sA.action?.canonicalCategory || 'other';
    const catB = sB.action?.canonicalCategory || 'other';
    if (catA === catB && catA !== 'other' && catA !== 'incidental_noise') score += 5;
    else if (catA !== catB && catA !== 'other' && catB !== 'other' && catA !== 'incidental_noise' && catB !== 'incidental_noise') score -= 6;

    const nameA = (sA.action?.name || '').toLowerCase().split(' ')[0];
    const nameB = (sB.action?.name || '').toLowerCase().split(' ')[0];
    if (nameA && nameA === nameB) score += 3;

    return score;
  }

  for (let i = 0; i <= m; i++) dp[i][0] = i * gapPenalty;
  for (let j = 0; j <= n; j++) dp[0][j] = j * gapPenalty;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const score = matchScore(listA[i - 1], listB[j - 1]);
      dp[i][j] = Math.max(
        dp[i - 1][j - 1] + score,
        dp[i - 1][j] + gapPenalty,
        dp[i][j - 1] + gapPenalty
      );
    }
  }

  /** @type {AlignedStepPair[]} */
  const aligned = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + matchScore(listA[i - 1], listB[j - 1])) {
      aligned.push({ stepA: listA[i - 1], stepB: listB[j - 1] });
      i--;
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j] === dp[i - 1][j] + gapPenalty)) {
      aligned.push({ stepA: listA[i - 1], stepB: null });
      i--;
    } else {
      aligned.push({ stepA: null, stepB: listB[j - 1] });
      j--;
    }
  }

  const alignedResult = aligned.reverse();

  // Prepend Step 0 (Starting Prompt / Harness Launch) when initialPrompt exists
  if (trajAObj.initialPrompt || trajBObj.initialPrompt || (!Array.isArray(trajOrStepsA) && !Array.isArray(trajOrStepsB))) {
    const promptA = trajAObj.initialPrompt || '';
    const promptB = trajBObj.initialPrompt || '';
    if (promptA || promptB) {
      /** @type {CompareStep | null} */
      const step0A = promptA ? {
        stepNumber: 0,
        thought: 'Harness launched agent with initial prompt',
        action: { type: 'launch', name: 'Starting Prompt / Launch', params: { prompt: promptA }, canonicalCategory: 'launch' },
        outcome: { status: 'success', output: promptA }
      } : null;
      /** @type {CompareStep | null} */
      const step0B = promptB ? {
        stepNumber: 0,
        thought: 'Harness launched agent with initial prompt',
        action: { type: 'launch', name: 'Starting Prompt / Launch', params: { prompt: promptB }, canonicalCategory: 'launch' },
        outcome: { status: 'success', output: promptB }
      } : null;
      alignedResult.unshift({ stepA: step0A, stepB: step0B });
    }
  }

  return alignedResult;
}

/**
 * @param {CompareTrajectory | null | undefined} trajA
 * @param {CompareTrajectory | null | undefined} trajB
 * @returns {DivergenceInfo}
 */
function findDivergenceInfo(trajA, trajB) {
  const aligned = alignTrajectorySteps(trajA, trajB, timelineViewMode);

  /** @type {number | null} */
  let primaryStepA = null;
  /** @type {number | null} */
  let primaryStepB = null;

  const diagnosisTextElement = document.getElementById('diagnosis-text');
  const diagnosisText = diagnosisTextElement ? diagnosisTextElement.innerText || '' : '';

  if (diagnosisText) {
    if (/Step 0/i.test(diagnosisText) || /Starting Prompt/i.test(diagnosisText) || /Harness Launch/i.test(diagnosisText) || /Initialization/i.test(diagnosisText)) {
      primaryStepA = 0;
      primaryStepB = 0;
    } else {
      const matchA = diagnosisText.match(/(?:Run|Trial)\s*A[^\d]*(?:Step|step)\s*(\d+)/i);
      const matchB = diagnosisText.match(/(?:Run|Trial)\s*B[^\d]*(?:Step|step)\s*(\d+)/i);
      if (matchA) primaryStepA = parseInt(matchA[1], 10);
      if (matchB) primaryStepB = parseInt(matchB[1], 10);

      if (primaryStepA === null && primaryStepB === null) {
        const match = diagnosisText.match(/Step\s*(?:Number)?[^\d]*(\d+)/i) ||
                      diagnosisText.match(/First\s+Meaningful\s+Divergence[^\d]*(\d+)/i) ||
                      diagnosisText.match(/Divergence.*?(?:Step|step)\s*(\d+)/i) ||
                      diagnosisText.match(/(?:Step|step)\s*(\d+)/i);
        if (match) {
          const stepVal = parseInt(match[1], 10);
          primaryStepA = stepVal;
          primaryStepB = stepVal;
        }
      }
    }
  }

  if (primaryStepA === null || primaryStepB === null) {
    for (let i = 0; i < aligned.length; i++) {
      const sA = aligned[i].stepA;
      const sB = aligned[i].stepB;

      if (!sA || !sB) {
        if (primaryStepA === null && sA) primaryStepA = sA.stepNumber;
        if (primaryStepB === null && sB) primaryStepB = sB.stepNumber;
        if (primaryStepA === null && primaryStepB === null) {
          primaryStepA = i + 1;
          primaryStepB = i + 1;
        }
        break;
      }

      if (sA.stepNumber === 0 && sB.stepNumber === 0) {
        const pA = (sA.outcome && typeof sA.outcome === 'object' ? sA.outcome.output || '' : '').trim();
        const pB = (sB.outcome && typeof sB.outcome === 'object' ? sB.outcome.output || '' : '').trim();
        if (pA && pB && pA !== pB) {
          primaryStepA = 0;
          primaryStepB = 0;
          break;
        }
        continue;
      }

      const aA = (sA.action?.name || '').toLowerCase();
      const aB = (sB.action?.name || '').toLowerCase();
      const catA = sA.action?.canonicalCategory || 'other';
      const catB = sB.action?.canonicalCategory || 'other';
      const isErrA = typeof sA.outcome === 'object' && sA.outcome !== null ? sA.outcome.status === 'error' : false;
      const isErrB = typeof sB.outcome === 'object' && sB.outcome !== null ? sB.outcome.status === 'error' : false;

      if (aA !== aB || catA !== catB || isErrA !== isErrB) {
        if (primaryStepA === null) primaryStepA = sA.stepNumber;
        if (primaryStepB === null) primaryStepB = sB.stepNumber;
        break;
      }
    }
  }

  return { primaryStepA, primaryStepB };
}

/**
 * @param {HTMLElement} container
 * @param {CompareTrajectory | null} trajA
 * @param {CompareTrajectory | null} trajB
 * @param {string} [chatA='']
 * @param {string} [chatB='']
 * @param {string} [sessionUrlA='']
 * @param {string} [sessionUrlB='']
 * @returns {void}
 */
function renderTimelineRows(container, trajA, trajB, chatA = '', chatB = '', sessionUrlA = '', sessionUrlB = '') {
  container.innerHTML = '';

  const aligned = alignTrajectorySteps(trajA, trajB, timelineViewMode);

  if (aligned.length === 0 && !chatA && !chatB) {
    container.innerHTML = '<div style="padding:30px; text-align:center; color:#64748b;">No normalized trajectory available. Ensure trajectory_summary.json is generated.</div>';
    return;
  }

  const { primaryStepA, primaryStepB } = findDivergenceInfo(trajA, trajB);

  const titleAStr = getFormattedTrialTitle(sideA, trajA);
  const titleBStr = getFormattedTrialTitle(sideB, trajB);

  const timelineTitleA = document.getElementById('timeline-title-a');
  if (timelineTitleA) timelineTitleA.innerText = titleAStr;
  const timelineTitleB = document.getElementById('timeline-title-b');
  if (timelineTitleB) timelineTitleB.innerText = titleBStr;
  const codeTitleA = document.getElementById('code-title-a');
  if (codeTitleA) codeTitleA.innerText = titleAStr;
  const codeTitleB = document.getElementById('code-title-b');
  if (codeTitleB) codeTitleB.innerText = titleBStr;
  const headerAssertA = document.getElementById('header-assert-a');
  if (headerAssertA) headerAssertA.innerText = titleAStr;
  const headerAssertB = document.getElementById('header-assert-b');
  if (headerAssertB) headerAssertB.innerText = titleBStr;

  // Top header row
  const headerRow = document.createElement('div');
  headerRow.className = 'timeline-header-row';
  headerRow.innerHTML = `
    <div class="timeline-header-col">${escapeHtml(titleAStr)}</div>
    <div class="timeline-header-col">${escapeHtml(titleBStr)}</div>
  `;
  container.appendChild(headerRow);

  // Add Timeline Mode Toggle bar
  const toggleBar = document.createElement('div');
  toggleBar.className = 'timeline-mode-toggle';
  toggleBar.style.cssText = 'display:flex; justify-content:center; align-items:center; gap:12px; margin:14px 0; padding:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;';
  toggleBar.innerHTML = `
    <span style="font-size:0.88em; font-weight:600; color:#475569;">Alignment Mode:</span>
    <button class="mode-btn ${timelineViewMode === 'milestone' ? 'active' : ''}" style="padding:6px 14px; border-radius:6px; border:1px solid ${timelineViewMode === 'milestone' ? '#2563eb' : '#cbd5e1'}; background:${timelineViewMode === 'milestone' ? '#2563eb' : '#ffffff'}; color:${timelineViewMode === 'milestone' ? '#ffffff' : '#334155'}; font-weight:600; font-size:0.85em; cursor:pointer; transition:all 0.2s;" onclick="switchTimelineMode('milestone')">🎯 Milestone View (Filtered & Aligned)</button>
    <button class="mode-btn ${timelineViewMode === 'raw' ? 'active' : ''}" style="padding:6px 14px; border-radius:6px; border:1px solid ${timelineViewMode === 'raw' ? '#2563eb' : '#cbd5e1'}; background:${timelineViewMode === 'raw' ? '#2563eb' : '#ffffff'}; color:${timelineViewMode === 'raw' ? '#ffffff' : '#334155'}; font-weight:600; font-size:0.85em; cursor:pointer; transition:all 0.2s;" onclick="switchTimelineMode('raw')">📋 Raw Chronological View (All Steps)</button>
  `;
  container.appendChild(toggleBar);

  // Render each step row
  for (let i = 0; i < aligned.length; i++) {
    const stepNum = i + 1;
    const stepA = aligned[i].stepA;
    const stepB = aligned[i].stepB;

    const isStep0A = stepA?.stepNumber === 0;
    const isStep0B = stepB?.stepNumber === 0;

    const isPrimaryA = Boolean(stepA && (typeof stepA.stepNumber === 'number' ? stepA.stepNumber === primaryStepA : stepNum === primaryStepA));
    const isPrimaryB = Boolean(stepB && (typeof stepB.stepNumber === 'number' ? stepB.stepNumber === primaryStepB : stepNum === primaryStepB));

    const row = document.createElement('div');
    row.className = `timeline-step-row ${(isPrimaryA || isPrimaryB) ? 'divergence-row' : ''}`;
    row.id = `step-row-${stepNum}`;

    let colAHtml = '';
    if (stepA) {
      if (isPrimaryA) {
        colAHtml += `
          <div class="divergence-banner primary track-banner" style="margin-bottom:8px;">
            <span class="divergence-badge">🚨 PRIMARY DIVERGENCE (TRIAL A)</span>
            <span class="divergence-desc">${isStep0A ? 'Starting prompt / launch parameters diverged' : `Divergent step in Trial A (Step ${stepA.stepNumber})`}</span>
          </div>
        `;
      }
      colAHtml += renderStepCardHtml(stepA, isPrimaryA, sessionUrlA);
    } else {
      colAHtml = '<div class="timeline-empty-card">No step in Trial A</div>';
    }

    let colBHtml = '';
    if (stepB) {
      if (isPrimaryB) {
        colBHtml += `
          <div class="divergence-banner primary track-banner" style="margin-bottom:8px;">
            <span class="divergence-badge">🚨 PRIMARY DIVERGENCE (TRIAL B)</span>
            <span class="divergence-desc">${isStep0B ? 'Starting prompt / launch parameters diverged' : `Divergent step in Trial B (Step ${stepB.stepNumber})`}</span>
          </div>
        `;
      }
      colBHtml += renderStepCardHtml(stepB, isPrimaryB, sessionUrlB);
    } else {
      colBHtml = '<div class="timeline-empty-card">No step in Trial B</div>';
    }

    row.innerHTML = `
      <div class="timeline-cols-grid">
        <div class="timeline-col col-a">${colAHtml}</div>
        <div class="timeline-col col-b">${colBHtml}</div>
      </div>
    `;
    container.appendChild(row);
  }

  // Render Final Assistant Response at the bottom of the timeline
  if (chatA || chatB) {
    const finalRow = document.createElement('div');
    finalRow.className = 'timeline-step-row final-answer-row';
    finalRow.innerHTML = `
      <div class="final-answer-banner">
        <span class="final-answer-badge">🏁 FINAL ASSISTANT OUTPUT</span>
        <span style="font-size:0.9em; color:#15803d; font-weight:500;">Agent final response after completing or halting execution.</span>
      </div>
      <div class="timeline-cols-grid">
        <div class="timeline-col col-a">
          <div class="final-answer-card">
            <div class="final-answer-header">
              <span>ASSISTANT</span>
              <span style="font-size:0.8em; color:#64748b;">Trial A</span>
            </div>
            <div class="final-answer-body">${escapeHtml(chatA || 'No final message recorded for Trial A.')}</div>
          </div>
        </div>
        <div class="timeline-col col-b">
          <div class="final-answer-card">
            <div class="final-answer-header">
              <span>ASSISTANT</span>
              <span style="font-size:0.8em; color:#64748b;">Trial B</span>
            </div>
            <div class="final-answer-body">${escapeHtml(chatB || 'No final message recorded for Trial B.')}</div>
          </div>
        </div>
      </div>
    `;
    container.appendChild(finalRow);
  }
}

/**
 * @param {CompareStep} step
 * @param {boolean} [isDivergent=false]
 * @param {string} [sessionUrl='']
 * @returns {string}
 */
function renderStepCardHtml(step, isDivergent = false, sessionUrl = '') {
  const isErr = typeof step.outcome === 'object' && step.outcome !== null ? step.outcome.status === 'error' : false;
  const cardClass = `timeline-step ${isErr ? 'error' : 'success'} ${isDivergent ? 'divergence-card' : ''}`;
  const stepAnchorUrl = sessionUrl ? `${sessionUrl}#step-${step.stepNumber}` : '';
  const outcomeStatus = typeof step.outcome === 'object' && step.outcome !== null && step.outcome.status ? step.outcome.status : 'UNKNOWN';

  let html = `
    <div class="${cardClass}">
      <div class="step-header">
        <div style="display:flex; align-items:center; gap:8px;">
          <span>STEP ${step.stepNumber}</span>
          ${stepAnchorUrl ? `
            <a href="${stepAnchorUrl}" target="_blank" title="Open source trajectory file at Step ${step.stepNumber}" style="font-size:0.82em; font-weight:600; color:#2563eb; text-decoration:none; display:inline-flex; align-items:center; gap:3px; background:#eff6ff; padding:2px 8px; border-radius:4px; border:1px solid #bfdbfe;">
              <span>🔗 Source Trajectory</span>
            </a>
          ` : ''}
        </div>
        <span style="color:${isErr ? '#ef4444' : '#22c55e'}">${outcomeStatus.toUpperCase()}</span>
      </div>
  `;

  if (step.thought && step.thought.trim()) {
    html += `
      <div class="step-thought">
        <div class="step-thought-header">💡 AGENT THINKING / REASONING</div>
        <div style="white-space: pre-wrap; word-break: break-word;">${escapeHtml(step.thought.trim())}</div>
      </div>
    `;
  }

  if (step.action) {
    const argsStr = step.action.params ? JSON.stringify(step.action.params, null, 2) : '';
    const actionName = step.action.name || 'Unknown Action';
    const actionType = step.action.type ? ` (${step.action.type})` : '';
    html += `
      <div class="step-action">
        <span class="step-action-title">🔧 Tool / Action:</span> ${escapeHtml(actionName)}${escapeHtml(actionType)}
        ${argsStr ? `
          <details style="margin-top:6px;">
            <summary style="cursor:pointer; color:#2563eb; font-weight:600; font-size:0.9em;">View Action Parameters</summary>
            <pre style="margin-top:5px; font-size:0.85em; background:#ffffff; border:1px solid #cbd5e1; padding:8px; border-radius:6px; white-space:pre-wrap; word-break:break-word; overflow-x:auto;">${escapeHtml(argsStr)}</pre>
          </details>
        ` : ''}
      </div>
    `;
  }

  let outcomeText = '';
  if (step.outcome) {
    if (typeof step.outcome === 'string') {
      outcomeText = step.outcome;
    } else if (typeof step.outcome === 'object' && step.outcome !== null) {
      const outcomeObj = /** @type {Record<string, any>} */ (step.outcome);
      if (outcomeObj.output || outcomeObj.result || outcomeObj.message || outcomeObj.content || outcomeObj.text || outcomeObj.stdout || outcomeObj.stderr) {
        outcomeText = outcomeObj.output || outcomeObj.result || outcomeObj.message || outcomeObj.content || outcomeObj.text || outcomeObj.stdout || outcomeObj.stderr;
        if (typeof outcomeText === 'object') outcomeText = JSON.stringify(outcomeText, null, 2);
      } else {
        const keys = Object.keys(outcomeObj);
        const onlyStatus = keys.every(k => k === 'status' || k === 'exitCode');
        if (!onlyStatus) {
          outcomeText = JSON.stringify(outcomeObj, null, 2);
        }
      }
    }
  } else if (step.output || step.result) {
    outcomeText = step.output || step.result;
    if (typeof outcomeText === 'object') outcomeText = JSON.stringify(outcomeText, null, 2);
  }

  const cleanText = String(outcomeText || '').trim().replace(/\s+/g, '');
  const hasOutputData = outcomeText && outcomeText !== '{}' && outcomeText !== 'null' && cleanText !== '{"status":"success"}' && cleanText !== '{"status":"error"}';

  if (hasOutputData || stepAnchorUrl) {
    const outcomeClass = isErr ? 'step-outcome error' : 'step-outcome';
    html += `
      <div style="margin-top: 8px; border-top: 1px dashed #e2e8f0; padding-top: 8px;">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
          ${hasOutputData ? `
            <details style="flex:1; min-width:200px;">
              <summary style="cursor:pointer; color:#2563eb; font-size:0.88em; font-weight:700;">📄 View Step Output / Result</summary>
              <div class="${outcomeClass}" style="margin-top:6px;">${escapeHtml(String(outcomeText).trim())}</div>
            </details>
          ` : `
            <span style="font-size:0.85em; color:#64748b; font-style:italic;">No summary text (view full trajectory)</span>
          `}
          ${stepAnchorUrl ? `
            <a href="${stepAnchorUrl}" target="_blank" title="View complete execution logs and tool output for Step ${step.stepNumber} in Trajectory Visualizer" style="font-size:0.84em; font-weight:600; color:#0f766e; background:#f0fdf4; border:1px solid #bbf7d0; padding:4px 10px; border-radius:6px; text-decoration:none; display:inline-flex; align-items:center; gap:4px; transition:all 0.2s;">
              <span>🔗 Open Full Step Result</span>
            </a>
          ` : ''}
        </div>
      </div>
    `;
  }

  html += `</div>`;
  return html;
}

/**
 * @param {string} pathA
 * @param {string} pathB
 * @returns {Promise<void>}
 */
async function loadCodeOutputs(pathA, pathB) {
  const resultsBase = isStatic ? 'results' : '';
  const srcParam = isStatic ? '' : '?source=local';
  
  const containerA = $('#code-a');
  const containerB = $('#code-b');
  
  containerA.innerHTML = 'Loading output file...';
  containerB.innerHTML = 'Loading output file...';

  // Find and load output code files
  // We check candidates: dist/index.html, src/App.jsx, index.html
  const candidates = ['dist/index.html', 'src/App.jsx', 'index.html'];
  
  let codeTextA = 'No generated code file found.';
  let codeTextB = 'No generated code file found.';

  for (const file of candidates) {
    try {
      const resA = await fetch(`${resultsBase}/${pathA}/${file}${srcParam}`);
      if (resA.ok) {
        codeTextA = await resA.text();
        break;
      }
    } catch (e) {}
  }

  for (const file of candidates) {
    try {
      const resB = await fetch(`${resultsBase}/${pathB}/${file}${srcParam}`);
      if (resB.ok) {
        codeTextB = await resB.text();
        break;
      }
    } catch (e) {}
  }

  containerA.innerText = codeTextA;
  containerB.innerText = codeTextB;
}

/**
 * @param {string} tab
 * @returns {void}
 */
function switchTab(tab) {
  currentTab = /** @type {'assertions' | 'timeline' | 'code'} */ (tab);
  
  // Update tab buttons active state using data-tab attribute
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const btnTab = btn.getAttribute('data-tab');
    btn.classList.toggle('active', btnTab === currentTab);
  });

  // Hide all tab contents
  $('#tab-content-assertions').style.display = 'none';
  $('#tab-content-timeline').style.display = 'none';
  $('#tab-content-code').style.display = 'none';

  // Show active tab content
  if (currentTab === 'assertions') {
    $('#tab-content-assertions').style.display = 'block';
  } else if (currentTab === 'timeline') {
    $('#tab-content-timeline').style.display = 'block';
  } else if (currentTab === 'code') {
    $('#tab-content-code').style.display = 'flex';
  }
}

/**
 * @returns {void}
 */
function resetDiagnosisUI() {
  const diagnosisText = document.getElementById('diagnosis-text');
  const statusSpan = document.getElementById('summary-status');
  const runBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('run-diagnosis-btn'));

  if (runBtn) {
    runBtn.disabled = false;
    runBtn.innerHTML = '✨ Run AI Diagnosis';
  }
  if (statusSpan) {
    statusSpan.innerText = 'Ready';
    statusSpan.style.color = '#64748b';
  }
  if (diagnosisText) {
    diagnosisText.innerHTML = `
      <div style="color:#64748b; font-size:0.95em;">
        Click <strong>"Run AI Diagnosis"</strong> above to dispatch the 3-phase AI variance analysis (Compliance Audit + Code & Friction Diagnostic) for this task comparison.
      </div>
    `;
  }
}

/**
 * @returns {Promise<void>}
 */
async function runDiagnosticAgent() {
  const diagnosisBox = $('#diagnosis-box');
  const diagnosisText = $('#diagnosis-text');
  const statusSpan = $('#summary-status');
  const runBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('run-diagnosis-btn'));

  const relativeA = `${sideA.trialId}/${sideA.runNum}/${guideName}/${activeTask}/${sideA.runType}`;
  const relativeB = `${sideB.trialId}/${sideB.runNum}/${guideName}/${activeTask}/${sideB.runType}`;

  if (runBtn) {
    runBtn.disabled = true;
    runBtn.innerHTML = `
      <div class="spinner" style="width:14px; height:14px; border-width:2px; margin-bottom:0; display:inline-block; vertical-align:middle; border-left-color:#fff;"></div>
      <span>Running Diagnosis...</span>
    `;
  }

  diagnosisBox.style.display = 'block';
  diagnosisText.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px;">
      <div class="spinner" style="width:20px; height:20px; border-width:2px; margin-bottom:0;"></div>
      <span>Running LLM variance diagnosis on the fly. This can take up to 20 seconds...</span>
    </div>
  `;
  statusSpan.innerText = 'Analyzing Runs...';
  statusSpan.style.color = '#d97706';

  try {
    // If in static mode, we fetch pre-generated markdown
    if (isStatic) {
      const resultsBase = 'results';
      const fileName = `${guideName}-${activeTask}-guided.md`;
      const url = `${resultsBase}/${sideA.trialId}/variance_diagnoses/${fileName}`;
      
      try {
        const response = await fetch(url);
        if (response.ok) {
          const markdown = await response.text();
          diagnosisText.innerHTML = renderMarkdown(markdown);
          statusSpan.innerText = 'Completed';
          statusSpan.style.color = '#166534';
        } else {
          diagnosisText.innerHTML = `
            <div style="color:#b91c1c; font-weight:600;">Diagnostic report not pre-generated for this run combination.</div>
            <div style="font-size:0.9em; margin-top:5px; color:#475569;">
              Running in STATIC mode. On-the-fly LLM comparison is only available when running the dashboard locally via <code>pnpm dashboard</code>.
              To generate this report locally, run:
              <pre style="background:#fff; border:1px solid #fecaca; margin-top:8px; padding:10px; border-radius:4px; font-family:monospace;">gd compare ${sideA.trialId}/${sideA.runNum}/${guideName}/${activeTask}/guided ${sideB.trialId}/${sideB.runNum}/${guideName}/${activeTask}/guided</pre>
            </div>
          `;
          statusSpan.innerText = 'Not Pre-generated';
          statusSpan.style.color = '#b91c1c';
        }
      } catch (e) {
        diagnosisText.innerText = 'Failed to load pre-generated diagnostic report.';
        statusSpan.innerText = 'Error';
      }
      return;
    }

    // Local Mode: Call Node dev server API to run comparison on the fly!
    const hasTaskA = sideA.suiteData ? checkTaskInSuite(sideA.suiteData, activeTask) : true;
    const hasTaskB = sideB.suiteData ? checkTaskInSuite(sideB.suiteData, activeTask) : true;

    if (sideA.suiteData && sideB.suiteData && (!hasTaskA || !hasTaskB)) {
      const missingIn = !hasTaskA && !hasTaskB ? 'both trials' : !hasTaskA ? 'Trial A' : 'Trial B';
      const presentIn = !hasTaskA ? 'Trial B' : 'Trial A';
      diagnosisText.innerHTML = `
        <div style="color:#92400e; font-weight:600;">Cross-trial comparison unavailable for this task.</div>
        <div style="font-size:0.9em; margin-top:5px; color:#78350f;">
          Task <code>${escapeHtml(activeTask)}</code> was only executed in ${presentIn} and is not present in ${missingIn}.
          To run an AI variance diagnosis, select a task that was executed in both trials.
        </div>
      `;
      statusSpan.innerText = 'Single Trial Only';
      statusSpan.style.color = '#64748b';
      return;
    }

    const apiUrl = `/api/compare?runDirA=${encodeURIComponent(relativeA)}&runDirB=${encodeURIComponent(relativeB)}`;
    
    /** @type {Record<string, string>} */
    const headers = {};
    const token = getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(apiUrl, { headers });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP error ${response.status}`);
    }
    if (!response.body) {
      throw new Error('Response body is null');
    }

    // Set up a scrollable log container to stream raw output in real-time
    diagnosisText.innerHTML = `
      <div style="font-size:0.9em; font-weight:600; color:#d97706; margin-bottom:8px; display:flex; align-items:center; gap:8px;">
        <div class="spinner" style="width:16px; height:16px; border-width:2px; margin-bottom:0;"></div>
        <span>Streaming Gemini API diagnosis...</span>
      </div>
      <pre id="compare-log-stream" style="font-family:monospace; font-size:0.85em; background:#ffffff; border:1px solid #fde68a; padding:12px; border-radius:6px; overflow-x:auto; max-height:250px; overflow-y:auto; margin:0; white-space:pre-wrap; color:#334155; line-height:1.4; box-shadow:inset 0 1px 2px rgba(0,0,0,0.05);"></pre>
    `;
    const logPre = document.getElementById('compare-log-stream');
    const accumulatedText = await streamBodyToElement(response.body, logPre);

    // Extraction of the final report from the accumulated stream text
    const startMarker = '--- DIAGNOSTIC REPORT ---';
    const endMarker = '-------------------------';
    const startIdx = accumulatedText.indexOf(startMarker);
    const endIdx = accumulatedText.indexOf(endMarker);

    if (startIdx !== -1 && endIdx !== -1) {
      const report = accumulatedText.slice(startIdx + startMarker.length, endIdx).trim();
      diagnosisText.innerHTML = renderMarkdown(report);
      statusSpan.innerText = 'Completed';
      statusSpan.style.color = '#166534';
    } else {
      // If we failed or couldn't find the markers, check for errors in the stream
      if (accumulatedText.includes('Comparison failed') || accumulatedText.includes('exited with code') || accumulatedText.includes('Server Error') || accumulatedText.includes('timed out')) {
        statusSpan.innerText = 'Failed';
        statusSpan.style.color = '#b91c1c';
        diagnosisText.innerHTML = `
          <div style="color:#b91c1c; font-weight:600;">On-the-fly LLM diagnosis failed.</div>
          <div style="font-size:0.85em; color:#64748b; margin-top:4px;">Diagnostic run logs:</div>
          <pre style="font-family:monospace; font-size:0.85em; background:#ffffff; border:1px solid #cbd5e1; padding:12px; border-radius:6px; overflow-x:auto; white-space:pre-wrap; margin-top:10px; color:#b91c1c; box-shadow:inset 0 1px 2px rgba(0,0,0,0.05);">${escapeHtml(accumulatedText)}</pre>
        `;
      } else {
        // Fallback: just render the accumulated text
        diagnosisText.innerHTML = renderMarkdown(accumulatedText);
        statusSpan.innerText = 'Completed';
        statusSpan.style.color = '#166534';
      }
    }
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error('LLM Diagnosis error:', e);
    diagnosisText.innerHTML = `
      <div style="color:#b91c1c; font-weight:600;">On-the-fly LLM diagnosis failed.</div>
      <div style="font-size:0.9em; color:#64748b; margin-top:5px;">Error: ${escapeHtml(errorMsg)}</div>
      <div style="font-size:0.9em; margin-top:10px; color:#475569;">
        You can try running the comparison manually in your terminal:
        <pre style="background:#fff; border:1px solid #fecaca; margin-top:8px; padding:10px; border-radius:4px; font-family:monospace;">gd compare ../harness/results/${relativeA} ../harness/results/${relativeB}</pre>
      </div>
    `;
    statusSpan.innerText = 'Failed';
    statusSpan.style.color = '#b91c1c';
  } finally {
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.innerHTML = '🔄 Re-run Diagnosis';
    }
  }
}

// Global initialization
window.onload = async () => {
  if (initParams()) {
    await loadTrialMetadata();
  }
};

// Expose module functions globally for inline HTML event handlers (since compare.js is loaded as a module)
window.switchTab = switchTab;
window.switchTask = switchTask;
window.runDiagnosticAgent = runDiagnosticAgent;

/**
 * @param {'milestone' | 'raw'} mode
 * @returns {void}
 */
function switchTimelineMode(mode) {
  timelineViewMode = mode;
  const pathPartA = `${sideA.trialId}/${sideA.runNum}/${guideName}/${activeTask}/${sideA.runType}`;
  const pathPartB = `${sideB.trialId}/${sideB.runNum}/${guideName}/${activeTask}/${sideB.runType}`;
  loadTrajectories(pathPartA, pathPartB);
}
window.switchTimelineMode = switchTimelineMode;

/**
 * @returns {void}
 */
function exportCompareReport() {
  const titleAStr = getFormattedTrialTitle(sideA);
  const titleBStr = getFormattedTrialTitle(sideB);

  let report = `# Cross-Run Variance Diagnosis & Trajectory Comparison Report\n`;
  report += `Generated: ${new Date().toISOString()}\n`;
  report += `Guide: ${guideName}\n`;
  report += `Active Task: ${activeTask}\n\n`;

  report += `## 1. Executive Summary\n`;
  report += `- **Trial A**: ${titleAStr} | Score: ${sideA.score}%\n`;
  report += `- **Trial B**: ${titleBStr} | Score: ${sideB.score}%\n`;
  const delta = sideB.score - sideA.score;
  report += `- **Score Delta**: ${delta === 0 ? 'No change (0%)' : delta > 0 ? `+${delta}% Improvement` : `${delta}% Regression`}\n\n`;

  report += `## 2. AI Variance Diagnosis\n`;
  const diagElem = document.getElementById('diagnosis-text');
  const diagText = diagElem ? diagElem.innerText || 'No diagnosis generated.' : 'No diagnosis generated.';
  report += `${diagText.trim()}\n\n`;

  report += `## 3. Assertions Comparison Table\n`;
  report += `| Assertion Check | Trial A (${sideA.score}%) | Trial B (${sideB.score}%) |\n`;
  report += `| :--- | :---: | :---: |\n`;
  const assertRows = document.querySelectorAll('#assert-tbody tr');
  if (assertRows && assertRows.length > 0) {
    assertRows.forEach(tr => {
      const tds = tr.querySelectorAll('td');
      if (tds.length >= 3) {
        const msg = (tds[0].textContent || '').trim();
        const statA = (tds[1].textContent || '').trim().replace(/\n/g, ' ');
        const statB = (tds[2].textContent || '').trim().replace(/\n/g, ' ');
        report += `| ${msg} | ${statA} | ${statB} |\n`;
      } else {
        report += `| ${(tr.textContent || '').trim()} | - | - |\n`;
      }
    });
  } else {
    report += `| No assertions found | - | - |\n`;
  }
  report += `\n`;

  report += `## 4. Trajectory Comparison (${timelineViewMode.toUpperCase()} Mode)\n`;
  const aligned = alignTrajectorySteps(sideA.trajectory, sideB.trajectory, timelineViewMode);
  if (aligned.length === 0) {
    report += `No trajectory steps available.\n\n`;
  } else {
    const { primaryStepA, primaryStepB } = findDivergenceInfo(sideA.trajectory, sideB.trajectory);
    aligned.forEach((pair, idx) => {
      const stepNum = idx + 1;
      const isPrimaryA = Boolean(pair.stepA && (typeof pair.stepA.stepNumber === 'number' ? pair.stepA.stepNumber === primaryStepA : stepNum === primaryStepA));
      const isPrimaryB = Boolean(pair.stepB && (typeof pair.stepB.stepNumber === 'number' ? pair.stepB.stepNumber === primaryStepB : stepNum === primaryStepB));

      const markerA = isPrimaryA ? ' [🚨 TRIAL A PRIMARY DIVERGENCE]' : '';
      const markerB = isPrimaryB ? ' [🚨 TRIAL B PRIMARY DIVERGENCE]' : '';

      report += `### Row ${stepNum}\n\n`;

      // Trial A
      report += `#### Trial A (Step ${pair.stepA?.stepNumber === 0 ? '0 - Starting Prompt / Launch' : pair.stepA?.stepNumber || 'N/A'})${markerA}\n`;
      if (pair.stepA) {
        const outcomeStatus = typeof pair.stepA.outcome === 'object' && pair.stepA.outcome !== null && pair.stepA.outcome.status ? pair.stepA.outcome.status : 'UNKNOWN';
        report += `- **Status**: ${outcomeStatus.toUpperCase()}\n`;
        if (pair.stepA.thought) {
          report += `- **Thinking / Reasoning**:\n\`\`\`\n${pair.stepA.thought.trim()}\n\`\`\`\n`;
        }
        if (pair.stepA.action) {
          const actName = pair.stepA.action.name || 'Unknown Action';
          const actType = pair.stepA.action.canonicalCategory ? ` [Category: ${pair.stepA.action.canonicalCategory}]` : '';
          const paramsStr = pair.stepA.action.params ? JSON.stringify(pair.stepA.action.params, null, 2) : '';
          report += `- **Action**: \`${actName}\`${actType}\n`;
          if (paramsStr && paramsStr !== '{}') {
            report += `  - **Parameters**:\n\`\`\`json\n${paramsStr}\n\`\`\`\n`;
          }
        }
        if (pair.stepA.outcome) {
          const out = typeof pair.stepA.outcome === 'object' && pair.stepA.outcome !== null
            ? (pair.stepA.outcome.output || pair.stepA.outcome.result || pair.stepA.outcome.message || pair.stepA.outcome.content || pair.stepA.outcome.text || pair.stepA.outcome.stdout || pair.stepA.outcome.stderr || '')
            : pair.stepA.outcome;
          if (out && typeof out !== 'object' || (typeof out === 'object' && Object.keys(out).length > 0)) {
            const outStr = typeof out === 'object' ? JSON.stringify(out, null, 2) : String(out);
            if (outStr !== '{}' && outStr !== 'null') {
              report += `- **Outcome / Output**:\n\`\`\`\n${outStr.trim()}\n\`\`\`\n`;
            }
          }
        }
      } else {
        report += `*No step in Trial A at this position.*\n`;
      }
      report += `\n`;

      // Trial B
      report += `#### Trial B (Step ${pair.stepB?.stepNumber === 0 ? '0 - Starting Prompt / Launch' : pair.stepB?.stepNumber || 'N/A'})${markerB}\n`;
      if (pair.stepB) {
        const outcomeStatus = typeof pair.stepB.outcome === 'object' && pair.stepB.outcome !== null && pair.stepB.outcome.status ? pair.stepB.outcome.status : 'UNKNOWN';
        report += `- **Status**: ${outcomeStatus.toUpperCase()}\n`;
        if (pair.stepB.thought) {
          report += `- **Thinking / Reasoning**:\n\`\`\`\n${pair.stepB.thought.trim()}\n\`\`\`\n`;
        }
        if (pair.stepB.action) {
          const actName = pair.stepB.action.name || 'Unknown Action';
          const actType = pair.stepB.action.canonicalCategory ? ` [Category: ${pair.stepB.action.canonicalCategory}]` : '';
          const paramsStr = pair.stepB.action.params ? JSON.stringify(pair.stepB.action.params, null, 2) : '';
          report += `- **Action**: \`${actName}\`${actType}\n`;
          if (paramsStr && paramsStr !== '{}') {
            report += `  - **Parameters**:\n\`\`\`json\n${paramsStr}\n\`\`\`\n`;
          }
        }
        if (pair.stepB.outcome) {
          const out = typeof pair.stepB.outcome === 'object' && pair.stepB.outcome !== null
            ? (pair.stepB.outcome.output || pair.stepB.outcome.result || pair.stepB.outcome.message || pair.stepB.outcome.content || pair.stepB.outcome.text || pair.stepB.outcome.stdout || pair.stepB.outcome.stderr || '')
            : pair.stepB.outcome;
          if (out && typeof out !== 'object' || (typeof out === 'object' && Object.keys(out).length > 0)) {
            const outStr = typeof out === 'object' ? JSON.stringify(out, null, 2) : String(out);
            if (outStr !== '{}' && outStr !== 'null') {
              report += `- **Outcome / Output**:\n\`\`\`\n${outStr.trim()}\n\`\`\`\n`;
            }
          }
        }
      } else {
        report += `*No step in Trial B at this position.*\n`;
      }
      report += `\n---\n\n`;
    });
  }

  if (sideA.chatLog || sideB.chatLog) {
    report += `### Final Assistant Output\n\n`;
    report += `#### Trial A Final Response:\n\`\`\`\n${(sideA.chatLog || 'No final response recorded.').trim()}\n\`\`\`\n\n`;
    report += `#### Trial B Final Response:\n\`\`\`\n${(sideB.chatLog || 'No final response recorded.').trim()}\n\`\`\`\n\n`;
  }

  report += `## 5. Code Output Comparison\n\n`;
  const codeElemA = document.getElementById('code-a');
  const codeElemB = document.getElementById('code-b');
  const codeTextA = codeElemA ? codeElemA.innerText || 'No code found.' : 'No code found.';
  const codeTextB = codeElemB ? codeElemB.innerText || 'No code found.' : 'No code found.';
  report += `### Trial A Generated Code:\n\`\`\`html\n${codeTextA.trim()}\n\`\`\`\n\n`;
  report += `### Trial B Generated Code:\n\`\`\`html\n${codeTextB.trim()}\n\`\`\`\n`;

  const blob = new Blob([report], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const filenameSafeTask = activeTask ? activeTask.replace(/[^a-zA-Z0-9_-]/g, '_') : 'task';
  const filenameSafeGuide = guideName ? guideName.replace(/[^a-zA-Z0-9_-]/g, '_') : 'guide';
  a.download = `compare_${filenameSafeGuide}_${filenameSafeTask}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
window.exportCompareReport = exportCompareReport;
