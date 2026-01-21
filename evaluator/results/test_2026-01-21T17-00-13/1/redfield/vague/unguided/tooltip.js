/**
 * tooltip.js - Modern Accessible Tooltips
 */

class TooltipManager {
    constructor() {
        this.init();
    }

    init() {
        // Find all triggers
        const triggers = document.querySelectorAll('[data-tooltip-trigger]');
        
        triggers.forEach(trigger => {
            this.setupTrigger(trigger);
        });

        // Global Escape key handler
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideAllTooltips();
            }
        });
    }

    setupTrigger(trigger) {
        const tooltipId = trigger.getAttribute('aria-describedby');
        if (!tooltipId) return;

        const container = trigger.closest('.container');
        if (!container) return; // Should have a container for positioning context if clean CSS isn't enough, but here we assume structure.

        // Events
        trigger.addEventListener('mouseenter', () => this.show(container));
        trigger.addEventListener('mouseleave', () => this.hide(container));
        
        trigger.addEventListener('focus', () => this.show(container));
        trigger.addEventListener('blur', () => this.hide(container));
    }

    show(container) {
        container.setAttribute('data-tooltip-visible', 'true');
    }

    hide(container) {
        container.setAttribute('data-tooltip-visible', 'false');
    }

    hideAllTooltips() {
        document.querySelectorAll('[data-tooltip-visible="true"]').forEach(el => {
            el.setAttribute('data-tooltip-visible', 'false');
        });
    }
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    new TooltipManager();
});
