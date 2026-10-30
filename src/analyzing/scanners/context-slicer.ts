import { Node, type SourceFile } from 'ts-morph';

const MAX_CONTEXT_LINES = 120;
const CODE_SNIPPET_RADIUS = 15;
const JS_SURROUNDING_RADIUS = 30;
const MAX_SFC_CONTEXT_LINES = 40;
const PACKAGE_JSON_FULL_MAX_LINES = 200;
const PACKAGE_JSON_HEADER_LINES = 35;
const PACKAGE_JSON_WINDOW_RADIUS = 30;

export function formatNumberedLines(
  lines: readonly string[],
  startLineNumber: number,
  targetLineNumber: number,
): string {
  return lines
    .map((line, idx) => {
      const lineNum = startLineNumber + idx;
      const marker = lineNum === targetLineNumber ? '> ' : '  ';
      return `${marker}${String(lineNum).padStart(4, ' ')} | ${line}`;
    })
    .join('\n');
}

/**
 * Returns true if the given ArrowFunction or FunctionExpression is passed as a callback
 * argument (directly, parenthesized, or inside an options object/array) to a CallExpression
 * or NewExpression (e.g. addEventListener, forEach, map, then, requestAnimationFrame,
 * setTimeout, new IntersectionObserver, $(...).on(...)).
 */
function isCallbackArgument(fnNode: Node): boolean {
  let current: Node = fnNode;
  let parent: Node | undefined = current.getParent();

  while (
    parent &&
    (Node.isParenthesizedExpression(parent) ||
      Node.isAsExpression(parent) ||
      Node.isTypeAssertion(parent) ||
      Node.isPropertyAssignment(parent) ||
      Node.isObjectLiteralExpression(parent) ||
      Node.isArrayLiteralExpression(parent))
  ) {
    current = parent;
    parent = current.getParent();
  }

  if (!parent) {
    return false;
  }

  if (Node.isCallExpression(parent) || Node.isNewExpression(parent)) {
    return parent.getExpression() !== current;
  }

  return false;
}

/**
 * If an ArrowFunction or FunctionExpression is the initializer of a VariableDeclaration,
 * returns the enclosing VariableStatement so the variable name/signature line is included.
 */
function resolveVariableStatementIfInitializer(fnNode: Node): Node {
  const parent = fnNode.getParent();
  if (parent && Node.isVariableDeclaration(parent)) {
    const declList = parent.getParent();
    const varStmt = declList?.getParent();
    if (varStmt && Node.isVariableStatement(varStmt)) {
      return varStmt;
    }
  }
  return fnNode;
}

/**
 * Finds the enclosing structural scope (function, method, class, or statement) around target line.
 * Continues walking past inner callback ArrowFunctions/FunctionExpressions so enclosing functions,
 * components, or outer top-level statements are preserved.
 */
function findEnclosingScopeNode(
  sourceFile: SourceFile,
  targetLine: number,
): Node {
  // Convert 1-based target line to start of line position
  const linePos = sourceFile.compilerNode.getPositionOfLineAndCharacter(
    Math.max(0, targetLine - 1),
    0,
  );
  const node: Node | undefined = sourceFile.getDescendantAtPos(linePos);

  if (!node) {
    return sourceFile;
  }

  let current: Node | undefined = node;
  let innermostStatement: Node | undefined;
  let outermostStatement: Node | undefined;

  while (current && !Node.isSourceFile(current)) {
    if (
      Node.isFunctionDeclaration(current) ||
      Node.isMethodDeclaration(current) ||
      Node.isConstructorDeclaration(current) ||
      Node.isGetAccessorDeclaration(current) ||
      Node.isSetAccessorDeclaration(current) ||
      Node.isClassDeclaration(current)
    ) {
      return current;
    }

    if (Node.isArrowFunction(current) || Node.isFunctionExpression(current)) {
      if (!isCallbackArgument(current)) {
        return resolveVariableStatementIfInitializer(current);
      }
    }

    if (Node.isStatement(current)) {
      if (!innermostStatement) {
        innermostStatement = current;
      }
      const parent = current.getParent();
      if (parent && Node.isSourceFile(parent)) {
        outermostStatement = current;
      }
    }

    current = current.getParent();
  }

  return outermostStatement ?? innermostStatement ?? sourceFile;
}

