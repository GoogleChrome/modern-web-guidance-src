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

// 2. Oxc Parser (Javascript/Typescript Parsing)
import { parseSync } from 'oxc-parser';

test('oxc-parser can parse Javascript and yield ESTree nodes', () => {
  const code = `
    function greet() {
      console.log('hi');
    }
  `;

  // Use oxc to parse the javascript snippet (extremely fast, Rust-based engine)
  // The API requires (filename, sourceText) or (sourceText, options)
  const result = parseSync('test.js', code);

  const program = result.program;

  assert.ok(program !== undefined, 'Program must be defined');
  
  // The program body should contain our single function declaration
  assert.strictEqual(program.body.length, 1, 'Program should have exactly 1 statement');
  
  const firstStmt = program.body[0] as any;
  assert.strictEqual(firstStmt.type, 'FunctionDeclaration', 'Statement is a function declaration');
  assert.strictEqual(firstStmt.id.name, 'greet', 'Function name extracted as greet');
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
