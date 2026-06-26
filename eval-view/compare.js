import { getAccessToken, capitalize } from './utils.js';

// Cross-Run Performance Variance Diagnosis Dashboard JavaScript

let currentTab = 'assertions';
let activeTask = '';
let availableTasks = [];

// Context parameters
let trialA = '';
let trialB = '';
let runNumA = '1';
let runNumB = '1';
let guideName = '';
let isStatic = false;
let agentA = '';
let modelA = '';
let scoreAParam = null;
let agentB = '';
let modelB = '';
let scoreBParam = null;

// Live Run Types & Scores
let runTypeA = 'guided';
let runTypeB = 'guided';
let currentScoreA = 0;
let currentScoreB = 0;

// Parsed run data
let runDirA = '';
let runDirB = '';
let suiteDataA = null;
let suiteDataB = null;

// Robust line-by-line markdown to HTML compiler with ANSI stripping & GFM Table support
function renderMarkdown(md) {
  if (!md) return '';
  
  // Strip ANSI escape sequences (e.g. \x1b[36m)
  let cleanMd = md.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').trim();
  
  const lines = cleanMd.split('\n');
  let html = '';
  let inList = false;
  let inParagraph = false;
  let inCodeBlock = false;
  let inTable = false;
  let codeLanguage = '';
  let codeContent = [];
  let tableHeaders = [];
  let tableAlignments = [];
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
          
          const cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
          tableHeaders = cells;
          
          const dividerCells = escapedNextLine.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
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
        const cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
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

// Helper to compile a parsed markdown table into structured HTML
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

function parseInline(text) {
  // Bold: **text**
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic: *text*
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Inline code: `code`
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  return text;
}

// Extract query parameters
function initParams() {
  const urlParams = new URLSearchParams(window.location.search);
  trialA = urlParams.get('trialA') || '';
  trialB = urlParams.get('trialB') || trialA; // Default within-trial
  runNumA = urlParams.get('runA') || '1';
  runNumB = urlParams.get('runB') || (trialA === trialB ? '2' : '1'); // Default to Run 2 if comparing same trial
  guideName = urlParams.get('guide') || '';
  isStatic = urlParams.get('source') === 'static' || window.location.hostname.includes('github.io');

  agentA = urlParams.get('agentA') || '';
  modelA = urlParams.get('modelA') || '';
  scoreAParam = urlParams.get('scoreA');
  agentB = urlParams.get('agentB') || '';
  modelB = urlParams.get('modelB') || '';
  scoreBParam = urlParams.get('scoreB');

  runTypeA = urlParams.get('runTypeA') || 'guided';
  runTypeB = urlParams.get('runTypeB') || 'guided';

  // Initialize dropdown selections
  document.getElementById('run-type-a').value = runTypeA;
  document.getElementById('run-type-b').value = runTypeB;

  // Set up dropdown change listeners
  document.getElementById('run-type-a').addEventListener('change', async (e) => {
    runTypeA = e.target.value;
    await handleRunTypeChange();
  });
  document.getElementById('run-type-b').addEventListener('change', async (e) => {
    runTypeB = e.target.value;
    await handleRunTypeChange();
  });

  // Back button setup
  const backBtn = document.getElementById('back-btn');
  backBtn.href = `guide.html?guide=${guideName}&source=${isStatic ? 'static' : 'local'}`;

  if (!trialA || !guideName) {
    document.getElementById('compare-title').innerText = 'Error: Missing Parameters';
    alert('Missing required parameters: trialA and guide are required.');
    return false;
  }
  return true;
}

/**
 * Handles reloading of workspace files and running diagnosis when run type is toggled.
 */
async function handleRunTypeChange() {
  await loadActiveTaskDetails();
  await runDiagnosticAgent();
}

async function loadTrialMetadata() {
  const resultsBase = isStatic ? 'results' : '';
  
  // Update UI titles and dates
  document.getElementById('summary-guide').innerText = guideName;
  
  // Fetch Trial A suite metadata
  try {
    const responseA = await fetch(`${resultsBase}/${trialA}/evals.json`);
    if (responseA.ok) {
      suiteDataA = await responseA.json();
    }
  } catch (e) {
    console.error('Failed to load Trial A suite data:', e);
  }

  // Fetch Trial B suite metadata
  try {
    if (trialA !== trialB) {
      const responseB = await fetch(`${resultsBase}/${trialB}/evals.json`);
      if (responseB.ok) {
        suiteDataB = await responseB.json();
      }
    } else {
      suiteDataB = suiteDataA;
    }
  } catch (e) {
    console.error('Failed to load Trial B suite data:', e);
  }

  // Determine tasks belonging to this guide
  // Filter the evaluations to find tasks matching this guide
  const tasksSet = new Set();
  const allEvals = [...(suiteDataA?.evaluations || []), ...(suiteDataB?.evaluations || [])];
  allEvals.forEach(ev => {
    // ev.task is usually "guideName/taskName"
    if (ev.task && ev.task.startsWith(`${guideName}/`)) {
      tasksSet.add(ev.task.split('/')[1]);
    }
  });

  availableTasks = Array.from(tasksSet);
  if (availableTasks.length === 0) {
    // Fallback: search the directories or use guideName/task
    availableTasks = ['task'];
  }

  activeTask = availableTasks[0];
  
  // Populate sidebar
  populateSidebar();

  // Populate Executive Cards
  updateExecutiveSummary();

  // Load active task details
  await loadActiveTaskDetails();

  // Trigger Diagnosis
  await runDiagnosticAgent();
}

function populateSidebar() {
  const sidebarList = document.getElementById('task-sidebar-list');
  sidebarList.innerHTML = '';
  availableTasks.forEach(task => {
    const btn = document.createElement('button');
    btn.className = `task-btn ${task === activeTask ? 'active' : ''}`;
    btn.innerText = task;
    btn.onclick = () => switchTask(task);
    sidebarList.appendChild(btn);
  });
}

function updateExecutiveSummary() {
  const resultsBase = isStatic ? 'results' : '';
  
  // Trial A
  document.getElementById('title-a').innerText = `${trialA.slice(0, 18)} (Run ${runNumA})`;
  document.getElementById('meta-a').innerText = trialA.includes('test-') ? `Date: ${trialA.replace('test-', '').slice(0, 10)}` : 'Historical Suite';
  
  const displayAgentA = agentA || 'Unknown';
  const displayModelA = modelA || 'Unknown';
  document.getElementById('agent-model-a').innerText = `Agent: ${displayAgentA} | Model: ${displayModelA}`;

  // Trial B
  if (trialA === trialB) {
    document.getElementById('title-b').innerText = `${trialA.slice(0, 18)} (Run ${runNumB})`;
    document.getElementById('meta-b').innerText = 'Within-Trial Non-determinism Check';
  } else {
    document.getElementById('title-b').innerText = `${trialB.slice(0, 18)} (Run ${runNumB})`;
    document.getElementById('meta-b').innerText = trialB.includes('test-') ? `Date: ${trialB.replace('test-', '').slice(0, 10)}` : 'Historical Suite';
  }
  
  const displayAgentB = agentB || 'Unknown';
  const displayModelB = modelB || 'Unknown';
  document.getElementById('agent-model-b').innerText = `Agent: ${displayAgentB} | Model: ${displayModelB}`;

  // Calculate Scores for the specific guide
  // Fall back to forwarded score parameters if evals.json is missing
  const scoreA = suiteDataA ? calculateGuideScore(suiteDataA, runNumA) : (scoreAParam !== null ? parseInt(scoreAParam) : 0);
  const scoreB = suiteDataB ? calculateGuideScore(suiteDataB, runNumB) : (scoreBParam !== null ? parseInt(scoreBParam) : 0);

  const badgeA = document.getElementById('score-badge-a');
  badgeA.innerText = `${scoreA}%`;
  badgeA.className = `score-badge ${scoreA >= 70 ? 'score-high' : 'score-low'}`;

  const badgeB = document.getElementById('score-badge-b');
  badgeB.innerText = `${scoreB}%`;
  badgeB.className = `score-badge ${scoreB >= 70 ? 'score-high' : 'score-low'}`;

  const delta = scoreB - scoreA;
  const deltaText = delta === 0 ? 'No change (0%)' : delta > 0 ? `+${delta}% Improvement` : `${delta}% Regression`;
  const deltaSpan = document.getElementById('summary-delta');
  deltaSpan.innerText = deltaText;
  deltaSpan.style.color = delta === 0 ? '#475569' : delta > 0 ? '#166534' : '#991b1b';
}

function calculateGuideScore(suiteData, runNum) {
  if (!suiteData || !suiteData.evaluations) return 0;
  const guideEvals = suiteData.evaluations.filter(ev => ev.task.startsWith(`${guideName}/`) && String(ev.run) === String(runNum));
  if (guideEvals.length === 0) return 0;
  
  let totalAsserts = 0;
  let passedAsserts = 0;
  
  guideEvals.forEach(ev => {
    if (ev.results && Array.isArray(ev.results)) {
      totalAsserts += ev.results.length;
      passedAsserts += ev.results.filter(r => r.passed).length;
    }
  });

  return totalAsserts > 0 ? Math.round((passedAsserts / totalAsserts) * 100) : 0;
}
async function switchTask(task) {
  activeTask = task;
  
  // Update sidebar active state
  document.querySelectorAll('.task-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim() === activeTask);
  });

  await loadActiveTaskDetails();
}
async function loadActiveTaskDetails() {
  document.getElementById('compare-loading').style.display = 'flex';
  document.getElementById('tab-content-assertions').style.display = 'none';
  document.getElementById('tab-content-timeline').style.display = 'none';
  document.getElementById('tab-content-code').style.display = 'none';

  const resultsBase = isStatic ? 'results' : '';
  
  // Format run directory paths using active run types
  const pathPartA = `${trialA}/${runNumA}/${guideName}/${activeTask}/${runTypeA}`;
  const pathPartB = `${trialB}/${runNumB}/${guideName}/${activeTask}/${runTypeB}`;
  
  runDirA = `${resultsBase}/${pathPartA}`;
  runDirB = `${resultsBase}/${pathPartB}`;

  // Update split-pane column titles to display both run number and run type
  document.getElementById('timeline-title-a').innerText = `Trial A (Run ${runNumA} - ${capitalize(runTypeA)})`;
  document.getElementById('timeline-title-b').innerText = `Trial B (Run ${runNumB} - ${capitalize(runTypeB)})`;
  document.getElementById('code-title-a').innerText = `Trial A (Run ${runNumA} - ${capitalize(runTypeA)})`;
  document.getElementById('code-title-b').innerText = `Trial B (Run ${runNumB} - ${capitalize(runTypeB)})`;
  document.getElementById('header-assert-a').innerText = `Trial A (Run ${runNumA} - ${capitalize(runTypeA)})`;
  document.getElementById('header-assert-b').innerText = `Trial B (Run ${runNumB} - ${capitalize(runTypeB)})`;

  // 1. Load Assertions Comparison
  await loadAssertions(pathPartA, pathPartB);

  // 2. Load Trajectory Timelines
  await loadTrajectories(pathPartA, pathPartB);

  // 3. Load Code Output Diffs
  await loadCodeOutputs(pathPartA, pathPartB);

  document.getElementById('compare-loading').style.display = 'none';
  switchTab(currentTab);
}

