import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { SyntaxKind } from 'ts-morph';

const targetFiles: string[] = getTargetFiles(
  // @ts-ignore
  import.meta.url
);

test.describe('load-shared-resources-declaratively Target Grader', () => {
  // Requirement 1: A <script> or <link> element that already carries a valid integrity attribute adds
  // crossoriginstorage to opt into the shared cache, rather than introducing a separate imperative fetch/cache step in JavaScript.
  test('script or link elements opt into shared cache with integrity and crossoriginstorage without imperative caching', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);

    const cosElements = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('script, link') as Iterable<Element>)
    ).filter((el) => el.hasAttribute('crossoriginstorage'));

    const sourceFiles = project.getSourceFiles();
    const hasImperativeCache = sourceFiles.some((sf) => {
      const text = sf.getFullText();
      return (
        /\bcaches\s*\.\s*(open|match|has|delete|keys)\b/.test(text) ||
        /\bCacheStorage\b/.test(text)
      );
    });

    const hasDeclarativeResource =
      cosElements.length > 0 &&
      cosElements.every((el) => {
        const integrity = el.getAttribute('integrity');
        return Boolean(integrity && /^sha(256|384|512)-/.test(integrity.trim()));
      }) &&
      !hasImperativeCache;

    expect(hasDeclarativeResource).toBe(true);
  });

  // Requirement 2: The value chosen for crossoriginstorage matches the intended sharing scope:
  // a valueless attribute for same-site-only, crossoriginstorage="*" for global availability,
  // or a space-separated list of origins for a specific trusted set.
  test('crossoriginstorage attribute value matches the intended sharing scope', () => {
    const docs = getHtmlDocuments(targetFiles);
    const cosElements = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('script, link') as Iterable<Element>)
    ).filter((el) => el.hasAttribute('crossoriginstorage'));

    const allValidScopes =
      cosElements.length > 0 &&
      cosElements.every((el) => {
        const val = el.getAttribute('crossoriginstorage');
        if (val === null) return false;
        const trimmed = val.trim();
        const url = (el.getAttribute('src') || el.getAttribute('href') || '').trim();
        const isCrossSite = /^https?:\/\//i.test(url);

        if (trimmed === '*') return true;
        if (trimmed === '') {
          return !isCrossSite;
        }
        const origins = trimmed.split(/\s+/).filter(Boolean);
        return origins.length > 0 && origins.every((o) => /^https?:\/\/[^\s/]+$/i.test(o));
      });

    expect(allValidScopes).toBe(true);
  });

  // Requirement 3: For static or dynamic module imports, the crossOriginStorage import attribute is supplied
  // alongside integrity in the same with { ... } block, using an empty string ("") for same-site-only, "*" for global,
  // or a space-separated string of origins for a specific set.
  test('module imports supply crossOriginStorage alongside integrity in the same with block with valid scope', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const dynamicImportsWithCos: Array<{ withObj: any }> = [];
    for (const sf of sourceFiles) {
      const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      for (const call of callExprs) {
        if (call.getExpression().getKind() === SyntaxKind.ImportKeyword) {
          const args = call.getArguments();
          if (args.length > 1 && args[1].isKind(SyntaxKind.ObjectLiteralExpression)) {
            const optsObj = args[1];
            const withProp = optsObj.getProperty('with');
            if (withProp && withProp.isKind(SyntaxKind.PropertyAssignment)) {
              const withInit = withProp.getInitializer();
              if (withInit && withInit.isKind(SyntaxKind.ObjectLiteralExpression)) {
                if (
                  withInit.getProperty('crossOriginStorage') ||
                  withInit.getProperty('crossoriginstorage')
                ) {
                  dynamicImportsWithCos.push({ withObj: withInit });
                }
              }
            }
          }
        }
      }
    }

    const staticImportsWithCos: Array<{ elements: any[] }> = [];
    for (const sf of sourceFiles) {
      for (const imp of sf.getImportDeclarations()) {
        const attrs = imp.getAttributes();
        if (attrs) {
          const elements = attrs.getElements();
          const cosEl = elements.find((e) => e.getName() === 'crossOriginStorage');
          if (cosEl) {
            staticImportsWithCos.push({ elements });
          }
        }
      }
    }

    const totalModuleCos = dynamicImportsWithCos.length + staticImportsWithCos.length;
    const cosElements = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('script, link') as Iterable<Element>)
    ).filter((el) => el.hasAttribute('crossoriginstorage'));

    let isValid = false;
    if (totalModuleCos > 0) {
      const dynamicValid = dynamicImportsWithCos.every(({ withObj }) => {
        const integrityProp = withObj.getProperty('integrity');
        const cosProp = withObj.getProperty('crossOriginStorage');
        if (!integrityProp || !cosProp) return false;
        const cosText = cosProp.getText();
        return /['"*]/.test(cosText);
      });
      const staticValid = staticImportsWithCos.every(({ elements }) => {
        const integrityEl = elements.find((e) => e.getName() === 'integrity');
        const cosEl = elements.find((e) => e.getName() === 'crossOriginStorage');
        return Boolean(integrityEl && cosEl);
      });
      isValid = dynamicValid && staticValid;
    } else {
      isValid = cosElements.length > 0;
    }

    expect(isValid).toBe(true);
  });

  // Requirement 4: crossoriginstorage / crossOriginStorage never appears without a corresponding
  // integrity value on the same element or import, since the integrity hash is what identifies the file in the shared cache.
  test('cross-origin storage never appears without a corresponding integrity attribute', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const cosElements = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('script, link') as Iterable<Element>)
    ).filter((el) => el.hasAttribute('crossoriginstorage'));

    const dynamicImportsWithCos: Array<{ withObj: any }> = [];
    for (const sf of sourceFiles) {
      const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      for (const call of callExprs) {
        if (call.getExpression().getKind() === SyntaxKind.ImportKeyword) {
          const args = call.getArguments();
          if (args.length > 1 && args[1].isKind(SyntaxKind.ObjectLiteralExpression)) {
            const optsObj = args[1];
            const withProp = optsObj.getProperty('with');
            if (withProp && withProp.isKind(SyntaxKind.PropertyAssignment)) {
              const withInit = withProp.getInitializer();
              if (withInit && withInit.isKind(SyntaxKind.ObjectLiteralExpression)) {
                if (
                  withInit.getProperty('crossOriginStorage') ||
                  withInit.getProperty('crossoriginstorage')
                ) {
                  dynamicImportsWithCos.push({ withObj: withInit });
                }
              }
            }
          }
        }
      }
    }

    const staticImportsWithCos: Array<{ elements: any[] }> = [];
    for (const sf of sourceFiles) {
      for (const imp of sf.getImportDeclarations()) {
        const attrs = imp.getAttributes();
        if (attrs) {
          const elements = attrs.getElements();
          const cosEl = elements.find((e) => e.getName() === 'crossOriginStorage');
          if (cosEl) {
            staticImportsWithCos.push({ elements });
          }
        }
      }
    }

    const totalModuleCos = dynamicImportsWithCos.length + staticImportsWithCos.length;
    const totalCosCount = cosElements.length + totalModuleCos;

    const elementsHaveIntegrity =
      cosElements.length > 0 &&
      cosElements.every((el) => {
        const integrity = el.getAttribute('integrity');
        return Boolean(integrity && /^sha(256|384|512)-/.test(integrity.trim()));
      });

    const modulesHaveIntegrity =
      totalModuleCos === 0 ||
      (dynamicImportsWithCos.every(({ withObj }) => Boolean(withObj.getProperty('integrity'))) &&
        staticImportsWithCos.every(({ elements }) =>
          elements.some((e) => e.getName() === 'integrity')
        ));

    const hasIntegrityEverywhere =
      totalCosCount > 0 && elementsHaveIntegrity && modulesHaveIntegrity;

    expect(hasIntegrityEverywhere).toBe(true);
  });

  // Requirement 5: The code does not conflate crossoriginstorage with the unrelated crossorigin attribute
  // (which controls CORS request mode); both may coexist on the same element but are never used interchangeably.
  test('crossoriginstorage is not conflated with the CORS crossorigin attribute', () => {
    const docs = getHtmlDocuments(targetFiles);
    const cosElements = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('script, link') as Iterable<Element>)
    ).filter((el) => el.hasAttribute('crossoriginstorage'));

    const noConflation =
      cosElements.length > 0 &&
      cosElements.every((el) => {
        const cosVal = el.getAttribute('crossoriginstorage')?.trim().toLowerCase();
        const isCorsMode = cosVal === 'anonymous' || cosVal === 'use-credentials';
        return !isCorsMode;
      });

    expect(noConflation).toBe(true);
  });

  // Requirement 6: The src/href/module specifier still points at the resource's real network URL,
  // since a cache lookup that doesn't succeed falls back to that URL exactly like ordinary integrity-checked fetches do.
  test('resource URLs and module specifiers point to real network URLs for fallback loading', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const cosElements = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('script, link') as Iterable<Element>)
    ).filter((el) => el.hasAttribute('crossoriginstorage'));

    const dynamicImportsWithCos: Array<{ call: any }> = [];
    for (const sf of sourceFiles) {
      const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      for (const call of callExprs) {
        if (call.getExpression().getKind() === SyntaxKind.ImportKeyword) {
          const args = call.getArguments();
          if (args.length > 1 && args[1].isKind(SyntaxKind.ObjectLiteralExpression)) {
            const optsObj = args[1];
            const withProp = optsObj.getProperty('with');
            if (withProp && withProp.isKind(SyntaxKind.PropertyAssignment)) {
              const withInit = withProp.getInitializer();
              if (withInit && withInit.isKind(SyntaxKind.ObjectLiteralExpression)) {
                if (
                  withInit.getProperty('crossOriginStorage') ||
                  withInit.getProperty('crossoriginstorage')
                ) {
                  dynamicImportsWithCos.push({ call });
                }
              }
            }
          }
        }
      }
    }

    const staticImportsWithCos: Array<{ imp: any }> = [];
    for (const sf of sourceFiles) {
      for (const imp of sf.getImportDeclarations()) {
        const attrs = imp.getAttributes();
        if (attrs) {
          const elements = attrs.getElements();
          const cosEl = elements.find((e) => e.getName() === 'crossOriginStorage');
          if (cosEl) {
            staticImportsWithCos.push({ imp });
          }
        }
      }
    }

    const totalModuleCos = dynamicImportsWithCos.length + staticImportsWithCos.length;
    const elementsHaveRealUrls =
      cosElements.length > 0 &&
      cosElements.every((el) => {
        const url = (el.getAttribute('src') || el.getAttribute('href') || '').trim();
        if (!url) return false;
        if (/^(cos|cache|storage|about):/i.test(url)) return false;
        return /^https?:\/\//i.test(url) || url.startsWith('/') || /^[a-zA-Z0-9._-]+/.test(url);
      });

    const modulesHaveRealUrls =
      totalModuleCos === 0 ||
      (dynamicImportsWithCos.every(({ call }) => {
        const arg0 = call.getArguments()[0]?.getText() || '';
        return arg0.length > 0 && !/^(cos|cache|storage):/i.test(arg0);
      }) &&
        staticImportsWithCos.every(({ imp }) => {
          const spec = imp.getModuleSpecifierValue();
          return spec.length > 0 && !/^(cos|cache|storage):/i.test(spec);
        }));

    const hasRealNetworkUrls =
      cosElements.length + totalModuleCos > 0 && elementsHaveRealUrls && modulesHaveRealUrls;

    expect(hasRealNetworkUrls).toBe(true);
  });
});
