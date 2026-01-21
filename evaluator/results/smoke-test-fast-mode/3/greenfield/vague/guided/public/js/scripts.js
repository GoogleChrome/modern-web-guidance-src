console.log("Velvet Brew Loaded");

// Optional: polyfill check logging
if (HTMLButtonElement.prototype.hasOwnProperty("interestForElement")) {
    console.log("Native Interest Invokers supported");
} else {
    console.log("Loading Interest Invokers polyfill");
}

if ("positionAnchor" in document.documentElement.style) {
    console.log("Native Anchor Positioning supported");
} else {
    console.log("Loading Anchor Positioning polyfill");
}

if ('loadingPlaceholder' in HTMLImageElement.prototype) {
    console.log("Native Adaptive Loading supported");
} else {
    console.log("Loading Adaptive Loading polyfill");
}
