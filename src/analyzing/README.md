# Modern Web Analyzer (`src/analyzing`)

The analyzer scans brownfield codebases for legacy web platform patterns and maps findings to [Modern Web Guidance](../../guides) guides, enabling automated and agentic modernization.

## Operating Specs & Datasets

Operating specs, evaluation benchmarks, and prior research live in the local repo at `analyzer-internal/`:

- **Operating Spec:** [`../../analyzer-internal/MEASUREMENT_FIRST_REDESIGN.md`](../../analyzer-internal/MEASUREMENT_FIRST_REDESIGN.md)
- **Product Vision:** [`../../analyzer-internal/VISION.md`](../../analyzer-internal/VISION.md)
- **Corpus & Split:** [`../../analyzer-internal/repos.json`](../../analyzer-internal/repos.json)
- **Human Labels & Cards:** [`../../analyzer-internal/labels/`](../../analyzer-internal/labels/)
- **Prior Research & v1 Lessons:** [`../../analyzer-internal/legacy/`](../../analyzer-internal/legacy/)

> [!NOTE]
> `analyzer-internal/` is a separate local git repo for internal specs, benchmarks, and research. It is ignored by guidance (`.git/info/exclude`) and never pushed to GitHub. Commit internal docs there, not here.
