// Adaptive Loading
document.addEventListener('DOMContentLoaded', () => {
    const heroImg = document.querySelector('.hero-img');
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    // Fallback if no connection API
    let effectiveType = '4g';
    let saveData = false;

    if (connection) {
        effectiveType = connection.effectiveType;
        saveData = connection.saveData;
        
        // Listen for changes
        connection.addEventListener('change', updateImage);
    }

    function updateImage() {
        const isSlow = effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g';
        // const isSlow = true; // Uncomment to test slow network behavior
        
        if (isSlow || saveData) {
            console.log('Using low-res image due to slow connection or data saver');
            heroImg.src = 'low-res.svg';
        } else {
            console.log('Using high-res image');
            heroImg.src = 'hero.svg';
        }
    }

    // Initial load
    updateImage();

    // Popover Interaction
    const detailsBtn = document.getElementById('details-btn');
    const ingredientsPopover = document.getElementById('ingredients-popover');

    if (detailsBtn && ingredientsPopover) {
        // Position the popover near the button
        // We can use the simple approach of appending it or just showing it.
        // For a "tooltip" style popover, we often want it next to the trigger.
        
        const showPopover = () => {
            ingredientsPopover.showPopover();
            // Simple positioning logic
            const rect = detailsBtn.getBoundingClientRect();
            ingredientsPopover.style.top = `${rect.bottom + window.scrollY + 10}px`;
            ingredientsPopover.style.left = `${rect.left + window.scrollX}px`;
        };

        const hidePopover = () => {
            ingredientsPopover.hidePopover();
        };

        detailsBtn.addEventListener('mouseenter', showPopover);
        detailsBtn.addEventListener('mouseleave', hidePopover);
        
        // Also handle focus/blur for accessibility
        detailsBtn.addEventListener('focus', showPopover);
        detailsBtn.addEventListener('blur', hidePopover);
    }
});