/**
 * Recursively parses Playwright's JSON report and extracts a flat array of assertions.
 */
function parsePlaywrightResults(report) {
  const assertions = [];
  if (!report || !Array.isArray(report.suites)) {
    return assertions;
  }
  
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

async function loadAssertions(pathA, pathB) {
  const resultsBase = isStatic ? 'results' : '';
  const tbody = document.getElementById('assert-tbody');
  tbody.innerHTML = '';

  let resultsA = [];
  let resultsB = [];

  // Fetch Run A results JSON
  try {
    const resA = await fetch(`${resultsBase}/${pathA}/${guideName}_results.json`);
    if (resA.ok) {
      const rawA = await resA.json();
      resultsA = parsePlaywrightResults(rawA);
    }
  } catch (e) {}

  // Fetch Run B results JSON
  try {
    const resB = await fetch(`${resultsBase}/${pathB}/${guideName}_results.json`);
    if (resB.ok) {
      const rawB = await resB.json();
      resultsB = parsePlaywrightResults(rawB);
    }
  } catch (e) {}

  // Calculate live scores from parsed assertions and update badges dynamically
  if (resultsA.length > 0) {
    const passedA = resultsA.filter(r => r.passed).length;
    currentScoreA = Math.round((passedA / resultsA.length) * 100);
    const badgeA = document.getElementById('score-badge-a');
    badgeA.innerText = `${currentScoreA}%`;
    badgeA.className = `score-badge ${currentScoreA >= 70 ? 'score-high' : 'score-low'}`;
  } else {
    currentScoreA = scoreAParam !== null ? parseInt(scoreAParam) : 0;
    const badgeA = document.getElementById('score-badge-a');
    badgeA.innerText = `${currentScoreA}%`;
    badgeA.className = `score-badge ${currentScoreA >= 70 ? 'score-high' : 'score-low'}`;
  }

  if (resultsB.length > 0) {
    const passedB = resultsB.filter(r => r.passed).length;
    currentScoreB = Math.round((passedB / resultsB.length) * 100);
    const badgeB = document.getElementById('score-badge-b');
    badgeB.innerText = `${currentScoreB}%`;
    badgeB.className = `score-badge ${currentScoreB >= 70 ? 'score-high' : 'score-low'}`;
  } else {
    currentScoreB = scoreBParam !== null ? parseInt(scoreBParam) : 0;
    const badgeB = document.getElementById('score-badge-b');
    badgeB.innerText = `${currentScoreB}%`;
    badgeB.className = `score-badge ${currentScoreB >= 70 ? 'score-high' : 'score-low'}`;
  }

  // Update Score Delta dynamically
  const delta = currentScoreB - currentScoreA;
  const deltaText = delta === 0 ? 'No change (0%)' : delta > 0 ? `+${delta}% Improvement` : `${delta}% Regression`;
  const deltaSpan = document.getElementById('summary-delta');
  deltaSpan.innerText = deltaText;
  deltaSpan.style.color = delta === 0 ? '#475569' : delta > 0 ? '#166534' : '#991b1b';

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

async function loadTrajectories(pathA, pathB) {
  const resultsBase = isStatic ? 'results' : '';
  
  const containerA = document.getElementById('timeline-a');
  const containerB = document.getElementById('timeline-b');
  
  containerA.innerHTML = '<div class="trial-meta">Loading trajectory...</div>';
  containerB.innerHTML = '<div class="trial-meta">Loading trajectory...</div>';

  let trajA = null;
  let trajB = null;

  try {
    const resA = await fetch(`${resultsBase}/${pathA}/trajectory_summary.json`);
    if (resA.ok) trajA = await resA.json();
  } catch (e) {}

  try {
    const resB = await fetch(`${resultsBase}/${pathB}/trajectory_summary.json`);
    if (resB.ok) trajB = await resB.json();
  } catch (e) {}

  renderTimeline(containerA, trajA);
  renderTimeline(containerB, trajB);
}

function renderTimeline(container, trajectory) {
  container.innerHTML = '';
  if (!trajectory || !trajectory.steps || trajectory.steps.length === 0) {
    container.innerHTML = '<div style="padding:20px; text-align:center; color:#64748b;">No normalized trajectory available. Ensure trajectory_summary.json is generated.</div>';
    return;
  }

  trajectory.steps.forEach(step => {
    const card = document.createElement('div');
    const isErr = step.outcome?.status === 'error';
    card.className = `timeline-step ${isErr ? 'error' : 'success'}`;

    let html = `
      <div class="step-header">
        <span>STEP ${step.stepNumber}</span>
        <span style="color:${isErr ? '#ef4444' : '#22c55e'}">${(step.outcome?.status || 'UNKNOWN').toUpperCase()}</span>
      </div>
    `;

    if (step.thought) {
      html += `<div class="step-thought"><strong>Thought:</strong> ${escapeHtml(step.thought)}</div>`;
    }
    if (step.action) {
      const argsStr = step.action.params ? JSON.stringify(step.action.params, null, 2) : '';
      html += `
        <div class="step-action">
          <strong>Tool:</strong> ${escapeHtml(step.action.name)} (${step.action.type})
          ${argsStr ? `<pre style="margin-top:5px; font-size:0.85em; background:#ffffff; border:1px solid #e2e8f0; padding:5px; border-radius:4px; white-space:pre-wrap; word-break:break-word; overflow-x:auto;">${escapeHtml(argsStr)}</pre>` : ''}
        </div>
      `;
    }
    if (step.outcome) {
      const outcomeClass = isErr ? 'step-outcome error' : 'step-outcome';
      html += `<div class="${outcomeClass}"><strong>Outcome:</strong> ${escapeHtml(step.outcome.message || 'Success')}</div>`;
    }

    card.innerHTML = html;
    container.appendChild(card);
  });
}

async function loadCodeOutputs(pathA, pathB) {
  const resultsBase = isStatic ? 'results' : '';
  
  const containerA = document.getElementById('code-a');
  const containerB = document.getElementById('code-b');
  
  containerA.innerHTML = 'Loading output file...';
  containerB.innerHTML = 'Loading output file...';

  // Find and load output code files
  // We check candidates: dist/index.html, src/App.jsx, index.html
  const candidates = ['dist/index.html', 'src/App.jsx', 'index.html'];
  
  let codeTextA = 'No generated code file found.';
  let codeTextB = 'No generated code file found.';

  for (const file of candidates) {
    try {
      const resA = await fetch(`${resultsBase}/${pathA}/${file}`);
      if (resA.ok) {
        codeTextA = await resA.text();
        break;
      }
    } catch (e) {}
  }

  for (const file of candidates) {
    try {
      const resB = await fetch(`${resultsBase}/${pathB}/${file}`);
      if (resB.ok) {
        codeTextB = await resB.text();
        break;
      }
    } catch (e) {}
  }

  containerA.innerText = codeTextA;
  containerB.innerText = codeTextB;
}

function switchTab(tab) {
  currentTab = tab;
  
  // Update tab buttons active state using data-tab attribute
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const btnTab = btn.getAttribute('data-tab');
    btn.classList.toggle('active', btnTab === currentTab);
  });

  // Hide all tab contents
  document.getElementById('tab-content-assertions').style.display = 'none';
  document.getElementById('tab-content-timeline').style.display = 'none';
  document.getElementById('tab-content-code').style.display = 'none';

  // Show active tab content
  if (currentTab === 'assertions') {
    document.getElementById('tab-content-assertions').style.display = 'block';
  } else if (currentTab === 'timeline') {
    document.getElementById('tab-content-timeline').style.display = 'flex';
    updateSyncScrollHeight('timeline-scroll-container', 'timeline-scroll-spacer', 'timeline-a', 'timeline-b');
  } else if (currentTab === 'code') {
    document.getElementById('tab-content-code').style.display = 'flex';
    updateSyncScrollHeight('code-scroll-container', 'code-scroll-spacer', 'code-a', 'code-b');
  }
}

