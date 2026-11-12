import assert from 'node:assert/strict';
import test from 'node:test';
import { scanFiles } from '../../scanners/index.ts';
import { matchJsRule } from '../../scanners/js-scanner.ts';
import jsDefaultRules, { copyingArrayMethodsRule as exportedJsRule } from '../js.ts';
import {
  copyingArrayMethodsMatcher,
  copyingArrayMethodsRule,
  JS_COPYING_ARRAY_METHODS_GUIDE_HASH,
} from './copying-array-methods.ts';

void test('js/copying-array-methods matcher', async (t) => {
  await t.test('wires js/copying-array-methods in src/rules/js.ts with the locked guideHash', () => {
    assert.strictEqual(JS_COPYING_ARRAY_METHODS_GUIDE_HASH, '8ad03eec26ab');
    const matchingRules = jsDefaultRules.filter((rule) => rule.id === 'js/copying-array-methods');
    assert.strictEqual(matchingRules.length, 1);
    const [rule] = matchingRules;
    assert.strictEqual(rule?.guideId, 'js');
    assert.strictEqual(rule?.guideHash, '8ad03eec26ab');
    assert.strictEqual(rule, exportedJsRule);
  });

  await t.test('flags shallow-copy .sort() and .reverse() variants across JS, TS, Vue, and HTML', () => {
    const code = `
      function sortAndReverseArrays(arr, fallback, obj, buf, cmp) {
        const a = [...arr].sort();
        const b = [...arr].sort((x, y) => x - y);
        const c = arr.slice().sort(cmp);
        const d = arr.slice(0).sort();
        const e = arr.slice(undefined).sort();
        const f = arr.concat().sort(cmp);
        const g = [...arr].reverse();
        const h = arr.slice().reverse();
        const i = arr.slice(0).reverse();
        const j = arr.concat().reverse();
        const k = [...Object.keys(obj)].sort();
        const l = [...(fallback ?? arr)].sort();
        const m = new Int32Array(buf).slice().sort();
        const n = new Uint8Array(buf).slice().reverse();
        const sortedCopy = arr.slice().sort();
        sortedCopy.push('tail');
        const doubleCopy = [...arr].slice().sort();
        return [a, b, c, d, e, f, g, h, i, j, k, l, m, n, sortedCopy, doubleCopy];
      }
    `;
    const arrayMatches = matchJsRule(copyingArrayMethodsMatcher, 'arrays.js', code);
    assert.deepEqual(
      arrayMatches.map((m) => m.line),
      [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19],
    );
    assert.ok(arrayMatches.at(-1)?.message.startsWith('Use arr.toSorted()'));

    const tsCode = `
      export function sortTyped(
        arr: number[],
        ta: Uint16Array | null,
        nullableArr: readonly string[] | undefined,
        tupleVal: [string, number],
      ): number[] {
        const label = arr + ' numbers';
        const copy = ([...arr] as number[]).sort((a, b) => a - b);
        const taSorted = ta ? ta.slice().sort((a, b) => a - b) : [];
        const optSorted = nullableArr ? [...nullableArr].sort() : [];
        const tupSorted = [...tupleVal].sort();
        const multilineSpread = [
          ...arr,
        ].sort();
        return label && taSorted.length && optSorted.length && tupSorted.length
          ? copy
          : multilineSpread.length ? arr.slice().reverse() : [];
      }
    `;
    assert.deepEqual(
      matchJsRule(copyingArrayMethodsMatcher, 'typed.ts', tsCode).map((m) => m.line),
      [9, 10, 11, 12, 13, 18],
    );

    const vueCode = `
      <template><div>{{ sorted.length }}</div></template>
      <script setup>
      const items = [3, 1, 2];
      const sorted = [...items].sort((a, b) => a - b);
      </script>
    `;
    const htmlCode = `
      <html><body><script type="module">
        const items = ['b', 'a'];
        console.log(items.slice().reverse());
      </script></body></html>
    `;
    const multiFindings = scanFiles(
      new Map([
        ['src/App.vue', vueCode],
        ['public/index.html', htmlCode],
      ]),
      [copyingArrayMethodsRule],
    );
    assert.deepEqual(
      multiFindings.map((f) => [f.file, f.line]),
      [
        ['src/App.vue', 5],
        ['public/index.html', 4],
      ],
    );
  });

  await t.test('flags copying .reverse().find() and length-inverted .reverse().findIndex()', () => {
    const code = `
      function findFromEnd(arr, pred, ctx) {
        const a = [...arr].reverse().find(pred);
        const b = arr.slice().reverse().find(pred, ctx);
        const c = arr.concat().reverse().find(pred);
        const d = arr.length - 1 - arr.slice().reverse().findIndex(pred);
        const e = arr.length - [...arr].reverse().findIndex(pred) - 1;
        const f = arr.length - (arr.concat().reverse().findIndex(pred) + 1);
        const revIdx = arr.slice().reverse().findIndex(pred);
        const g = arr.length - 1 - revIdx;
        let idx = -1;
        idx = [...arr].reverse().findIndex(pred);
        const h = arr.length - 1 - idx;
        const i = arr.length - 1 - (arr.slice().reverse().findIndex(pred));
        return [a, b, c, d, e, f, g, h, i];
      }
    `;
    const findMatches = matchJsRule(copyingArrayMethodsMatcher, 'find-last.js', code);
    assert.deepEqual(
      findMatches.map((m) => m.line),
      [3, 4, 5, 6, 7, 8, 9, 12, 14],
    );
    assert.ok(findMatches.at(-1)?.message.includes('without .length - 1 - ...'));
  });

  await t.test('exempts non-Array iterables and DOM/array-like spread targets', () => {
    const code = `
      function spreadNonArrays(tags, pairs, map, set, str, el, input, select, buf, extra) {
        const s1 = [...new Set(tags)].sort();
        const s1b = [...new Set(tags)].slice().sort();
        const s2 = [...new Set(tags).add(extra)].reverse();
        const m1 = [...new Map(pairs)].sort();
        const it1 = [...map.keys()].sort();
        const it2 = [...set.values()].reverse();
        const it3 = [...map.entries()].sort();
        const it4 = [...str.matchAll(/a/g)].reverse();
        const dom1 = [...el.children].sort();
        const dom2 = [...el.childNodes].reverse();
        const dom3 = [...el.classList].sort();
        const dom4 = [...el.attributes].reverse();
        const dom5 = [...input.files].sort();
        const dom6 = [...document.forms].sort();
        const dom7 = [...document.images].reverse();
        const dom8 = [...document.links].sort();
        const dom9 = [...document.scripts].reverse();
        const dom10 = [...document.styleSheets].sort();
        const dom11 = [...select.selectedOptions].reverse();
        const dom12 = [...document.querySelectorAll('li')].sort();
        const dom13 = [...el.getElementsByTagName('p')].reverse();
        const dom14 = [...el.getElementsByClassName('item')].sort();
        const dom15 = [...document.getElementsByName('x')].reverse();
        const argsCopy = [...arguments].sort();
        const strLit = [...'hello'].reverse();
        const tplLit = [...\`prefix-\${extra}\`].reverse();
        const taSpread = [...new Int32Array(buf)].sort();
        return [
          s1, s2, m1, it1, it2, it3, it4,
          dom1, dom2, dom3, dom4, dom5, dom6, dom7, dom8, dom9, dom10, dom11, dom12, dom13, dom14, dom15,
          argsCopy, strLit, tplLit, taSpread,
        ];
      }
    `;
    assert.equal(matchJsRule(copyingArrayMethodsMatcher, 'non-arrays.js', code).length, 0);

    const scopedTsCode = `
      class Panel {
        controllers = new Set<string>();
        listControllers() {
          return [...this.controllers].sort();
        }
      }

      function scopedBindings(
        s: Set<string>,
        nestedSet: Set<string[]>,
        nestedMap: Map<string, number[]> | null,
        rs: ReadonlySet<number>,
        n: NodeListOf<Element>,
        h: HTMLCollection,
        ta: Uint16Array,
        attr: { value: string },
        keys,
        closedSet,
      ) {
        const localSet = new Set(['a']);
        const localMap = new Map<string, number>();
        localMap.set('a', 1);
        keys.delete('a');
        const mutateOuter = () => closedSet.add('x');
        let text = attr.value;
        text = text.replace(/x/g, '');
        return [
          [...localSet].sort(),
          [...localMap].sort(),
          [...keys].sort(),
          [...text].reverse(),
          [...s].sort(),
          [...nestedSet].sort(),
          [...(nestedMap ?? [])].sort(),
          [...rs].sort(),
          [...n].reverse(),
          [...h].sort(),
          [...ta].reverse(),
          [...closedSet].sort(),
          mutateOuter,
        ];
      }
    `;
    assert.equal(matchJsRule(copyingArrayMethodsMatcher, 'scoped.ts', scopedTsCode).length, 0);

    const shadowedCode = `
      class Outer {
        controllers = ['b', 'a'];
        list() {
          class Inner {
            controllers = new Set(['z']);
          }
          return [Inner, [...this.controllers].sort()];
        }
      }

      function outerShadowed(items: string[]) {
        const innerFn = () => {
          const items = new Set(['x']);
          return items.size;
        };
        const shadowParam = (items: Set<string>) => items.delete('y');
        return [innerFn, shadowParam, [...items].sort()];
      }

      function outerSetInnerArray(items: Set<string>) {
        if (items.size > 0) {
          const items = ['c', 'a'];
          return [...items].sort();
        }
        return [];
      }
    `;
    assert.deepEqual(
      matchJsRule(copyingArrayMethodsMatcher, 'shadowed.ts', shadowedCode).map((m) => m.line),
      [8, 18, 24],
    );
  });

  await t.test('exempts array-like slice.call, Array.from, bounded slices, non-empty concats, callback index usage, and un-inverted findIndex', () => {
    const code = `
      function edgeCases(arr, arrayLike, iterable, map, buf, args, other, pred) {
        const c1 = [].slice.call(arrayLike).reverse();
        const c2 = Array.prototype.slice.call(arguments, 0).sort();
        const c3 = Array.from(iterable).sort();
        const c4 = Array.from(map.values()).reverse().find(pred);
        const b1 = arr.slice(1).sort();
        const b2 = arr.slice(0, 10).reverse();
        const b3 = arr.slice(...args).sort();
        const n1 = arr.concat(other).sort();
        const n2 = ['head', ...arr].sort();
        const n3 = [...arr, ...other].reverse();
        const taConcat = new Int32Array(buf).concat().sort();
        const opt1 = arr?.slice().sort();
        const opt2 = arr.slice()?.sort();
        const opt3 = arr?.slice().reverse().find(pred);
        const idxCb1 = arr.slice().reverse().find((x, i) => i > 0);
        const idxCb2 = [...arr].reverse().find((...rest) => rest.length > 0);
        const idxCb3 = arr.slice().reverse().find(function (x) { return arguments[1] === 0; });
        const unInverted = [...arr].reverse().findIndex(pred);
        const wrongLen = other.length - 1 - arr.slice().reverse().findIndex(pred);
        const mutatedCopy = arr.slice();
        mutatedCopy.push(1);
        mutatedCopy.sort();
        arr.sort();
        arr.reverse();
        return [c1, c2, c3, c4, b1, b2, b3, n1, n2, n3, taConcat, opt1, opt2, opt3, idxCb1, idxCb2, idxCb3, unInverted, wrongLen, mutatedCopy];
      }
    `;
    assert.equal(matchJsRule(copyingArrayMethodsMatcher, 'edges.js', code).length, 0);
  });

  await t.test('exempts feature guards, polyfills, comments/strings, and keeps unguarded functions in mixed files', () => {
    const guarded = `
      const g1 = typeof arr.toSorted === 'function' ? arr.toSorted() : arr.slice().sort();
      const g2 = 'toReversed' in Array.prototype ? arr.toReversed() : [...arr].reverse();
      if (!Array.prototype.findLast) {
        const last = [...arr].reverse().find(pred);
      }
      Array.prototype.toSorted = function (cmp) {
        return this.slice().sort(cmp);
      };
      function toReversed(list) {
        return [...list].reverse();
      }
      // [...arr].sort()
      const str = 'arr.slice().reverse()';
    `;
    assert.equal(matchJsRule(copyingArrayMethodsMatcher, 'guarded.js', guarded).length, 0);

    const mixed = `
      function modernSort(xs) {
        return xs.toSorted();
      }
      function legacySort(ys) {
        return ys.slice().sort();
      }
    `;
    assert.deepEqual(
      matchJsRule(copyingArrayMethodsMatcher, 'mixed.js', mixed).map((m) => m.line),
      [6],
    );
  });
});
