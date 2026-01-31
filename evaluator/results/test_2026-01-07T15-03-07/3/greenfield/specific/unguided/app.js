// Adaptive Loading
document.addEventListener('DOMContentLoaded', () => {
    const heroImg = document.getElementById('hero-img');
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    // Default to 'high' if API not supported
    let effectiveType = '4g';
    if (connection && connection.effectiveType) {
        effectiveType = connection.effectiveType;
        console.log(`Detected connection type: ${effectiveType}`);
    }

    // Simple Adaptive Loading Strategy
    const isSlow = effectiveType === 'slow-2g' || effectiveType === '2g';
    const imageSrc = isSlow ? 'placeholder_coffee.svg' : 'hero_coffee.svg'; // Using SVG for both in this demo, but conceptually 'hero_coffee' would be high-res

    heroImg.src = imageSrc;
    heroImg.hidden = false;
    
    // Optional: Update if connection changes
    if (connection) {
        connection.addEventListener('change', () => {
            console.log(`Connection changed to: ${connection.effectiveType}`);
            // In a real app we might decide whether to upgrade the image dynamically
        });
    }

    // Popover Hover Interaction
    // The Popover API is declarative for clicks (popovertarget), but for hover we need JS
    const detailsBtn = document.getElementById('details-btn');
    const popover = document.getElementById('ingredients-popover');

    if (detailsBtn && popover) {
        // Show on hover
        detailsBtn.addEventListener('mouseenter', () => {
            try {
                // Check if already open to avoid error
                if (!popover.matches(':popover-open')) {
                    popover.showPopover();
                }
            } catch (e) {
                console.error('Popover show failed:', e);
            }
        });

        // Hide on mouseleave logic
        // We need to be careful: if user moves to the popover itself, it shouldn't close immediately?
        // User requirement: "triggers a non-modal popover when a user hovers over it"
        // Usually hover interaction implies closing when not hovering.
        // Let's implement a simple close on mouseleave of the button, 
        // but often UX requires keeping it open if hovered over the popover content.
        // For this task, strict "hover over button" implies it might close when leaving button.
        // I will add a small grace period or check if entered popover.
        
        // Simple version: Close when mouse leaves the button or the popover
        
        let timeoutId;

        const cancelClose = () => clearTimeout(timeoutId);
        const scheduleClose = () => {
            timeoutId = setTimeout(() => {
                try {
                    popover.hidePopover();
                } catch (e) {
                   // ignore
                }
            }, 300); // 300ms grace
        };

        detailsBtn.addEventListener('mouseleave', scheduleClose);
        detailsBtn.addEventListener('mouseenter', cancelClose);

        popover.addEventListener('mouseenter', cancelClose);
        popover.addEventListener('mouseleave', scheduleClose);
    }
});
