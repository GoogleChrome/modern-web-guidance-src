const fs = require('fs');

let html = fs.readFileSync('golden-demo.html', 'utf8');

const markers = [
    { start: '/* CV_OPTIMIZATION_START */', end: '/* CV_OPTIMIZATION_END */' },
    { start: '<!-- CV_CONTROLS_START -->', end: '<!-- CV_CONTROLS_END -->' },
    { start: '/* CV_JS_START */', end: '/* CV_JS_END */' },
    { start: '/* CV_JS_TOGGLE_START */', end: '/* CV_JS_TOGGLE_END */' }
];

markers.forEach(m => {
    while (true) {
        const startIndex = html.indexOf(m.start);
        if (startIndex === -1) break;
        
        const endIndex = html.indexOf(m.end, startIndex);
        if (endIndex === -1) break;

        // Remove from start of marker to end of marker
        const fullEndIndex = endIndex + m.end.length;
        html = html.slice(0, startIndex) + html.slice(fullEndIndex);
    }
});

// Branding and cleanup
html = html.replace('class="feed cv-enabled"', 'class="feed"');
html = html.replace(/<title>.*?<\/title>/, '<title>Negative Demo (No content-visibility)</title>');
html = html.replace(/<h1>.*?<\/h1>/, '<h1>Negative Demo: No content-visibility</h1>');
html = html.replace('When <code>content-visibility: auto</code> is enabled, the browser skips rendering cards that are off-screen.', 
                   'This page has <strong>no</strong> <code>content-visibility</code> optimizations applied. It will render all cards on load.');

fs.writeFileSync('negative-demo.html', html);
console.log('Successfully generated negative-demo.html');