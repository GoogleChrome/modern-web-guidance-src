import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type Project, type SourceFile } from 'ts-morph';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAppSourceFiles(project: Project): SourceFile[] {
  return project
    .getSourceFiles()
    .filter((sf) => !/\.(test|spec)\.[a-z]+$/i.test(sf.getBaseName()));
}

test.describe('Measure interaction and soft-navigation paint timing Target Grader', () => {

  test('Feature-detects support for interaction-contentful-paint and soft-navigation via PerformanceObserver.supportedEntryTypes before observing', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = getAppSourceFiles(project);

    const accessesSupportedEntryTypes = sourceFiles.some((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((pa) => {
        if (pa.getName() !== 'supportedEntryTypes') return false;
        return pa.getExpression().getText().includes('PerformanceObserver');
      })
    );

    const callsPassingIcp = sourceFiles.some((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) =>
        call.getArguments().some((arg) => {
          if (arg.isKind(SyntaxKind.StringLiteral)) {
            return arg.getLiteralValue() === 'interaction-contentful-paint';
          }
          return false;
        })
      )
    );

    const callsPassingSoftNav = sourceFiles.some((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) =>
        call.getArguments().some((arg) => {
          if (arg.isKind(SyntaxKind.StringLiteral)) {
            return arg.getLiteralValue() === 'soft-navigation';
          }
          return false;
        })
      )
    );

    const hasDegradationGuard = sourceFiles.some((sf) => {
      const ifStatements = sf.getDescendantsOfKind(SyntaxKind.IfStatement);
      const hasGuardedIf = ifStatements.some((ifStmt) => {
        const thenStatement = ifStmt.getThenStatement();
        return thenStatement.getDescendantsOfKind(SyntaxKind.ReturnStatement).length > 0;
      });
      const hasConditionalExpr = sf.getDescendantsOfKind(SyntaxKind.ConditionalExpression).length > 0;
      const hasLogicalGuard = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression).some(
        (be) => be.getOperatorToken().getText() === '&&'
      );
      return hasGuardedIf || hasConditionalExpr || hasLogicalGuard;
    });

    const isFeatureDetected =
      accessesSupportedEntryTypes &&
      callsPassingIcp &&
      callsPassingSoftNav &&
      hasDegradationGuard;

    expect(isFeatureDetected).toBe(true);
  });

  function hasObserveForType(sourceFiles: SourceFile[], targetType: string): boolean {
    const resolveStrings = (node: import('ts-morph').Node | undefined, sf: SourceFile, seen = new Set<string>()): string[] => {
      if (!node) return [];
      const key = `${sf.getFilePath()}:${node.getStart()}:${node.getKind()}`;
      if (seen.has(key)) return [];
      seen.add(key);

      if (node.isKind(SyntaxKind.StringLiteral) || node.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)) {
        return [node.getLiteralValue()];
      }
      if (node.isKind(SyntaxKind.ArrayLiteralExpression)) {
        return node.getElements().flatMap((el) => resolveStrings(el, sf, seen));
      }
      if (node.isKind(SyntaxKind.Identifier)) {
        const name = node.getText();
        const out: string[] = [];

        // Variable declarations in file
        for (const decl of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
          if (decl.getName() === name) {
            if (decl.getInitializer()) {
              out.push(...resolveStrings(decl.getInitializer(), sf, seen));
            }
            // for (const name of expr)
            const declList = decl.getParent();
            const forOf = declList?.getParent();
            if (forOf && forOf.isKind(SyntaxKind.ForOfStatement)) {
              out.push(...resolveStrings(forOf.getExpression(), sf, seen));
            }
          }
        }

        // Function/arrow/method parameters
        for (const param of sf.getDescendantsOfKind(SyntaxKind.Parameter)) {
          if (param.getName() !== name) continue;
          const fn = param.getParent();
          const params = (fn as any).getParameters?.() as import('ts-morph').ParameterDeclaration[] | undefined;
          const idx = params ? params.indexOf(param) : -1;
          if (idx < 0) continue;

          let fnName: string | undefined;
          if (fn.isKind(SyntaxKind.FunctionDeclaration) || fn.isKind(SyntaxKind.MethodDeclaration)) {
            fnName = fn.getName();
          } else if (fn.isKind(SyntaxKind.ArrowFunction) || fn.isKind(SyntaxKind.FunctionExpression)) {
            const parent = fn.getParent();
            if (parent?.isKind(SyntaxKind.VariableDeclaration)) {
              fnName = parent.getName();
            }
          }
          if (!fnName) continue;

          for (const otherSf of sourceFiles) {
            for (const call of otherSf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
              const callee = call.getExpression();
              const calleeName = callee.isKind(SyntaxKind.Identifier)
                ? callee.getText()
                : callee.isKind(SyntaxKind.PropertyAccessExpression)
                  ? callee.getName()
                  : undefined;
              if (calleeName === fnName) {
                out.push(...resolveStrings(call.getArguments()[idx], otherSf, seen));
              }
            }
          }
        }
        return out;
      }
      return [];
    };

    const resolveObjectLiterals = (node: import('ts-morph').Node | undefined, sf: SourceFile): import('ts-morph').ObjectLiteralExpression[] => {
      if (!node) return [];
      if (node.isKind(SyntaxKind.ObjectLiteralExpression)) return [node];
      if (node.isKind(SyntaxKind.Identifier)) {
        const name = node.getText();
        return sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
          .filter((d) => d.getName() === name)
          .flatMap((d) => {
            const init = d.getInitializer();
            return init?.isKind(SyntaxKind.ObjectLiteralExpression) ? [init] : [];
          });
      }
      return [];
    };

    return sourceFiles.some((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
        const expr = call.getExpression();
        const isObserve =
          (expr.isKind(SyntaxKind.PropertyAccessExpression) && expr.getName() === 'observe') ||
          expr.getText().endsWith('.observe');
        if (!isObserve) return false;

        return call.getArguments().some((arg) =>
          resolveObjectLiterals(arg, sf).some((obj) => {
            const typeProp = obj.getProperty('type');
            const bufferedProp = obj.getProperty('buffered');
            if (!typeProp || !bufferedProp) return false;

            const hasBufferedTrue =
              (bufferedProp.isKind(SyntaxKind.PropertyAssignment) &&
                bufferedProp.getInitializer()?.getKind() === SyntaxKind.TrueKeyword) ||
              (bufferedProp.isKind(SyntaxKind.ShorthandPropertyAssignment) &&
                sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration).some(
                  (d) =>
                    d.getName() === 'buffered' &&
                    d.getInitializer()?.getKind() === SyntaxKind.TrueKeyword
                ));
            if (!hasBufferedTrue) return false;

            if (typeProp.isKind(SyntaxKind.PropertyAssignment)) {
              return resolveStrings(typeProp.getInitializer(), sf).includes(targetType);
            }
            if (typeProp.isKind(SyntaxKind.ShorthandPropertyAssignment)) {
              return resolveStrings(typeProp.getNameNode(), sf).includes(targetType);
            }
            return false;
          })
        );
      })
    );
  }

  test('Registers a PerformanceObserver with type interaction-contentful-paint and buffered true', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = getAppSourceFiles(project);
    expect(hasObserveForType(sourceFiles, 'interaction-contentful-paint')).toBe(true);
  });

  test('Registers a PerformanceObserver with type soft-navigation and buffered true without relying on performance.getEntriesByType', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = getAppSourceFiles(project);

    const registersSoftNavObserver = hasObserveForType(sourceFiles, 'soft-navigation');

    const usesGetEntriesByTypeSoftNav = sourceFiles.some((sf) => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return calls.some((call) => {
        const expr = call.getExpression();
        const isGetEntries =
          (expr.isKind(SyntaxKind.PropertyAccessExpression) && expr.getName() === 'getEntriesByType') ||
          expr.getText().includes('getEntriesByType');
        if (!isGetEntries) return false;

        return call.getArguments().some((arg) => {
          if (arg.isKind(SyntaxKind.StringLiteral)) {
            return arg.getLiteralValue() === 'soft-navigation';
          }
          return false;
        });
      });
    });

    const tracksSoftNavCorrectly = registersSoftNavObserver && !usesGetEntriesByTypeSoftNav;

    expect(tracksSoftNavCorrectly).toBe(true);
  });

  test('Retrieves the initial LCP candidate using getLargestInteractionContentfulPaint on observed soft navigation entries', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = getAppSourceFiles(project);

    const callsGetLargestInteractionContentfulPaint = sourceFiles.some((sf) => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return calls.some((call) => {
        const expr = call.getExpression();
        return (
          (expr.isKind(SyntaxKind.PropertyAccessExpression) &&
            expr.getName() === 'getLargestInteractionContentfulPaint') ||
          expr.getText().includes('getLargestInteractionContentfulPaint')
        );
      });
    });

    expect(callsGetLargestInteractionContentfulPaint).toBe(true);
  });

  test('Correlates subsequent interaction-contentful-paint entries to soft navigations by interactionId instead of navigationId', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = getAppSourceFiles(project);

    const correlatesByInteractionId = sourceFiles.some((sf) => {
      const binaryExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
      return binaryExprs.some((be) => {
        const op = be.getOperatorToken().getText();
        if (op !== '===' && op !== '==') return false;
        const left = be.getLeft();
        const right = be.getRight();

        const leftHasInteractionId =
          left.isKind(SyntaxKind.PropertyAccessExpression) && left.getName() === 'interactionId';
        const rightHasInteractionId =
          right.isKind(SyntaxKind.PropertyAccessExpression) && right.getName() === 'interactionId';

        return leftHasInteractionId && rightHasInteractionId;
      });
    });

    const correlatesByNavigationId = sourceFiles.some((sf) => {
      const binaryExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
      return binaryExprs.some((be) => {
        const op = be.getOperatorToken().getText();
        if (op !== '===' && op !== '==') return false;
        const left = be.getLeft();
        const right = be.getRight();

        const leftHasNavId =
          left.isKind(SyntaxKind.PropertyAccessExpression) && left.getName() === 'navigationId';
        const rightHasNavId =
          right.isKind(SyntaxKind.PropertyAccessExpression) && right.getName() === 'navigationId';

        return leftHasNavId && rightHasNavId;
      });
    });

    const correctlyCorrelatesPaints = correlatesByInteractionId && !correlatesByNavigationId;

    expect(correctlyCorrelatesPaints).toBe(true);
  });

  test('Calculates paint durations relative to interaction startTime using duration or presentationTime minus startTime', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = getAppSourceFiles(project);

    const usesRelativeDurationCalculation = sourceFiles.some((sf) => {
      const propertyAccesses = sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
      const hasDurationAccess = propertyAccesses.some((pa) => pa.getName() === 'duration');

      const binaryExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
      const hasPresentationMinusStartTime = binaryExprs.some((be) => {
        if (be.getOperatorToken().getText() !== '-') return false;
        const left = be.getLeft().getText();
        const right = be.getRight().getText();
        return (
          (left.includes('presentationTime') && right.includes('startTime')) ||
          (right.includes('presentationTime') && left.includes('startTime'))
        );
      });

      return hasDurationAccess || hasPresentationMinusStartTime;
    });

    const reportsRawTimestampAsDuration = sourceFiles.some((sf) => {
      const objLiterals = sf.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression);
      return objLiterals.some((obj) => {
        for (const prop of obj.getProperties()) {
          if (prop.isKind(SyntaxKind.PropertyAssignment)) {
            const name = prop.getName();
            if (name === 'duration' || name === 'lcpDuration' || name === 'fcpDuration') {
              const init = prop.getInitializer();
              if (init && init.isKind(SyntaxKind.PropertyAccessExpression)) {
                const propName = init.getName();
                if (propName === 'presentationTime' || propName === 'paintTime') {
                  return true;
                }
              }
            }
          }
        }
        return false;
      });
    });

    const calculatesDurationRelativeToStartTime =
      usesRelativeDurationCalculation && !reportsRawTimestampAsDuration;

    expect(calculatesDurationRelativeToStartTime).toBe(true);
  });

  test('Reads painted element details from the nested largestContentfulPaint property on InteractionContentfulPaint entries', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = getAppSourceFiles(project);

    const readsLargestContentfulPaintDetails = sourceFiles.some((sf) => {
      const propertyAccesses = sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
      const hasPropertyAccess = propertyAccesses.some((pa) => {
        const propName = pa.getName();
        if (propName !== 'element' && propName !== 'size') return false;
        const expr = pa.getExpression();
        if (
          expr.isKind(SyntaxKind.PropertyAccessExpression) &&
          expr.getName() === 'largestContentfulPaint'
        ) {
          return true;
        }
        return expr.getText().includes('largestContentfulPaint');
      });

      const variableDecls = sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
      const hasDestructuring = variableDecls.some((vd) => {
        const init = vd.getInitializer();
        if (!init || !init.getText().includes('largestContentfulPaint')) return false;
        const text = vd.getText();
        return text.includes('element') || text.includes('size');
      });

      return hasPropertyAccess || hasDestructuring;
    });

    expect(readsLargestContentfulPaintDetails).toBe(true);
  });
});
