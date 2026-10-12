import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import {
  SyntaxKind,
  Node,
  type Project,
  type JsxOpeningElement,
  type JsxSelfClosingElement,
  type JsxElement,
} from 'ts-morph';

const targetFiles: string[] = getTargetFiles(import.meta.url);

interface OtpInputInfo {
  type: string;
  inputmode: string;
  autocomplete: string;
  required: boolean;
  pattern: string;
  maxlength: string;
  name: string;
  id: string;
  ariaDescribedBy: string;
  hasWrappingForm: boolean;
  formHasSubmitButtonWithText: boolean;
  otpInputCountInForm: number;
  hasSingleDigitSplit: boolean;
  hasMatchingVisibleLabel: boolean;
  isHintAboveInput: boolean;
}

const OTP_ATTR_PATTERN = /otp|one[-_]?time|passcode|verification|verify/i;

function isOtpCandidateAttrs(attrs: {
  autocomplete: string;
  id: string;
  name: string;
  placeholder: string;
  ariaLabel: string;
  className: string;
  inputmode: string;
  maxlength: string;
  pattern: string;
}): boolean {
  if (attrs.autocomplete.toLowerCase().includes('one-time-code')) {
    return true;
  }
  const combined = `${attrs.id} ${attrs.name} ${attrs.placeholder} ${attrs.ariaLabel} ${attrs.className}`;
  if (OTP_ATTR_PATTERN.test(combined)) {
    return true;
  }
  if (
    attrs.inputmode.toLowerCase() === 'numeric' &&
    (attrs.maxlength === '6' || /\\d|\d|\[0-9\]/.test(attrs.pattern))
  ) {
    return true;
  }
  return false;
}

