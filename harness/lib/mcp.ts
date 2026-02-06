import fs from 'fs';

/**
 * Updates the MCP configuration file to enable or disable the Google Developer Knowledge MCP server.
 * @param configFullPath Full path to the MCP configuration file (e.g. mcp_config.json or settings.json)
 * @param runType 'guided' or 'unguided'
 * @param apiKey The API key for the MCP server
 */
export function updateMcpConfig(configFullPath: string, runType: string, apiKey: string): void {
  let mcpConfig: { mcpServers?: Record<string, any> } = { mcpServers: {} };

  try {
    if (fs.existsSync(configFullPath)) {
      const content = fs.readFileSync(configFullPath, 'utf8');
      if (content.trim()) {
        mcpConfig = JSON.parse(content);
      }
    }
  } catch (e) {
    console.error(`Failed to read MCP config at ${configFullPath}:`, e);
  }

  if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};

  const serverName = 'google-developer-knowledge-mcp';
  // Note: 'guided' enables the server, anything else (like 'unguided') disables it.
  if (runType === 'guided') {
    mcpConfig.mcpServers[serverName] = {
      "serverUrl": "https://developerknowledge.googleapis.com/mcp",
      "headers": {
        "X-Goog-Api-Key": apiKey
      }
    };
    console.log(`Enabled ${serverName} MCP server in ${configFullPath}`);
  } else {
    if (mcpConfig.mcpServers[serverName]) {
      delete mcpConfig.mcpServers[serverName];
      console.log(`Disabled ${serverName} MCP server in ${configFullPath}`);
    }
  }

  try {
    fs.writeFileSync(configFullPath, JSON.stringify(mcpConfig, null, 2));
  } catch (e) {
    console.error(`Failed to write MCP config to ${configFullPath}:`, e);
  }
}
