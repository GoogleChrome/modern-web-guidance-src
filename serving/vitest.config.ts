import { defineConfig } from 'vitest/config';

import os from 'os';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      MCP_LOG_DIR: os.tmpdir(),
    },
    exclude: ['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**', '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*', 'build/**'],
  },
});
