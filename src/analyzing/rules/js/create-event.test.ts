import assert from 'node:assert/strict';
import test from 'node:test';
import { scanFiles } from '../../scanners/index.ts';
import { matchJsRule } from '../../scanners/js-scanner.ts';
import jsDefaultRules, { jsCreateEventRule as exportedJsRule } from '../js.ts';
import { JS_GUIDE_HASH, jsCreateEventMatcher, jsCreateEventRule } from './create-event.ts';

void test('js/create-event matcher', async (t) => {
  await t.test('wires js/create-event in src/rules/js.ts with the locked guideHash and rubric', () => {
    assert.strictEqual(JS_GUIDE_HASH, '78d968c460dd');
    const matchingRules = jsDefaultRules.filter((rule) => rule.id === 'js/create-event');
    assert.strictEqual(matchingRules.length, 1);
    const [rule] = matchingRules;
    assert.strictEqual(rule?.guideId, 'js');
    assert.strictEqual(rule?.guideHash, '78d968c460dd');
    assert.strictEqual(rule, exportedJsRule);
    assert.ok(rule.verifierRubric.keepWhen.length > 0);
    assert.ok(rule.verifierRubric.dropWhen.length >= 4);
  });

  await t.test('flags standard DOM createEvent() + init*Event() sequences and emits once per sequence', () => {
    const code = `
      function dispatchAll(target, detail) {
        const ev1 = document.createEvent('Event');
        ev1.initEvent('resize', true, true);
        window.dispatchEvent(ev1);

        const ev2 = document.createEvent('Events');
        ev2.initEvent('localized', true, false);
        document.dispatchEvent(ev2);

        const ev3 = document.createEvent('HTMLEvents');
        ev3.initEvent('change', true, true);
        target.dispatchEvent(ev3);

        const ev4 = document.createEvent('CustomEvent');
        ev4.initCustomEvent('item-selected', true, false, detail);
        target.dispatchEvent(ev4);

        const ev5 = document.createEvent('MouseEvents');
        ev5.initMouseEvent('click', true, true, window, 1, 0, 0, 10, 20, false, false, false, false, 0, null);
        target.dispatchEvent(ev5);

        const ev6 = document.createEvent('MouseEvent');
        ev6.initMouseEvent('dblclick', true, true, window, 2, 0, 0, 0, 0, false, false, false, false, 0, null);

        const ev7 = document.createEvent('KeyboardEvent');
        ev7.initKeyboardEvent('keydown', true, true, window, 'Enter', 0, '');

        const ev8 = document.createEvent('UIEvents');
        ev8.initUIEvent('scroll', true, false, window, 1);

        const ev9 = document.createEvent('UIEvent');
        ev9.initUIEvent('resize', false, false, window, 0);

        document.createEvent('Event').initEvent('load', false, false);
      }
    `;
    const matches = matchJsRule(jsCreateEventMatcher, 'dispatch.js', code);
    assert.deepEqual(
      matches.map((m) => m.line),
      [3, 7, 11, 15, 19, 23, 26, 29, 32, 35],
    );
    assert.ok(matches[3]?.message.includes('new CustomEvent('));
    assert.ok(matches[4]?.message.includes('new MouseEvent('));
    assert.ok(matches[6]?.message.includes('new KeyboardEvent('));
    assert.ok(matches[7]?.message.includes('new UIEvent('));
  });

  await t.test('flags non-global DOM document receivers, ternaries, dynamic init, and HTML inline scripts', () => {
    const tsCode = `
      export function fireOnDocument(el: HTMLElement, frame: HTMLIFrameElement, eventName: string, initMethod: string, cond: boolean) {
        const e1 = window.document.createEvent('HTMLEvents');
        e1.initEvent('change', true, true);

        const e2 = (el.ownerDocument as Document).createEvent('Event');
        e2.initEvent('input', true, false);

        const frameDoc = frame.contentDocument;
        const e3 = frameDoc.createEvent('CustomEvent');
        e3.initCustomEvent('ready', false, false, { ok: true });

        const doc = getDocument();
        const e4 = doc.createEvent('CustomEvent') as CustomEvent;
        e4.initCustomEvent(eventName, true, true, null);

        const eDyn = document.createEvent(eventName) as CustomEvent;
        eDyn.initCustomEvent(eventName, true, true, null);

        const e6 = cond ? document.createEvent('HTMLEvents') : document.createEvent('HTMLEvents');
        e6.initEvent('blur', false, false);

        const kb = document.createEvent('KeyboardEvent');
        (kb as any)[initMethod]('keyup', true, true, window, false, false, false, false, 40, 0);

        (document.createEvent('Event') as Event).initEvent('load', false, false);

        const castProbe = (document.createEvent('Event') as Event).timeStamp;
        void castProbe;
      }
    `;
    assert.deepEqual(
      matchJsRule(jsCreateEventMatcher, 'receivers.ts', tsCode).map((m) => m.line),
      [3, 6, 10, 14, 17, 20, 23, 26],
    );

    const htmlCode = `
      <!doctype html>
      <html>
        <body>
          <script>
            const ev = document.createEvent('HTMLEvents');
            ev.initEvent('change', true, true);
            document.body.dispatchEvent(ev);
          </script>
        </body>
      </html>
    `;
    const htmlFindings = scanFiles(
      new Map([['components/widget.html', htmlCode]]),
      [jsCreateEventRule],
    );
    assert.deepEqual(
      htmlFindings.map((f) => f.line),
      [6],
    );
  });

  await t.test('exempts TouchEvent probes, removed interfaces, uninitialized probes, and non-DOM APIs', () => {
    const code = `
      function isTouchSupported() {
        try {
          document.createEvent('TouchEvent');
          return true;
        } catch (e) {
          return false;
        }
      }

      function probeEventCapabilities(calendar, nonDom, eventName, initMethod) {
        const highResSupported = performance.now() > document.createEvent('Event').timeStamp;
        const proto = document.createEvent('HTMLEvents').__proto__;
        const protoBracket = document.createEvent('HTMLEvents')['__proto__'];
        const kb = document.createEvent('KeyboardEvent');
        const hasCode = kb.code !== undefined;
        calendar.createEvent('meeting');
        const customEv = nonDom.createEvent(eventName);
        customEv[initMethod]('custom', true, true);
        prior.initEvent('before', false, false);
        const prior = document.createEvent('Event');
        const valid = document.createEvent('CustomEvent');
        valid.initCustomEvent('mixed', false, false, null);
        return { highResSupported, proto, protoBracket, hasCode, customEv, prior, valid };
      }

      registerWrapper(OriginalEvent, Event, document.createEvent('Event'));
      unwrap(document.createEvent('Event'));

      function nonMigrableInterfaces(node) {
        const mut = document.createEvent('MutationEvents');
        mut.initMutationEvent('DOMAttrModified', true, true, node, 'a', 'b', 'attr', 1);
        const keyEvt = document.createEvent('KeyEvents');
        keyEvt.initKeyEvent('keyup', true, true, window, false, false, false, false, 13, 0);
      }

      function nonDomApis(calendar, api, log, e) {
        calendar.createEvent({ title: 'Team Sync' });
        api.createEvent('user.signed_in', { userId: 42 });
        log.events.createEvent().text('started').tags('boot');
        this.createEvent('internal');
        if (e.keyCode === 13 || e.which === 27) {
          return false;
        }
      }
    `;
    assert.deepEqual(
      matchJsRule(jsCreateEventMatcher, 'probes-and-nondom.js', code).map((m) => m.line),
      [22],
    );
  });

  await t.test('exempts feature-guarded fallbacks (positive and negative) and Event/CustomEvent polyfills', () => {
    const code = `
      function createCustom(name, detail) {
        if (typeof CustomEvent !== 'undefined') {
          return new CustomEvent(name, { detail, bubbles: true, cancelable: true });
        } else {
          const ev = document.createEvent('CustomEvent');
          ev.initCustomEvent(name, true, true, detail);
          return ev;
        }
      }

      function unrelatedSiblingBranch(mode) {
        if (mode === 'fast') {
          return new CustomEvent('done');
        } else {
          const ev = document.createEvent('CustomEvent');
          ev.initCustomEvent('done', false, false, null);
          return ev;
        }
      }

      function dispatchPing() {
        if (typeof Event === 'function') {
          window.dispatchEvent(new Event('ping'));
        } else {
          const ev = document.createEvent('Event');
          ev.initEvent('ping', false, false);
          window.dispatchEvent(ev);
        }
      }

      function negativeEventGuards() {
        if (!window.Event) {
          const ev = document.createEvent('Event');
          ev.initEvent('legacy', false, false);
          return ev;
        }
        if (typeof Event === 'undefined') {
          const ev = document.createEvent('HTMLEvents');
          ev.initEvent('legacy2', true, true);
          return ev;
        }
      }

      function dispatchAliasedCtor() {
        const EventCtor = window.CustomEvent;
        let event;
        if (EventCtor) {
          event = new EventCtor('mouseup');
        } else {
          event = window.document.createEvent('Event');
          event.initEvent('mouseup', false, false);
        }
        return event;
      }

      function tryClick(node) {
        try {
          node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        } catch (err) {
          const evt = document.createEvent('MouseEvents');
          evt.initMouseEvent('click', true, true, window);
          node.dispatchEvent(evt);
        }
      }

      function polyfillCustomEvent(type, params) {
        const evt = document.createEvent('CustomEvent');
        evt.initCustomEvent(type, Boolean(params?.bubbles), Boolean(params?.cancelable), params?.detail);
        return evt;
      }

      const CustomEvent = (type, params) => {
        const evt = document.createEvent('CustomEvent');
        evt.initCustomEvent(type, Boolean(params?.bubbles), Boolean(params?.cancelable), params?.detail);
        return evt;
      };

      window['CustomEvent'] = function (type, params) {
        const evt = document.createEvent('CustomEvent');
        evt.initCustomEvent(type, Boolean(params?.bubbles), Boolean(params?.cancelable), params?.detail);
        return evt;
      };

      window.CustomEvent = window.CustomEvent || function (type, params) {
        const evt = document.createEvent('CustomEvent');
        evt.initCustomEvent(type, Boolean(params?.bubbles), Boolean(params?.cancelable), params?.detail);
        return evt;
      };

      // (a) if (document.createEvent) { ... } else { document.createEventObject(); }
      function ifElseCreateEventObject(el) {
        if (document.createEvent) {
          const ev = document.createEvent('HTMLEvents');
          ev.initEvent('change', true, true);
          el.dispatchEvent(ev);
        } else {
          document.createEventObject();
        }
      }

      // (b) if ("createEvent" in document) { ... } else { el.fireEvent("onchange"); }
      function inDocumentFireEvent(el) {
        if ("createEvent" in document) {
          const evt = document.createEvent("HTMLEvents");
          evt.initEvent("change", false, true);
          el.dispatchEvent(evt);
        } else {
          el.fireEvent("onchange");
        }
      }

      // (c) document.createEvent ? function(b) { var c = document.createEvent("UIEvents"); c.initUIEvent("scroll", true, true, window, 0); } : function() {}
      const notify = document.createEvent ? function(b) {
        var c = document.createEvent("UIEvents");
        c.initUIEvent("scroll", true, true, window, 0);
      } : function() {};

      // (d) 'function' == typeof a ? new a(t, n) : (a = doc.createEvent('Event'), a.initEvent(t, true, true))
      function ternaryFallback(a, t, n, doc) {
        return 'function' == typeof a ? new a(t, n) : (a = doc.createEvent('Event'), a.initEvent(t, true, true));
      }

      // (e) Minified CustomEvent ponyfill
      function minifiedPonyfill(t, o) {
        o = o || { bubbles: false, cancelable: false, detail: undefined };
        var e = document.createEvent("CustomEvent");
        return e.initCustomEvent(t, o.bubbles, o.cancelable, o.detail), e;
      }
    `;
    assert.deepEqual(
      matchJsRule(jsCreateEventMatcher, 'polyfills-and-guards.js', code).map((m) => m.line),
      [],
    );
  });

  await t.test('skips minified single-line code (> 500 characters on one line)', () => {
    const longPrefix = '// ' + 'x'.repeat(550) + '; ';
    const code = `${longPrefix}const e = document.createEvent('Event'); e.initEvent('load', false, false);\n`;
    assert.deepEqual(matchJsRule(jsCreateEventMatcher, 'bundle.min.js', code), []);
  });

  await t.test('does not confuse return keyword characters with single-letter assigned event variable', () => {
    const code = `
      function emitCustom(el, params) {
        const t = document.createEvent('CustomEvent');
        t.initCustomEvent('notify', Boolean(params?.bubbles), Boolean(params?.cancelable), params?.detail);
        el.dispatchEvent(t);
        return true;
      }
    `;
    const matches = matchJsRule(jsCreateEventMatcher, 'single-letter-return.js', code);
    assert.deepEqual(
      matches.map((m) => m.line),
      [3],
    );
  });

  await t.test('does not suppress createEvent inside catch when try block constructs a non-Event class', () => {
    const code = `
      function fallbackInCatch(target) {
        try {
          new Date();
        } catch (err) {
          const ev = document.createEvent('Event');
          ev.initEvent('tick', false, false);
          target.dispatchEvent(ev);
        }
      }
    `;
    const matches = matchJsRule(jsCreateEventMatcher, 'non-event-try-catch.js', code);
    assert.deepEqual(
      matches.map((m) => m.line),
      [6],
    );
  });
});
