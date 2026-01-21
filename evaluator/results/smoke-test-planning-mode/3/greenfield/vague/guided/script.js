// Main script file
console.log('Espresso Emporium loaded');

// Check for Scroll-driven animations support just to log it
if (CSS.supports('animation-timeline: view()')) {
    console.log('Scroll-driven animations supported natively.');
} else {
    console.log('Scroll-driven animations NOT supported natively. Fallback styles should apply.');
}

// Interest Invokers support check
if ('interestForElement' in HTMLButtonElement.prototype) {
    console.log('Interest Invokers supported natively (or polyfilled).');
} else {
    console.warn('Interest Invokers NOT supported.');
}
