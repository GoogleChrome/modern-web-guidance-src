---
description: Safely encode and decode strings with Unicode characters in JavaScript by handling potential errors and data corruption.
filename: safe-unicode-base64
category: data
---

# Safely Encode and Decode Unicode Strings with Base64 in JavaScript

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/API/btoa
- https://developer.mozilla.org/en-US/docs/Web/API/atob
- https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder
- https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/isWellFormed

## Best Practices

When applying Base64 encoding and decoding to strings in JavaScript, especially those containing Unicode characters, it's crucial to handle potential issues that can arise from different character encodings and the behavior of built-in functions.

### Understand `btoa()` and `atob()` limitations

The built-in `btoa()` and `atob()` functions are designed to work with strings where each character represents a single byte (Latin1 range). They will throw an error if they encounter characters outside this range, such as many Unicode characters.

```js
// This will work.
const asciiString = 'hello';
const asciiStringEncoded = btoa(asciiString);
console.log(`Encoded string: [${asciiStringEncoded}]`); // Encoded string: [aGVsbG8=]

// This will NOT work. It will throw a DOMException.
const unicodeString = 'hello⛳';
try {
  const unicodeStringEncoded = btoa(unicodeString);
  console.log(`Encoded string: [${unicodeStringEncoded}]`);
} catch (error) {
  console.log(error); // DOMException: Failed to execute 'btoa' on 'Window': The string to be encoded contains characters outside of the Latin1 range.
}
```

### Properly handle Unicode characters

To encode strings containing Unicode characters, you need to convert them to a byte stream first. The `TextEncoder` API is ideal for this, as it encodes strings into UTF-8 bytes.

```js
const unicodeString = 'hello⛳❤️🧀';

// Encode the string to UTF-8 bytes
const encoder = new TextEncoder();
const utf8Bytes = encoder.encode(unicodeString);

// Convert the UTF-8 bytes to a Base64 encoded string
// Note: This intermediate step requires converting bytes to a string where each char is a byte.
// For demonstration, we'll use a helper function that encapsulates this.
function bytesToBase64(bytes) {
  const binString = String.fromCodePoint(...bytes);
  return btoa(binString);
}

const encodedString = bytesToBase64(utf8Bytes);
console.log(`Encoded string: [${encodedString}]`); // Encoded string: [aGVsbG/im7PinaTvuI/wn6eA]
```

### Handle potential data corruption with lone surrogates

JavaScript strings are UTF-16 internally. UTF-16 uses surrogate pairs to represent code points outside the Basic Multilingual Plane (BMP). If a string contains a "lone surrogate" (one half of a surrogate pair without the other), it's considered malformed. Functions like `TextDecoder` might replace these malformed sequences with a replacement character (`�`, `\uFFFD`) by default, leading to silent data corruption.

To avoid this, check if strings are well-formed before processing. The `String.prototype.isWellFormed()` method is the modern approach. For older browsers, `encodeURIComponent()` can be used as a polyfill, as it throws an `URIError` for lone surrogates.

```js
// Helper function to check for well-formed strings
function isWellFormed(str) {
  if (typeof(str.isWellFormed) !== "undefined") {
    return str.isWellFormed();
  } else {
    try {
      encodeURIComponent(str);
      return true;
    } catch (error) {
      return false;
    }
  }
}

const malformedString = 'hello⛳❤️🧀\uDE75'; // '\uDE75' is a lone surrogate

if (isWellFormed(malformedString)) {
  console.log("String is well-formed.");
} else {
  console.log(`String is malformed: [${malformedString}]`); // String is malformed: [hello⛳❤️🧀�] (or similar representation)
}
```

### Reconstruct decoded strings safely

When decoding Base64 strings back into JavaScript strings, use `TextDecoder` to convert the UTF-8 bytes back into a string. Ensure you're aware of its `fatal` option, which can be set to `true` to throw an error on malformed sequences instead of replacing them.

```js
// Helper function to decode Base64 to bytes
function base64ToBytes(base64) {
  const binString = atob(base64);
  return Uint8Array.from(binString, (m) => m.codePointAt(0));
}

const encodedString = 'aGVsbG/im7PinaTvuI/wn6eA'; // Example encoded string from above

// Decode Base64 to UTF-8 bytes
const decodedBytes = base64ToBytes(encodedString);

// Decode UTF-8 bytes back to a string
const decoder = new TextDecoder(); // Defaults to replacing malformed sequences
const decodedString = decoder.decode(decodedBytes);
console.log(`Decoded string: [${decodedString}]`); // Decoded string: [hello⛳❤️🧀]

// To throw an error on malformed data instead of replacing it:
// const decoderFatal = new TextDecoder('utf-8', { fatal: true });
// try {
//   const decodedStringFatal = decoderFatal.decode(decodedBytes);
//   console.log(`Decoded string (fatal): [${decodedStringFatal}]`);
// } catch (error) {
//   console.error("Decoding error:", error);
// }
```

## Fallback strategies

If you need to support older environments that might not have `TextEncoder`, `TextDecoder`, or `String.isWellFormed()`:

### TextEncoder and TextDecoder

- **DO** check for the existence of `window.TextEncoder` and `window.TextDecoder` before use.
- **DO** consider using polyfills like `text-encoding` if necessary.

### String.isWellFormed()

- **DO** use the `encodeURIComponent()` check as a fallback for older browsers that don't support `String.isWellFormed()`.
- **DO** consider implementing a more robust polyfill if needed.

## Put it all together

Combine these practices for robust Base64 encoding and decoding of Unicode strings.

```js
// Helper functions as defined above
function base64ToBytes(base64) {
  const binString = atob(base64);
  return Uint8Array.from(binString, (m) => m.codePointAt(0));
}

function bytesToBase64(bytes) {
  const binString = String.fromCodePoint(...bytes);
  return btoa(binString);
}

function isWellFormed(str) {
  if (typeof(str.isWellFormed) !== "undefined") {
    return str.isWellFormed();
  } else {
    try {
      encodeURIComponent(str);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// --- Main logic ---

const stringToProcess = 'hello⛳❤️🧀\uDE75'; // Example with a lone surrogate

if (isWellFormed(stringToProcess)) {
  // Encode
  const encoder = new TextEncoder();
  const utf8Bytes = encoder.encode(stringToProcess);
  const encoded = bytesToBase64(utf8Bytes);
  console.log(`Encoded: ${encoded}`);

  // Decode
  const decodedBytes = base64ToBytes(encoded);
  const decoder = new TextDecoder(); // Or new TextDecoder('utf-8', { fatal: true });
  const decoded = decoder.decode(decodedBytes);
  console.log(`Decoded: ${decoded}`);

} else {
  console.log(`Cannot process malformed string: [${stringToProcess}]`);
  // Handle the malformed string case: reject, log, or use a replacement strategy.
}

// Example with a valid string
const validString = 'hello⛳❤️🧀';
if (isWellFormed(validString)) {
  const encoder = new TextEncoder();
  const utf8Bytes = encoder.encode(validString);
  const encoded = bytesToBase64(utf8Bytes);
  console.log(`Encoded (valid): ${encoded}`); // Encoded (valid): aGVsbG/im7PinaTvuI/wn6eA

  const decodedBytes = base64ToBytes(encoded);
  const decoder = new TextDecoder();
  const decoded = decoder.decode(decodedBytes);
  console.log(`Decoded (valid): ${decoded}`); // Decoded (valid): hello⛳❤️🧀
}
```

This approach ensures that your Base64 encoding and decoding operations are robust, handling the complexities of Unicode and potential malformed strings gracefully, preventing silent data corruption.