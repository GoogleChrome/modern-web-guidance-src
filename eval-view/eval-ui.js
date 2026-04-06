document.addEventListener('DOMContentLoaded', async () => {
  const tableBody = document.querySelector('#tasks-table tbody');

  const launchForm = document.getElementById('launch-form');

  // Toggle button groups for Agent and Serving
  document.querySelectorAll('#agent-group .btn-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('#agent-group .btn-toggle').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      document.getElementById('agent').value = e.currentTarget.getAttribute('data-value');
    });
  });

  document.querySelectorAll('#serving-group .btn-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('#serving-group .btn-toggle').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      document.getElementById('serving').value = e.currentTarget.getAttribute('data-value');
    });
  });

  let allGuides = {};

  try {
    const response = await fetch('/api/grouped-tasks');
    const data = await response.json();
    allGuides = data.guides || {};
    renderGuides(allGuides);
    renderDisciplines(data.disciplines || {});
    updateTaskCount();
  } catch (e) {
    console.error('Failed to fetch tasks:', e);
  }

  function updateTaskCount() {
    const count = document.querySelectorAll('.task-check:checked').length;
    const discCount = document.querySelectorAll('#disciplines-table .task-check:checked').length;
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

    const discHeader = document.getElementById('discipline-header');
    const guideHeader = document.getElementById('guide-header');

    if (discHeader) {
      discHeader.textContent = discCount > 0 ? `Discipline Tasks (${discCount} selected)` : 'Discipline Tasks';
    }
    if (guideHeader) {
      guideHeader.textContent = guideCount > 0 ? `Guide Tasks (${guideCount} selected)` : 'Guide Tasks';
    }
  }

  function updateHeaderChecks(table) {
    if (!table) return;
    table.querySelectorAll('.header-check').forEach(headerCheck => {
      const taskType = headerCheck.getAttribute('data-task');
      const checkboxes = table.querySelectorAll(`.task-check[data-task="${taskType}"]`);
      if (checkboxes.length > 0) {
        const allChecked = Array.from(checkboxes).every(c => c.checked);
        headerCheck.checked = allChecked;
      }
    });
  }

  function updateRowChecks(table) {
    if (!table) return;
    table.querySelectorAll('.guide-check-all').forEach(rowCheck => {
      const guide = rowCheck.getAttribute('data-guide');
      const checkboxes = table.querySelectorAll(`.task-check[data-guide="${guide}"]`);
      if (checkboxes.length > 0) {
        const allChecked = Array.from(checkboxes).every(c => c.checked);
        rowCheck.checked = allChecked;
      }
    });
  }

  document.addEventListener('change', (e) => {
    if (e.target.classList.contains('task-check')) {
      const table = e.target.closest('table');
      updateTaskCount();
      updateHeaderChecks(table);
      updateRowChecks(table);
    } else if (e.target.classList.contains('header-check')) {
      updateTaskCount();
    }
  });

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
    let headerHtml = `<th>Guide</th>`;
    headers.forEach(h => {
      const isSelected = h === 'task';
      headerHtml += `<th class="checkbox-header">
        <label class="custom-checkbox">
          <input type="checkbox" class="header-check" data-task="${h}" ${isSelected ? 'checked' : ''}>
          <span class="checkmark"></span>
        </label>
      </th>`;
    });
    headersRow.innerHTML = headerHtml;

    const totalCols = headers.length + 1;

    for (const [category, categoryGuides] of Object.entries(guides)) {
      const headerRow = document.createElement('tr');
      headerRow.classList.add('category-header');
      headerRow.setAttribute('data-category', category);
      headerRow.innerHTML = `<td colspan="${totalCols}"><span class="expand-icon">▼</span> ${category}</td>`;
      tableBody.appendChild(headerRow);

      for (const [guideName, tasks] of Object.entries(categoryGuides)) {
        const fullKey = `${category}/${guideName}`;
        const row = document.createElement('tr');
        row.classList.add('guide-row');
        row.setAttribute('data-category', category);

        let rowHtml = `
          <td class="guide-name">
            <div class="guide-cell-content">
              <label class="custom-checkbox">
                <input type="checkbox" class="guide-check-all" data-guide="${fullKey}">
                <span class="checkmark"></span>
              </label>
              ${guideName}
            </div>
          </td>
        `;

        headers.forEach(h => {
          if (tasks.includes(h)) {
            rowHtml += `
              <td class="checkbox-cell">
                <label class="pill-checkbox">
                  <input type="checkbox" name="tasks" value="${fullKey}" class="task-check" data-guide="${fullKey}" data-task="${h}" ${h === 'task' ? 'checked' : ''}>
                  <span class="pill-label">${h}</span>
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

  function renderDisciplines(disciplines) {
    const tableBody = document.querySelector('#disciplines-table tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    for (const [disciplineName, tasks] of Object.entries(disciplines)) {
      const row = document.createElement('tr');
      row.classList.add('guide-row');
      
      let rowHtml = `
        <td class="guide-name">
          <div class="guide-cell-content">
            <label class="custom-checkbox">
              <input type="checkbox" class="guide-check-all" data-guide="${disciplineName}">
              <span class="checkmark"></span>
            </label>
            ${disciplineName}
          </div>
        </td>
      `;

      const headers = ['task', 'negative'];
      headers.forEach(h => {
        if (tasks.includes(h)) {
          rowHtml += `
            <td class="checkbox-cell">
              <label class="pill-checkbox">
                <input type="checkbox" name="tasks" value="${disciplineName}" class="task-check" data-guide="${disciplineName}" data-task="${h}" ${h === 'task' ? 'checked' : ''}>
                <span class="pill-label">${h}</span>
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

    // Attach row events (works exactly as before using fullKey as data-guide)
    document.querySelectorAll('.guide-check-all').forEach(check => {
      check.addEventListener('change', (e) => {
        const guide = e.currentTarget.getAttribute('data-guide');
        const checkboxes = document.querySelectorAll(`.task-check[data-guide="${guide}"]`);
        checkboxes.forEach(tc => {
          tc.checked = e.currentTarget.checked;
        });
        const table = e.currentTarget.closest('table');
        updateTaskCount();
        updateHeaderChecks(table);
      });
    });

    document.querySelectorAll('.header-check').forEach(headerCheck => {
      headerCheck.addEventListener('change', (e) => {
        const taskType = e.currentTarget.getAttribute('data-task');
        const table = e.currentTarget.closest('table');
        if (!table) return;
        const checkboxes = table.querySelectorAll(`.task-check[data-task="${taskType}"]`);
        checkboxes.forEach(tc => {
          tc.checked = e.currentTarget.checked;
        });
        updateTaskCount();
        updateRowChecks(table);
      });
    });

    document.querySelectorAll('.task-check').forEach(tc => {
      tc.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      tc.addEventListener('change', (e) => {
        const taskType = e.currentTarget.getAttribute('data-task');
        const guideKey = e.currentTarget.getAttribute('data-guide');

        // Update column header check!
        const colCheckboxes = document.querySelectorAll(`.task-check[data-task="${taskType}"]`);
        const headerCheck = document.querySelector(`.header-check[data-task="${taskType}"]`);
        const allColChecked = Array.from(colCheckboxes).every(c => c.checked);
        if (headerCheck) {
          headerCheck.checked = allColChecked;
        }

        // Update row guide check!
        const rowCheckboxes = document.querySelectorAll(`.task-check[data-guide="${guideKey}"]`);
        const guideCheck = document.querySelector(`.guide-check-all[data-guide="${guideKey}"]`);
        const allRowChecked = rowCheckboxes.length > 0 && Array.from(rowCheckboxes).every(c => c.checked);
        if (guideCheck) {
          guideCheck.checked = allRowChecked;
        }
      });
    });

    document.querySelectorAll('.category-header').forEach(header => {
      header.addEventListener('click', (e) => {
        const cat = e.currentTarget.getAttribute('data-category');
        const icon = e.currentTarget.querySelector('.expand-icon');
        const rows = document.querySelectorAll(`.guide-row[data-category="${cat}"]`);
        
        rows.forEach(r => r.classList.toggle('collapsed'));
        
        const isCollapsed = rows[0]?.classList.contains('collapsed');
        if (icon) {
          icon.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
        }
      });
    });

  let allDefaultState = false;
  let allNegativeState = false;

  document.addEventListener('click', (e) => {
    if (e.target.id === 'action-all-default') {
      allDefaultState = !allDefaultState;
      document.querySelectorAll('.task-check').forEach(tc => {
        if (tc.getAttribute('data-task') === 'task') tc.checked = allDefaultState;
      });
      e.target.innerText = allDefaultState ? 'De-select All task.md' : 'Select All task.md';
    } else if (e.target.id === 'action-all-negative') {
      allNegativeState = !allNegativeState;
      document.querySelectorAll('.task-check').forEach(tc => {
        if (tc.getAttribute('data-task') === 'negative') tc.checked = allNegativeState;
      });
      e.target.innerText = allNegativeState ? 'De-select All negative' : 'Select All negative';
    } else if (e.target.id === 'action-clear-guides') {
      const table = document.getElementById('tasks-table');
      if (table) table.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = false);
    } else if (e.target.id === 'action-clear-disciplines') {
      const table = document.getElementById('disciplines-table');
      if (table) table.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = false);
    }
    
    if (['action-all-default', 'action-all-negative', 'action-clear-guides', 'action-clear-disciplines'].includes(e.target.id)) {
      updateTaskCount();
    }
  });

  // Form Submission
  launchForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const selectedTasks = Array.from(document.querySelectorAll('.task-check:checked')).map(tc => {
      const fullKey = tc.getAttribute('data-guide');
      const guideName = fullKey.split('/')[1] || fullKey;
      const task = tc.getAttribute('data-task');
      return `${guideName}/${task}`;
    });
    
    if (selectedTasks.length === 0) {
      alert('Please select at least one task to run!');
      return;
    }

    const payload = {
      name: document.getElementById('name').value || undefined,
      numRuns: parseInt(document.getElementById('numRuns').value),
      agent: document.getElementById('agent').value,
      serving: document.getElementById('serving').value,
      tasks: selectedTasks
    };

    const runBtn = document.getElementById('launch-btn');
    const headerBtn = document.getElementById('launch-btn-header');
    
    [runBtn, headerBtn].forEach(btn => {
      if (btn) {
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
          if (btn) {
            btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
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
      alert(`Launch failed: ${err.message}`);
      [runBtn, headerBtn].forEach(btn => {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<span>Start Evaluation</span>';
        }
      });
    }
  });
});
