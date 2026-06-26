import { getAccessToken } from './utils.js';

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

// Parsed run data
let runDirA = '';
let runDirB = '';
let suiteDataA = null;
let suiteDataB = null;

// Simple markdown to HTML parser
function renderMarkdown(md) {
  if (!md) return '';
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Headings
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Lists
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>');
  // Clean up consecutive <ul> lists
  html = html.replace(/<\/ul>\s*<ul>/g, '\n');

  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';
  
  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');
  
  return html;
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
  
  // Trial B
  if (trialA === trialB) {
    document.getElementById('title-b').innerText = `${trialA.slice(0, 18)} (Run ${runNumB})`;
    document.getElementById('meta-b').innerText = 'Within-Trial Non-determinism Check';
  } else {
    document.getElementById('title-b').innerText = `${trialB.slice(0, 18)} (Run ${runNumB})`;
    document.getElementById('meta-b').innerText = trialB.includes('test-') ? `Date: ${trialB.replace('test-', '').slice(0, 10)}` : 'Historical Suite';
  }

  // Calculate Scores for the specific guide
  const scoreA = calculateGuideScore(suiteDataA, runNumA);
  const scoreB = calculateGuideScore(suiteDataB, runNumB);

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
  if (task === activeTask) return;
  activeTask = task;
  
  // Update sidebar active state
  document.querySelectorAll('.task-btn').forEach(btn => {
    btn.classList.toggle('active', btn.innerText === activeTask);
  });

  await loadActiveTaskDetails();
}

async function loadActiveTaskDetails() {
  document.getElementById('compare-loading').style.display = 'flex';
  document.getElementById('tab-content-assertions').style.display = 'none';
  document.getElementById('tab-content-timeline').style.display = 'none';
  document.getElementById('tab-content-code').style.display = 'none';

  const resultsBase = isStatic ? 'results' : '';
  
  // Format run directory paths
  // e.g. results/test-xxx/1/guideName/taskName/guided
  const pathPartA = `${trialA}/${runNumA}/${guideName}/${activeTask}/guided`;
  const pathPartB = `${trialB}/${runNumB}/${guideName}/${activeTask}/guided`;
  
  runDirA = `${resultsBase}/${pathPartA}`;
  runDirB = `${resultsBase}/${pathPartB}`;

  // Update split-pane column titles
  document.getElementById('timeline-title-a').innerText = `Trial A (Run ${runNumA})`;
  document.getElementById('timeline-title-b').innerText = `Trial B (Run ${runNumB})`;
  document.getElementById('code-title-a').innerText = `Trial A (Run ${runNumA})`;
  document.getElementById('code-title-b').innerText = `Trial B (Run ${runNumB})`;
  document.getElementById('header-assert-a').innerText = `Trial A (Run ${runNumA})`;
  document.getElementById('header-assert-b').innerText = `Trial B (Run ${runNumB})`;

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
          ${argsStr ? `<pre style="margin-top:5px; font-size:0.85em; background:#ffffff; border:1px solid #e2e8f0; padding:5px; border-radius:4px; overflow-x:auto;">${escapeHtml(argsStr)}</pre>` : ''}
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
  
  // Update tab buttons active state
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const btnTab = btn.onclick.toString().match(/'(\w+)'/)[1];
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
    document.getElementById('tab-content-timeline').style.display = 'grid';
  } else if (currentTab === 'code') {
    document.getElementById('tab-content-code').style.display = 'grid';
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
  // Relative run directories are passed, which are resolved relative to results/ on the server
  const relativeA = `${trialA}/${runNumA}/${guideName}/${activeTask}/guided`;
  const relativeB = `${trialB}/${runNumB}/${guideName}/${activeTask}/guided`;

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
        <span>Streaming JetskiCLI progress...</span>
      </div>
      <pre id="compare-log-stream" style="font-family:monospace; font-size:0.85em; background:#ffffff; border:1px solid #fde68a; padding:12px; border-radius:6px; overflow-x:auto; max-height:250px; overflow-y:auto; margin:0; white-space:pre-wrap; color:#334155; line-height:1.4; box-shadow:inset 0 1px 2px rgba(0,0,0,0.05);"></pre>
    `;
    const logPre = document.getElementById('compare-log-stream');
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      accumulatedText += chunk;
      
      if (logPre) {
        logPre.textContent = accumulatedText;
        // Scroll to the bottom as new logs stream in
        logPre.scrollTop = logPre.scrollHeight;
      }
    }

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
    await loadTrialMetadata();
  }
};
