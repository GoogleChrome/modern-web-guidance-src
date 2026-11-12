import assert from 'node:assert/strict';
import test from 'node:test';
import { scanFiles } from '../../scanners/index.ts';
import { matchJsRule } from '../../scanners/js-scanner.ts';
import jsDefaultRules, { structuredCloneRule as exportedJsRule } from '../js.ts';
import { JS_GUIDE_HASH, structuredCloneMatcher, structuredCloneRule } from './structured-clone.ts';

void test('js/structured-clone matcher', async (t) => {
  await t.test('wires js/structured-clone in src/rules/js.ts with the locked guideHash', () => {
    assert.strictEqual(JS_GUIDE_HASH, '8ad03eec26ab');
    const matchingRules = jsDefaultRules.filter((rule) => rule.id === 'js/structured-clone');
    assert.strictEqual(matchingRules.length, 1);
    const [rule] = matchingRules;
    assert.strictEqual(rule?.guideId, 'js');
    assert.strictEqual(rule?.guideHash, '8ad03eec26ab');
    assert.strictEqual(rule, exportedJsRule);
  });

  await t.test('flags direct JSON.parse(JSON.stringify(x)) deep-copy shapes', () => {
    const code = `
      function cloneVariants(state, getStoreData) {
        const a = JSON.parse(JSON.stringify(state));
        const b = JSON.parse(JSON.stringify(this.settings.data));
        const c = JSON.parse(JSON.stringify([...state.items]));
        const d = JSON.parse(JSON.stringify(getStoreData(state.id)));
        const e = globalThis.JSON.parse(window.JSON.stringify({ nested: state }));
        return { a, b, c, d, e };
      }
    `;
    const matches = matchJsRule(structuredCloneMatcher, 'app.js', code);
    assert.deepEqual(
      matches.map((m) => m.line),
      [3, 4, 5, 6, 7],
    );
  });

  await t.test('flags plain data classes, shadowed location, conditional guards, and TS assertions', () => {
    const code = `
      class PlainDataRecord {
        constructor(id, label) {
          this.id = id;
          this.label = label;
        }
      }

      export function cloneRecords(location, params?: Record<string, unknown>, override?: unknown) {
        const record = new PlainDataRecord(7, 'alpha');
        const copiedRecord = JSON.parse(JSON.stringify(record));
        const copiedInline = JSON.parse(JSON.stringify(new PlainDataRecord(8, 'beta')));
        const copiedLocalCoords = JSON.parse(JSON.stringify(location));
        const paramsObject = JSON.parse(JSON.stringify(params || {}));
        const oldOverride = override ? JSON.parse(JSON.stringify(override)) || null : null;
        const typedCopy = JSON.parse((JSON.stringify(paramsObject)) as string);
        return { copiedRecord, copiedInline, copiedLocalCoords, oldOverride, typedCopy };
      }
    `;
    const matches = matchJsRule(structuredCloneMatcher, 'records.ts', code);
    assert.deepEqual(
      matches.map((m) => m.line),
      [11, 12, 13, 14, 15, 16],
    );
  });

  await t.test('flags plain local objects, toRaw(), own getters, and logical assignments; delegates ambiguous cases to dropWhen', () => {
    const vueSetupCode = `
      <template><div>{{ state.count }}</div></template>
      <script setup lang="ts">
      const state = { count: 0, items: ['a', 'b'] };
      const reactiveState = reactive({ count: 0 });
      function copyState() {
        return JSON.parse(JSON.stringify(state));
      }
      function copyUnwrapped() {
        return JSON.parse(JSON.stringify(toRaw(reactiveState)));
      }
      </script>
    `;
    const vueFindings = scanFiles(
      new Map([['src/views/SetupView.vue', vueSetupCode]]),
      [structuredCloneRule],
    );
    assert.deepEqual(
      vueFindings.map((f) => f.line),
      [7, 10],
    );

    const gettersAndLogicalAssignments = `
      const withGetter = JSON.parse(JSON.stringify({ a: 1, get computedSum() { return this.a + 1; } }));
      const nullishAssign = JSON.parse(JSON.stringify(obj.x ??= fallback));
      const orAssign = JSON.parse(JSON.stringify(obj.x ||= fallback));
      const andAssign = JSON.parse(JSON.stringify(obj.x &&= next));
    `;
    assert.deepEqual(
      matchJsRule(structuredCloneMatcher, 'getters-and-assigns.js', gettersAndLogicalAssignments).map((m) => m.line),
      [2, 3, 4, 5],
    );

    const ambiguousInJs = `
      const themeCopy = JSON.parse(JSON.stringify(config.style));
      const treeCopy = JSON.parse(JSON.stringify(menu.children));
      const metaCopy = JSON.parse(JSON.stringify(field.attributes));
      const recordWithDate = JSON.parse(JSON.stringify({ createdAt: new Date() }));
    `;
    assert.deepEqual(
      matchJsRule(structuredCloneMatcher, 'ambiguous.js', ambiguousInJs).map((m) => m.line),
      [2, 3, 4, 5],
    );
  });

  await t.test('does not suppress unguarded clones when an unrelated function uses structuredClone', () => {
    const code = `
      function modernClone(x) {
        return structuredClone(x);
      }
      function legacyClone(y) {
        return JSON.parse(JSON.stringify(y));
      }
    `;
    const matches = matchJsRule(structuredCloneMatcher, 'mixed.js', code);
    assert.deepEqual(
      matches.map((m) => m.line),
      [6],
    );
  });

  await t.test('exempts modern structuredClone and feature-guarded fallbacks', () => {
    const code = `
      const directModern = structuredClone(data);
      const qualifiedModern = globalThis.structuredClone(data);

      const ternaryGuarded =
        typeof structuredClone === 'function'
          ? structuredClone(data)
          : JSON.parse(JSON.stringify(data));

      const nullishGuarded =
        globalThis.structuredClone ?? ((value) => JSON.parse(JSON.stringify(value)));

      function earlyReturnGuarded(value) {
        if (typeof structuredClone !== 'undefined') {
          return structuredClone(value);
        }
        return JSON.parse(JSON.stringify(value));
      }

      if (!('structuredClone' in globalThis)) {
        globalThis.structuredClone = (value) => JSON.parse(JSON.stringify(value));
      }
    `;
    assert.equal(matchJsRule(structuredCloneMatcher, 'guarded.js', code).length, 0);
  });

  await t.test('exempts custom toJSON hooks, replacer/reviver arguments, and chained string transforms', () => {
    const code = `
      class ModelWithToJson {
        toJSON() {
          return { serialized: true };
        }
      }

      class GetterToJson {
        get toJSON() {
          return () => ({ getter: true });
        }
      }

      const toJSON = () => ({ custom: 1 });
      const ownMethod = JSON.parse(JSON.stringify({ a: 1, toJSON() { return { b: 2 }; } }));
      const ownGetter = JSON.parse(JSON.stringify({ a: 1, get toJSON() { return { b: 2 }; } }));
      const ownProp = JSON.parse(JSON.stringify({ a: 1, toJSON: () => ({ b: 2 }) }));
      const shorthandHook = JSON.parse(JSON.stringify({ a: 1, toJSON }));
      const classInstance = new ModelWithToJson();
      const classHook = JSON.parse(JSON.stringify(classInstance));
      const getterInstance = new GetterToJson();
      const classGetterHook = JSON.parse(JSON.stringify(getterInstance));

      const trimmed = JSON.parse(
        JSON.stringify(bibtex, (k, v) => (typeof v === 'string' ? v.trim() : v)),
      );
      const picked = JSON.parse(JSON.stringify(entry, ['id', 'title']));
      const revived = JSON.parse(JSON.stringify(raw), reviverFn);
      const spreadArgs = JSON.parse(JSON.stringify(...args));
      const replacedBeforeParse = JSON.parse(
        JSON.stringify(template).replace(/this\\.entity_id/g, entity.id),
      );
    `;
    assert.equal(matchJsRule(structuredCloneMatcher, 'hooks.ts', code).length, 0);
  });

  await t.test('exempts structural reactive proxies, ref chains, $store/$state, and Options API Vue this.<prop>', () => {
    const code = `
      const directProxy = JSON.parse(JSON.stringify(new Proxy(raw, handler)));
      const localProxy = new Proxy(raw, handler);
      const fromLocalProxy = JSON.parse(JSON.stringify(localProxy));

      const state = reactive({ name: 'alice' });
      const fromReactive = JSON.parse(JSON.stringify(state));

      const formRef = ref({ title: 'draft', nested: { flag: true } });
      const fromRefValue = JSON.parse(JSON.stringify(formRef.value));
      const fromNestedRefValue = JSON.parse(JSON.stringify(formRef.value.title));
      const fromDeepRefValue = JSON.parse(JSON.stringify(formRef.value.nested.flag));

      const computedSummary = computed(() => ({ count: 1 }));
      const fromComputed = JSON.parse(JSON.stringify(computedSummary.value));

      const props = defineProps();
      const fromProps = JSON.parse(JSON.stringify(props));
      const fromPropsMember = JSON.parse(JSON.stringify(props.user));
      const defaultedProps = withDefaults(defineProps(), { items: () => [] });
      const fromDefaultedProps = JSON.parse(JSON.stringify(defaultedProps.items));
      const model = defineModel();
      const fromModel = JSON.parse(JSON.stringify(model));

      const vuexState = JSON.parse(JSON.stringify(this.$store.state));
      const piniaState = JSON.parse(JSON.stringify(userStore.$state));
      const piniaNested = JSON.parse(JSON.stringify(userStore.$state.profile));
    `;
    assert.equal(matchJsRule(structuredCloneMatcher, 'reactive.ts', code).length, 0);

    const vueOptionsCode = `
      <template><div>{{ cityData.length }}</div></template>
      <script>
      export default {
        methods: {
          newCityData() {
            return JSON.parse(JSON.stringify(this.cityData));
          },
          cloneComponentInstance() {
            return JSON.parse(JSON.stringify(this));
          },
          cloneNestedReactive() {
            return JSON.parse(JSON.stringify({ items: this.items, self: this }));
          },
          cloneReactiveArray() {
            return JSON.parse(JSON.stringify([this.item, this]));
          },
          duplicateRow(row) {
            return JSON.parse(JSON.stringify(row));
          }
        }
      };
      </script>
    `;
    const optionsFindings = scanFiles(
      new Map([['src/components/CityPicker.vue', vueOptionsCode]]),
      [structuredCloneRule],
    );
    assert.deepEqual(
      optionsFindings.map((f) => f.line),
      [19],
    );
  });

  await t.test('exempts DOM-unambiguous properties and non-serializable platform objects', () => {
    const code = `
      const storageCopy = JSON.parse(JSON.stringify(localStorage));
      const sessionCopy = JSON.parse(JSON.stringify(window.sessionStorage));
      const cachesCopy = JSON.parse(JSON.stringify(caches));
      const idbCopy = JSON.parse(JSON.stringify(indexedDB));
      const locationCopy = JSON.parse(JSON.stringify(window.location));
      const bareLocationCopy = JSON.parse(JSON.stringify(location));
      const docLocationCopy = JSON.parse(JSON.stringify(document.location));
      const datasetCopy = JSON.parse(JSON.stringify(el.dataset));
      const classListCopy = JSON.parse(JSON.stringify(el.classList));
      const childNodesCopy = JSON.parse(JSON.stringify(el.childNodes));
      const shadowCopy = JSON.parse(JSON.stringify(el.shadowRoot));
      const ownerDocCopy = JSON.parse(JSON.stringify(el.ownerDocument));
      const contentDocCopy = JSON.parse(JSON.stringify(frame.contentDocument));
      const contentWinCopy = JSON.parse(JSON.stringify(frame.contentWindow));
      const firstElemCopy = JSON.parse(JSON.stringify(el.firstElementChild));
      const nextElemCopy = JSON.parse(JSON.stringify(el.nextElementSibling));
      const paramsCopy = JSON.parse(JSON.stringify(new URLSearchParams('a=1')));
      const formCopy = JSON.parse(JSON.stringify(new FormData()));
      const headersCopy = JSON.parse(JSON.stringify(new Headers()));
      const eventCopy = JSON.parse(JSON.stringify(new CustomEvent('ping')));
      const eventTargetCopy = JSON.parse(JSON.stringify(new EventTarget()));
      const readableCopy = JSON.parse(JSON.stringify(new ReadableStream()));
      const writableCopy = JSON.parse(JSON.stringify(new WritableStream()));
      const transformCopy = JSON.parse(JSON.stringify(new TransformStream()));
      const messageChannelCopy = JSON.parse(JSON.stringify(new MessageChannel()));
      const broadcastChannelCopy = JSON.parse(JSON.stringify(new BroadcastChannel('sync')));
      const abortControllerCopy = JSON.parse(JSON.stringify(new AbortController()));
      const abortSignalCopy = JSON.parse(JSON.stringify(AbortSignal.abort()));
      const mutationObsCopy = JSON.parse(JSON.stringify(new MutationObserver(() => {})));
      const resizeObsCopy = JSON.parse(JSON.stringify(new ResizeObserver(() => {})));
      const intersectionObsCopy = JSON.parse(JSON.stringify(new IntersectionObserver(() => {})));
      const domNodeCopy = JSON.parse(JSON.stringify(document.createElement('div')));
    `;
    assert.equal(matchJsRule(structuredCloneMatcher, 'platform.ts', code).length, 0);
  });

  await t.test('exempts functions, Symbols, Promises, WeakMaps, WeakSets, standalone new Date(), and undefined', () => {
    const code = `
      function lazyHandler() {}
      const arrowHandler = () => {};
      const fnCopy = JSON.parse(JSON.stringify(() => {}));
      const declaredFnCopy = JSON.parse(JSON.stringify(lazyHandler));
      const objWithFn = JSON.parse(JSON.stringify({ ok: 1, run: () => {} }));
      const objWithDeclaredFn = JSON.parse(JSON.stringify({ ok: 1, run: lazyHandler }));
      const objWithShorthandFn = JSON.parse(JSON.stringify({ ok: 1, lazyHandler }));
      const objWithShorthandArrow = JSON.parse(JSON.stringify({ ok: 1, arrowHandler }));
      const objWithMethod = JSON.parse(JSON.stringify({ ok: 1, run() {} }));
      const objWithUndefined = JSON.parse(JSON.stringify({ ok: 1, empty: undefined }));
      const arrWithUndefined = JSON.parse(JSON.stringify([1, undefined]));
      const symCopy = JSON.parse(JSON.stringify(Symbol('id')));
      const wellKnownSymCopy = JSON.parse(JSON.stringify(Symbol.iterator));
      const promiseCopy = JSON.parse(JSON.stringify(Promise.resolve(1)));
      const weakMapCopy = JSON.parse(JSON.stringify(new WeakMap()));
      const weakSetCopy = JSON.parse(JSON.stringify(new WeakSet()));
      const standaloneDateCopy = JSON.parse(JSON.stringify(new Date()));
    `;
    assert.equal(matchJsRule(structuredCloneMatcher, 'non-cloneable.ts', code).length, 0);
  });

  await t.test('exempts trivial primitives, reverse JSON.stringify(JSON.parse(...)), postMessage, split variables, shadowed JSON, and comments/strings', () => {
    const code = `
      const formatted = JSON.stringify(JSON.parse(rawText), null, 2);
      const compact = JSON.stringify(JSON.parse(rawText));

      worker.postMessage(JSON.stringify(message));
      const serialized = JSON.stringify(payload);
      const parsed = JSON.parse(serialized);

      const primStr = JSON.parse(JSON.stringify('hello'));
      const primTpl = JSON.parse(JSON.stringify(\`hello-\${id}\`));
      const primNum = JSON.parse(JSON.stringify(42));
      const primBool = JSON.parse(JSON.stringify(true));
      const primNull = JSON.parse(JSON.stringify(null));
      const primUndefined = JSON.parse(JSON.stringify(undefined));
      const primTypeof = JSON.parse(JSON.stringify(typeof value));
      const primUnary = JSON.parse(JSON.stringify(!flag));
      const primBinary = JSON.parse(JSON.stringify(count + 1));

      function customSerializer(JSON, obj) {
        return JSON.parse(JSON.stringify(obj));
      }

      // JSON.parse(JSON.stringify(commentedOut))
      const codeSnippet = 'JSON.parse(JSON.stringify(inString))';
    `;
    assert.equal(matchJsRule(structuredCloneMatcher, 'negatives.js', code).length, 0);
  });
});
