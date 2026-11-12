import assert from 'node:assert/strict';
import test from 'node:test';
import { scanFiles } from '../../scanners/index.ts';
import { matchJsRule } from '../../scanners/js-scanner.ts';
import jsDefaultRules, { jsTextDecoderRule as exportedJsRule } from '../js.ts';
import { JS_GUIDE_HASH, jsTextDecoderMatcher, jsTextDecoderRule } from './text-decoder.ts';

void test('js/text-decoder matcher', async (t) => {
  await t.test('wires js/text-decoder in src/rules/js.ts and src/rules/index.ts with locked guideHash', () => {
    assert.strictEqual(JS_GUIDE_HASH, '8ad03eec26ab');
    const matchingRules = jsDefaultRules.filter((rule) => rule.id === 'js/text-decoder');
    assert.strictEqual(matchingRules.length, 1);
    const [rule] = matchingRules;
    assert.strictEqual(rule?.guideId, 'js');
    assert.strictEqual(rule?.guideHash, '8ad03eec26ab');
    assert.strictEqual(rule, exportedJsRule);
    assert.match(jsTextDecoderRule.verifierRubric.keepWhen.join(' '), /value-returning.*try\/catch.*fatal:\s*true/);
    assert.match(jsTextDecoderRule.verifierRubric.dropWhen[0] ?? '', /non-UTF-8 raw 8-bit binary protocols/);
    assert.match(jsTextDecoderRule.verifierRubric.dropWhen[1] ?? '', /lossless 1:1 Latin1\/binary/);
    assert.match(jsTextDecoderRule.verifierRubric.dropWhen[3] ?? '', /UTF-16LE\/BE.*\.subarray\(\)-sliced.*matched function\/branch/);
  });

  await t.test('verifies runtime TextDecoder latin1 windows-1252 remapping, btoa failure, and fatal mode', () => {
    assert.strictEqual(new TextDecoder('latin1').decode(new Uint8Array([0x80, 0x99])), '\u20AC\u2122');
    assert.throws(() => btoa(new TextDecoder().decode(new Uint8Array([0xff, 0x41]))));
    assert.throws(() => new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array([0xff, 0xfe])), TypeError);
    assert.strictEqual(new TextDecoder().decode(new Uint8Array([0xff, 0x41])), '\uFFFDA');
  });

  await t.test('flags decodeURIComponent(escape(...)), fatal try/catch decoders, manual UTF-8 loops, and Uint8Array String.fromCharCode', () => {
    const code = `
      function legacyDecoders(str, b64, buf) {
        const a = decodeURIComponent(escape(str));
        const b = window.decodeURIComponent(globalThis.escape(atob(b64)));
        const c = decodeURIComponent(escape(String.fromCharCode(...new Uint8Array(buf))));
        try {
          return decodeURIComponent(escape(str));
        } catch {
          throw new Error('Malformed UTF-8 data');
        }
      }
      function partialModernFile(bytes, legacyStr) {
        const modern = new TextDecoder().decode(bytes);
        void modern;
        return decodeURIComponent(escape(legacyStr));
      }
      function outerTryCallback(items) {
        try { return items.map((s) => decodeURIComponent(escape(s))); } catch { return []; }
      }
    `;
    const matches = matchJsRule(jsTextDecoderMatcher, 'legacy.js', code);
    assert.deepEqual(matches.map((m) => m.line), [3, 4, 5, 7, 15, 18]);
    assert.ok(!matches[0]?.message.includes("'latin1'") || matches[0]?.message.includes('never pass'));
    assert.match(matches[3]?.message ?? '', /fatal:\s*true/);
    assert.ok(!matches[4]?.message.includes('fatal'));
    assert.ok(!matches[5]?.message.includes('fatal'));

    const tsCode = `
      export function decodeManualLoop(bytes: Uint8Array): string {
        let out = '';
        let i = 0;
        while (i < bytes.length) {
          const c = bytes[i++];
          if (c < 128) {
            out += String.fromCharCode(c);
          } else if (c > 191 && c < 224) {
            out += String.fromCharCode(((c & 31) << 6) | (bytes[i++] & 63));
          } else {
            out += String.fromCharCode(((c & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63));
          }
        }
        return out;
      }

      export function decodeBufferSpread(bytes: Uint8Array): string {
        const view = new Uint8Array(bytes.buffer);
        const s1 = String.fromCharCode.apply(null, view);
        const s2 = String.fromCharCode(...bytes.subarray(0, 8));
        return s1 + s2;
      }
    `;
    const tsMatches = matchJsRule(jsTextDecoderMatcher, 'decoder.ts', tsCode);
    assert.deepEqual(tsMatches.map((m) => m.line), [5, 20, 21]);

    const htmlCode = `
      <!doctype html>
      <html>
        <script>
          const decoded = decodeURIComponent(escape(window.atob(raw)));
        </script>
      </html>
    `;
    const htmlFindings = scanFiles(
      new Map([['index.html', htmlCode]]),
      [jsTextDecoderRule],
    );
    assert.deepEqual(htmlFindings.map((f) => f.line), [5]);
  });

  await t.test('exempts binary btoa() encoders, chunked accumulators, helpers, probes, non-byte views, and guards', () => {
    const negCode = `
      function toLatin1(bytes: Uint8Array) {
        return (String.fromCharCode.apply(null, bytes) as string);
      }

      class BinaryCodec {
        static encode(bytes: Uint8Array) {
          return String.fromCharCode(...bytes);
        }
        static toBase64(bytes: Uint8Array) {
          return btoa(BinaryCodec.encode(bytes));
        }
      }

      function binaryToBase64(buffer: ArrayBuffer, data: ArrayBuffer) {
        const b1 = btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)));
        const b2 = window.btoa(String.fromCharCode(...new Uint8Array(buffer)));
        const raw = (String.fromCharCode.apply(null, new Uint8Array(buffer)) as string);
        const chunks: string[] = [];
        let acc = '';
        for (let i = 0; i < data.byteLength; i += 1024) {
          acc += String.fromCharCode.apply(null, new Uint8Array(data.slice(i, i + 1024)));
          chunks.push(String.fromCharCode.apply(null, new Uint8Array(data.slice(i, i + 1024))));
          const piece = String.fromCharCode(...new Uint8Array(data.slice(i, i + 1024)));
          chunks.push(piece);
        }
        const arr = [String.fromCharCode.apply(null, new Uint8Array(buffer))];
        return btoa(raw) + btoa(toLatin1(new Uint8Array(buffer))) + b1 + b2 + acc + chunks.join('') + arr.join('');
      }

      function isValidUtf8(s: string) {
        try {
          decodeURIComponent(escape(s));
          return true;
        } catch {
          return false;
        }
      }

      function capabilityProbes() {
        try {
          const arr = new Uint8Array([1, 2, 3]);
          String.fromCharCode.apply(null, arr);
        } catch {}
        try {
          return String.fromCharCode.apply(null, new Uint8Array([0])) === '\\0';
        } catch {
          return false;
        }
      }

      function nonByteBuffers(input: ArrayBuffer) {
        const utf16 = String.fromCharCode.apply(null, new Uint16Array(input));
        const codePoints = String.fromCharCode(...new Int32Array(input));
        let j;
        j = new Float32Array(input);
        const floats = String.fromCharCode.apply(null, new Uint8Array(j.buffer));
        let forFloats = '';
        let k;
        for (let i = 0; i < 1 && (k = new Float32Array(input)); i++) {
          forFloats += String.fromCharCode.apply(null, new Uint8Array(k.buffer));
        }
        const encoded = new TextEncoder().encode('hello');
        const roundtrip = String.fromCharCode(...encoded);
        return utf16 + codePoints + floats + forFloats + roundtrip;
      }

      function encodeUtf8Loop(str: string) {
        let out = '';
        for (let n = 0; n < str.length; n++) {
          const c = str.charCodeAt(n);
          out += String.fromCharCode((c >> 12) | 224);
          out += String.fromCharCode(((c >> 6) & 63) | 128);
          out += String.fromCharCode((c & 63) | 128);
        }
        return out;
      }

      function decodeBase64Loop(b: number, c: number, d: number) {
        return ((b & 0x3f) << 12) | ((c & 0x3f) << 6) | (d & 0x3f);
      }

      function codepageCopy(buf: Uint8Array, table: string[], out: Record<number, string>) {
        for (let i = 0, j = 0; i < buf.length;) {
          out[j++] = table[((buf[i++] & 15) << 12) | ((buf[i++] & 63) << 6) | (buf[i++] & 63)];
        }
      }

      function guarded(bytes: ArrayBuffer) {
        if (typeof window.TextDecoder !== 'undefined') {
          return new window.TextDecoder().decode(bytes);
        }
        return String.fromCharCode.apply(null, new Uint8Array(bytes));
      }

      // decodeURIComponent(escape(commented))
      const literal = 'decodeURIComponent(escape(inLiteral))';
    `;
    assert.equal(matchJsRule(jsTextDecoderMatcher, 'negatives.ts', negCode).length, 0);
  });
});
