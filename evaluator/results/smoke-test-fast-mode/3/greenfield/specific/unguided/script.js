/* script.js */

document.addEventListener('DOMContentLoaded', () => {
    setupHeroImage();
    setupPopover();
});

function setupHeroImage() {
    const imgElement = document.getElementById('hero-img');
    const placeholderIndicator = document.getElementById('placeholder-indicator');

    // SVGs as Data URIs for demo purposes (since we can't fetch external or generate images in this environment easily)
    
    // High Quality: A complex radial gradient simulating a coffee cup top-down view or just moody art
    const highResImage = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'><defs><radialGradient id='coffee' cx='50%' cy='50%' r='50%' fx='50%' fy='50%'><stop offset='0%' stop-color='%235c4033' /><stop offset='100%' stop-color='%231a1512' /></radialGradient><filter id='f1' x='0' y='0'><feTurbulence type='fractalNoise' baseFrequency='0.01' numOctaves='3' /><feColorMatrix values='1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 10 -5'/><feBlend in='SourceGraphic' mode='multiply'/></filter></defs><rect width='100%' height='100%' fill='url(%23coffee)' /><circle cx='400' cy='300' r='150' fill='%233c2f25' stroke='%238b6b52' stroke-width='5' /><path d='M350,280 Q400,350 450,280' stroke='%23f4e4d5' stroke-width='3' fill='none' opacity='0.7' /></svg>`;
    
    // Low Quality: Simple solid rect
    const lowResImage = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'><rect width='100%' height='100%' fill='%233c2f25' /><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%238b6b52' font-family='sans-serif' font-size='24'>Low Data Mode</text></svg>`;

    // Adaptive Loading Logic
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    let isSlow = false;

    if (connection) {
        // specific check for save-data or slow connection types
        if (connection.saveData === true || 
            connection.effectiveType === 'slow-2g' || 
            connection.effectiveType === '2g' || 
            connection.effectiveType === '3g') {
            isSlow = true;
        }
        
        console.log(`Connection type: ${connection.effectiveType}, SaveData: ${connection.saveData}`);
    }

    if (isSlow) {
        imgElement.src = lowResImage;
        placeholderIndicator.style.display = 'block';
        placeholderIndicator.textContent = 'Using Placeholder (Adaptive Loading)';
    } else {
        imgElement.src = highResImage;
        // Preload high-res if we were switching, but here we just set it.
    }
}

function setupPopover() {
    const btn = document.getElementById('details-btn');
    const popover = document.getElementById('ingredients-popover');

    if (!btn || !popover) return;

    // Hover logic
    // We use popover="manual" so we control show/hide explicitly.
    
    const show = () => {
        try {
            popover.showPopover();
            // Positioning logic since we don't have CSS Anchor Positioning everywhere yet
            const btnRect = btn.getBoundingClientRect();
            // Popover is in top layer, position absolute relative to viewport
            const popWidth = popover.offsetWidth;
            const popHeight = popover.offsetHeight;
            
            // Center above button
            let top = btnRect.top - popHeight - 10;
            let left = btnRect.left + (btnRect.width / 2) - (popWidth / 2);

            popover.style.top = `${top + window.scrollY}px`;
            popover.style.left = `${left + window.scrollX}px`;
        } catch (e) {
            console.warn("Popover API not supported or error", e);
        }
    };

    const hide = () => {
        try {
            popover.hidePopover();
        } catch (e) {
            console.warn("Popover API error", e);
        }
    };

    btn.addEventListener('mouseenter', show);
    btn.addEventListener('mouseleave', hide);
    // Also keep open if hovering the popover itself? The user said "triggers... when a user hovers over it" (the button).
    // Usually standard UX allows hovering the content too, but strict interpretation is button. 
    // I'll add listeners to popover too just in case to prevent flickering if they move mouse to it.
    popover.addEventListener('mouseenter', show);
    popover.addEventListener('mouseleave', hide);
}