async function runDiagnosticAgent() {
  const diagnosisBox = document.getElementById('diagnosis-box');
  const diagnosisText = document.getElementById('diagnosis-text');
  const statusSpan = document.getElementById('summary-status');

  diagnosisBox.style.display = 'block';
  diagnosisText.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px;">
      <div class="spinner" style="width:20px; height:20px; border-width:2px; margin-bottom:0;"></div>
      <span>Running LLM variance diagnosis on the fly. This can take up to 20 seconds...</span>
    </div>
  `;
  statusSpan.innerText = 'Analyzing Runs...';
  statusSpan.style.color = '#d97706';

  // If in static mode, we fetch pre-generated markdown
  if (isStatic) {
    const resultsBase = 'results';
    // Format is results/test_xxx/variance_diagnoses/guideName-taskName-guided.md
    // Since we don't know the exact taskName or runType, we'll construct the filename:
    const fileName = `${guideName}-${activeTask}-guided.md`;
    const url = `${resultsBase}/${trialA}/variance_diagnoses/${fileName}`;
    
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
            <pre style="background:#fff; border:1px solid #fecaca; margin-top:8px; padding:10px; border-radius:4px; font-family:monospace;">gd compare ${trialA}/${runNumA}/${guideName}/${activeTask}/guided ${trialB}/${runNumB}/${guideName}/${activeTask}/guided</pre>
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
  // Use dynamic runTypeA and runTypeB values
  const relativeA = `${trialA}/${runNumA}/${guideName}/${activeTask}/${runTypeA}`;
  const relativeB = `${trialB}/${runNumB}/${guideName}/${activeTask}/${runTypeB}`;

  const apiUrl = `/api/compare?runDirA=${encodeURIComponent(relativeA)}&runDirB=${encodeURIComponent(relativeB)}`;
  
  try {
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

    // Set up a scrollable log container to stream raw output in real-time
    diagnosisText.innerHTML = `
      <div style="font-size:0.9em; font-weight:600; color:#d97706; margin-bottom:8px; display:flex; align-items:center; gap:8px;">
        <div class="spinner" style="width:16px; height:16px; border-width:2px; margin-bottom:0;"></div>
        <span>Streaming Gemini API diagnosis...</span>
      </div>
      <pre id="compare-log-stream" style="font-family:monospace; font-size:0.85em; background:#ffffff; border:1px solid #fde68a; padding:12px; border-radius:6px; overflow-x:auto; max-height:250px; overflow-y:auto; margin:0; white-space:pre-wrap; color:#334155; line-height:1.4; box-shadow:inset 0 1px 2px rgba(0,0,0,0.05);"></pre>
    `;
    const logPre = document.getElementById('compare-log-stream');
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';

    let lastUpdate = 0;
    let updatePending = false;

    function updateDOM() {
      if (logPre) {
        logPre.textContent = accumulatedText;
        logPre.scrollTop = logPre.scrollHeight;
      }
      updatePending = false;
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      accumulatedText += chunk;
      
      const now = performance.now();
      if (now - lastUpdate > 100) { // Limit DOM rendering to at most once per 100ms
        updateDOM();
        lastUpdate = now;
      } else if (!updatePending) {
        updatePending = true;
        // Schedule trailing update on the next animation frame to keep CPU load low
        requestAnimationFrame(() => {
          if (updatePending) {
            updateDOM();
            lastUpdate = performance.now();
          }
        });
      }
    }
    // Guarantee final, complete update when stream completes
    updateDOM();

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
    console.error('LLM Diagnosis error:', e);
    diagnosisText.innerHTML = `
      <div style="color:#b91c1c; font-weight:600;">On-the-fly LLM diagnosis failed.</div>
      <div style="font-size:0.9em; color:#64748b; margin-top:5px;">Error: ${escapeHtml(e.message)}</div>
      <div style="font-size:0.9em; margin-top:10px; color:#475569;">
        You can try running the comparison manually in your terminal:
        <pre style="background:#fff; border:1px solid #fecaca; margin-top:8px; padding:10px; border-radius:4px; font-family:monospace;">gd compare ../harness/results/${relativeA} ../harness/results/${relativeB}</pre>
      </div>
    `;
    statusSpan.innerText = 'Failed';
    statusSpan.style.color = '#b91c1c';
  }
}

function escapeHtml(str) {
  return (str || '').toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Global initialization
window.onload = async () => {
  if (initParams()) {
    // Create temporary scroll debug overlay
    const overlay = document.createElement('div');
    overlay.id = 'debug-scroll-overlay';
    overlay.style.cssText = 'position: fixed; top: 10px; right: 10px; background: rgba(15, 23, 42, 0.95); color: #22c55e; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 11px; z-index: 99999; pointer-events: none; border: 1px solid #334155; line-height: 1.5; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);';
    overlay.innerHTML = '<strong>Scroll Telemetry Debug:</strong><br>Drag scrollbar or scroll wheel to activate...';
    document.body.appendChild(overlay);

    await loadTrialMetadata();
    
    // Initialize combined scroll synchronization for Timeline and Code tabs
    setupSyncScroll('timeline-scroll-container', 'timeline-scroll-spacer', 'timeline-a', 'timeline-b');
    setupSyncScroll('code-scroll-container', 'code-scroll-spacer', 'code-a', 'code-b');
  }
};

/**
 * Sets up bidirectional, synchronized scrolling between a combined scrollbar container and two columns.
 * Also captures mouse wheel events on the columns and redirects them to the scrollbar container.
 */
function setupSyncScroll(scrollContainerId, spacerId, colAId, colBId) {
  const container = document.getElementById(scrollContainerId);
  const colA = document.getElementById(colAId);
  const colB = document.getElementById(colBId);

  if (!container || !colA || !colB) return;

  // 1. Synchronize scroll from scrollbar container to both columns
  container.addEventListener('scroll', () => {
    const top = container.scrollTop;
    colA.scrollTop = top;
    colB.scrollTop = top;

    // Update real-time debug overlay
    const overlay = document.getElementById('debug-scroll-overlay');
    if (overlay) {
      overlay.innerHTML = `
        <strong>Scroll Telemetry (${scrollContainerId.split('-')[0].toUpperCase()}):</strong><br>
        • Scrollbar scrollTop: ${Math.round(top)}px (max: ${container.scrollHeight - container.clientHeight}px)<br>
        • Col A (${colAId}) scrollTop: ${Math.round(colA.scrollTop)}px (scrollHeight: ${colA.scrollHeight}px, clientHeight: ${colA.clientHeight}px)<br>
        • Col B (${colBId}) scrollTop: ${Math.round(colB.scrollTop)}px (scrollHeight: ${colB.scrollHeight}px, clientHeight: ${colB.clientHeight}px)
      `;
    }
  });

  // 2. Capture wheel events on columns and redirect to the scrollbar container to enable native scrolling
  const handleWheel = (e) => {
    e.preventDefault();
    container.scrollTop += e.deltaY;
  };

  colA.addEventListener('wheel', handleWheel, { passive: false });
  colB.addEventListener('wheel', handleWheel, { passive: false });
}

/**
 * Updates the height of the combined scrollbar spacer dynamically to match the maximum scrollable height of the columns.
 */
function updateSyncScrollHeight(scrollContainerId, spacerId, colAId, colBId) {
  const container = document.getElementById(scrollContainerId);
  const spacer = document.getElementById(spacerId);
  const colA = document.getElementById(colAId);
  const colB = document.getElementById(colBId);

  if (!container || !spacer || !colA || !colB) return;

  // Tiny timeout to ensure DOM layout is fully rendered and scrollHeights are accurate
  setTimeout(() => {
    const maxScrollHeight = Math.max(colA.scrollHeight, colB.scrollHeight);
    spacer.style.height = `${maxScrollHeight}px`;
    
    // Reset scrollbars to top
    container.scrollTop = 0;
    colA.scrollTop = 0;
    colB.scrollTop = 0;
  }, 80);
}

// Expose module functions globally for inline HTML event handlers (since compare.js is loaded as a module)
window.switchTab = switchTab;
window.switchTask = switchTask;
