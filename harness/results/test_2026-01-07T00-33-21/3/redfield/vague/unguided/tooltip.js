export class Tooltip {
    constructor(triggerElement) {
        this.trigger = triggerElement;
        this.content = this.trigger.getAttribute('data-tooltip');
        this.id = `tooltip-${Math.random().toString(36).substr(2, 9)}`;
        this.tooltip = null;
        this.isVisible = false;

        this.init();
    }

    init() {
        // Accessibility attributes
        this.trigger.setAttribute('aria-describedby', this.id);
        
        // Event listeners
        this.handleShow = this.show.bind(this);
        this.handleHide = this.hide.bind(this);
        this.handleKeyDown = this.onKeyDown.bind(this);

        // Mouse events
        this.trigger.addEventListener('mouseenter', this.handleShow);
        this.trigger.addEventListener('mouseleave', this.handleHide);

        // Focus events
        this.trigger.addEventListener('focus', this.handleShow);
        this.trigger.addEventListener('blur', this.handleHide);
    }

    createTooltip() {
        if (this.tooltip) return;

        this.tooltip = document.createElement('div');
        this.tooltip.id = this.id;
        this.tooltip.className = 'tooltip';
        this.tooltip.setAttribute('role', 'tooltip');
        this.tooltip.setAttribute('aria-hidden', 'true');
        this.tooltip.textContent = this.content;
        
        // Append to container or body? 
        // Best practice is usually body for positioning avoiding clipping, 
        // but for this simple demo let's keep it near the trigger or just use the container if it exists.
        // Actually, let's append to the trigger's parent to match the previous structure 
        // but `position: relative` on parent is needed.
        // For modernization, appending to body and using Popper.js is best, 
        // but we are keeping it simple: append to same container.
        
        this.trigger.parentNode.appendChild(this.tooltip);
        
        // Trigger generic reflow/paint if needed before showing class
        // (Not strictly needed with just CSS transitions usually)
    }

    show() {
        if (!this.tooltip) {
            this.createTooltip();
        }

        this.isVisible = true;
        this.tooltip.setAttribute('aria-hidden', 'false');
        this.tooltip.classList.add('is-visible');
        
        document.addEventListener('keydown', this.handleKeyDown);
    }

    hide() {
        if (!this.tooltip) return;

        this.isVisible = false;
        this.tooltip.setAttribute('aria-hidden', 'true');
        this.tooltip.classList.remove('is-visible');
        
        document.removeEventListener('keydown', this.handleKeyDown);
        
        // Optional: Remove after transition? 
        // For performance, we can leave it in DOM or remove it. 
        // Let's leave it for now to avoid complexity.
    }

    onKeyDown(e) {
        if (e.key === 'Escape' && this.isVisible) {
            this.hide();
            // Optional: return focus to trigger if it wasn't there? 
            // Usually trigger acts as the anchor.
        }
    }
}