function extractHtmlOtpInputs(
  docs: Array<{ file: string; document: any }>
): OtpInputInfo[] {
  const results: OtpInputInfo[] = [];

  for (const { document } of docs) {
    const allElements = Array.from(document.querySelectorAll('*')) as any[];
    const allInputs = Array.from(document.querySelectorAll('input')) as any[];

    const candidateInputs = allInputs.filter((input) => {
      const inputType = (input.getAttribute('type') || 'text').toLowerCase();
      if (['hidden', 'submit', 'button', 'reset', 'checkbox', 'radio', 'email', 'password'].includes(inputType)) {
        return false;
      }
      if (inputType === 'tel' && (input.getAttribute('autocomplete') || '').toLowerCase().includes('tel')) {
        return false;
      }
      return isOtpCandidateAttrs({
        autocomplete: input.getAttribute('autocomplete') || '',
        id: input.getAttribute('id') || '',
        name: input.getAttribute('name') || '',
        placeholder: input.getAttribute('placeholder') || '',
        ariaLabel: input.getAttribute('aria-label') || '',
        className: input.getAttribute('class') || '',
        inputmode: input.getAttribute('inputmode') || '',
        maxlength: input.getAttribute('maxlength') || '',
        pattern: input.getAttribute('pattern') || '',
      });
    });

    for (const input of candidateInputs) {
      const form = input.closest('form');
      const scopeRoot = form || document;
      const scopeInputs = Array.from(scopeRoot.querySelectorAll('input')) as any[];

      const otpInputsInScope = scopeInputs.filter((inp) =>
        candidateInputs.includes(inp)
      );
      const singleDigitInputs = scopeInputs.filter(
        (inp) => (inp.getAttribute('maxlength') || '').trim() === '1'
      );

      let formHasSubmitButtonWithText = false;
      if (form) {
        const buttons = Array.from(form.querySelectorAll('button, input[type="submit"]')) as any[];
        formHasSubmitButtonWithText = buttons.some((btn) => {
          const tag = (btn.tagName || '').toLowerCase();
          if (tag === 'input') {
            return Boolean((btn.getAttribute('value') || '').trim());
          }
          const btnType = (btn.getAttribute('type') || '').toLowerCase();
          const text = (btn.textContent || btn.getAttribute('aria-label') || '').trim();
          return btnType === 'submit' && text.length > 0;
        });
      }

      const id = (input.getAttribute('id') || '').trim();
      let hasMatchingVisibleLabel = false;
      if (id) {
        const labels = Array.from(document.querySelectorAll('label')) as any[];
        hasMatchingVisibleLabel = labels.some((label) => {
          const forAttr = (label.getAttribute('for') || '').trim();
          const text = (label.textContent || '').trim();
          const isHidden =
            label.hasAttribute('hidden') ||
            (label.getAttribute('aria-hidden') || '').toLowerCase() === 'true';
          return forAttr === id && text.length > 0 && !isHidden;
        });
      }

      const ariaDescribedBy = String(input.getAttribute('aria-describedby') || '').trim();
      let isHintAboveInput = true;
      if (ariaDescribedBy) {
        const inputIdx = allElements.indexOf(input);
        const hintIds = ariaDescribedBy.split(/\s+/).filter(Boolean);
        const hintEls = hintIds
          .map((hintId: string) => document.getElementById(hintId))
          .filter(Boolean);
        const formatHintEls = hintEls.filter((hintEl: any) => {
          const role = (hintEl.getAttribute('role') || '').toLowerCase();
          const hasAriaLive = hintEl.hasAttribute('aria-live');
          const isHidden = hintEl.hasAttribute('hidden');
          const text = (hintEl.textContent || '').trim();
          const idAndClass = `${hintEl.getAttribute('id') || ''} ${hintEl.getAttribute('class') || ''}`;
          const isStatusOrError =
            role === 'status' ||
            role === 'alert' ||
            hasAriaLive ||
            isHidden ||
            text.length === 0 ||
            (/error|status|alert/i.test(idAndClass) && !/hint|format|help|desc|instruction/i.test(idAndClass));
          return !isStatusOrError;
        });
        isHintAboveInput =
          hintEls.length > 0 &&
          formatHintEls.every((hintEl: any) => {
            const hintIdx = allElements.indexOf(hintEl);
            return hintIdx !== -1 && hintIdx < inputIdx;
          });
      }

      results.push({
        type: (input.getAttribute('type') || 'text').trim().toLowerCase(),
        inputmode: (input.getAttribute('inputmode') || '').trim().toLowerCase(),
        autocomplete: (input.getAttribute('autocomplete') || '').trim().toLowerCase(),
        required: input.hasAttribute('required'),
        pattern: (input.getAttribute('pattern') || '').trim(),
        maxlength: (input.getAttribute('maxlength') || '').trim(),
        name: (input.getAttribute('name') || '').trim(),
        id,
        ariaDescribedBy,
        hasWrappingForm: Boolean(form),
        formHasSubmitButtonWithText,
        otpInputCountInForm: otpInputsInScope.length,
        hasSingleDigitSplit:
          singleDigitInputs.length > 1 ||
          (input.getAttribute('maxlength') || '').trim() === '1',
        hasMatchingVisibleLabel,
        isHintAboveInput,
      });
    }
  }

  return results;
}

function getJsxAttrValue(
  el: JsxOpeningElement | JsxSelfClosingElement,
  attrNames: string[]
): string | undefined {
  const lowerNames = attrNames.map((n) => n.toLowerCase());
  for (const attr of el.getAttributes()) {
    if (!Node.isJsxAttribute(attr)) continue;
    const name = attr.getNameNode().getText().toLowerCase();
    if (!lowerNames.includes(name)) continue;

    const init = attr.getInitializer();
    if (!init) return 'true';
    if (Node.isStringLiteral(init)) return init.getLiteralValue();
    if (Node.isJsxExpression(init)) {
      const expr = init.getExpression();
      if (!expr) return 'true';
      if (Node.isStringLiteral(expr) || Node.isNoSubstitutionTemplateLiteral(expr)) {
        return expr.getLiteralValue();
      }
      return expr.getText().trim();
    }
  }
  return undefined;
}

function findEnclosingJsxElement(node: Node, tagName: string): JsxElement | undefined {
  for (const ancestor of node.getAncestors()) {
    if (Node.isJsxElement(ancestor)) {
      const tag = ancestor.getOpeningElement().getTagNameNode().getText();
      if (tag === tagName) return ancestor;
    }
  }
  return undefined;
}

