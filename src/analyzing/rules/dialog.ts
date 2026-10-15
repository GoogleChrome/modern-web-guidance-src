import type {
  AnalyzerRule,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
} from '../schema.ts';

export const DIALOG_GUIDE_HASH = '95fc47d3f348';

const dialogDomMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'div[role="dialog"], div.modal, [role="dialog"], [role="alertdialog"]',
  fastTokens: ['dialog', 'modal'],
  skipIfHasSpread: true,
  skipIfDynamicAttributes: ['role', 'aria-modal'],
  matchElement: (element: DomElementView, _ctx: DomMatcherContext) => {
    // 1. Skip native <dialog> elements
    if (element.tagName === 'dialog') {
      return null;
    }

    // 2. Skip elements with spread attributes
    if (element.hasSpreadAttribute) {
      return null;
    }

    // 3. Skip elements with dynamic role or aria-modal in JSX
    if (
      element.hasDynamicAttribute?.('role') ||
      element.hasDynamicAttribute?.('aria-modal')
    ) {
      return null;
    }

    const role = element.getAttribute('role')?.toLowerCase().trim();
    const ariaModal = element.getAttribute('aria-modal')?.toLowerCase().trim();

    // 4. Alertdialog: only flag if explicitly marked modal; skip notification banners
    if (role === 'alertdialog') {
      if (ariaModal !== 'true') {
        return null;
      }
      return {
        message:
          `Custom modal alertdialog constructed using <${element.tagName}> with role="alertdialog" and aria-modal="true"; modernize with native HTML <dialog> element and showModal().`,
      };
    }

    // 5. Must have role="dialog"
    if (role !== 'dialog') {
      return null;
    }

    // 6. Explicitly non-modal dialogs (e.g. inline popups or find bars) are exempt
    if (ariaModal === 'false') {
      return null;
    }

    // 7. Check modal criteria: aria-modal="true" or modal class (e.g. Bootstrap modal)
    const classAttr = element.getAttribute('class') ?? '';
    const classList = classAttr.toLowerCase().split(/\s+/).filter(Boolean);
    const hasModalClass =
      classList.includes('modal') ||
      classList.some(
        (c) =>
          c === 'modal-dialog' ||
          c === 'modal-container' ||
          c.endsWith('-modal') ||
          c.startsWith('modal-'),
      );

    const isModal = ariaModal === 'true' || hasModalClass;

    if (!isModal) {
      return null;
    }

    return {
      message:
        `Custom modal dialog constructed using <${element.tagName}> with role="dialog"; modernize with the native HTML <dialog> element and showModal().`,
    };
  },
};

export const dialogRule: AnalyzerRule = {
  id: 'dialog',
  guideId: 'dialog',
  guideHash: DIALOG_GUIDE_HASH,
  summary:
    'Custom non-<dialog> modal dialog elements in HTML/JSX should be modernized using the native HTML <dialog> element and showModal().',
  matcher: dialogDomMatcher,
  phase2Rubric: {
    keepWhen: [
      'Custom modal dialog overlay constructed using non-<dialog> element (e.g., div[role="dialog"]) with aria-modal="true" or modal classes instead of the native HTML <dialog> element.',
      'Modal dialog component reimplementing backdrop overlay, focus trapping, or platform dismissal (Esc) in custom JavaScript instead of dialog.showModal().',
    ],
    dropWhen: [
      'The element is a native HTML <dialog> element (even if role="dialog" is redundantly specified for older assistive technologies).',
      'Non-modal overlays, inline popups, tooltips, or alert banners where role="alertdialog" or role="dialog" is used without modal blocking behavior (aria-modal="false" or absence of modal attributes).',
      'The component receives its dialog or modal attributes dynamically via JSX spread attributes or framework wrapper components.',
    ],
  },
};

export const dialogRules: readonly AnalyzerRule[] = [dialogRule];
