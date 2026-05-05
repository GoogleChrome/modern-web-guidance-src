import { fileURLToPath } from 'node:url';

export { testGrader } from './run-grader.ts';

if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  const { testGrader } = await import('./run-grader.ts');
  const args = process.argv.slice(2);
  const dir = args.find(a => !a.startsWith('--'));
  if (!dir) {
    console.error('Usage: gd dev <path/to/guide> --test-grader');
    process.exit(1);
  }
  const result = await testGrader(dir);
  process.exit(result.success ? 0 : 1);
}
