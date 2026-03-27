import test from 'node:test';
import assert from 'node:assert';

// 1. Linkedom (HTML/DOM Parsing)
import { parseHTML } from 'linkedom';

test('linkedom can parse HTML and use classic DOM APIs', () => {
  const htmlStr = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>Test File</title>
      <style>body { background: #000; }</style>
    </head>
    <body>
      <h1 class="target title" id="main-heading">Hello World</h1>
      <script>
        const inlineVar = "test";
      </script>
    </body>
    </html>
  `;

  // parseHTML gives us a fake window, document, etc without firing up a headless browser
  const { document } = parseHTML(htmlStr);
  
  // We can write assertions against normal DOM queries, just as if we were writing a front-end test
  const heading = document.querySelector('h1#main-heading');
  
  assert.ok(heading !== null, 'Heading must be found');
  assert.strictEqual(heading.textContent, 'Hello World', 'Heading text must match');
  assert.ok(heading.classList.contains('target'), 'Heading must have target class');
  
  const scriptTags = document.querySelectorAll('script');
  assert.strictEqual(scriptTags.length, 1, 'Should find one script tag');
  assert.ok(scriptTags[0].textContent?.includes('inlineVar'), 'Script tag content extracted successfully');
});

// 2. ts-morph (Javascript/Typescript Parsing)
import { Project, SyntaxKind } from 'ts-morph';

test('ts-morph can parse Javascript and yield AST nodes via fluent API', () => {
  const code = `
    function greet() {
      console.log('hi');
    }
  `;

  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile('test.js', code);

  const functionDecls = sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration);

  assert.strictEqual(functionDecls.length, 1, 'Program should have exactly 1 function declaration');
  assert.strictEqual(functionDecls[0].getName(), 'greet', 'Function name extracted as greet');
});

// 3. CSS Tree
import * as csstree from 'css-tree';

test('css-tree can parse CSS and yield AST nodes', () => {
  const css = `
    @supports (display: grid) {
      .container { display: grid; }
    }
  `;

  // Parse CSS into AST
  const ast = csstree.parse(css);

  let foundSupports = false;
  csstree.walk(ast, {
    visit: 'Atrule',
    enter(node) {
      if (node.name === 'supports') {
        foundSupports = true;
      }
    }
  });

  assert.ok(foundSupports, 'csstree successfully walked the AST and found @supports');
});
