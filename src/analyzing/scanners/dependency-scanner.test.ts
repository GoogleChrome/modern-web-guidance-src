import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { DependencyRuleMatcher } from '../schema.ts';
import {
  createDependencyMatcher,
  isPureNodeBackendOrCliPackage,
  scanPackageJson,
  scanVendoredLibraryFile,
} from './dependency-scanner.ts';

const SAMPLE_SANITIZER_RULE: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: ['sanitize-html', 'dompurify', 'moment'],
};

describe('dependency-scanner runtime & client-side filtering', () => {
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

  it('scans checked-in vendored library files and identifies packages at line 1 (Slice C)', () => {
    const fittextRule: DependencyRuleMatcher = {
      kind: 'dependency',
      packages: ['jquery-fittext', 'fittext'],
    };

    const fittextMatches = scanVendoredLibraryFile(
      'vendor/jquery.fittext.js',
      '/*! jQuery FitText.js 1.2 */\n(function($){})(jQuery);',
      [fittextRule],
    );
    assert.equal(fittextMatches.length, 1);
    assert.equal(fittextMatches[0]?.line, 1);
    assert.equal(fittextMatches[0]?.isVendoredLibrary, true);
    assert.match(fittextMatches[0]?.message ?? '', /jquery\.fittext\.js/);

    const bodyScrollRule: DependencyRuleMatcher = {
      kind: 'dependency',
      packages: ['body-scroll-lock'],
      matchPackage: (pkgName) => ({
        message: `Package ${pkgName} replaces manual scroll locking.`,
      }),
    };

    const bslMatches = scanVendoredLibraryFile(
      'libs/body-scroll-lock.min.js',
      'var bodyScrollLock=function(){};',
      [bodyScrollRule],
    );
    assert.equal(bslMatches.length, 1);
    assert.equal(bslMatches[0]?.line, 1);
    assert.match(bslMatches[0]?.message ?? '', /body-scroll-lock/);
    assert.match(bslMatches[0]?.message ?? '', /replaces manual scroll locking/);

    const tablesawRule: DependencyRuleMatcher = {
      kind: 'dependency',
      packages: ['tablesaw'],
    };
    const tablesawMatches = scanVendoredLibraryFile(
      'js/tablesaw.jquery.js',
      '/*! Tablesaw - v3.1.2 */',
      [tablesawRule],
    );
    assert.equal(tablesawMatches.length, 1);
    assert.equal(tablesawMatches[0]?.line, 1);

    const humanizeRule: DependencyRuleMatcher = {
      kind: 'dependency',
      packages: ['humanize-duration'],
    };
    const humanizeMatches = scanVendoredLibraryFile(
      'vendor/humanize-duration.js',
      '// HumanizeDuration.js\nfunction humanizeDuration(){}',
      [humanizeRule],
    );
    assert.equal(humanizeMatches.length, 1);
    assert.equal(humanizeMatches[0]?.line, 1);

    const markRule: DependencyRuleMatcher = {
      kind: 'dependency',
      packages: ['mark.js'],
    };
    const markMatches = scanVendoredLibraryFile(
      'js/jquery.mark.min.js',
      'var Mark=function(){};',
      [markRule],
    );
    assert.equal(markMatches.length, 1);
    assert.equal(markMatches[0]?.line, 1);

    const lozadRule: DependencyRuleMatcher = {
      kind: 'dependency',
      packages: ['lozad'],
    };
    const lozadMatches = scanVendoredLibraryFile(
      'vendor/lozad.min.js',
      '/*! lozad.js - v1.16.0 */',
      [lozadRule],
    );
    assert.equal(lozadMatches.length, 1);
    assert.equal(lozadMatches[0]?.line, 1);

    const lazyloadRule: DependencyRuleMatcher = {
      kind: 'dependency',
      packages: ['vanilla-lazyload'],
    };
    const lazyloadMatches = scanVendoredLibraryFile(
      'vendor/lazyload.min.js',
      '/*! Vanilla LazyLoad */',
      [lazyloadRule],
    );
    assert.equal(lazyloadMatches.length, 1);
    assert.equal(lazyloadMatches[0]?.line, 1);

    const aosRule: DependencyRuleMatcher = {
      kind: 'dependency',
      packages: ['aos'],
    };
    const aosMatches = scanVendoredLibraryFile(
      'vendor/aos.js',
      'window.AOS = {};',
      [aosRule],
    );
    assert.equal(aosMatches.length, 1);
    assert.equal(aosMatches[0]?.line, 1);

    const momentRule: DependencyRuleMatcher = {
      kind: 'dependency',
      packages: ['moment'],
    };
    const momentHijriMatches = scanVendoredLibraryFile(
      'vendor/moment-hijri.js',
      '// moment-hijri.js\nmoment.fn.hijri = function(){};',
      [{ kind: 'dependency', packages: ['moment-hijri'] }],
    );
    assert.equal(momentHijriMatches.length, 1);
    assert.equal(momentHijriMatches[0]?.line, 1);

    const momentWithCnMatches = scanVendoredLibraryFile(
      'vendor/moment-with-cn.js',
      '//! moment.js\n//! locale : chinese (zh-cn)',
      [momentRule],
    );
    assert.equal(momentWithCnMatches.length, 1);
    assert.equal(momentWithCnMatches[0]?.line, 1);
  });

  it('skips vendored detection for files in node_modules, dist, or build directories', () => {
    const fittextRule: DependencyRuleMatcher = {
      kind: 'dependency',
      packages: ['jquery-fittext', 'fittext'],
    };

    assert.equal(
      scanVendoredLibraryFile(
        'node_modules/fittext/jquery.fittext.js',
        '/*! FitText.js */',
        [fittextRule],
      ).length,
      0,
    );

    assert.equal(
      scanVendoredLibraryFile(
        'dist/fittext.min.js',
        '/*! FitText.js */',
        [fittextRule],
      ).length,
      0,
    );

    assert.equal(
      scanVendoredLibraryFile(
        'build/jquery.fittext.js',
        '/*! FitText.js */',
        [fittextRule],
      ).length,
      0,
    );
  });

  it('skips first-party application files that do not match vendored or minified criteria', () => {
    const fittextRule: DependencyRuleMatcher = {
      kind: 'dependency',
      packages: ['fittext'],
    };

    assert.equal(
      scanVendoredLibraryFile(
        'src/components/FitTextBanner.tsx',
        'export function FitTextBanner() { return null; }',
        [fittextRule],
      ).length,
      0,
    );

    assert.equal(
      scanVendoredLibraryFile(
        'src/utils/text.js',
        'export function fitText() {}',
        [fittextRule],
      ).length,
      0,
    );
  });

  it('does not false-positive on author names like Mark Otto in Bootstrap copyright headers (regression test)', () => {
    const markRule: DependencyRuleMatcher = {
      kind: 'dependency',
      packages: ['mark.js', 'markjs'],
    };

    const bootstrapHeader = [
      '/*!',
      ' * Bootstrap v4.1.3 (https://getbootstrap.com/)',
      ' * Copyright 2011-2018 The Bootstrap Authors',
      ' * Copyright 2011-2018 Twitter, Inc.',
      ' * Authors: Mark Otto, Jacob Thornton',
      ' * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)',
      ' */',
      '(function (global, factory) {',
      '  typeof exports === "object" && typeof module !== "undefined" ? factory(exports, require("jquery"), require("popper.js")) :',
      '  typeof define === "function" && define.amd ? define(["exports", "jquery", "popper.js"], factory) :',
      '  (factory((global.bootstrap = {}), global.jQuery, global.Popper));',
      '}(this, (function (exports, $, Popper) {',
      '})));',
    ].join('\n');

    const matches = scanVendoredLibraryFile(
      'vendor/bootstrap.js',
      bootstrapHeader,
      [markRule],
    );
    assert.equal(matches.length, 0);
  });

  it('does not false-positive on prose words like "chosen" or "countries" in license text', () => {
    const chosenRule: DependencyRuleMatcher = {
      kind: 'dependency',
      packages: ['chosen-js'],
    };
    const countriesRule: DependencyRuleMatcher = {
      kind: 'dependency',
      packages: ['i18n-iso-countries', 'countries'],
    };

    const licenseWithProse = [
      '/*!',
      ' * SomeUtility v1.0.0',
      ' * Licensed under the Apache License, Version 2.0.',
      ' * Redistribution and use are permitted in all countries.',
      ' * In any venue chosen by the user, this license applies.',
      ' */',
      'function util() {}',
    ].join('\n');

    assert.equal(
      scanVendoredLibraryFile('vendor/util.js', licenseWithProse, [chosenRule]).length,
      0,
    );
    assert.equal(
      scanVendoredLibraryFile('vendor/util.js', licenseWithProse, [countriesRule]).length,
      0,
    );
  });

  it('correctly matches legitimate mark.js and chosen-js library banners', () => {
    const markRule: DependencyRuleMatcher = {
      kind: 'dependency',
      packages: ['mark.js'],
    };
    const chosenRule: DependencyRuleMatcher = {
      kind: 'dependency',
      packages: ['chosen-js'],
    };

    const realMarkJsHeader = [
      '/*!***************************************************',
      ' * mark.js v8.11.1',
      ' * https://github.com/julmot/mark.js',
      ' * Copyright (c) 2014–2018, Julian Motz',
      ' * Released under the MIT license https://git.io/vwTVl',
      ' ***************************************************/',
      'var Mark = function(){};',
    ].join('\n');

    const markMatches = scanVendoredLibraryFile(
      'vendor/custom-highlighter.js',
      realMarkJsHeader,
      [markRule],
    );
    assert.equal(markMatches.length, 1);
    assert.equal(markMatches[0]?.line, 1);

    const realChosenHeader = [
      '/*!',
      'Chosen, a Select Box Enhancer for jQuery and Prototype',
      'by Patrick Filler for Harvest, http://getharvest.com',
      '',
      'Version 1.8.7',
      'Full source at https://github.com/harvesthq/chosen',
      'Copyright (c) 2011-2018 by Harvest',
      '*/',
      'var SelectParser = function(){};',
    ].join('\n');

    const chosenMatches = scanVendoredLibraryFile(
      'vendor/custom-select.js',
      realChosenHeader,
      [chosenRule],
    );
    assert.equal(chosenMatches.length, 1);
    assert.equal(chosenMatches[0]?.line, 1);
  });

  it('createDependencyMatcher formats package matches and honors null skips', () => {
    const matcher = createDependencyMatcher(['aos', 'franc'], (pkgName, versionRange, ctx) => {
      if (pkgName === 'franc' && ctx.packageJson.private === true) {
        return null;
      }
      return `Replace "${pkgName}" (${versionRange})`;
    });

    const pkg = JSON.stringify(
      {
        private: true,
        dependencies: {
          react: '^18.2.0',
          aos: '^2.3.4',
          franc: '^6.1.0',
        },
      },
      null,
      2,
    );

    const matches = scanPackageJson('package.json', pkg, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.message, 'Replace "aos" (^2.3.4)');
  });
});

