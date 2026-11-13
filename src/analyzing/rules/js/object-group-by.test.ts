import assert from 'node:assert/strict';
import test from 'node:test';
import { scanFiles } from '../../scanners/index.ts';
import { matchJsRule } from '../../scanners/js-scanner.ts';
import jsDefaultRules, { objectGroupByRule as exportedJsRule } from '../js.ts';
import { JS_GUIDE_HASH, objectGroupByMatcher, objectGroupByRule } from './object-group-by.ts';

void test('js/object-group-by matcher', async (t) => {
  await t.test('wires js/object-group-by in src/rules/js.ts with the locked guideHash', () => {
    assert.strictEqual(JS_GUIDE_HASH, '78d968c460dd');
    const matching = jsDefaultRules.filter((rule) => rule.id === 'js/object-group-by');
    assert.strictEqual(matching.length, 1);
    const [rule] = matching;
    assert.strictEqual(rule?.guideId, 'js');
    assert.strictEqual(rule?.guideHash, '78d968c460dd');
    assert.strictEqual(rule, exportedJsRule);
  });

  await t.test('flags .reduce() grouping variants across block, temp-var, comma, ternary, and spread forms', () => {
    const code = `
      const byIfElse = items.reduce((acc, item) => {
        if (!acc[item.type]) {
          acc[item.type] = [item];
        } else {
          acc[item.type].push(item);
        }
        return acc;
      }, {});

      const byPosIfElse = items.reduce((acc, item) => {
        if (acc[item.type]) {
          acc[item.type].push(item);
        } else {
          acc[item.type] = [item];
        }
        return acc;
      }, Object.create(null));

      const byNullishAssign = items.reduce<Record<string, Item[]>>((acc, result) => {
        const key = \`\${result.title}:\${result.ts}\`;
        acc[key] ??= [];
        acc[key].push(result);
        return acc;
      }, {});

      const byOrAssign = items.reduce((acc, ele) => {
        const group = ele.dataset.group || ele.id;
        acc[group] = acc[group] || [];
        acc[group].push(ele);
        return acc;
      }, {});

      const byTempVar = items.reduce(
        (map, view) => {
          const reviews = map[view.assignee] || [];
          reviews.push(view);
          map[view.assignee] = reviews;
          return map;
        },
        /** @type {Record<string, Item[]>} */ ({}),
      );

      const byConciseComma = items.reduce((acc, cur) => ((acc[cur.k] || (acc[cur.k] = [])).push(cur), acc), {});
      const byBlockReturnComma = items.reduce((e, n) => {
        const r = String(n.id);
        return e[r] || (e[r] = []), e[r].push(n), e;
      }, {});
      const byTernary = items.reduce((acc, x) => {
        acc[x.k] ? acc[x.k].push(x) : (acc[x.k] = [x]);
        return acc;
      }, {});
      const bySpread = items.reduce((acc, x) => ({ ...acc, [x.k]: [...(acc[x.k] ?? []), x] }), {});
    `;
    const matches = matchJsRule(objectGroupByMatcher, 'reduce-variants.ts', code);
    assert.deepEqual(
      matches.map((m) => m.line),
      [2, 11, 20, 27, 34, 44, 45, 49, 53],
    );
  });

  await t.test('flags fresh-object for..of and .forEach() grouping loops including Vue SFCs', () => {
    const jsCode = `
      function groupForOfNullish(items) {
        const grouped = {};
        for (const item of items) {
          (grouped[item.category] ??= []).push(item);
        }
        return grouped;
      }

      function groupForOfHasOwn(items) {
        const out = Object.create(null);
        for (const entry of items) {
          if (!Object.hasOwn(out, entry.kind)) {
            out[entry.kind] = [];
          }
          out[entry.kind].push(entry);
        }
        return out;
      }

      function groupForEach(events) {
        const invalidations = {};
        events.forEach(function (ev) {
          if (!(ev.type in invalidations)) {
            invalidations[ev.type] = [ev];
          } else {
            invalidations[ev.type].push(ev);
          }
        });
        return invalidations;
      }

      function groupBraceless(items) {
        const groups = {};
        for (const x of items) (groups[x.k] ??= []).push(x);
        return groups;
      }

      function groupConciseForEach(items) {
        const groups = {};
        items.forEach((x) => (groups[x.k] ??= []).push(x));
        return groups;
      }

      function groupTernaryForEach(fights) {
        const fightsMapped = {};
        fights.forEach((fight) =>
          fightsMapped[fight.id] ? fightsMapped[fight.id].push(fight) : (fightsMapped[fight.id] = [fight]),
        );
        return fightsMapped;
      }
    `;
    assert.deepEqual(
      matchJsRule(objectGroupByMatcher, 'loops.js', jsCode).map((m) => m.line),
      [4, 12, 23, 35, 41, 47],
    );

    const vueCode = `
      <template><div /></template>
      <script setup lang="ts">
      function groupBuffs(filteredBuffFlat: { value: Array<{ genre: string }> }) {
        let temp: Record<string, Array<{ genre: string }>> = {};
        for (let item of filteredBuffFlat.value) {
          if (!Object.prototype.hasOwnProperty.call(temp, item.genre)) {
            temp[item.genre] = [];
          }
          temp[item.genre].push(item);
        }
        return temp;
      }
      </script>
    `;
    assert.deepEqual(
      scanFiles(new Map([['SelectBuff.vue', vueCode]]), [objectGroupByRule]).map((f) => f.line),
      [6],
    );
  });

  await t.test('ignores projections, multi-field buckets, filters, nested loops, async bodies, post-loop hasOwnProperty, guards, and polyfills', () => {
    const code = `
      // 1. Projected value instead of raw item
      const durations = entries.reduce((acc, entry) => {
        (acc[entry.name] ??= []).push(entry.duration);
        return acc;
      }, {});

      // 2. Multi-property bucket record
      const richBuckets = accounts.reduce((grouped, account) => {
        if (!grouped[account.group]) {
          grouped[account.group] = { name: account.group, accounts: [], total: 0 };
        }
        grouped[account.group].accounts.push(account);
        grouped[account.group].total += account.balance;
        return grouped;
      }, {});

      // 3. Conditional filter inside reducer / loop
      const filtered = items.reduce((acc, s) => {
        if (s.active) {
          (acc[s.type] ??= []).push(s);
        }
        return acc;
      }, {});

      // 4. Non-empty initial accumulator or pre-mutated target object
      const seeded = items.reduce((acc, x) => ((acc[x.k] ??= []).push(x), acc), { preset: [] });
      const existing = {};
      existing.seed = [];
      for (const x of items) {
        (existing[x.k] ??= []).push(x);
      }

      // 5. Nested multi-level loop
      const nested = batches.reduce((total, batch) => {
        for (const stat of batch) {
          (total[stat.id] ??= []).push(stat);
        }
        return total;
      }, {});

      // 6. Async callback or for-await loop
      const asyncReduce = async () => items.reduce(async (acc, x) => {
        const k = await getKey(x);
        (acc[k] ??= []).push(x);
        return acc;
      }, {});
      async function asyncLoop(stream) {
        const out = {};
        for await (const x of stream) {
          (out[x.k] ??= []).push(x);
        }
        return out;
      }

      // 7. Post-loop .hasOwnProperty() call on result object
      function checksProtoMethod(items) {
        const groups = {};
        for (const x of items) {
          (groups[x.k] ??= []).push(x);
        }
        return groups.hasOwnProperty('a');
      }

      // 8. Feature-guarded fallback, modern Object.groupBy, and multi-decl temp var
      const guarded = typeof Object.groupBy === 'function'
        ? Object.groupBy(items, (x) => x.k)
        : items.reduce((acc, x) => ((acc[x.k] ??= []).push(x), acc), {});
      const multiDecl = items.reduce((acc, x) => {
        const b = acc[x.k] || [], extra = 1;
        b.push(x);
        acc[x.k] = b;
        return acc;
      }, {});
    `;
    assert.deepEqual(matchJsRule(objectGroupByMatcher, 'negatives.js', code), []);

    const polyfillCode = `
      if (!Object.groupBy) {
        Object.groupBy = function (items, cb) {
          const obj = Object.create(null);
          for (const item of items) {
            (obj[cb(item)] ??= []).push(item);
          }
          return obj;
        };
      }
    `;
    assert.deepEqual(matchJsRule(objectGroupByMatcher, 'polyfill.js', polyfillCode), []);
  });

  await t.test('supports bracket key extraction in loops, local bucket aliases, block spread reducers, and AST equivalence', () => {
    const bracketKeyCode = `
      function groupByField(items, field) {
        const other = {};
        other.seed = true;
        const grouped = {};
        for (const item of items) {
          const key = item[field];
          (grouped[key] ??= []).push(item);
        }
        return grouped;
      }

      function forEachByField(items, field) {
        const grouped = {};
        items.forEach((item) => {
          const key = item[field];
          (grouped[key] ??= []).push(item);
        });
        return grouped;
      }

      function negativePreSeededWithOther() {
        const other = {};
        const grouped = {};
        grouped.existing = [];
        for (const item of items) {
          const key = item[field];
          (grouped[key] ??= []).push(item);
        }
        return grouped;
      }
    `;
    assert.deepEqual(
      matchJsRule(objectGroupByMatcher, 'bracket-keys.js', bracketKeyCode).map((m) => m.line),
      [6, 15],
    );

    const aliasAndSpreadCode = `
      const directAlias = items.reduce((acc, item) => {
        const bucket = (acc[item.type] ??= []);
        bucket.push(item);
        return acc;
      }, {});

      const threeStmtAlias = items.reduce((acc, item) => {
        const bucket = acc[item.type] ?? [];
        bucket.push(item);
        acc[item.type] = bucket;
        return acc;
      }, {});

      function loopAlias(items) {
        const groups = {};
        for (const item of items) {
          const bucket = (groups[item.k] ??= []);
          bucket.push(item);
        }
        return groups;
      }

      const blockSpread = items.reduce((acc, x) => {
        const k = x.type ?? 'other';
        return { ...acc, [k]: [...(acc[k] ?? []), x] };
      }, {});

      const blockSpreadConcat = items.reduce((acc, x) => {
        const k = x.type;
        return { ...acc, [k]: (acc[k] ?? []).concat(x) };
      }, {});

      const negativeUnwrittenAlias = items.reduce((acc, item) => {
        const bucket = acc[item.type] || [];
        bucket.push(item);
        return acc;
      }, {});

      const negativeSideEffectBeforeSpread = items.reduce((acc, x) => {
        sideEffect(x);
        return { ...acc, [x.k]: [...(acc[x.k] ?? []), x] };
      }, {});
    `;
    assert.deepEqual(
      matchJsRule(objectGroupByMatcher, 'alias-spread.js', aliasAndSpreadCode).map((m) => m.line),
      [2, 8, 17, 24, 29],
    );

    const astEquivalenceCode = `
      const parenNullish = items.reduce((acc, item) => {
        if ((acc[((item)
          .k)]) == null) {
          acc[(item.k)] = [item];
        } else {
          (acc[item.k]).push(item);
        }
        return acc;
      }, {});

      const yodaUndefined = items.reduce((acc, item) => {
        if (undefined !== acc[item.k]) {
          acc[item.k].push(item);
        } else {
          acc[item.k] = [item];
        }
        return acc;
      }, {});

      const negativeInvertedNullish = items.reduce((acc, x) =>
        acc[x.k] == null ? acc[x.k].push(x) : (acc[x.k] = [x]), {});
    `;
    assert.deepEqual(
      matchJsRule(objectGroupByMatcher, 'ast-equiv.js', astEquivalenceCode).map((m) => m.line),
      [2, 12],
    );

    const classMethodGroupByCode = `
      class Grouper {
        private groupBy(xs: any[], key: string) {
          return xs.reduce((acc, item) => {
            const k = item[key];
            if (!acc[k]) acc[k] = [];
            acc[k].push(item);
            return acc;
          }, {});
        }
      }
      export default Grouper;
    `;
    assert.deepEqual(
      matchJsRule(objectGroupByMatcher, 'class-method-groupby.ts', classMethodGroupByCode).map((m) => m.line),
      [4],
    );

    const genericReduceCode = `
      const grouped = items.reduce<Record<string, Item[]>>((acc, item) => {
        (acc[item.category] ??= []).push(item);
        return acc;
      }, {});
    `;
    assert.deepEqual(
      matchJsRule(objectGroupByMatcher, 'generic-reduce.ts', genericReduceCode).map((m) => m.line),
      [2],
    );

    const spreadOnlyReduceCode = `
      const grouped = items.reduce((acc, item) => ({
        ...acc,
        [item.category]: [...(acc[item.category] ?? []), item],
      }), {});
    `;
    assert.deepEqual(
      matchJsRule(objectGroupByMatcher, 'spread-reduce.js', spreadOnlyReduceCode).map((m) => m.line),
      [2],
    );
  });
});
