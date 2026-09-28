import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
} from '../../../../test-fixture.ts';
import { SyntaxKind, type Project } from 'ts-morph';

// @ts-ignore: TS1470 suppression for import.meta under nodenext without type: module in package.json
const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('avoid-redundant-large-asset-downloads Target Grader', () => {
  // Requirement 1: The app feature-detects navigator.crossOriginStorage?.requestFileHandle once, up front, and falls back to a normal network fetch immediately when it's absent, rather than attempting a call unconditionally.
  test('feature-detects crossOriginStorage.requestFileHandle once up front with fallback to network fetch', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasFeatureDetection = sourceFiles.some((sf) => {
      const text = sf.getFullText();
      if (!text.includes('crossOriginStorage') || !text.includes('requestFileHandle')) return false;

      const propertyAccesses = sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
      const hasCOSProperty = propertyAccesses.some((p) => p.getName() === 'crossOriginStorage');
      const hasHandleProperty = propertyAccesses.some((p) => p.getName() === 'requestFileHandle');

      const ifStatements = sf.getDescendantsOfKind(SyntaxKind.IfStatement);
      const hasGuard = ifStatements.some((ifStmt) => {
        const cond = ifStmt.getExpression().getText();
        const thenText = ifStmt.getThenStatement().getText();
        return (
          (cond.includes('COS') ||
            cond.includes('crossOriginStorage') ||
            cond.includes('storage') ||
            cond.includes('support')) &&
          thenText.includes('requestFileHandle')
        );
      });

      return hasCOSProperty && hasHandleProperty && hasGuard;
    });

    expect(hasFeatureDetection).toBe(true);
  });

  // Requirement 2: Before fetching a large shared asset from the network, the app calls navigator.crossOriginStorage.requestFileHandle(hash) to check whether it is already available locally.
  test('calls requestFileHandle to check local storage before fetching from the network', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const checksBeforeFetch = sourceFiles.some((sf) => {
      const functions = [
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionExpression),
        ...sf.getDescendantsOfKind(SyntaxKind.ArrowFunction),
      ];

      return functions.some((fn) => {
        const calls = fn.getDescendantsOfKind(SyntaxKind.CallExpression);
        const fetchCall = calls.find((c) => {
          const expr = c.getExpression();
          return expr.getText() === 'fetch' || expr.getText().endsWith('.fetch');
        });
        const cosCall = calls.find((c) => {
          const text = c.getExpression().getText();
          return text.includes('requestFileHandle');
        });

        if (!fetchCall || !cosCall) return false;
        return cosCall.getStart() < fetchCall.getStart();
      });
    });

    expect(checksBeforeFetch).toBe(true);
  });

  // Requirement 3: The hash object passed to requestFileHandle() has a value that is a lowercase hexadecimal string and an algorithm naming a Web Crypto API hash algorithm (e.g. 'SHA-256').
  test('specifies hash object with a Web Crypto algorithm and lowercase hexadecimal value', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasValidHashObject = sourceFiles.some((sf) => {
      const objectLiterals = sf.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression);
      return objectLiterals.some((obj) => {
        const algorithmProp = obj.getProperty('algorithm');
        const valueProp = obj.getProperty('value');
        if (!algorithmProp || !valueProp) return false;

        const algoText = algorithmProp.getText();
        const valText = valueProp.getText();

        const hasValidAlgo = /SHA-(256|384|512)/i.test(algoText);
        const hasValidVal =
          /^[a-f0-9]{32,}$/.test(valText.replace(/['"`]/g, '')) ||
          valText.includes('hex') ||
          valText.includes('repeat') ||
          /['"`][a-f0-9]+['"`]/.test(valText);

        return hasValidAlgo && hasValidVal;
      });
    });

    expect(hasValidHashObject).toBe(true);
  });

  // Requirement 4: A NotFoundError thrown by requestFileHandle() is treated as a cache miss and triggers a fallback to a normal network fetch, never as definitive proof the file is absent from storage.
  test('treats NotFoundError as a cache miss and falls back to network fetch', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const fallsBackOnNotFound = sourceFiles.some((sf) => {
      const tryStatements = sf.getDescendantsOfKind(SyntaxKind.TryStatement);
      return tryStatements.some((tryStmt) => {
        const tryBlockText = tryStmt.getTryBlock().getText();
        if (!tryBlockText.includes('requestFileHandle')) return false;

        const catchClause = tryStmt.getCatchClause();
        if (!catchClause) return false;

        const enclosingFunction =
          tryStmt.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) ||
          tryStmt.getFirstAncestorByKind(SyntaxKind.FunctionExpression) ||
          tryStmt.getFirstAncestorByKind(SyntaxKind.ArrowFunction);

        if (!enclosingFunction) return false;
        const functionCalls = enclosingFunction.getDescendantsOfKind(SyntaxKind.CallExpression);
        const hasFetch = functionCalls.some((c) => {
          const expr = c.getExpression();
          return expr.getText() === 'fetch' || expr.getText().endsWith('.fetch');
        });

        return hasFetch;
      });
    });

    expect(fallsBackOnNotFound).toBe(true);
  });

  // Requirement 5: When storing a newly-downloaded file, the app requests a writable handle with { create: true }, then writes the complete file via createWritable() / write() / close() (or pipeTo()), regardless of whether the file might already exist.
  test('requests writable handle with create: true and completes write stream via createWritable/write/close', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasCompleteStorageFlow = sourceFiles.some((sf) => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const hasCreateHandle = calls.some((c) => {
        const text = c.getExpression().getText();
        if (!text.includes('requestFileHandle')) return false;
        const args = c.getArguments();
        return args.some((arg) => {
          const argText = arg.getText();
          return argText.includes('create') && argText.includes('true');
        });
      });

      const hasCreateWritable = calls.some((c) =>
        c.getExpression().getText().endsWith('createWritable')
      );
      const hasWrite = calls.some((c) => c.getExpression().getText().endsWith('write'));
      const hasCloseOrPipe = calls.some((c) => {
        const expr = c.getExpression().getText();
        return expr.endsWith('close') || expr.endsWith('pipeTo');
      });

      return hasCreateHandle && hasCreateWritable && hasWrite && hasCloseOrPipe;
    });

    expect(hasCompleteStorageFlow).toBe(true);
  });

  // Requirement 6: The app makes an explicit choice for the origins option based on the resource's real sharing scope: omitted for same-site-only, an explicit array of origin strings for a small trusted set, or '*' only for genuinely popular, non-proprietary resources — never using an enumerated origin list as a substitute for '*'.
  test('makes an explicit choice for origins sharing scope supporting omission for same-site and wildcard for public resources', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasDeliberateOriginsHandling = sourceFiles.some((sf) => {
      const text = sf.getFullText();
      const stringLiterals = sf.getDescendantsOfKind(SyntaxKind.StringLiteral);
      const hasWildcardOrigin = stringLiterals.some((s) => s.getLiteralValue() === '*');

      const hasOriginsProperty = text.includes('origins');
      const hasOmissionLogic =
        text.includes('origins !== undefined') ||
        text.includes('origins === undefined') ||
        text.includes('origins &&') ||
        /origins\s*\?\s*/.test(text);

      return (
        (hasWildcardOrigin && hasOriginsProperty) || (hasOriginsProperty && hasOmissionLogic)
      );
    });

    expect(hasDeliberateOriginsHandling).toBe(true);
  });

  // Requirement 7: The app does not assume origins: '*' guarantees a resource is retrievable by any origin; it still handles NotFoundError from a '*'-scoped lookup as an expected outcome, since availability gating can withhold confirmation even for globally-scoped resources.
  test('does not assume retrievability for globally-scoped resources and handles lookup rejections defensively', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const lookupIsDefensive = sourceFiles.some((sf) => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const lookupCalls = calls.filter((c) => {
        const expr = c.getExpression().getText();
        if (!expr.includes('requestFileHandle')) return false;
        const args = c.getArguments();
        return args.length === 1 || (args[1] && !args[1].getText().includes('create'));
      });

      if (lookupCalls.length === 0) return false;

      return lookupCalls.every((call) => {
        const enclosingTry = call.getFirstAncestorByKind(SyntaxKind.TryStatement);
        const isChainedCatch = call.getParent()?.getText().includes('.catch') ?? false;
        return Boolean(enclosingTry || isChainedCatch);
      });
    });

    expect(lookupIsDefensive).toBe(true);
  });

  // Requirement 8: The app does not call getFile() on a handle it just obtained via a create: true request until after that handle's write()/close() has resolved.
  test('does not call getFile on a newly obtained create: true handle before write and close resolve', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    let foundCreateHandle = false;
    let callsGetFilePrematurely = false;

    for (const sf of sourceFiles) {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      for (const call of calls) {
        if (!call.getExpression().getText().includes('requestFileHandle')) continue;
        const args = call.getArguments();
        const hasCreate = args.some((arg) => {
          const text = arg.getText();
          return text.includes('create') && text.includes('true');
        });
        if (!hasCreate) continue;

        foundCreateHandle = true;

        const enclosingBlock = call.getFirstAncestorByKind(SyntaxKind.Block);
        if (enclosingBlock) {
          const blockCalls = enclosingBlock.getDescendantsOfKind(SyntaxKind.CallExpression);
          const getFileCall = blockCalls.find((c) => c.getExpression().getText().endsWith('getFile'));
          const closeCall = blockCalls.find((c) => {
            const expr = c.getExpression().getText();
            return expr.endsWith('close') || expr.endsWith('pipeTo');
          });

          if (getFileCall) {
            if (!closeCall || getFileCall.getStart() < closeCall.getStart()) {
              callsGetFilePrematurely = true;
            }
          }
        }
      }
    }

    expect(foundCreateHandle && !callsGetFilePrematurely).toBe(true);
  });

  // Requirement 9: NotAllowedError from requestFileHandle() or getFile() is handled distinctly from NotFoundError, not treated as "asset absent."
  test('handles NotAllowedError distinctly from NotFoundError without treating it as asset absent', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const handlesNotAllowed = sourceFiles.some((sf) => {
      const stringLiterals = sf.getDescendantsOfKind(SyntaxKind.StringLiteral);
      const hasNotAllowedString = stringLiterals.some(
        (s) => s.getLiteralValue() === 'NotAllowedError'
      );
      if (!hasNotAllowedString) return false;

      const text = sf.getFullText();
      const hasDistinctionLogic =
        text.includes('NotAllowedError') &&
        (text.includes('blocked') || text.includes('policy') || text.includes('isNotAllowed'));

      return hasDistinctionLogic;
    });

    expect(handlesNotAllowed).toBe(true);
  });

  // Requirement 10: Concurrent lookups or writes for multiple distinct hashes use Promise.all() over individual requestFileHandle() calls, not a single batched call.
  test('uses Promise.all over individual requestFileHandle calls for concurrent operations', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const allCalls = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );
    const hasPromiseAll = allCalls.some((c) => c.getExpression().getText() === 'Promise.all');
    const requestHandleCalls = allCalls.filter((c) =>
      c.getExpression().getText().includes('requestFileHandle')
    );

    const neverBatchesHandleCall = requestHandleCalls.every((c) => {
      const firstArg = c.getArguments()[0];
      return !firstArg || firstArg.getKind() !== SyntaxKind.ArrayLiteralExpression;
    });

    const isConcurrentOverIndividualCalls =
      hasPromiseAll && neverBatchesHandleCall && requestHandleCalls.length > 0;

    expect(isConcurrentOverIndividualCalls).toBe(true);
  });
});
