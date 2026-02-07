import './style.css';

export class TooltipManager {
  private tooltipElement: HTMLElement;
  private currentTrigger: HTMLElement | null = null;

  constructor() {
    this.tooltipElement = this.createTooltipElement();
    this.attachGlobalListeners();
  }

  private createTooltipElement(): HTMLElement {
    const tooltip = document.createElement('div');
    tooltip.classList.add('tooltip');
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');
    tooltip.id = 'tooltip-global';
    document.body.appendChild(tooltip);
    return tooltip;
  }

  private attachGlobalListeners(): void {
    // Event delegation for mouse interactions
    document.addEventListener('mouseover', (e) => {
      const target = (e.target as HTMLElement).closest('[data-tooltip]') as HTMLElement;
      if (target) {
        this.show(target);
      }
    });

    document.addEventListener('mouseout', (e) => {
      const target = (e.target as HTMLElement).closest('[data-tooltip]');
      if (target) {
        this.hide();
      }
    });

    // Keyboard interaction events
    document.addEventListener('focusin', (e) => {
      const target = (e.target as HTMLElement).closest('[data-tooltip]') as HTMLElement;
      if (target) {
        this.show(target);
      }
    });

    document.addEventListener('focusout', (e) => {
      const target = (e.target as HTMLElement).closest('[data-tooltip]');
      if (target) {
        this.hide();
      }
    });
    
    // Handle Escape key to close tooltip
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.currentTrigger) {
        this.hide();
      }
    });
  }

  private show(trigger: HTMLElement): void {
    this.currentTrigger = trigger;
    const tooltipText = trigger.getAttribute('data-tooltip') || '';
    
    // Set accessibility attributes on trigger
    trigger.setAttribute('aria-describedby', this.tooltipElement.id);

    this.tooltipElement.textContent = tooltipText;
    this.tooltipElement.setAttribute('aria-hidden', 'false');
    this.tooltipElement.classList.add('tooltip--visible');

    this.updatePosition(trigger);
  }

  private hide(): void {
    if (this.currentTrigger) {
      this.currentTrigger.removeAttribute('aria-describedby');
    }
    this.currentTrigger = null;
    this.tooltipElement.setAttribute('aria-hidden', 'true');
    this.tooltipElement.classList.remove('tooltip--visible');
  }

  private updatePosition(trigger: HTMLElement): void {
    const rect = trigger.getBoundingClientRect();
    const tooltipRect = this.tooltipElement.getBoundingClientRect();
    
    const spacing = 8;
    let top = rect.top - tooltipRect.height - spacing;
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

    // Keep within viewport logic (basic)
    if (top < 0) {
      top = rect.bottom + spacing; // Flip to bottom if not enough space above
      this.tooltipElement.classList.add('tooltip--bottom');
    } else {
        this.tooltipElement.classList.remove('tooltip--bottom');
    }

    if (left < 0) left = 10;
    if (left + tooltipRect.width > window.innerWidth) {
        left = window.innerWidth - tooltipRect.width - 10;
    }

    this.tooltipElement.style.top = `${top + window.scrollY}px`;
    this.tooltipElement.style.left = `${left + window.scrollX}px`;
  }
}
