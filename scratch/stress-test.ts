import { scanAllGuides, classifyGuide } from '../lib/guide-validation.ts';
import { testGrader } from '../guides/run-grader.ts';
import * as path from 'path';

async function run() {
  const allGuides = scanAllGuides();
  const readyGuides = allGuides.filter(g => classifyGuide(g) === 'eval-ready');

  console.log(`Found ${readyGuides.length} eval-ready guides to stress test.`);

  const iterations = 5;
  const concurrency = 8; // Adjust to increase/decrease load

  console.log(`Running ${iterations} iterations with concurrency ${concurrency}...`);

  for (let iter = 1; iter <= iterations; iter++) {
    console.log(`\n--- Iteration ${iter}/${iterations} ---`);
    const startTime = Date.now();
    
    // Create tasks
    const tasks = readyGuides.map(guide => async () => {
      const start = Date.now();
      try {
        // Run testGrader silently
        const result = await testGrader(guide.dir, true);
        const duration = Date.now() - start;
        return { guide: guide.name, success: result.success, duration, error: null, result };
      } catch (err: any) {
        return { guide: guide.name, success: false, duration: Date.now() - start, error: err.message, result: null };
      }
    });

    // Run with concurrency limit
    const results = await limitConcurrency(tasks, concurrency);
    const duration = Date.now() - startTime;
    
    // Report iteration results
    const failed = results.filter(r => !r.success);
    console.log(`Iteration ${iter} finished in ${(duration / 1000).toFixed(1)}s. Failed: ${failed.length}/${results.length}`);
    for (const f of failed) {
      let detail = '';
      if (f.result) {
        const demoFail = f.result.demo.failed;
        const negPass = f.result.negative.passed;
        detail = `(demo failed: ${demoFail}, negative passed: ${negPass})`;
      } else {
        detail = `Error: ${f.error}`;
      }
      console.log(`  - ${f.guide} ${detail} [${(f.duration / 1000).toFixed(1)}s]`);
    }
  }
}

async function limitConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = [];
  const running: Promise<void>[] = [];
  
  for (const task of tasks) {
    const p = (async () => {
      const res = await task();
      results.push(res);
    })();
    running.push(p);
    p.then(() => {
      running.splice(running.indexOf(p), 1);
    });
    if (running.length >= limit) {
      await Promise.race(running);
    }
  }
  await Promise.all(running);
  return results;
}

run().catch(console.error);
