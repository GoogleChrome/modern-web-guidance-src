export function generateCodexTrajectoryHtml(logData: any[]): string {
  // Escape '<' in the JSON representation to prevent XSS or broken script tags
  const safeJsonData = JSON.stringify(logData).replace(/</g, '\\u003c');

  function escapeHtml(str: any): string {
    return (str || '').toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderTool(name: string, args: any, callId: string): string {
    const safeName = escapeHtml(name || 'unknown');
    let formattedArgs = '';
    try {
      const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
      formattedArgs = Object.entries(parsedArgs).map(([key, val]) => {
        if (typeof val === 'string' && (val.includes('\n') || val.length > 80)) {
          return '<div style="margin-top:10px;"><strong>' + escapeHtml(key) + ':</strong><pre style="background: #010409; border: 1px solid #30363d; padding: 12px; overflow-x: auto; margin-top: 8px; white-space: pre-wrap; color: #79c0ff;">' + escapeHtml(val) + '</pre></div>';
        }
        const displayVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return '<div style="margin-top:4px;"><strong>' + escapeHtml(key) + ':</strong> <span style="color: #79c0ff;">' + escapeHtml(displayVal) + '</span></div>';
      }).join('');
    } catch (e) {
      formattedArgs = escapeHtml(String(args));
    }
    return '<div class="tool-use"><b>Tool: ' + safeName + ' [' + escapeHtml(callId || 'unknown') + ']</b><br/>' + formattedArgs + '</div>';
  }

  // Pre-render log entries to static HTML with explicit step IDs
  let preRenderedLogsHtml = '';
  let sessionMetaHtml = '';
  let toolStepCounter = 0;

  if (Array.isArray(logData)) {
    logData.forEach((entry, i) => {
      let role = entry.role || entry.type || 'unknown';
      let contentHtml = '';

      if (entry.type === 'session_meta') {
        const p = entry.payload || {};
        sessionMetaHtml = '<div style="font-size: 0.9em; color: #8b949e; margin-top: 10px;">Session: <b>' + escapeHtml(p.id) + '</b> | CLI: <b>' + escapeHtml(p.cli_version) + '</b> | Model: <b>' + escapeHtml(p.model_provider) + '</b></div>';
        return;
      }

      const timestamp = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '';

      if (entry.type === 'turn_context') {
        role = 'system';
        contentHtml = '<div class="text-content" style="color:#8b949e;">[System Instructions Collapsed]</div>';
      } else if (entry.type === 'event_msg') {
        const p = entry.payload || {};
        if (p.type === 'user_message') {
          role = 'user';
          contentHtml = '<div class="text-content">' + escapeHtml(p.message) + '</div>';
        } else if (p.type === 'agent_message') {
          role = 'assistant';
          contentHtml = '<div class="text-content" style="color: #7ee787;">' + escapeHtml(p.message) + '</div>';
        } else if (p.type === 'token_count') {
          role = 'system';
          contentHtml = '<div class="text-content" style="font-size:0.8em; color:#8b949e;">Tokens: ' + (p.total_tokens || 'N/A') + '</div>';
        }
      } else if (entry.type === 'response_item') {
        const p = entry.payload || {};
        if (p.type === 'message') {
          role = p.role || 'assistant';
          const text = p.content?.[0]?.text || p.content?.[0]?.input_text || '';
          contentHtml = '<div class="text-content">' + escapeHtml(text) + '</div>';
        } else if (p.type === 'reasoning') {
          role = 'assistant';
          contentHtml = '<div class="thought"><b>Reasoning Process:</b><br/>' + escapeHtml(p.content || '[Reasoning]') + '</div>';
        } else if (p.type === 'function_call' || p.type === 'custom_tool_call') {
          role = 'assistant';
          contentHtml = renderTool(p.name, p.arguments, p.call_id);
        } else if (p.type === 'function_call_output' || p.type === 'custom_tool_call_output') {
          role = 'system';
          const errorClass = p.is_error ? ' error' : '';
          contentHtml = '<div class="tool-result' + errorClass + '"><b>Tool Result [' + escapeHtml(p.call_id) + ']:</b><br/>' + escapeHtml(p.output || '') + '</div>';
        }
      }

      if (contentHtml) {
        let elementId = 'entry-' + (i + 1);
        let stepBadgeHtml = '';
        if (entry.type === 'response_item' && entry.payload && (entry.payload.type === 'function_call' || entry.payload.type === 'custom_tool_call')) {
          toolStepCounter++;
          elementId = 'step-' + toolStepCounter;
          stepBadgeHtml = '<span class="step-badge" style="background:#1f6feb22; color:#58a6ff; border:1px solid #1f6feb; border-radius:4px; padding:2px 8px; font-size:0.8em; font-weight:bold; margin-left:8px;">STEP ' + toolStepCounter + '</span>';
        }
        let innerHTML = '<div class="log-entry role-' + escapeHtml(role) + '" id="' + elementId + '">';
        innerHTML += '<div class="meta"><div><span>' + escapeHtml(role).toUpperCase() + '</span>' + stepBadgeHtml + '</div><span class="timestamp">' + timestamp + '</span></div>';
        innerHTML += '<div class="content-block">' + contentHtml + '</div>';
        innerHTML += '<div class="toggle-raw" onclick="this.nextElementSibling.style.display = (this.nextElementSibling.style.display === \'block\' ? \'none\' : \'block\')">Toggle Raw JSON</div>';
        innerHTML += '<pre class="raw-json">' + escapeHtml(JSON.stringify(entry, null, 2)) + '</pre>';
        innerHTML += '</div>\n';
        preRenderedLogsHtml += innerHTML;
      }
    });
  }

  let html = '<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="utf-8">\n  <title>Codex CLI Trajectory</title>\n';
  
  // 1. CSS Styles
  html += '  <style>\n';
  html += '    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; background-color: #0d1117; color: #c9d1d9; line-height: 1.5; }\n';
  html += '    .container { max-width: 1200px; margin: 0 auto; }\n';
  html += '    .header { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #30363d; background: #010409; padding: 20px; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.2); }\n';
  html += '    .log-entry { margin-bottom: 20px; padding: 18px; border: 1px solid #30363d; background: #161b22; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); transition: transform 0.1s; }\n';
  html += '    .role-user { border-left: 5px solid #1f6feb; }\n';
  html += '    .role-assistant { border-left: 5px solid #238636; }\n';
  html += '    .role-developer { border-left: 5px solid #8957e5; }\n';
  html += '    .role-system { border-left: 5px solid #484f58; }\n';
  html += '    .meta { font-size: 0.85em; color: #8b949e; margin-bottom: 12px; font-weight: bold; font-family: ui-monospace, SFMono-Regular, monospace; display: flex; justify-content: space-between; border-bottom: 1px solid #21262d; padding-bottom: 4px; align-items: center; }\n';
  html += '    .timestamp { font-weight: normal; color: #6e7681; }\n';
  html += '    .content-block { margin-top: 10px; }\n';
  html += '    .text-content { white-space: pre-wrap; font-size: 0.95rem; color: #e6edf3; }\n';
  html += '    .thought { background-color: #0d1117; color: #d29922; padding: 15px; border-radius: 6px; border: 1px solid #d2992233; margin: 15px 0; font-family: ui-monospace, monospace; white-space: pre-wrap; font-size: 0.9em; position: relative; }\n';
  html += '    .thought b { color: #d29922; display: block; margin-bottom: 8px; text-transform: uppercase; font-size: 0.8em; }\n';
  html += '    .tool-use { background-color: #010409; padding: 15px; border-radius: 6px; border: 1px solid #1f6feb66; margin: 15px 0; font-family: ui-monospace, monospace; white-space: pre-wrap; color: #58a6ff; }\n';
  html += '    .tool-result { background-color: #010409; padding: 15px; border-radius: 6px; border: 1px solid #30363d; margin: 15px 0; max-height: 500px; overflow-y: auto; font-family: ui-monospace, monospace; font-size: 0.85em; white-space: pre-wrap; color: #c9d1d9; }\n';
  html += '    .tool-result.error { border-color: #f85149; background-color: #49020222; color: #ff7b72; }\n';
  html += '    .token-badge { display: inline-block; background-color: #21262d; color: #8b949e; padding: 2px 10px; border-radius: 12px; font-size: 0.75em; border: 1px solid #30363d; font-weight: normal; }\n';
  html += '    .raw-json { display: none; background: #010409; padding: 15px; border-radius: 6px; font-size: 0.85em; overflow-x: auto; margin-top: 15px; border: 1px solid #30363d; white-space: pre-wrap; color: #7d8590; }\n';
  html += '    .toggle-raw { cursor: pointer; color: #58a6ff; font-size: 0.8em; margin-top: 15px; display: inline-block; padding: 6px 12px; border: 1px solid #30363d; border-radius: 6px; background: #21262d; }\n';
  html += '    .toggle-raw:hover { background: #30363d; border-color: #8b949e; }\n';
  html += '    details summary { color: #58a6ff; cursor: pointer; font-weight: bold; margin-bottom: 10px; }\n';
  html += '    ::-webkit-scrollbar { width: 10px; }\n';
  html += '    ::-webkit-scrollbar-track { background: #0d1117; }\n';
  html += '    ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 5px; }\n';
  html += '  </style>\n';
  html += '</head>\n';

  // 2. HTML Body Structure with Pre-rendered Logs
  html += '<body>\n';
  html += '  <div class="container">\n';
  html += '    <div class="header" id="header">\n';
  html += '      <h2 style="margin: 0; color: #58a6ff;">Codex CLI Trajectory</h2>\n';
  html +=        sessionMetaHtml + '\n';
  html += '    </div>\n';
  html += '    <div id="logs">\n' + preRenderedLogsHtml + '    </div>\n';
  html += '  </div>\n';

  // 3. Auto-scroll Hash Listener
  html += '  <script>\n';
  html += '    if (window.location.hash) {\n';
  html += '      const target = document.querySelector(window.location.hash);\n';
  html += '      if (target) {\n';
  html += '        setTimeout(() => {\n';
  html += '          target.scrollIntoView({ behavior: "smooth", block: "center" });\n';
  html += '          target.style.outline = "3px solid #58a6ff";\n';
  html += '          target.style.boxShadow = "0 0 25px rgba(88, 166, 255, 0.6)";\n';
  html += '        }, 100);\n';
  html += '      }\n';
  html += '    }\n';
  html += '  </script>\n';
  html += '</body>\n';
  html += '</html>';

  return html;
}
