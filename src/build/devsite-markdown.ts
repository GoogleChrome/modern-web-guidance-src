import { marked, type Token, type Tokens } from "marked";

/**
 * Adapts guide markdown for DevSite's renderer, which diverges from GitHub in two ways:
 *  - GitHub alerts (`> [!NOTE]`) aren't supported; DevSite uses `Note: …` paragraphs or `<aside class="note">`.
 *  - Ordered lists ignore their start number, so a list interrupted by an unindented block
 *    (code fence, paragraph) restarts at 1. We fold the interrupting blocks into the preceding item.
 */
export function toDevsiteMarkdown(markdown: string, onListMerge?: (stepNumber: number) => void): string {
  const normalized = markdown.replace(/\r\n?/g, "\n");
  const tokens = marked.lexer(normalized);
  const reconstructed = tokens.map(t => t.raw).join("");
  if (reconstructed !== normalized) {
    throw new Error("marked lexer tokens don't round-trip the source markdown; refusing to rewrite it.");
  }

  const out: string[] = [];
  // Expected start number of an ordered list that would continue the most recent one, plus the
  // index in `out` right after that list. Blocks between are candidates for folding into the list.
  let pending: { nextNumber: number; outIndex: number } | undefined;

  for (const token of tokens) {
    if (token.type === "list" && token.ordered) {
      const list = token as Tokens.List;
      const start = typeof list.start === "number" ? list.start : 1;
      if (pending && start === pending.nextNumber && start > 1) {
        const interrupting = out.splice(pending.outIndex);
        out.push(indentBlock(interrupting.join("")));
        onListMerge?.(start);
      }
      out.push(list.raw);
      pending = { nextNumber: start + list.items.length, outIndex: out.length };
      continue;
    }

    if (token.type === "heading" || token.type === "hr") {
      pending = undefined;
    }

    out.push(token.type === "blockquote" ? convertAlert(token as Tokens.Blockquote) : token.raw);
  }

  return out.join("");
}

/** Indents every non-blank line by 4 spaces so the block nests inside the preceding list item. */
function indentBlock(text: string): string {
  return text.replace(/^(?=[^\n]*\S)/gm, "    ");
}

const ALERT_LABELS: Record<string, { label: string; className: string }> = {
  NOTE: { label: "Note", className: "note" },
  TIP: { label: "Tip", className: "tip" },
  IMPORTANT: { label: "Important", className: "special" },
  WARNING: { label: "Warning", className: "warning" },
  CAUTION: { label: "Caution", className: "caution" },
};

function convertAlert(token: Tokens.Blockquote): string {
  const match = token.raw.match(/^> ?\[!(\w+)\][ \t]*\n/);
  if (!match) return token.raw;

  const alert = ALERT_LABELS[match[1].toUpperCase()];
  if (!alert) {
    throw new Error(`Unsupported GitHub alert type "[!${match[1]}]".`);
  }

  const trailing = token.raw.match(/\n*$/)?.[0] ?? "";
  const body = token.raw
    .slice(match[0].length, token.raw.length - trailing.length)
    .split("\n")
    .map(line => line.replace(/^> ?/, ""))
    .join("\n")
    .trim();

  const bodyTokens: Token[] = marked.lexer(body).filter(t => t.type !== "space");
  const isSingleParagraph = bodyTokens.length === 1 && bodyTokens[0].type === "paragraph";
  if (isSingleParagraph) {
    return `${alert.label}: ${body}${trailing}`;
  }
  return `<aside class="${alert.className}"><b>${alert.label}:</b>\n\n${body}\n\n</aside>${trailing}`;
}
