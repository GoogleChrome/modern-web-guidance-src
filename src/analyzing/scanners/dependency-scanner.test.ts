import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { DependencyRuleMatcher } from '../schema.ts';
import {
  isPureNodeBackendOrCliPackage,
  scanPackageJson,
} from './dependency-scanner.ts';

const SAMPLE_SANITIZER_RULE: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: ['sanitize-html', 'dompurify', 'moment'],
};

describe('dependency-scanner R46 runtime & client-side filtering', () => {
  it('ignores packages present only in devDependencies or optionalDependencies by default', () => {
    const pkgJson = JSON.stringify(
      {
        name: 'my-web-app',
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
        },
        devDependencies: {
          'sanitize-html': '^2.11.0',
          moment: '^2.29.4',
        },
        optionalDependencies: {
          dompurify: '^3.0.0',
        },
      },
      null,
      2,
    );

    const matches = scanPackageJson('package.json', pkgJson, [SAMPLE_SANITIZER_RULE]);
    assert.equal(matches.length, 0);
  });

  it('skips Node/Express/Pug server package.json files without a frontend framework (Card 4b438c1873e3)', () => {
    const expressPugServerPkg = JSON.stringify(
      {
        name: 'ocwa-portal-server',
        version: '1.0.0',
        main: 'app.js',
        dependencies: {
          express: '^4.17.1',
          pug: '^3.0.0',
          passport: '^0.4.1',
          'sanitize-html': '^2.7.0',
        },
        devDependencies: {
          nodemon: '^2.0.15',
          eslint: '^8.0.0',
        },
      },
      null,
      2,
    );

    assert.equal(
      isPureNodeBackendOrCliPackage(JSON.parse(expressPugServerPkg)),
      true,
    );
    const matches = scanPackageJson('frontend/package.json', expressPugServerPkg, [
      SAMPLE_SANITIZER_RULE,
    ]);
    assert.equal(matches.length, 0);
  });

  it('skips pure CLI packages with bin field and no browser/frontend framework', () => {
    const cliPkg = JSON.stringify(
      {
        name: 'markdown-cli-tool',
        version: '2.1.0',
        bin: {
          mdtool: './bin/cli.js',
        },
        dependencies: {
          commander: '^11.0.0',
          'sanitize-html': '^2.11.0',
        },
      },
      null,
      2,
    );

    assert.equal(isPureNodeBackendOrCliPackage(JSON.parse(cliPkg)), true);
    const matches = scanPackageJson('package.json', cliPkg, [SAMPLE_SANITIZER_RULE]);
    assert.equal(matches.length, 0);
  });

  it('matches runtime dependencies and peerDependencies in frontend app package.json files', () => {
    const frontendAppPkg = [
      '{',
      '  "name": "dashboard-ui",',
      '  "version": "1.0.0",',
      '  "dependencies": {',
      '    "react": "^18.2.0",',
      '    "react-dom": "^18.2.0",',
      '    "moment": "^2.29.4"',
      '  },',
      '  "peerDependencies": {',
      '    "dompurify": "^3.0.5"',
      '  }',
      '}',
    ].join('\n');

    const matches = scanPackageJson('package.json', frontendAppPkg, [
      SAMPLE_SANITIZER_RULE,
    ]);
    assert.equal(matches.length, 2);
    assert.equal(matches[0]?.line, 7);
    assert.match(matches[0]?.message ?? '', /moment/);
    assert.equal(matches[1]?.line, 10);
    assert.match(matches[1]?.message ?? '', /dompurify/);
  });

  it('matches full-stack frontend app package.json when both express and a frontend framework (react/vue/next) are present', () => {
    const ssrFrontendPkg = [
      '{',
      '  "name": "ssr-web-app",',
      '  "dependencies": {',
      '    "express": "^4.18.2",',
      '    "vue": "^3.4.0",',
      '    "moment": "^2.29.4"',
      '  }',
      '}',
    ].join('\n');

    const matches = scanPackageJson('package.json', ssrFrontendPkg, [
      SAMPLE_SANITIZER_RULE,
    ]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 6);
  });

  it('does not skip packages with a browser field even if bin or express is present, and handles single-line empty dependencies: {}', () => {
    const browserFieldPkg = [
      '{',
      '  "name": "isomorphic-browser-bundle",',
      '  "bin": "./bin/cli.js",',
      '  "browser": "./dist/browser.js",',
      '  "dependencies": {',
      '    "express": "^4.18.2",',
      '    "moment": "^2.29.4"',
      '  }',
      '}',
    ].join('\n');

    assert.equal(isPureNodeBackendOrCliPackage(JSON.parse(browserFieldPkg)), false);
    const matches = scanPackageJson('package.json', browserFieldPkg, [
      SAMPLE_SANITIZER_RULE,
    ]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 7);

    const emptyDepsSingleLinePkg = [
      '{',
      '  "name": "empty-runtime-deps",',
      '  "dependencies": {},',
      '  "devDependencies": {',
      '    "moment": "^2.29.4"',
      '  },',
      '  "peerDependencies": {',
      '    "moment": "^2.29.4"',
      '  }',
      '}',
    ].join('\n');

    const peerMatches = scanPackageJson('package.json', emptyDepsSingleLinePkg, [
      SAMPLE_SANITIZER_RULE,
    ]);
    assert.equal(peerMatches.length, 1);
    assert.equal(peerMatches[0]?.line, 8);
  });
});
