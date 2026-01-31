class TooltipManager {
    constructor() {
        this.tooltip = null;
        this.activeTarget = null;
        this.showTimeout = null;
        
        this.init();
    }

    init() {
        // Create the tooltip element once
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'tooltip-element';
        this.tooltip.setAttribute('role', 'tooltip');
        this.tooltip.id = 'global-tooltip';
        document.body.appendChild(this.tooltip);

        // Bind events using delegation
        document.body.addEventListener('mouseover', this.handleMouseOver.bind(this));
        document.body.addEventListener('mouseout', this.handleMouseOut.bind(this));
        document.body.addEventListener('focusin', this.handleFocusIn.bind(this));
        document.body.addEventListener('focusout', this.handleFocusOut.bind(this));
        
        // Handle scroll/resize to update position if visible
        window.addEventListener('resize', () => {
             if (this.activeTarget) this.updatePosition(this.activeTarget);
        });
        window.addEventListener('scroll', () => {
            if (this.activeTarget) this.updatePosition(this.activeTarget);
        }, { passive: true });
    }

    handleMouseOver(e) {
        const target = e.target.closest('[data-tooltip]');
        if (!target) return;
        this.show(target);
    }

    handleMouseOut(e) {
        // Only hide if we actually left a tooltip target
        const target = e.target.closest('[data-tooltip]');
        if (target) {
            this.hide();
        }
    }

    handleFocusIn(e) {
        const target = e.target.closest('[data-tooltip]');
        if (!target) return;
        this.show(target);
    }

    handleFocusOut(e) {
        const target = e.target.closest('[data-tooltip]');
        if (target) {
            this.hide();
        }
    }

    show(target) {
        if (this.activeTarget === target) return;
        this.activeTarget = target;

        const text = target.getAttribute('data-tooltip');
        if (!text) return;

        this.tooltip.textContent = text;
        this.tooltip.setAttribute('data-side', 'top'); // Default to top

        // Accessibility connection
        if (!target.getAttribute('aria-describedby')) {
            target.setAttribute('aria-describedby', 'global-tooltip');
        }

        // Show (allows separation of showing logic from positioning for animations)
        // We use a small timeout or requestAnimationFrame to allow browser to calculate layout if needed
        // but here standard sync update is usually fine before adding 'visible' class
        this.updatePosition(target);
        
        // Add visible class for transition
        requestAnimationFrame(() => {
            this.tooltip.classList.add('visible');
        });
    }

    hide() {
        if (!this.activeTarget) return;

        // Cleanup Accessibility
        if (this.activeTarget.getAttribute('aria-describedby') === 'global-tooltip') {
            this.activeTarget.removeAttribute('aria-describedby');
        }

        this.activeTarget = null;
        this.tooltip.classList.remove('visible');
    }

    updatePosition(target) {
        const targetRect = target.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();
        const spacing = 10; // Gap between arrow and target

        // Calculate centering
        let left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
        let top = targetRect.top - tooltipRect.height - spacing;
        let side = 'top';

        // Viewport boundary checks
        // If it goes off the top, flip to bottom
        if (top < 0) {
            top = targetRect.bottom + spacing;
            side = 'bottom';
        }

        // Horizontal clamping
        if (left < 10) left = 10;
        if (left + tooltipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tooltipRect.width - 10;
        }

        this.tooltip.style.left = `${left + window.scrollX}px`;
        this.tooltip.style.top = `${top + window.scrollY}px`;
        this.tooltip.setAttribute('data-side', side);
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    new TooltipManager();
});
