# Modern Web Analyzer (`src/analyze`)

The analyzer scans brownfield codebases for legacy web platform patterns and maps findings to [Modern Web Guidance](../../guides) guides, enabling automated and agentic modernization.

## Operating Specs & Datasets

Operating specs, evaluation benchmarks, and prior research live in the local repo at `analyzer-internal/` (gitignored):

- **Operating Spec:** [`../../analyzer-internal/MEASUREMENT_FIRST_REDESIGN.md`](../../analyzer-internal/MEASUREMENT_FIRST_REDESIGN.md)
- **Product Vision:** [`../../analyzer-internal/VISION.md`](../../analyzer-internal/VISION.md)
- **Corpus & Split:** [`../../analyzer-internal/repos.json`](../../analyzer-internal/repos.json)
- **Human Labels & Cards:** [`../../analyzer-internal/labels/`](../../analyzer-internal/labels/)
- **Prior Research & v1 Lessons:** [`../../analyzer-internal/legacy/`](../../analyzer-internal/legacy/)

> [!NOTE]
> `analyzer-internal/` is excluded from git tracking (`.git/info/exclude`). Do not commit internal research, evaluation trajectories, or non-public data into this public repository.
