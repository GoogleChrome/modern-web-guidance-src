/**
 * Modern Tooltip Implementation
 * - Uses Event Delegation
 * - Accessible (aria-describedby)
 * - Managed positioning (basic)
 */
export class TooltipSystem {
    constructor() {
        this.tooltipElement = null;
        this.activeTrigger = null;
        this._init();
    }

    _init() {
        // Create the single shared tooltip element
        this.tooltipElement = document.createElement('div');
        this.tooltipElement.className = 'tooltip';
        this.tooltipElement.id = 'global-tooltip';
        this.tooltipElement.setAttribute('role', 'tooltip');
        this.tooltipElement.setAttribute('aria-hidden', 'true');
        document.body.appendChild(this.tooltipElement);

        // Bind events globally
        document.addEventListener('mouseover', this._handleEnter.bind(this));
        document.addEventListener('mouseout', this._handleLeave.bind(this));
        document.addEventListener('focusin', this._handleEnter.bind(this));
        document.addEventListener('focusout', this._handleLeave.bind(this));
    }

    _handleEnter(e) {
        const trigger = e.target.closest('[data-tooltip]');
        if (!trigger) return;

        this.show(trigger);
    }

    _handleLeave(e) {
        const trigger = e.target.closest('[data-tooltip]');
        if (!trigger) return;

        // If moving to another trigger, let the next enter event handle it
        // But for now, we just hide if we leave the current trigger
        if (trigger === this.activeTrigger) {
            this.hide();
        }
    }

    show(trigger) {
        this.activeTrigger = trigger;
        const text = trigger.getAttribute('data-tooltip');
        if (!text) return;

        this.tooltipElement.textContent = text;
        this.tooltipElement.classList.add('is-visible');
        this.tooltipElement.setAttribute('aria-hidden', 'false');

        // Link accessibility
        if (!trigger.getAttribute('aria-describedby')) {
             trigger.setAttribute('aria-describedby', this.tooltipElement.id);
        }

        this._position(trigger);
    }

    hide() {
        if (this.activeTrigger) {
             // Optional: Clean up aria-describedby if we want to be strict, 
             // but keeping it is often fine or we can remove it.
             // this.activeTrigger.removeAttribute('aria-describedby');
             this.activeTrigger = null;
        }

        this.tooltipElement.classList.remove('is-visible');
        this.tooltipElement.setAttribute('aria-hidden', 'true');
    }

    _position(trigger) {
        // Simple positioning: centered above the trigger
        // In a real app, use something like floating-ui (popper.js)
        const rect = trigger.getBoundingClientRect();
        const tooltipRect = this.tooltipElement.getBoundingClientRect();

        const top = rect.top - tooltipRect.height - 10; // 10px offset
        const left = rect.left + (rect.width / 2);

        this.tooltipElement.style.top = `${top + window.scrollY}px`;
        this.tooltipElement.style.left = `${left + window.scrollX}px`;
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    new TooltipSystem();
});
