// Main JavaScript

// Feature: Adaptive Loading
// Check network status and load appropriate image
document.addEventListener('DOMContentLoaded', () => {
  const heroImg = document.getElementById('hero-img');
  const highResSrc = 'hero-high.svg';
  const lowResSrc = 'hero-low.svg';

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  if (connection) {
    const isSlow = connection.saveData === true || 
                   connection.effectiveType === 'slow-2g' || 
                   connection.effectiveType === '2g' || 
                   connection.effectiveType === '3g';
    
    if (isSlow) {
      console.log('Slow network detected. Loading low-quality image.');
      heroImg.src = lowResSrc;
      // Optionally upgrade later
      // setTimeout(() => { heroImg.src = highResSrc; }, 5000);
    } else {
      heroImg.src = highResSrc;
    }
  } else {
    // Default to high res if API not supported
    heroImg.src = highResSrc;
  }
});

// Polyfill Loading Logic
if (!HTMLButtonElement.prototype.hasOwnProperty("interestForElement")) {
  console.log("Loading Interest Invokers Polyfill");
  const script = document.createElement("script");
  script.src = "libs/interestfor.min.js";
  document.head.appendChild(script);
}

if (!("positionAnchor" in document.documentElement.style)) {
  console.log("Loading CSS Anchor Positioning Polyfill");
  const script = document.createElement("script");
  script.src = "libs/css-anchor-positioning.js";
  document.head.appendChild(script);
}