function extractJsxOtpInputs(project: Project): OtpInputInfo[] {
  const results: OtpInputInfo[] = [];

  for (const sf of project.getSourceFiles()) {
    const jsxTagNodes = sf
      .getDescendants()
      .filter(
        (n): n is JsxOpeningElement | JsxSelfClosingElement =>
          Node.isJsxOpeningElement(n) || Node.isJsxSelfClosingElement(n)
      );

    const inputNodes = jsxTagNodes.filter(
      (n) => n.getTagNameNode().getText() === 'input'
    );

    const candidateInputs = inputNodes.filter((input) => {
      const inputType = (getJsxAttrValue(input, ['type']) || 'text').toLowerCase();
      if (['hidden', 'submit', 'button', 'reset', 'checkbox', 'radio', 'email', 'password'].includes(inputType)) {
        return false;
      }
      const autocomplete = getJsxAttrValue(input, ['autocomplete', 'autoComplete']) || '';
      if (inputType === 'tel' && autocomplete.toLowerCase().includes('tel')) {
        return false;
      }
      return isOtpCandidateAttrs({
        autocomplete,
        id: getJsxAttrValue(input, ['id']) || '',
        name: getJsxAttrValue(input, ['name']) || '',
        placeholder: getJsxAttrValue(input, ['placeholder']) || '',
        ariaLabel: getJsxAttrValue(input, ['aria-label', 'ariaLabel']) || '',
        className: getJsxAttrValue(input, ['class', 'className']) || '',
        inputmode: getJsxAttrValue(input, ['inputmode', 'inputMode']) || '',
        maxlength: getJsxAttrValue(input, ['maxlength', 'maxLength']) || '',
        pattern: getJsxAttrValue(input, ['pattern']) || '',
      });
    });

    for (const input of candidateInputs) {
      const formEl = findEnclosingJsxElement(input, 'form');
      const scopeNode: Node = formEl || sf;
      const scopeInputs = scopeNode
        .getDescendants()
        .filter(
          (n): n is JsxOpeningElement | JsxSelfClosingElement =>
            (Node.isJsxOpeningElement(n) || Node.isJsxSelfClosingElement(n)) &&
            n.getTagNameNode().getText() === 'input'
        );

      const otpInputsInScope = scopeInputs.filter((inp) =>
        candidateInputs.includes(inp)
      );
      const singleDigitInputs = scopeInputs.filter(
        (inp) => (getJsxAttrValue(inp, ['maxlength', 'maxLength']) || '').trim() === '1'
      );
      const isInsideArrayMap = input
        .getAncestors()
        .some(
          (a) =>
            Node.isCallExpression(a) &&
            a.getExpression().getText().endsWith('.map')
        );

      let formHasSubmitButtonWithText = false;
      if (formEl) {
        const jsxElements = formEl.getDescendantsOfKind(SyntaxKind.JsxElement);
        formHasSubmitButtonWithText = jsxElements.some((el) => {
          const open = el.getOpeningElement();
          if (open.getTagNameNode().getText() !== 'button') return false;
          const btnType = (getJsxAttrValue(open, ['type']) || '').toLowerCase();
          const innerText = el
            .getJsxChildren()
            .map((c) => c.getText())
            .join('')
            .trim();
          return btnType === 'submit' && innerText.length > 0;
        });
      }

      const id = (getJsxAttrValue(input, ['id']) || '').trim();
      let hasMatchingVisibleLabel = false;
      if (id) {
        const labelElements = sf
          .getDescendantsOfKind(SyntaxKind.JsxElement)
          .filter((el) => el.getOpeningElement().getTagNameNode().getText() === 'label');
        hasMatchingVisibleLabel = labelElements.some((labelEl) => {
          const open = labelEl.getOpeningElement();
          const forVal = (getJsxAttrValue(open, ['for', 'htmlFor']) || '').trim();
          const hasHidden = getJsxAttrValue(open, ['hidden']) !== undefined;
          const innerText = labelEl
            .getJsxChildren()
            .map((c) => c.getText())
            .join('')
            .trim();
          return forVal === id && !hasHidden && innerText.length > 0;
        });
      }

      const ariaDescribedBy = (
        getJsxAttrValue(input, ['aria-describedby', 'ariaDescribedby']) || ''
      ).trim();
      let isHintAboveInput = true;
      if (ariaDescribedBy) {
        const hintIds = ariaDescribedBy.split(/\s+/).filter(Boolean);
        const hintNodes = jsxTagNodes.filter((n) => {
          const nodeId = (getJsxAttrValue(n, ['id']) || '').trim();
          return hintIds.includes(nodeId);
        });
        const formatHintNodes = hintNodes.filter((n) => {
          const role = (getJsxAttrValue(n, ['role']) || '').toLowerCase();
          const hasAriaLive = getJsxAttrValue(n, ['aria-live', 'ariaLive']) !== undefined;
          const isHidden = getJsxAttrValue(n, ['hidden']) !== undefined;
          const idAndClass = `${getJsxAttrValue(n, ['id']) || ''} ${getJsxAttrValue(n, ['class', 'className']) || ''}`;
          const isStatusOrError =
            role === 'status' ||
            role === 'alert' ||
            hasAriaLive ||
            isHidden ||
            (/error|status|alert/i.test(idAndClass) && !/hint|format|help|desc|instruction/i.test(idAndClass));
          return !isStatusOrError;
        });
        isHintAboveInput =
          hintNodes.length > 0 &&
          formatHintNodes.every((hintNode) => hintNode.getPos() < input.getPos());
      }

      const reqVal = getJsxAttrValue(input, ['required']);
      const required = reqVal !== undefined && reqVal !== 'false';
      const maxlength = (getJsxAttrValue(input, ['maxlength', 'maxLength']) || '').trim();

      results.push({
        type: (getJsxAttrValue(input, ['type']) || 'text').trim().toLowerCase(),
        inputmode: (getJsxAttrValue(input, ['inputmode', 'inputMode']) || '').trim().toLowerCase(),
        autocomplete: (getJsxAttrValue(input, ['autocomplete', 'autoComplete']) || '').trim().toLowerCase(),
        required,
        pattern: (getJsxAttrValue(input, ['pattern']) || '').trim(),
        maxlength,
        name: (getJsxAttrValue(input, ['name']) || '').trim(),
        id,
        ariaDescribedBy,
        hasWrappingForm: Boolean(formEl),
        formHasSubmitButtonWithText,
        otpInputCountInForm: otpInputsInScope.length,
        hasSingleDigitSplit:
          singleDigitInputs.length > 1 || maxlength === '1' || isInsideArrayMap,
        hasMatchingVisibleLabel,
        isHintAboveInput,
      });
    }
  }

  return results;
}

