import { escapeHtml } from './utils.js';
document.addEventListener('DOMContentLoaded', async () => {
  const tableBodyRaw = document.querySelector('#tasks-table tbody');
  const launchFormRaw = document.getElementById('launch-form');

  if (!tableBodyRaw || !launchFormRaw) return;

  const tableBody = tableBodyRaw;
  const launchForm = launchFormRaw;


  /** @type {Record<string, Record<string, string[]>>} */
  let allGuides = {};
  let selectedSkills = new Set(['modern-web-guidance']);

  try {
    const response = await fetch('/api/grouped-tasks');
    const data = await response.json();
    allGuides = data.guides || {};
    renderGuides(allGuides);
    const tasksTable = /** @type {HTMLTableElement | null} */ (document.getElementById('tasks-table'));
    updateHeaderChecks(tasksTable);
    updateRowChecks(tasksTable);
    
    const skillsResponse = await fetch('/api/available-skills');
    const skillsData = await skillsResponse.json();
    console.log('Skills received from API:', skillsData.skills);
    renderSkills(skillsData.skills || []);
    
    updateTaskCount();
  } catch (e) {
    console.error('Failed to fetch tasks or skills:', e);
  }

  /**
   * @param {string[]} skills
   */
  function renderSkills(skills) {
    // Sort skills to put modern-web first
    const sortedSkills = [...skills].sort((a, b) => {
      if (a.startsWith('modern-web')) return -1;
      if (b.startsWith('modern-web')) return 1;
      return a.localeCompare(b);
    });

    const container = document.getElementById('skills-container');
    if (!container) return;
    container.innerHTML = '';

    sortedSkills.forEach(skill => {
      const label = document.createElement('label');
      label.className = 'btn-toggle';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.name = 'skills';
      input.value = skill;
      input.checked = selectedSkills.has(skill);
      input.addEventListener('change', () => {
        if (input.checked) {
          selectedSkills.add(skill);
        } else {
          selectedSkills.delete(skill);
        }
      });
      label.append(input, skill);
      container.appendChild(label);
    });
  }

  function updateTaskCount() {
    const count = document.querySelectorAll('.task-check:checked').length;
    const guideCount = document.querySelectorAll('#tasks-table .task-check:checked').length;

    const spans = [
      document.querySelector('#launch-btn-header span'),
      document.querySelector('#launch-btn span')
    ];
    spans.forEach(span => {
      if (span) {
        span.textContent = count > 0 ? `Start Evaluation (${count} tasks)` : 'Start Evaluation';
      }
    });

    const guideHeader = document.getElementById('guide-header');

    if (guideHeader) {
      guideHeader.textContent = guideCount > 0 ? `Guide Tasks (${guideCount} selected)` : 'Guide Tasks';
    }
    if (count > 0) {
      const formError = document.getElementById('form-error');
      if (formError) { formError.hidden = true; formError.textContent = ''; }
    }
  }

  /**
   * @param {HTMLTableElement | null} table
   */
  function updateHeaderChecks(table) {
    if (!table) return;
    table.querySelectorAll('.header-check').forEach(headerCheck => {
      if (!(headerCheck instanceof HTMLInputElement)) return;
      const taskType = headerCheck.getAttribute('data-task');
      const checkboxes = Array.from(table.querySelectorAll(`.task-check[data-task="${CSS.escape(taskType || '')}"]`))
        .filter((c) => c instanceof HTMLInputElement);
      if (checkboxes.length > 0) {
        const allChecked = checkboxes.every(c => c.checked);
        const someChecked = checkboxes.some(c => c.checked);
        headerCheck.checked = allChecked;
        headerCheck.indeterminate = someChecked && !allChecked;
      }
    });
  }

  /**
   * @param {HTMLTableElement | null} table
   */
  function updateRowChecks(table) {
    if (!table) return;
    table.querySelectorAll('.guide-check-all').forEach(rowCheck => {
      if (!(rowCheck instanceof HTMLInputElement)) return;
      const guide = rowCheck.getAttribute('data-guide');
      const checkboxes = Array.from(table.querySelectorAll(`.task-check[data-guide="${CSS.escape(guide || '')}"]`))
        .filter((c) => c instanceof HTMLInputElement);
      if (checkboxes.length > 0) {
        const allChecked = checkboxes.every(c => c.checked);
        const someChecked = checkboxes.some(c => c.checked);
        rowCheck.checked = allChecked;
        rowCheck.indeterminate = someChecked && !allChecked;
      }
    });
  }

  document.addEventListener('change', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.classList.contains('task-check')) {
      const table = target.closest('table');
      updateTaskCount();
      updateHeaderChecks(table);
      updateRowChecks(table);
    } else if (target.classList.contains('header-check')) {
      updateTaskCount();
    }
  });

  /**
   * @param {Record<string, Record<string, string[]>>} guides
   */
  function renderGuides(guides) {
    const taskTypes = new Set();
    for (const catGuides of Object.values(guides)) {
      for (const tasks of Object.values(catGuides)) {
        tasks.forEach(t => taskTypes.add(t));
      }
    }
    const headers = Array.from(taskTypes).sort((a, b) => {
      const order = ['task', 'negative'];
      const indexA = order.indexOf(a);
      const indexB = order.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });

    tableBody.innerHTML = '';

    const headersRow = document.getElementById('table-headers');
    if (!headersRow) return;
    let headerHtml = `<th>Guide</th>`;
    headers.forEach(h => {
      const isSelected = h === 'task';
      const safeH = escapeHtml(h);
      const headerLabel = h === 'task' ? 'Select all default tasks' : `Select all ${safeH} tasks`;
      headerHtml += `<th class="checkbox-header">
        <label class="custom-checkbox">
          <input type="checkbox" class="header-check" data-task="${safeH}" aria-label="${headerLabel}" ${isSelected ? 'checked' : ''}>
          <span class="checkmark" aria-hidden="true"></span>
        </label>
      </th>`;
    });
    headersRow.innerHTML = headerHtml;

    const totalCols = headers.length + 1;

    let categoryIndex = 0;
    for (const [category, categoryGuides] of Object.entries(guides)) {
      const rowIdPrefix = `category-${categoryIndex++}-row`;
      const rowIds = Object.keys(categoryGuides).map((_, i) => `${rowIdPrefix}-${i}`);
      const headerRow = document.createElement('tr');
      headerRow.classList.add('category-header');
      headerRow.setAttribute('data-category', category);
      headerRow.innerHTML = `<td colspan="${totalCols}"><button type="button" class="category-toggle" aria-expanded="true" aria-controls="${rowIds.join(' ')}"><span class="expand-icon" aria-hidden="true">▼</span> ${escapeHtml(category)}</button></td>`;
      tableBody.appendChild(headerRow);

      let guideIndex = 0;
      for (const [guideName, tasks] of Object.entries(categoryGuides)) {
        const fullKey = `${category}/${guideName}`;
        const safeKey = escapeHtml(fullKey);
        const safeName = escapeHtml(guideName);
        const row = document.createElement('tr');
        row.id = rowIds[guideIndex++];
        row.classList.add('guide-row');
        row.setAttribute('data-category', category);

        let rowHtml = `
          <td class="guide-name">
            <div class="guide-cell-content">
              <label class="custom-checkbox">
                <input type="checkbox" class="guide-check-all" data-guide="${safeKey}">
                <span class="checkmark" aria-hidden="true"></span>
                ${safeName}
              </label>
            </div>
          </td>
        `;

        headers.forEach(h => {
          if (tasks.includes(h)) {
            const safeH = escapeHtml(h);
            rowHtml += `
              <td class="checkbox-cell">
                <label class="pill-checkbox">
                  <input type="checkbox" name="tasks" value="${safeKey}" class="task-check" data-guide="${safeKey}" data-task="${safeH}" aria-label="${safeName}: ${safeH}" ${h === 'task' ? 'checked' : ''}>
                  <span class="pill-label">${safeH}</span>
                </label>
              </td>
            `;
          } else {
            rowHtml += `<td class="checkbox-cell"></td>`;
          }
        });

        row.innerHTML = rowHtml;
        tableBody.appendChild(row);
      }
    }
  }

  // Attach row events (works exactly as before using fullKey as data-guide)
  document.querySelectorAll('.guide-check-all').forEach(check => {
    check.addEventListener('change', (e) => {
      const currentTarget = e.currentTarget;
      if (!(currentTarget instanceof HTMLInputElement)) return;
      const guide = currentTarget.getAttribute('data-guide');
      const checkboxes = document.querySelectorAll(`.task-check[data-guide="${CSS.escape(guide || '')}"]`);
      checkboxes.forEach(tc => {
        if (tc instanceof HTMLInputElement) tc.checked = currentTarget.checked;
      });
      const table = currentTarget.closest('table');
      if (table instanceof HTMLTableElement) {
        updateTaskCount();
        updateHeaderChecks(table);
      }
    });
  });

  document.querySelectorAll('.header-check').forEach(headerCheck => {
    headerCheck.addEventListener('change', (e) => {
      const currentTarget = e.currentTarget;
      if (!(currentTarget instanceof HTMLInputElement)) return;
      const taskType = currentTarget.getAttribute('data-task');
      const table = currentTarget.closest('table');
      if (!table || !(table instanceof HTMLTableElement)) return;
      const checkboxes = table.querySelectorAll(`.task-check[data-task="${CSS.escape(taskType || '')}"]`);
      checkboxes.forEach(tc => {
        if (tc instanceof HTMLInputElement) tc.checked = currentTarget.checked;
      });
      updateTaskCount();
      updateRowChecks(table);
    });
  });

  document.querySelectorAll('.task-check').forEach(tc => {
    tc.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  });

  document.querySelectorAll('.category-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      for (const id of (toggle.getAttribute('aria-controls') || '').split(' ')) {
        const row = id && document.getElementById(id);
        if (row) row.hidden = expanded;
      }
    });
  });

  let allDefaultState = false;
  let allNegativeState = false;

  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.id === 'action-all-default') {
      allDefaultState = !allDefaultState;
      document.querySelectorAll('.task-check').forEach(tc => {
        if (tc instanceof HTMLInputElement && tc.getAttribute('data-task') === 'task') {
          tc.checked = allDefaultState;
        }
      });
      target.innerText = allDefaultState ? 'De-select All task.md' : 'Select All task.md';
    } else if (target.id === 'action-all-negative') {
      allNegativeState = !allNegativeState;
      document.querySelectorAll('.task-check').forEach(tc => {
        if (tc instanceof HTMLInputElement && tc.getAttribute('data-task') === 'negative') {
          tc.checked = allNegativeState;
        }
      });
      target.innerText = allNegativeState ? 'De-select All negative' : 'Select All negative';
    } else if (target.id === 'action-clear') {
      document.querySelectorAll('input[type="checkbox"]').forEach(c => {
        if (c instanceof HTMLInputElement) c.checked = false;
      });
    } else if (target.id === 'action-clear-guides') {
      const table = document.getElementById('tasks-table');
      if (table) table.querySelectorAll('input[type="checkbox"]').forEach(c => { if (c instanceof HTMLInputElement) c.checked = false; });
    }
    
    if (['action-all-default', 'action-all-negative', 'action-clear', 'action-clear-guides'].includes(target.id)) {
      const table = /** @type {HTMLTableElement | null} */ (document.getElementById('tasks-table'));
      updateHeaderChecks(table);
      updateRowChecks(table);
      updateTaskCount();
    }
  });

  // Form Submission
  launchForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const selectedTasks = /** @type {string[]} */ (Array.from(document.querySelectorAll('.task-check:checked'))
      .map(tc => {
        const fullKey = tc.getAttribute('data-guide');
        const task = tc.getAttribute('data-task');
        if (!fullKey || !task) return null;
        const guideName = fullKey.split('/')[1] || fullKey;
        return `${guideName}/${task}`;
      })
      .filter(Boolean));
    
    if (selectedTasks.length === 0) {
      const formError = document.getElementById('form-error');
      if (formError) {
        formError.textContent = 'Please select at least one task to run.';
        formError.hidden = false;
        formError.scrollIntoView({ block: 'nearest' });
      }
      return;
    }

    const nameEl = document.getElementById('name');
    const numRunsEl = document.getElementById('numRuns');
    const workerCountEl = document.getElementById('workerCount');
    const agentEl = document.querySelector('input[name="agent"]:checked');

    const payload = {
      name: (nameEl instanceof HTMLInputElement) ? nameEl.value || null : null,
      numRuns: (numRunsEl instanceof HTMLInputElement) ? parseInt(numRunsEl.value) : 0,
      workerCount: (workerCountEl instanceof HTMLInputElement && workerCountEl.value) ? parseInt(workerCountEl.value) : null,
      agent: (agentEl instanceof HTMLInputElement) ? agentEl.value : '',
      tasks: selectedTasks,
      skillsToEnable: Array.from(selectedSkills)
    };

    const runBtn = document.getElementById('launch-btn');
    const headerBtn = document.getElementById('launch-btn-header');
    
    [runBtn, headerBtn].forEach(btn => {
      if (btn instanceof HTMLButtonElement) {
        btn.disabled = true;
        btn.innerHTML = '<span>⏳ Launching...</span>';
      }
    });

    try {
      const response = await fetch('/api/eval-launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data.success) {
        [runBtn, headerBtn].forEach(btn => {
          if (btn instanceof HTMLButtonElement) {
            btn.style.background = 'linear-gradient(135deg, #047857 0%, #065f46 100%)';
            btn.innerHTML = '<span>🚀 Started! Closing...</span>';
          }
        });
        
        setTimeout(() => {
          window.close();
        }, 1000);
      } else {
        throw new Error(data.error || 'Server rejected request');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`Launch failed: ${message}`);
      [runBtn, headerBtn].forEach(btn => {
        if (btn instanceof HTMLButtonElement) {
          btn.disabled = false;
          btn.innerHTML = '<span>Start Evaluation</span>';
        }
      });
    }
  });
});
