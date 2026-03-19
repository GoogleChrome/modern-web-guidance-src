export function generateClaudeTrajectoryHtml(logData: any[]): string {
  // Escape '<' in the JSON representation to prevent XSS or broken script tags
  const safeJsonData = JSON.stringify(logData).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Claude Code Trajectory</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; background-color: #f5f5f5; color: #333; line-height: 1.5; }
    .log-entry { margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; background: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .role-user { border-left: 4px solid #3b82f6; }
    .role-assistant { border-left: 4px solid #10b981; }
    .role-system { border-left: 4px solid #6b7280; }
    .meta { font-size: 0.85em; color: #666; margin-bottom: 8px; font-weight: bold; text-transform: uppercase; }
    .content-block { margin-top: 10px; }
    .text-content { white-space: pre-wrap; }
    .thought { background-color: #fef3c7; padding: 10px; border-radius: 4px; border-left: 4px solid #f59e0b; margin: 10px 0; font-family: monospace; white-space: pre-wrap; font-size: 0.9em; }
    .tool-use { background-color: #e0f2fe; padding: 10px; border-radius: 4px; border-left: 4px solid #0ea5e9; margin: 10px 0; font-family: monospace; white-space: pre-wrap; }
    .tool-result { background-color: #f3f4f6; padding: 10px; border-radius: 4px; border-left: 4px solid #9ca3af; margin: 10px 0; max-height: 300px; overflow-y: auto; font-family: monospace; font-size: 0.85em; white-space: pre-wrap; }
    .tool-result.error { background-color: #fef2f2; border-left-color: #ef4444; color: #b91c1c; }
    .code-change { background-color: #dcfce7; padding: 10px; border-radius: 4px; border-left: 4px solid #22c55e; margin: 10px 0; font-family: monospace; white-space: pre-wrap; }
    .raw-json { display: none; background: #f8f9fa; padding: 10px; border-radius: 4px; font-size: 0.8em; overflow-x: auto; margin-top: 10px; border: 1px solid #e5e7eb; white-space: pre-wrap; }
    .toggle-raw { cursor: pointer; color: #3b82f6; text-decoration: underline; font-size: 0.85em; margin-top: 10px; display: inline-block; }
  </style>
</head>
<body>
  <h2>Claude Code Trajectory Viewer</h2>
  <div id="logs"></div>
  <script>
    const logData = ${safeJsonData};
    const logsContainer = document.getElementById('logs');
    
    function escapeHtml(str) {
      return (str || '').toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function formatContent(content) {
      if (!content) return '';
      if (typeof content === 'string') {
        let html = escapeHtml(content);
        html = html.replace(/&lt;thinking&gt;([\\s\\S]*?)&lt;\\/thinking&gt;/g, '<div class="thought"><b>Thought:</b>\\n$1</div>');
        return '<div class="text-content">' + html + '</div>';
      }
      
      if (Array.isArray(content)) {
        return content.map(block => {
          if (block.type === 'text') {
             let html = escapeHtml(block.text);
             html = html.replace(/&lt;thinking&gt;([\\s\\S]*?)&lt;\\/thinking&gt;/g, '<div class="thought"><b>Thought:</b>\\n$1</div>');
             return '<div class="text-content">' + html + '</div>';
          }
          if (block.type === 'thinking') {
             let html = escapeHtml(block.thinking);
             return \`<div class="thought"><b>Thought:</b><br/>\${html}</div>\`;
          }
          if (block.type === 'redacted_thinking') {
             return \`<div class="thought"><b>Thought:</b><br/>[Redacted Thinking]</div>\`;
          }
          if (block.type === 'tool_use') {
             const safeName = escapeHtml(block.name || 'unknown');
             const safeId = escapeHtml(block.id || 'unknown');
             if (['replace', 'write_file', 'edit', 'str_replace_editor', 'file_edit', 'bash', 'run_shell_command', 'run_script'].includes((block.name || '').toLowerCase())) {
                 let formattedInput = '';
                 if (block.input && typeof block.input === 'object') {
                     formattedInput = Object.entries(block.input).map(([key, val]) => {
                         if (typeof val === 'string' && (val.includes('\\n') || val.length > 50)) {
                             return \`<div style="margin-top:10px;"><strong>\${escapeHtml(key)}:</strong><pre style="background: #fff; border: 1px solid #ccc; padding: 10px; overflow-x: auto; margin-top: 5px; white-space: pre-wrap; word-wrap: break-word;">\${escapeHtml(val)}</pre></div>\`;
                         } else {
                             const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
                             return \`<div style="margin-top:5px;"><strong>\${escapeHtml(key)}:</strong> <span>\${escapeHtml(strVal)}</span></div>\`;
                         }
                     }).join('');
                 } else {
                     formattedInput = escapeHtml(JSON.stringify(block.input, null, 2) || '');
                 }
                 return \`<div class="code-change"><b>Tool: \${safeName} [\${safeId}] (Code/File/Shell Modification)</b><br/>\${formattedInput}</div>\`;
             }
             const inputStr = JSON.stringify(block.input, null, 2) || '';
             const safeInput = escapeHtml(inputStr);
             return \`<div class="tool-use"><b>Tool: \${safeName} [\${safeId}]</b><br/>\${safeInput}</div>\`;
          }
          if (block.type === 'tool_result') {
             const out = typeof block.content === 'string' ? escapeHtml(block.content) : formatContent(block.content);
             const errorClass = block.is_error ? ' error' : '';
             const errorText = block.is_error ? ' [ERROR]' : '';
             return \`<div class="tool-result\${errorClass}"><b>Tool Result [\${escapeHtml(block.tool_use_id)}]\${errorText}:</b><br/>\${out}</div>\`;
          }
          return \`<div class="raw-json" style="display:block;">\${escapeHtml(JSON.stringify(block, null, 2))}</div>\`;
        }).join('');
      }
      return '<div class="text-content">' + escapeHtml(JSON.stringify(content, null, 2)) + '</div>';
    }

    logData.forEach((entry, i) => {
      const div = document.createElement('div');
      
      let role = entry.role || entry.type || 'unknown';
      let mainContent = entry.message || entry.content || entry;
      
      if (entry.message && entry.message.content) {
          mainContent = entry.message.content;
          role = entry.message.role || role;
      }

      div.className = 'log-entry role-' + escapeHtml(role);
      
      let innerHTML = \`<div class="meta">\${escapeHtml(role).toUpperCase()} (Entry \${i + 1})</div>\`;
      innerHTML += \`<div class="content-block">\${formatContent(mainContent)}</div>\`;
      
      innerHTML += \`
        <div class="toggle-raw" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'">Toggle Raw JSON</div>
        <pre class="raw-json">\${escapeHtml(JSON.stringify(entry, null, 2))}</pre>
      \`;
      
      div.innerHTML = innerHTML;
      logsContainer.appendChild(div);
    });
  </script>
</body>
</html>`;
}