/**
 * Extracts up to MAX_SFC_CONTEXT_LINES of non-blank lines from `<template>` / HTML / `<style>`
 * regions that were blanked in `sourceFile` outside the sliced JS scope.
 */
function extractSfcTemplateAndStyleLines(
  allLines: readonly string[],
  sourceLines: readonly string[],
  nodeStartLine: number,
  nodeEndLine: number,
): string[] {
  const numberedMarkupLines: string[] = [];

  for (let i = 1; i <= allLines.length; i++) {
    if (i >= nodeStartLine && i <= nodeEndLine) {
      continue;
    }
    const origLine = allLines[i - 1] ?? '';
    const srcLine = sourceLines[i - 1] ?? '';
    if (origLine.trim().length > 0 && srcLine.trim().length === 0) {
      numberedMarkupLines.push(`   ${String(i).padStart(4, ' ')} | ${origLine}`);
    }
  }

  if (numberedMarkupLines.length <= MAX_SFC_CONTEXT_LINES) {
    return numberedMarkupLines;
  }

  const half = Math.floor(MAX_SFC_CONTEXT_LINES / 2);
  const omittedCount = numberedMarkupLines.length - MAX_SFC_CONTEXT_LINES;
  return [
    ...numberedMarkupLines.slice(0, half),
    `       ... [${omittedCount} lines of template/style context folded] ...`,
    ...numberedMarkupLines.slice(numberedMarkupLines.length - half),
  ];
}

function isFunctionOrClassScopeNode(node: Node): boolean {
  if (
    Node.isFunctionDeclaration(node) ||
    Node.isMethodDeclaration(node) ||
    Node.isConstructorDeclaration(node) ||
    Node.isGetAccessorDeclaration(node) ||
    Node.isSetAccessorDeclaration(node) ||
    Node.isClassDeclaration(node) ||
    Node.isArrowFunction(node) ||
    Node.isFunctionExpression(node)
  ) {
    return true;
  }
  if (Node.isVariableStatement(node)) {
    for (const decl of node.getDeclarations()) {
      const init = decl.getInitializer();
      if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
        return true;
      }
    }
  }
  return false;
}

