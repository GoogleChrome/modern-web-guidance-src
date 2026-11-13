# legacy-scan: file format support

Which files, and which languages embedded inside them, `legacy-scan` reads; what that promises; and how a new format gets added. Vocabulary follows [LEXICON.md](./LEXICON.md).

A **format** is a file type (`.vue`, `.scss`) or an embedded region inside one (a `<style>` block, a Lit `css` tagged template). Each format has a **status** and an **owner**.

## What "supported" means

A supported format gets all of the following:

1. **Every rule whose engine applies runs on it.** CSS rules run on its CSS, DOM rules on its markup, JS rules on its script, wherever they sit in the file.
2. **Findings point at the original file.** Line and column refer to the file on disk, not to an extracted copy.
3. **It is regression-tested.** `scanFiles()` contract tests and a per-format release check cover it. A supported format that stops producing findings blocks a release.
4. **Failures are visible.** Files or regions that fail to parse are reported, never silently counted as zero findings.

Items 3 and 4 are being built out; until they land, contract tests are the gate.

## Statuses

| Status | What `legacy-scan` does |
| --- | --- |
| `supported` | Scans it, with the guarantees above |
| `expected-skip` | Recognizes it and deliberately doesn't scan it, because our rules can't apply to it; reports it as skipped |
| `unsupported` | Doesn't recognize it; reports it as skipped |

"No findings" should never mean "didn't look" without saying so.

## Owners

| Owner | Meaning |
| --- | --- |
| `core` | Maintainers fix breakage |
| `contributor` | A named contributor or ecosystem expert is the first call when it breaks. If a breakage isn't fixed by the next release, the format moves to `expected-skip` |

## The bar for adding a format

A format becomes `supported` when it clears all five:

1. **Real-world use.** It shows up in real code at a scale comparable to the smallest format we already support. We measure this across a large sample of public repositories, counting recently active projects.
2. **Payoff.** On a sample of real files (at least 100), our rules find things at a rate comparable to a format we already support. A format our rules can't fire on doesn't help anyone, however common it is.
3. **Precision.** Findings in the new format meet the same qualification bar as any rule ([README](./README.md#qualification-criteria)).
4. **Cost.** Extraction preserves original offsets and uses the parsers we already ship: the TypeScript scanner and AST, linkedom, and cssomnom. No native or WASM dependencies. No new dependency that only serves one ecosystem. No hand-written tokenizers where the TypeScript scanner will do.
5. **An owner.** `core`, or a named `contributor`. For smaller ecosystems, an ecosystem expert's view of what correct support looks like.

A format that falls short on real-world use but clears the rest can be `supported` with a `contributor` owner, if extraction is small.

## Boundaries

- **Declared, not guessed.** Embedded CSS or markup is recognized only by syntax that declares it: `<style>` and `<script>` tags, file extensions (with a content check where an extension is shared with an unrelated file type), and tagged templates whose tag is a known library API, such as Lit's `css` or styled-components' `createGlobalStyle`. Never by variable names or by "looks like CSS".
- **Never compile or evaluate.** Preprocessor languages such as SCSS and Less are read as CSS-tolerant text, with at most a cheap pre-pass (for example masking `//` comments). We don't run Sass, Less, MDX, Pug or template engines.
- **Stylesheets, not style objects.** Object-style CSS-in-JS (MUI `sx`, `makeStyles`, vanilla-extract) is `expected-skip`: our CSS rules read stylesheets.
- **Web languages.** Server-side templates that are mostly HTML are judged one by one against the bar. Other host languages (Python, Ruby, ...) are `unsupported`.

## Current formats

| Format | Status | Owner |
| --- | --- | --- |
| `.css` | supported | core |
| `.html`, `.htm`, `.php` (incl. `.blade.php`) | supported | core |
| `.js`, `.mjs`, `.cjs`, `.ts`, `.mts`, `.cts`, `.jsx`, `.tsx` | supported | core |
| `.vue`, `.svelte`, `.astro`: script, style and template blocks | supported | core |
| Lit `css` tagged templates in JS/TS | supported | core |
| `.gts`, `.gjs` (Ember template tag) | supported | contributor |
| `<style lang="scss">` / `lang="less"` blocks | in progress (`//` comments) | core |
| `.scss`, `.less` | in progress | core |
| `createGlobalStyle` (styled-components) | under review | contributor |
| styled-components and Emotion component styles | expected-skip | — |
| Object-style CSS-in-JS | expected-skip | — |
| Angular inline `styles` / `template` | expected-skip | — |
| Lit `html` templates, markup in `innerHTML` strings | expected-skip | — |
| Untagged template literals that look like CSS | unsupported | — |
| `.sass` (indented), `.styl`, `.mdx`, `.pug` | unsupported | — |
| Server-side templates other than PHP (`.ejs`, `.jsp`, `.erb`, `.cshtml`, `.twig`, ...) | unsupported (candidates) | — |
| Non-web languages | unsupported | — |

Styled-components and Emotion component bodies are mostly bare declarations with no selector, and our CSS rules match rules with selectors, so scanning them finds little. That's why they are `expected-skip` rather than `supported`.

## Proposing a format

Open an issue before a PR (see [CONTRIBUTING.md](../../CONTRIBUTING.md#proposal-first-for-non-trivial-changes)). Include real-world examples and what correct support looks like in that ecosystem. Maintainers measure real-world use and payoff, decide, and update the table above. PRs that add a format without an agreed issue will be pointed back to one.

## Leaving

A format moves to `expected-skip` when its release check breaks and its owner doesn't fix it by the next release, or when the evidence for it no longer holds. The change is noted in this file.
