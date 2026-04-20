// Fixture: JS file with known compatibility issues for eval testing
// Expected findings: Array.prototype.at, structuredClone, Array.prototype.findLast

const items = ["apple", "banana", "cherry"];

// Array.at() — Chrome 92+, Firefox 90+, Safari 15.4+
const lastItem = items.at(-1);

// structuredClone — Chrome 98+, Firefox 94+, Safari 15.4+
const config = { theme: "dark", nested: { level: 1 } };
const configCopy = structuredClone(config);

// Array.findLast — Chrome 97+, Firefox 104+, Safari 15.4+
const lastEven = [1, 2, 3, 4].findLast((n) => n % 2 === 0);

// Object.hasOwn — Chrome 93+, Firefox 92+, Safari 15.4+
const hasName = Object.hasOwn(config, "theme");

export { lastItem, configCopy, lastEven, hasName };
