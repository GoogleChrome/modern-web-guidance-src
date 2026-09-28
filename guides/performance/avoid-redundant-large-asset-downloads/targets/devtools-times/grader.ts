import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
} from '../../../../test-fixture.ts';
import { SyntaxKind } from 'ts-morph';

const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('avoid-redundant-large-asset-downloads Target Grader', () => {
  const project = getJsProject(targetFiles);
  const sourceFiles = project.getSourceFiles().filter(sf => !sf.getFilePath().includes('test'));

  test('App feature-detects navigator.crossOriginStorage?.requestFileHandle once, up front, with immediate network fallback', () => {
    let hasFeatureDetection = false;
    for (const sf of sourceFiles) {
      const propAccesses = sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
      const hasCosProp = propAccesses.some(pa => pa.getName() === 'crossOriginStorage');
      const hasReqProp = propAccesses.some(pa => pa.getName() === 'requestFileHandle');

      if (hasCosProp && hasReqProp) {
        const isGuarded = propAccesses.some(pa => {
          if (pa.getName() !== 'requestFileHandle') return false;
          if (pa.hasQuestionDotToken()) return true;
          const parent = pa.getParent();
          if (!parent) return false;
          const parentKind = parent.getKind();
          return (
            parentKind === SyntaxKind.TypeOfExpression ||
            parentKind === SyntaxKind.PrefixUnaryExpression ||
            parentKind === SyntaxKind.BinaryExpression ||
            parentKind === SyntaxKind.IfStatement
          );
        });

        const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
        const hasFetch = calls.some(c => c.getExpression().getText() === 'fetch');

        if (isGuarded && hasFetch) {
          hasFeatureDetection = true;
          break;
        }
      }
    }
    expect(hasFeatureDetection).toBe(true);
  });

  test('App calls requestFileHandle(hash) before network fetch to check local availability', () => {
    let checksCOSBeforeFetch = false;
    for (const sf of sourceFiles) {
      const functionNodes = [
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
        ...sf.getDescendantsOfKind(SyntaxKind.ArrowFunction),
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionExpression),
      ];

      for (const fn of functionNodes) {
        const calls = fn.getDescendantsOfKind(SyntaxKind.CallExpression);
        const reqCalls = calls.filter(c => c.getExpression().getText().endsWith('requestFileHandle'));
        const fetchCalls = calls.filter(c => c.getExpression().getText() === 'fetch');

        if (reqCalls.length > 0 && fetchCalls.length > 0) {
          const readLookup = reqCalls.find(c => {
            const args = c.getArguments();
            return args.length === 1 || !args[1]?.getText().includes('create');
          });
          const firstFetch = fetchCalls[0];
          if (readLookup && readLookup.getStart() < firstFetch.getStart()) {
            checksCOSBeforeFetch = true;
            break;
          }
        }
      }
      if (checksCOSBeforeFetch) break;
    }
    expect(checksCOSBeforeFetch).toBe(true);
  });

  test('Hash object specifies a Web Crypto algorithm and a lowercase hexadecimal value', () => {
    const webCryptoAlgs = ['SHA-256', 'SHA-384', 'SHA-512', 'SHA-1'];
    let hasValidHashFormat = false;

    for (const sf of project.getSourceFiles()) {
      const objLiterals = sf.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression);
      for (const obj of objLiterals) {
        const algProp = obj.getProperty('algorithm');
        const valProp = obj.getProperty('value');
        if (algProp && valProp) {
          const algText = algProp.getText();
          const valText = valProp.getText();
          const matchesAlg = webCryptoAlgs.some(a => algText.includes(a));
          const isHex =
            /['"][0-9a-f]{32,}['"]/.test(valText) ||
            valText.includes('hex') ||
            valText.includes('toLowerCase');
          if (matchesAlg && isHex) {
            hasValidHashFormat = true;
            break;
          }
        }
      }

      const interfaces = sf.getDescendantsOfKind(SyntaxKind.InterfaceDeclaration);
      for (const iface of interfaces) {
        const alg = iface.getProperty('algorithm');
        const val = iface.getProperty('value');
        if (alg && val && webCryptoAlgs.some(a => alg.getText().includes(a))) {
          hasValidHashFormat = true;
          break;
        }
      }

      if (hasValidHashFormat) break;
    }
    expect(hasValidHashFormat).toBe(true);
  });

  test('NotFoundError from requestFileHandle is treated as a cache miss falling back to network fetch', () => {
    let handlesMissWithFetch = false;
    for (const sf of sourceFiles) {
      const tryStatements = sf.getDescendantsOfKind(SyntaxKind.TryStatement);
      for (const ts of tryStatements) {
        if (ts.getTryBlock().getText().includes('requestFileHandle')) {
          const catchClause = ts.getCatchClause();
          if (catchClause) {
            const statements = catchClause.getBlock().getStatements();
            const unconditionallyThrows = statements.some(s => s.getKind() === SyntaxKind.ThrowStatement);
            let enclosingFn = ts.getParent();
            while (
              enclosingFn &&
              ![SyntaxKind.FunctionDeclaration, SyntaxKind.ArrowFunction, SyntaxKind.FunctionExpression].includes(enclosingFn.getKind())
            ) {
              enclosingFn = enclosingFn.getParent();
            }
            if (enclosingFn && !unconditionallyThrows) {
              const fetchCalls = enclosingFn.getDescendantsOfKind(SyntaxKind.CallExpression)
                .filter(c => c.getExpression().getText() === 'fetch');
              if (fetchCalls.length > 0) {
                handlesMissWithFetch = true;
                break;
              }
            }
          }
        }
      }
      if (handlesMissWithFetch) break;
    }
    expect(handlesMissWithFetch).toBe(true);
  });

  test('Newly-downloaded file is stored with create: true and written via createWritable, write, and close', () => {
    let storesWithCreateTrueAndWrites = false;
    for (const sf of sourceFiles) {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const hasCreateTrue = calls.some(c => {
        if (!c.getExpression().getText().endsWith('requestFileHandle')) return false;
        const args = c.getArguments();
        return args.some(arg => arg.getText().includes('create') && arg.getText().includes('true'));
      });

      const hasCreateWritable = calls.some(c => c.getExpression().getText().endsWith('createWritable'));
      const hasWrite = calls.some(c => c.getExpression().getText().endsWith('write'));
      const hasCloseOrPipe = calls.some(c => {
        const expr = c.getExpression().getText();
        return expr.endsWith('close') || expr.endsWith('pipeTo');
      });

      if (hasCreateTrue && hasCreateWritable && (hasWrite || hasCloseOrPipe)) {
        storesWithCreateTrueAndWrites = true;
        break;
      }
    }
    expect(storesWithCreateTrueAndWrites).toBe(true);
  });

  test('App makes an explicit choice for origins sharing scope without substituting enumerated origins for wildcard', () => {
    let handlesOriginsScopeProperly = false;
    for (const sf of sourceFiles) {
      const text = sf.getFullText();
      const hasWildcardScope = text.includes("origins: '*'") || text.includes('origins: "*"');
      const hasConditionalOrigins =
        /origins\s*===?\s*undefined/.test(text) ||
        /\.\.\.\(\s*origins\b/.test(text) ||
        /origins\s*\?/.test(text);
      const hasScopeType = text.includes("'*' | string[]") || text.includes('"*" | string[]');

      if (hasWildcardScope || (hasConditionalOrigins && (hasScopeType || text.includes('origins')))) {
        handlesOriginsScopeProperly = true;
        break;
      }
    }
    expect(handlesOriginsScopeProperly).toBe(true);
  });

  test('App handles NotFoundError as expected outcome even when wildcard origins is used', () => {
    let handlesMissWithoutAssumingAvailability = false;
    for (const sf of sourceFiles) {
      const tryStatements = sf.getDescendantsOfKind(SyntaxKind.TryStatement);
      for (const ts of tryStatements) {
        if (ts.getTryBlock().getText().includes('requestFileHandle')) {
          const catchClause = ts.getCatchClause();
          if (catchClause) {
            let enclosingFn = ts.getParent();
            while (
              enclosingFn &&
              ![SyntaxKind.FunctionDeclaration, SyntaxKind.ArrowFunction, SyntaxKind.FunctionExpression].includes(enclosingFn.getKind())
            ) {
              enclosingFn = enclosingFn.getParent();
            }
            if (enclosingFn) {
              const fetchCalls = enclosingFn.getDescendantsOfKind(SyntaxKind.CallExpression)
                .filter(c => c.getExpression().getText() === 'fetch');
              if (fetchCalls.length > 0) {
                handlesMissWithoutAssumingAvailability = true;
                break;
              }
            }
          }
        }
      }
      if (handlesMissWithoutAssumingAvailability) break;
    }
    expect(handlesMissWithoutAssumingAvailability).toBe(true);
  });

  test('App does not call getFile() on create: true handle before write/close has resolved', () => {
    let adheresToHandleLifecycle = false;
    for (const sf of sourceFiles) {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const createHandleCalls = calls.filter(c =>
        c.getExpression().getText().endsWith('requestFileHandle') &&
        c.getArguments().some(a => a.getText().includes('create') && a.getText().includes('true'))
      );

      if (createHandleCalls.length > 0) {
        const hasErroneousGetFile = createHandleCalls.some(c => {
          const parentBlock = c.getFirstAncestorByKind(SyntaxKind.Block);
          if (!parentBlock) return false;
          const blockCalls = parentBlock.getDescendantsOfKind(SyntaxKind.CallExpression);
          return blockCalls.some(bc => bc.getExpression().getText().endsWith('getFile') && bc.getStart() > c.getStart());
        });

        if (!hasErroneousGetFile) {
          adheresToHandleLifecycle = true;
          break;
        }
      }
    }
    expect(adheresToHandleLifecycle).toBe(true);
  });

  test('NotAllowedError is handled distinctly from NotFoundError and does not treat asset as absent', () => {
    let handlesNotAllowedDistinctly = false;
    for (const sf of sourceFiles) {
      const stringLiterals = sf.getDescendantsOfKind(SyntaxKind.StringLiteral);
      const hasNotAllowed = stringLiterals.some(sl => sl.getLiteralValue() === 'NotAllowedError');
      if (hasNotAllowed) {
        const text = sf.getFullText();
        if (
          text.includes('NotAllowedError') &&
          (text.includes('blocked') ||
            text.includes('isBlocked') ||
            text.includes('name ===') ||
            text.includes("name === 'NotAllowedError'"))
        ) {
          handlesNotAllowedDistinctly = true;
          break;
        }
      }
    }
    expect(handlesNotAllowedDistinctly).toBe(true);
  });

  test('Concurrent lookups or writes for multiple distinct hashes use Promise.all over individual calls', () => {
    let usesPromiseAllForConcurrency = false;
    for (const sf of sourceFiles) {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      for (const c of calls) {
        if (c.getExpression().getText() === 'Promise.all') {
          const text = c.getText();
          if (/loadAsset|loadSharedAsset|CHART_|SharedAsset/.test(text)) {
            usesPromiseAllForConcurrency = true;
            break;
          }
        }
      }
      if (usesPromiseAllForConcurrency) break;
    }
    expect(usesPromiseAllForConcurrency).toBe(true);
  });
});
