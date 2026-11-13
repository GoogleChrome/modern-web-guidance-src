# `legacy-scan`: file format support

In short: `legacy-scan` reads standalone source files (`.css`, `.vue`, `.ts`) and code embedded inside them (`<style>` blocks, `css` tagged templates). Both count as a **format** here.

This doc covers what `supported` guarantees, the bar for adding a format, and what we currently scan. (Terminology follows [LEXICON.md](./LEXICON.md).)

## What `supported` means

1. Every applicable rule engine runs on it (CSS rules on its styles, DOM rules on its markup, JS rules on its script). See [Known gaps](#known-gaps) for where that isn't true yet.
2. Findings report the **original file's line** on disk, not a line in an extracted snippet.
3. It stays covered by `scanFiles()` contract tests and a per-format release check. **If a supported format stops producing findings, it blocks the release.**
4. Parse failures are **reported visibly**, never silently counted as 0 findings.

(FWIW, the release check and visible parse/skip reporting in #3 and #4 are still being wired up.. until those land, `scanFiles()` contract tests are the gate.)

## Statuses

| Status | What `legacy-scan` does |
| --- | --- |
| `supported` | Scans it with the guarantees above. |
| `expected-skip` | Deliberately doesn't scan it: either our rules can't apply (no stylesheet syntax to match), or we measured it on real code and our rules found nothing worth the cost. |
| `unsupported` | Doesn't scan it. |

For the web source files listed in the table below, `0 findings` shouldn't quietly mean "we didn't look at those files": skipped files are counted by extension in the scan output. (Embedded shapes like MUI `sx` objects inside a `.tsx` file are documented here, not counted.)

## The bar for adding a format

To become `supported`, a format needs to clear five things:

1. **Real-world use.** It shows up in recently active public code at roughly `.astro`'s scale. This is a yardstick, not a hard floor. We measure it, and it's a judgment call.
2. **Payoff.** Our rules actually produce findings on a real-code sample, at a rate comparable to formats we already support. (If our rules never fire on a format in practice, parsing it doesn't help anyone, no matter how popular the framework is.)
3. **Precision.** Findings in the format pass the same [qualification criteria](./README.md#qualification-criteria) as any rule. This is the real test; raw hit counts aren't enough.
4. **Cost.** Extraction preserves original file offsets using the parsers we already ship (TypeScript scanner/AST, `linkedom`, `cssomnom`). No native or WASM dependencies, no new dependency for a single ecosystem, and no hand-rolled tokenizers where the TypeScript scanner will do.
5. **Performance.** It doesn't make scans meaningfully slower for everyone else. Files that don't contain the format shouldn't pay for it (gate any heavier parsing behind a cheap extension or substring check).

You don't need to measure #1 or #2 yourself; maintainers do. Bring real-world examples and a sense of what correct support looks like.

For smaller ecosystems, we lean on domain experts from that community to get the syntax and edge cases right (like consulting an Ember core member on `.gts`). A format that's well under `.astro`'s scale can still get in when extraction is small and cheap and we have that domain input, but that's our call, case by case.

## Boundaries (what we won't do)

- **Declared, not guessed.** We only extract embedded CSS or markup when the syntax explicitly declares it (`<style>` and `<script>` tags, file extensions, or tagged templates like `css` and styled-components' `createGlobalStyle`). We never guess from variable names or "looks like CSS" heuristics. Where a file extension collides with an unrelated format, we should check content before treating it as code (see [Known gaps](#known-gaps)).
- **Never compile or evaluate.** We don't run preprocessors, compilers, or template engines (Sass, Less, MDX, Pug, etc.). Preprocessor stylesheets like SCSS and Less are read as CSS-tolerant text with at most a cheap pre-pass (like masking `//` comments).
- **Stylesheets, not style objects.** Object-style CSS-in-JS (MUI `sx`, `makeStyles`, vanilla-extract) is `expected-skip` because our CSS rules match stylesheet rules, not JS objects.
- **Web languages.** Non-web host languages (Python, Ruby, etc.) are `unsupported`. Server-side templates that are mostly HTML get evaluated one by one against the bar above.

## Current formats

| Format | Status | Notes |
| --- | --- | --- |
| `.css` | supported | |
| `.html`, `.htm`, `.php` (incl. `.blade.php`) | supported | |
| `.js`, `.mjs`, `.cjs`, `.ts`, `.mts`, `.cts`, `.jsx`, `.tsx` | supported | |
| `package.json` | supported | Dependency rules |
| `.vue`, `.svelte`, `.astro`: script, style and template blocks | supported | |
| `css` tagged templates in JS/TS (Lit, Emotion, styled-components' `css` helper) | supported | Bodies with no selector rarely match |
| `.gts`, `.gjs` (Ember template tag) | supported | Well under `.astro`'s scale; taken on Ember-community input and small extraction cost |
| `<style lang="scss">` / `lang="less"` blocks | supported | Scanned today, but rules after a `//` comment are dropped; fix in flight |
| `.scss`, `.less` | unsupported | Not scanned today; support in flight |
| `createGlobalStyle` (styled-components) | unsupported | Under review |
| styled-components and Emotion component styles (`styled.div`) | expected-skip | Mostly bare declarations |
| Object-style CSS-in-JS | expected-skip | |
| Angular inline `styles` / `template` | expected-skip | Measured; found nothing |
| Lit `html` templates, markup in `innerHTML` strings | expected-skip | Measured; found nothing |
| Untagged template literals that look like CSS | unsupported | Not declared |
| `.sass` (indented), `.styl`, `.mdx`, `.pug` | unsupported | Would need a compiler, or too small |
| Server-side templates other than PHP (`.ejs`, `.jsp`, `.erb`, `.cshtml`, `.twig`, ...) | unsupported | Candidates |
| Non-web languages | unsupported | |

Why are styled-components and Emotion component styles `expected-skip` instead of `supported`? Their blocks are mostly bare declarations with no selector, and our CSS rules match against selectors. Scanning them finds almost nothing.

## Known gaps

- `css` tagged templates inside a `<script>` block of an HTML, Vue, Svelte or Astro file aren't extracted.
- DOM rules don't run on JSX inside `<script lang="tsx">` / `lang="jsx"` blocks of SFCs.
- `.gts` files that are actually Gerber PCB files (same extension) aren't filtered out by content yet. They produce no findings, but they shouldn't be parsed as code.

## Proposing a format

[Open an issue](../../CONTRIBUTING.md#proposal-first-for-non-trivial-changes) before sending a PR. Include real-world examples and what right support looks like in that ecosystem. Maintainers will check real-world use and rule payoff, make the call, and update the table above. (If you open a PR for a new format without an agreed issue first, we'll point you back to the issue tracker.)

If the usage or payoff evidence for a supported format stops holding up, it moves to `expected-skip` and we note the change here.
