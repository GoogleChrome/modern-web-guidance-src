import { test, expect } from '../../../../test-fixture.ts';
import { extractTargetFilesFromPatch } from '../../../../../lib/patch-utils.ts';
import * as path from 'path';
import * as fs from 'fs';
import { parseHTML } from 'linkedom';
import { Project, SyntaxKind } from 'ts-morph';

// Setup target workspace details
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);

const patchFile = process.env.PATCH_FILE;
if (!patchFile) {
  throw new Error('PATCH_FILE environment variable not set.');
}

const targetFiles = extractTargetFilesFromPatch(patchFile);
const absoluteTargetFiles = targetFiles.map(f => path.join(targetDir, f));

let cloningFunctionName = 'deepClone';

test.describe('Deep Copy Objects Grader', () => {

  test.beforeAll(() => {
    const htmlFiles = absoluteTargetFiles.filter(f => f.endsWith('.html') || f.endsWith('.astro'));
    const jsFiles = absoluteTargetFiles.filter(f => f.endsWith('.js') || f.endsWith('.ts'));
    
    const project = new Project({ useInMemoryFileSystem: true });

    const findName = (code: string) => {
      const sourceFile = project.createSourceFile('temp.ts', code, { overwrite: true });
      const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
      for (const call of callExpressions) {
        if (call.getExpression().getText() === 'structuredClone') {
          let parent = call.getParent();
          while (parent) {
            if (parent.getKind() === SyntaxKind.FunctionDeclaration) {
              const name = (parent as any).getName();
              if (name) {
                cloningFunctionName = name;
                return true;
              }
            }
            if (parent.getKind() === SyntaxKind.ArrowFunction || parent.getKind() === SyntaxKind.FunctionExpression) {
              const variableDecl = parent.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
              if (variableDecl) {
                cloningFunctionName = variableDecl.getName();
                return true;
              }
            }
            parent = parent.getParent();
          }
        }
      }
      return false;
    };

    for (const file of htmlFiles) {
      if (!fs.existsSync(file)) continue;
      const htmlStr = fs.readFileSync(file, 'utf8');
      const { document } = parseHTML(htmlStr);
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        if (findName(script.textContent || '')) return;
      }
    }

    for (const file of jsFiles) {
      if (!fs.existsSync(file)) continue;
      if (findName(fs.readFileSync(file, 'utf8'))) return;
    }
  });

  test('Static Analysis: Should use structuredClone and avoid JSON.parse(JSON.stringify)', () => {
    const htmlFiles = absoluteTargetFiles.filter(f => f.endsWith('.html') || f.endsWith('.astro'));
    const jsFiles = absoluteTargetFiles.filter(f => f.endsWith('.js') || f.endsWith('.ts'));
    
    let foundStructuredClone = false;
    let foundJSONStringify = false;

    const project = new Project({ useInMemoryFileSystem: true });

    const processCode = (code: string) => {
      const sourceFile = project.createSourceFile('temp.ts', code, { overwrite: true });
      
      const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
      for (const call of callExpressions) {
        const expression = call.getExpression().getText();
        if (expression === 'structuredClone') {
          foundStructuredClone = true;
        }
        
        if (expression === 'JSON.parse') {
          const args = call.getArguments();
          if (args.length > 0 && args[0].getKind() === SyntaxKind.CallExpression) {
            const innerCall = args[0] as any;
            if (innerCall.getExpression().getText() === 'JSON.stringify') {
              let parent = call.getParent();
              let isLegacy = false;
              while (parent) {
                if (parent.getKind() === SyntaxKind.FunctionDeclaration) {
                  const name = (parent as any).getName() || '';
                  if (name.toLowerCase().includes('legacy') || name.toLowerCase().includes('incorrect')) {
                    isLegacy = true;
                  }
                }
                parent = parent.getParent();
              }
              
              if (!isLegacy) {
                foundJSONStringify = true;
              }
            }
          }
        }
      }
    };

    for (const file of htmlFiles) {
      if (!fs.existsSync(file)) continue;
      const htmlStr = fs.readFileSync(file, 'utf8');
      const { document } = parseHTML(htmlStr);
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        processCode(script.textContent || '');
      }
    }

    for (const file of jsFiles) {
      if (!fs.existsSync(file)) continue;
      processCode(fs.readFileSync(file, 'utf8'));
    }
    
    expect(foundStructuredClone, 'The implementation should use structuredClone for deep cloning.').toBe(true);
    expect(foundJSONStringify, 'The implementation should not use JSON.parse(JSON.stringify) for deep cloning.').toBe(false);
  });

  test.describe('Browser tests', () => {
    
    test.beforeEach(async ({ page, TARGET_URL }) => {
      if (TARGET_URL.startsWith('http://localhost/')) {
        await page.route('http://localhost/*', async (route: any) => {
          const requestPath = new URL(route.request().url()).pathname;
          const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

          if (fs.existsSync(localFilePath)) {
            await route.fulfill({ path: localFilePath });
          } else {
            await route.continue();
          }
        });
      }
      
      await page.goto(TARGET_URL);

      // Expose a helper to find the deep copy function, checking both window and module exports
      await page.evaluate(async (relativeFiles) => {
        (window as any).getDeepCopyFunction = async () => {
          // 1. Search window
          for (const key in window) {
            if (key !== 'structuredClone' && key !== 'getDeepCopyFunction' && typeof (window as any)[key] === 'function') {
              try {
                const testObj = { a: 1 };
                const clone = (window as any)[key](testObj);
                if (clone && clone !== testObj && clone.a === 1) {
                  return (window as any)[key];
                }
              } catch {}
            }
          }

          // 2. Search modified modules
          for (const file of relativeFiles) {
            try {
              const urlPath = file.startsWith('/') ? file : '/' + file;
              const module = await import(urlPath);
              for (const key in module) {
                const potentialFn = module[key];
                if (typeof potentialFn === 'function') {
                  const testObj = { a: 1 };
                  const clone = potentialFn(testObj);
                  if (clone && clone !== testObj && clone.a === 1) {
                    return potentialFn;
                  }
                }
              }
            } catch (e) {
              // Ignore import failures
            }
          }

          // 3. No fallback
          return null;
        };
      }, targetFiles);
    });

    test('Cloning should handle Map, Set, and Date correctly', async ({ page }) => {
      const results = await page.evaluate(async () => {
        const cloneFunc = await (window as any).getDeepCopyFunction();
        if (typeof cloneFunc !== 'function') return { error: `Deep copy function not found` };

        const original = {
          date: new Date('2026-07-19T12:00:00Z'),
          set: new Set([1, 2, 3]),
          map: new Map([['a', 1], ['b', 2]])
        };

        const clone = cloneFunc(original);

        return {
          dateOk: (clone.date instanceof Date) && clone.date.getTime() === original.date.getTime() && clone.date !== original.date,
          setOk: (clone.set instanceof Set) && clone.set.size === 3 && clone.set.has(1) && clone.set !== original.set,
          mapOk: (clone.map instanceof Map) && clone.map.get('a') === 1 && clone.map !== original.map
        };
      });

      if (results.error) throw new Error(results.error);
      expect(results.dateOk, 'Date should be correctly cloned as a new Date instance').toBe(true);
      expect(results.setOk, 'Set should be correctly cloned as a new Set instance').toBe(true);
      expect(results.mapOk, 'Map should be correctly cloned as a new Map instance').toBe(true);
    });

    test('Cloning should handle circular references', async ({ page }) => {
      const results = await page.evaluate(async () => {
        const cloneFunc = await (window as any).getDeepCopyFunction();
        if (typeof cloneFunc !== 'function') return { error: `Deep copy function not found` };

        const original: any = { name: 'circular' };
        original.self = original;

        try {
          const clone = cloneFunc(original);
          return {
            success: true,
            isCircular: clone.self === clone,
            isNewObject: clone !== original
          };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      });

      if (results.error && !results.success) throw new Error(`Circular reference cloning failed: ${results.error}`);
      expect(results.success, 'Cloning should not throw on circular references').toBe(true);
      expect(results.isCircular, 'Circular reference should be maintained in the clone').toBe(true);
      expect(results.isNewObject, 'Cloned object should be a new instance').toBe(true);
    });

    test('Cloned object should be independent (mutation test)', async ({ page }) => {
      const results = await page.evaluate(async () => {
        const cloneFunc = await (window as any).getDeepCopyFunction();
        if (typeof cloneFunc !== 'function') return { error: `Deep copy function not found` };

        const original = {
          nested: { value: 10 },
          set: new Set([1]),
          map: new Map([['key', 'val']])
        };

        const clone = cloneFunc(original);
        
        // Mutate clone
        clone.nested.value = 20;
        clone.set.add(2);
        clone.map.set('key', 'newVal');

        return {
          nestedIndependent: original.nested.value === 10,
          setIndependent: !original.set.has(2),
          mapIndependent: original.map.get('key') === 'val'
        };
      });

      if (results.error) throw new Error(results.error);
      expect(results.nestedIndependent, 'Mutating nested property in clone should not affect original').toBe(true);
      expect(results.setIndependent, 'Mutating Set in clone should not affect original').toBe(true);
      expect(results.mapIndependent, 'Mutating Map in clone should not affect original').toBe(true);
    });
  });
});
