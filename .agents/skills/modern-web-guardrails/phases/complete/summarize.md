# Command: summarize

Formats and writes the final audit summary markdown.

## Purpose
To provide persistent logs documenting all discovery outcomes and resolved conflicts.

## Log Location
Write the summary file exactly to:
`results/modern-web-guardrails-<YYYY-MM-DD>/result-<HH-MM-SS>.md`

## Structure
1. **Baseline declarations found**
2. **Rule-level allow-list exceptions**
3. **Inline exceptions cataloged**
4. **Conflicts resolved** — for every conflict where a config file was modified, include a fenced `diff` block showing the exact before/after lines changed. Label it **Diff applied:**. Omit the diff block only for conflicts resolved with "keep as-is" (resolution C).
5. **Acknowledged divergences**
6. **Advisory notices**
7. **Write Time Section** (Static analysis)
8. **Deployment Time Section** (Lighthouse analysis)
9. **Effective baseline (project-wide)**
