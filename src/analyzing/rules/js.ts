import type { AnalyzerRule } from '../schema.ts';
import { abortSignalTimeoutRule } from './js/abort-signal-timeout.ts';
import { copyingArrayMethodsRule } from './js/copying-array-methods.ts';
import { jsCreateEventRule } from './js/create-event.ts';
import { jsErrorCauseRule } from './js/error-cause.ts';
import { objectGroupByRule } from './js/object-group-by.ts';
import { jsPromiseWithResolversRule } from './js/promise-with-resolvers.ts';
import { jsReplaceChildrenRule } from './js/replace-children.ts';
import { jsReplaceChildrenInnerHtmlRule } from './js/replace-children-innerhtml.ts';
import { structuredCloneRule } from './js/structured-clone.ts';
import { jsTextDecoderRule } from './js/text-decoder.ts';
import { jsUrlSearchParamsRule } from './js/url-search-params.ts';

export {
  abortSignalTimeoutRule,
  copyingArrayMethodsRule,
  jsCreateEventRule,
  jsErrorCauseRule,
  jsPromiseWithResolversRule,
  jsReplaceChildrenInnerHtmlRule,
  jsReplaceChildrenRule,
  jsTextDecoderRule,
  jsUrlSearchParamsRule,
  objectGroupByRule,
  structuredCloneRule,
};

export const jsRules: readonly AnalyzerRule[] = [
  structuredCloneRule,
  jsReplaceChildrenRule,
  jsReplaceChildrenInnerHtmlRule,
  jsUrlSearchParamsRule,
  objectGroupByRule,
  jsPromiseWithResolversRule,
  jsCreateEventRule,
  copyingArrayMethodsRule,
  abortSignalTimeoutRule,
  jsErrorCauseRule,
  jsTextDecoderRule,
];

export default jsRules;