function getAllOtpInputs(): OtpInputInfo[] {
  const docs = getHtmlDocuments(targetFiles);
  const project = getJsProject(targetFiles);
  return [...extractHtmlOtpInputs(docs), ...extractJsxOtpInputs(project)];
}

test.describe('sms-otp-form Target Grader', () => {
  test('The OTP verification control is wrapped in a semantic <form> element with an explicit <button type="submit"> with actionable text', () => {
    const inputs = getAllOtpInputs();
    const hasSemanticFormWithSubmit = inputs.some(
      (inp) => inp.hasWrappingForm && inp.formHasSubmitButtonWithText
    );
    expect(hasSemanticFormWithSubmit).toBe(true);
  });

  test('The OTP code is collected using a single <input> element rather than splitting individual digits across multiple <input> elements', () => {
    const inputs = getAllOtpInputs();
    const hasSingleOtpInput = inputs.some(
      (inp) => inp.otpInputCountInForm === 1 && !inp.hasSingleDigitSplit
    );
    expect(hasSingleOtpInput).toBe(true);
  });

  test('The OTP <input> element uses type="text", inputmode="numeric", and autocomplete="one-time-code"', () => {
    const inputs = getAllOtpInputs();
    const hasValidInputAttributes = inputs.some(
      (inp) =>
        inp.type === 'text' &&
        inp.inputmode === 'numeric' &&
        inp.autocomplete === 'one-time-code'
    );
    expect(hasValidInputAttributes).toBe(true);
  });

  test('The OTP <input> element includes native validation attributes (required and pattern or maxlength) and a name attribute', () => {
    const inputs = getAllOtpInputs();
    const hasValidationAndName = inputs.some(
      (inp) =>
        inp.required &&
        Boolean(inp.name) &&
        (Boolean(inp.pattern) || (Boolean(inp.maxlength) && Number(inp.maxlength) >= 4))
    );
    expect(hasValidationAndName).toBe(true);
  });

  test('The OTP <input> element is programmatically associated with a visible <label> via matching for and id attributes, and any format hint linked via aria-describedby is positioned above the <input>', () => {
    const inputs = getAllOtpInputs();
    const hasAccessibleLabelAndHint = inputs.some(
      (inp) => inp.hasMatchingVisibleLabel && inp.isHintAboveInput
    );
    expect(hasAccessibleLabelAndHint).toBe(true);
  });

  test('When OTPCredential is available on window, the client invokes navigator.credentials.get with otp: { transport: ["sms"] } and an AbortSignal from an AbortController', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasOtpCredentialCheck = sourceFiles.some((sf) =>
      sf.getText().includes('OTPCredential')
    );

    const hasAbortController = sourceFiles.some((sf) =>
      sf
        .getDescendantsOfKind(SyntaxKind.NewExpression)
        .some((ne) => ne.getExpression().getText() === 'AbortController')
    );

    const hasWebOtpCredentialsGet = sourceFiles.some((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
        const callee = call.getExpression().getText();
        if (!callee.endsWith('credentials.get') && !callee.endsWith('.get')) {
          return false;
        }
        const firstArg = call.getArguments()[0];
        if (!firstArg || !Node.isObjectLiteralExpression(firstArg)) {
          return false;
        }
        const argText = firstArg.getText();
        const hasOtpSms =
          /otp\s*:/.test(argText) &&
          /transport\s*:/.test(argText) &&
          /['"`]sms['"`]/.test(argText);
        const hasSignal = /signal\b/.test(argText);
        return hasOtpSms && hasSignal;
      })
    );

    expect(
      hasOtpCredentialCheck && hasAbortController && hasWebOtpCredentialsGet
    ).toBe(true);
  });

  test('Submitting the <form> manually calls abort() on the active AbortController to cancel any pending WebOTP request', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasAbortCall = sourceFiles.some((sf) =>
      sf
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .some((call) => call.getExpression().getText().endsWith('.abort'))
    );

    const hasSubmitHandlerAbort = sourceFiles.some((sf) => {
      const text = sf.getText();
      const hasSubmitBinding =
        /addEventListener\s*\(\s*['"`]submit['"`]/.test(text) ||
        /\bonSubmit\s*=/.test(text) ||
        /\.onsubmit\s*=/.test(text);
      return hasSubmitBinding && /\.abort\s*\(\s*\)/.test(text);
    });

    expect(hasAbortCall && hasSubmitHandlerAbort).toBe(true);
  });

  test('When navigator.credentials.get resolves with an OTP credential object, the client populates the OTP <input> value with code and triggers the form submission flow', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasCodeAssignmentAndSubmit = sourceFiles.some((sf) => {
      const text = sf.getText();
      if (!text.includes('credentials.get')) return false;
      const accessesCode =
        /\.code\b/.test(text) || /\{\s*code\s*\}/.test(text);
      const populatesInput =
        /\.value\s*=/.test(text) || /\bset[A-Z]\w*\s*\(/.test(text);
      const triggersSubmitFlow =
        (/\.requestSubmit\s*\(/.test(text) ||
          /(?<!\.)\bsubmit\w*\s*\(/.test(text) ||
          /\bverify\w*\s*\(/.test(text)) &&
        !/\.submit\s*\(/.test(text);
      return accessesCode && populatesInput && triggersSubmitFlow;
    });

    expect(hasCodeAssignmentAndSubmit).toBe(true);
  });
});