function isTopLevelImportOrRequireStatement(stmt: Node): boolean {
  if (Node.isImportDeclaration(stmt) || Node.isImportEqualsDeclaration(stmt)) {
    return true;
  }
  if (
    Node.isVariableStatement(stmt) &&
    stmt.getEndLineNumber() - stmt.getStartLineNumber() <= 10 &&
    /\brequire\s*\(/.test(stmt.getText())
  ) {
    return true;
  }
  return false;
}

/**
 * AST-aware context slicer for JS/TS: extracts enclosing function/method/class + top-level imports
 * (both ESM `import` and CommonJS `require()`), plus unblanked SFC `<template>`/`<style>` context,
 * capped cleanly with numbered lines and smart folding over 120 lines.
 */
export function sliceJsAstContext(
  sourceFile: SourceFile,
  targetLine: number,
  fileContent?: string,
): string {
  const sourceText = sourceFile.getFullText();
  const effectiveText = fileContent ?? sourceText;
  const allLines = effectiveText.split('\n');

  const enclosingNode = findEnclosingScopeNode(sourceFile, targetLine);
  let nodeStartLine = enclosingNode.getStartLineNumber();
  let nodeEndLine = enclosingNode.getEndLineNumber();

  const statements = sourceFile.getStatements();
  let lastImportEndLine = 0;
  for (const stmt of statements) {
    if (isTopLevelImportOrRequireStatement(stmt) && stmt.getEndLineNumber() < nodeStartLine) {
      lastImportEndLine = Math.max(lastImportEndLine, stmt.getEndLineNumber());
    }
  }

  // Expand short non-function top-level statements by +-15 lines within the script body
  if (!isFunctionOrClassScopeNode(enclosingNode) && nodeEndLine - nodeStartLine + 1 < 25) {
    const firstStmtStart = statements[0]?.getStartLineNumber() ?? 1;
    const lastStmtEnd = statements[statements.length - 1]?.getEndLineNumber() ?? allLines.length;
    const minScriptLine = Math.max(firstStmtStart, lastImportEndLine + 1);
    const maxScriptLine = Math.min(allLines.length, lastStmtEnd);
    nodeStartLine = Math.min(
      nodeStartLine,
      Math.max(minScriptLine, targetLine - CODE_SNIPPET_RADIUS),
    );
    nodeEndLine = Math.max(
      nodeEndLine,
      Math.min(maxScriptLine, targetLine + CODE_SNIPPET_RADIUS),
    );
  }

  // 1. Top-level ESM imports and CommonJS require() statements (if not already part of enclosing node)
  const importLines: string[] = [];
  for (const stmt of statements) {
    if (!isTopLevelImportOrRequireStatement(stmt)) {
      continue;
    }

    const start = stmt.getStartLineNumber();
    const end = stmt.getEndLineNumber();
    if (end < nodeStartLine || start > nodeEndLine) {
      for (let i = start; i <= end; i++) {
        const lineContent = allLines[i - 1] ?? '';
        importLines.push(`   ${String(i).padStart(4, ' ')} | ${lineContent}`);
      }
    }
  }

  // 2. Scope block
  const totalNodeLines = nodeEndLine - nodeStartLine + 1;
  const scopeLines: string[] = [];

  if (totalNodeLines <= MAX_CONTEXT_LINES) {
    for (let i = nodeStartLine; i <= nodeEndLine; i++) {
      const lineContent = allLines[i - 1] ?? '';
      const marker = i === targetLine ? '> ' : '  ';
      scopeLines.push(
        `${marker}${String(i).padStart(4, ' ')} | ${lineContent}`,
      );
    }
  } else {
    // Smart folding: keep function header, surrounding window around targetLine, and footer
    const headEnd = Math.min(nodeStartLine + 4, targetLine - 1);
    const windowStart = Math.max(
      nodeStartLine,
      targetLine - JS_SURROUNDING_RADIUS,
    );
    const windowEnd = Math.min(
      nodeEndLine,
      targetLine + JS_SURROUNDING_RADIUS,
    );
    const tailStart = Math.max(windowEnd + 1, nodeEndLine - 3);

    for (let i = nodeStartLine; i <= headEnd; i++) {
      const lineContent = allLines[i - 1] ?? '';
      const marker = i === targetLine ? '> ' : '  ';
      scopeLines.push(
        `${marker}${String(i).padStart(4, ' ')} | ${lineContent}`,
      );
    }

    if (windowStart > headEnd + 1) {
      const foldedCount = windowStart - (headEnd + 1);
      scopeLines.push(
        `       ... [${foldedCount} lines folded in enclosing scope] ...`,
      );
    }

    for (
      let i = Math.max(headEnd + 1, windowStart);
      i <= Math.min(tailStart - 1, windowEnd);
      i++
    ) {
      const lineContent = allLines[i - 1] ?? '';
      const marker = i === targetLine ? '> ' : '  ';
      scopeLines.push(
        `${marker}${String(i).padStart(4, ' ')} | ${lineContent}`,
      );
    }

    if (tailStart > windowEnd + 1) {
      const foldedCount = tailStart - (windowEnd + 1);
      scopeLines.push(
        `       ... [${foldedCount} lines folded in enclosing scope] ...`,
      );
    }

    for (let i = Math.max(windowEnd + 1, tailStart); i <= nodeEndLine; i++) {
      const lineContent = allLines[i - 1] ?? '';
      const marker = i === targetLine ? '> ' : '  ';
      scopeLines.push(
        `${marker}${String(i).padStart(4, ' ')} | ${lineContent}`,
      );
    }
  }

  const sections: string[] = [];
  if (importLines.length > 0) {
    sections.push('// --- Imports ---', ...importLines);
  }
  sections.push('// --- Scope ---', ...scopeLines);

  // 3. When slicing an SFC (.vue, .svelte, .astro) or HTML <script> where non-script sections
  // were blanked in sourceFile, append up to 40 lines of <template>/HTML/<style> context.
  if (fileContent !== undefined && fileContent !== sourceText) {
    const sourceLines = sourceText.split('\n');
    const sfcLines = extractSfcTemplateAndStyleLines(
      allLines,
      sourceLines,
      nodeStartLine,
      nodeEndLine,
    );
    if (sfcLines.length > 0) {
      sections.push('// --- Template / Style Context ---', ...sfcLines);
    }
  }

  return sections.join('\n');
}

/**
 * Slices `package.json` with full context when <= 200 lines, or the first 35 lines
 * (showing "name", "bin", "scripts", "dependencies") plus `...` plus a +-30 line window
 * around `targetLine` when > 200 lines.
 */
function slicePackageJsonContext(
  fileContent: string,
  targetLine: number,
): string {
  const allLines = fileContent.split('\n');
  if (allLines.length <= PACKAGE_JSON_FULL_MAX_LINES) {
    return formatNumberedLines(allLines, 1, targetLine);
  }

  const windowStart = Math.max(1, targetLine - PACKAGE_JSON_WINDOW_RADIUS);
  const windowEnd = Math.min(
    allLines.length,
    targetLine + PACKAGE_JSON_WINDOW_RADIUS,
  );

  if (windowStart <= PACKAGE_JSON_HEADER_LINES + 1) {
    const mergedEnd = Math.max(PACKAGE_JSON_HEADER_LINES, windowEnd);
    return formatNumberedLines(allLines.slice(0, mergedEnd), 1, targetLine);
  }

  const headerSlice = formatNumberedLines(
    allLines.slice(0, PACKAGE_JSON_HEADER_LINES),
    1,
    targetLine,
  );
  const windowSlice = formatNumberedLines(
    allLines.slice(windowStart - 1, windowEnd),
    windowStart,
    targetLine,
  );
  return `${headerSlice}\n       ...\n${windowSlice}`;
}

/**
 * Structured block slicer for HTML, CSS, and other non-AST file formats.
 */
export function sliceStructuredBlock(
  fileContent: string,
  targetLine: number,
  radius: number = 25,
): string {
  const lines = fileContent.split('\n');
  const start = Math.max(0, targetLine - 1 - radius);
  const end = Math.min(lines.length, targetLine + radius);

  const blockLines = lines.slice(start, end);
  return formatNumberedLines(blockLines, start + 1, targetLine);
}

export function extractCompactSnippet(
  fileContent: string,
  targetLine: number,
  radius: number = CODE_SNIPPET_RADIUS,
): string {
  return sliceStructuredBlock(fileContent, targetLine, radius);
}

export function sliceStructuredContext(
  filePath: string,
  fileContent: string,
  targetLine: number,
  sourceFile?: SourceFile,
): { codeSnippet: string; contextSlice: string; lineContent: string } {
  const lines = fileContent.split('\n');
  const lineContent = (lines[targetLine - 1] ?? '').trim();
  const codeSnippet = extractCompactSnippet(fileContent, targetLine);
  const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
  const isPackageJson =
    normalizedPath === 'package.json' ||
    normalizedPath.endsWith('/package.json');

  let contextSlice: string;
  if (isPackageJson) {
    contextSlice = slicePackageJsonContext(fileContent, targetLine);
  } else if (sourceFile) {
    contextSlice = sliceJsAstContext(sourceFile, targetLine, fileContent);
  } else {
    contextSlice = sliceStructuredBlock(fileContent, targetLine);
  }

  return { codeSnippet, contextSlice, lineContent };
}
