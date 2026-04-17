// Polyfill for localStorage in Node.js
global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    length: 0,
    key: () => null
} as any;

// Polyfill for document if needed
global.document = {
    getElementById: () => null,
    addEventListener: () => {}
} as any;
