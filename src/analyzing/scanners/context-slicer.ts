import { Node, type SourceFile } from 'ts-morph';

export const MAX_CONTEXT_LINES = 120;
export const CODE_SNIPPET_RADIUS = 15;
export const JS_SURROUNDING_RADIUS = 30;

/**
 * Formats a block of text lines with line numbers and a `>` marker pointing to the target line.
 */
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
 * Finds the enclosing structural scope (function, method, class, or statement) around target line.
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
  let node: Node | undefined = sourceFile.getDescendantAtPos(linePos);

  if (!node) {
    return sourceFile;
  }

  let current: Node | undefined = node;
  let candidate: Node = sourceFile;

  while (current) {
    if (
      Node.isFunctionDeclaration(current) ||
      Node.isMethodDeclaration(current) ||
      Node.isArrowFunction(current) ||
      Node.isFunctionExpression(current) ||
      Node.isClassDeclaration(current)
    ) {
      return current;
    }
    if (Node.isStatement(current) && candidate === sourceFile) {
      candidate = current;
    }
    current = current.getParent();
  }

  return candidate;
}

/**
 * AST-aware context slicer for JS/TS: extracts enclosing function/method/class + top-level imports,
 * capped cleanly with numbered lines and smart folding over 120 lines.
 */
export function sliceJsAstContext(
  sourceFile: SourceFile,
  targetLine: number,
): string {
  const fullText = sourceFile.getFullText();
  const allLines = fullText.split('\n');

  const enclosingNode = findEnclosingScopeNode(sourceFile, targetLine);
  const nodeStartLine = enclosingNode.getStartLineNumber();
  const nodeEndLine = enclosingNode.getEndLineNumber();

  // 1. Top-level imports (if not already part of the enclosing node)
  const importLines: string[] = [];
  for (const imp of sourceFile.getImportDeclarations()) {
    const start = imp.getStartLineNumber();
    const end = imp.getEndLineNumber();
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

  return sections.join('\n');
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

/**
 * Extracts compact code snippet (~15 lines) around targetLine.
 */
export function extractCompactSnippet(
  fileContent: string,
  targetLine: number,
  radius: number = CODE_SNIPPET_RADIUS,
): string {
  const lines = fileContent.split('\n');
  const start = Math.max(0, targetLine - 1 - radius);
  const end = Math.min(lines.length, targetLine + radius);

  return formatNumberedLines(lines.slice(start, end), start + 1, targetLine);
}

/**
 * Generates both the compact `codeSnippet` and the AST/structured `astSlice`.
 */
export function sliceStructuredContext(
  filePath: string,
  fileContent: string,
  targetLine: number,
  sourceFile?: SourceFile,
): { codeSnippet: string; astSlice: string } {
  const codeSnippet = extractCompactSnippet(fileContent, targetLine);

  let astSlice: string;
  if (sourceFile) {
    astSlice = sliceJsAstContext(sourceFile, targetLine);
  } else {
    astSlice = sliceStructuredBlock(fileContent, targetLine);
  }

  return { codeSnippet, astSlice };
}
