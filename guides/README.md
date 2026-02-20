Testing Guides:

1. Create a `guide.md`, `expectations.md`, and `demo.html` in the desired guide directory.
2. Set `GEMINI_API_KEY` and `GEMINI_MODEL` environment variables in `guidance/.env`.

.env:
```
GEMINI_API_KEY=api-key
GEMINI_MODEL=gemini-3-pro-preview
```

3. From `guidance/` root:

Setup:
```
pnpm install
pnpm setup:playwright
```

Generate negative demo:
```
pnpm generate-negative </path/to/guide_dir>
```

This will create a `negative-demo.html` file in the guide directory.

Generate grader:
```
pnpm generate-grader </path/to/guide_dir>
```

This will create a `grader.ts` file in the guide directory.

4. Once the grader is generated, run it on the `demo.html` and `negative-demo.html` with:

```
pnpm test:guide </path/to/guide_dir>
```

The test should pass at 100% for `demo.html`, and 0% for `negative-demo.html`. Make the necessary updates until this is reliably true.

5. Run evals on the guide