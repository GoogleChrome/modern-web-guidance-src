import fs from 'node:fs';
import path from 'node:path';
import { Project, SyntaxKind, Node, type CallExpression } from 'ts-morph';

const SELECTOR_METHODS = new Set([
  'locator', 'querySelector', 'querySelectorAll', 'closest', 'matches', 'waitForSelector', 'resolveSelector',
]);
const CLASS_TOKEN_METHODS = new Set(['contains', 'add', 'remove', 'toggle', 'getElementsByClassName']);
const IGNORED_DIRS = new Set(['node_modules', '.astro', 'dist', '.git', 'test-results']);

const defaultInMemoryProject = new Project({
  compilerOptions: { noLib: true, noResolve: true },
  skipAddingFilesFromTsConfig: true,
  useInMemoryFileSystem: true,
});

function collectTokens(text: string, out: Set<string>): void {
  for (const m of text.matchAll(/[a-zA-Z_-][a-zA-Z0-9_-]*/g)) out.add(m[0]);
}

function collectBaseAndTaskTokens(baseAppDir: string, taskMd: string): Set<string> {
  const tokens = new Set<string>();
  collectTokens(taskMd, tokens);
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) collectTokens(fs.readFileSync(full, 'utf8'), tokens);
    }
  };
  walk(baseAppDir);
  return tokens;
}

function extractLiteralTexts(node: Node): string[] {
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) return [node.getLiteralValue()];
  if (Node.isTemplateExpression(node)) {
    return [node.getHead().getLiteralText(), ...node.getTemplateSpans().map(s => s.getLiteral().getLiteralText())];
  }
  return [];
}

function collectQueriedSelectors(graderSource: string): Array<{ prefix: '.' | '#'; name: string; line: number }> {
  const sf = defaultInMemoryProject.createSourceFile('grader.ts', graderSource, { overwrite: true });
  try {
    const found: Array<{ prefix: '.' | '#'; name: string; line: number }> = [];
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression) as CallExpression[]) {
      const expr = call.getExpression();
      const method = Node.isPropertyAccessExpression(expr) ? expr.getName() : expr.getText();
      const isClassList = Node.isPropertyAccessExpression(expr) && expr.getExpression().getText().endsWith('classList');
      const isSelectorCall = SELECTOR_METHODS.has(method);
      const isClassTokenCall = (isClassList || method === 'getElementsByClassName') && CLASS_TOKEN_METHODS.has(method);
      const isIdCall = method === 'getElementById';
      if (!isSelectorCall && !isClassTokenCall && !isIdCall) continue;

      const line = sf.getLineAndColumnAtPos(call.getStart()).line;
      for (const arg of call.getArguments()) {
        for (const text of extractLiteralTexts(arg)) {
          if (isSelectorCall) {
            for (const m of text.matchAll(/([.#])([a-zA-Z_-][a-zA-Z0-9_-]*)/g)) {
              found.push({ prefix: m[1] as '.' | '#', name: m[2]!, line });
            }
          } else {
            const prefix = isIdCall ? '#' : '.';
            for (const token of text.split(/\s+/).filter(Boolean)) {
              if (/^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(token)) found.push({ prefix, name: token, line });
            }
          }
        }
      }
    }
    return found;
  } finally {
    defaultInMemoryProject.removeSourceFile(sf);
  }
}

/**
 * Checks `graderSource` for `.class` or `#id` selectors introduced only by golden solution patches
 * (absent from `task.md` and `baseAppDir`). Returns a diagnostic string or `null` if clean.
 */
export function checkGraderGoldenSelectorCoupling(opts: {
  graderSource: string;
  baseAppDir: string;
  taskMd: string;
  goldenPatchPaths: readonly string[];
}): string | null {
  const contractTokens = collectBaseAndTaskTokens(opts.baseAppDir, opts.taskMd);
  const goldenAddedTokens = new Set<string>();
  for (const patchPath of opts.goldenPatchPaths) {
    if (!fs.existsSync(patchPath)) continue;
    for (const line of fs.readFileSync(patchPath, 'utf8').split('\n')) {
      if (line.startsWith('+') && !line.startsWith('+++')) collectTokens(line.slice(1), goldenAddedTokens);
    }
  }
  if (goldenAddedTokens.size === 0) return null;

  const coupled = collectQueriedSelectors(opts.graderSource)
    .filter(({ name }) => !contractTokens.has(name) && goldenAddedTokens.has(name))
    .map(({ prefix, name, line }) => `${prefix}${name} (L${line})`);

  if (coupled.length === 0) return null;
  return `Grader appears coupled to non-contract class/id names from golden patches: ${[...new Set(coupled)].join(', ')}`;
}
