type CSSToken = string | CSSStyleValue | CSSParserValue;
declare abstract class CSSParserValue {
    abstract toString(): string;
}
declare class CSSParserBlock extends CSSParserValue {
    name: string;
    body: CSSParserValue[];
    constructor(name: string, body: CSSParserValue[]);
    toString(): string;
}
declare class CSSParserFunction extends CSSParserValue {
    name: string;
    args: CSSParserValue[][];
    constructor(name: string, args: CSSParserValue[][]);
    toString(): string;
}
declare abstract class CSSParserRule {
    abstract toString(): string;
}
declare class CSSParserAtRule extends CSSParserRule {
    name: string;
    prelude: CSSToken[];
    body: CSSParserRule[] | null;
    constructor(name: string, prelude: CSSToken[], body?: CSSParserRule[] | null);
    toString(): string;
}
declare class CSSParserQualifiedRule extends CSSParserRule {
    prelude: CSSToken[];
    body: CSSParserRule[];
    constructor(prelude: CSSToken[], body: CSSParserRule[]);
    toString(): string;
}
declare class CSSParserDeclaration extends CSSParserRule {
    name: string;
    body: CSSParserValue[];
    constructor(name: string, body: CSSParserValue[]);
    toString(): string;
}
interface CSSParserOptions {
    atRules?: Record<string, string>;
}
/**
 * Parser API Implementation
 */
declare function parseStylesheetSync(css: string, _options?: CSSParserOptions): CSSParserRule[];
declare function parseStylesheet(css: string, options?: CSSParserOptions): Promise<CSSParserRule[]>;
declare function parseRuleListSync(css: string, _options?: CSSParserOptions): CSSParserRule[];
declare function parseRuleList(css: string, options?: CSSParserOptions): Promise<CSSParserRule[]>;
declare function parseRuleSync(css: string, _options?: CSSParserOptions): CSSParserRule | null;
declare function parseRule(css: string, options?: CSSParserOptions): Promise<CSSParserRule | null>;
declare function parseDeclarationListSync(css: string, _options?: CSSParserOptions): CSSParserRule[];
declare function parseDeclarationList(css: string, options?: CSSParserOptions): Promise<CSSParserRule[]>;
declare function parseDeclarationSync(css: string, _options?: CSSParserOptions): CSSParserDeclaration | null;
declare function parseValueSync(css: string): CSSToken;
declare function parseValueListSync(css: string): CSSToken[];
declare function parseCommaValueListSync(css: string): CSSToken[][];
declare const CSS: {
    number: (v: number) => CSSUnitValue;
    percent: (v: number) => CSSUnitValue;
    px: (v: number) => CSSUnitValue;
    em: (v: number) => CSSUnitValue;
    ex: (v: number) => CSSUnitValue;
    ch: (v: number) => CSSUnitValue;
    rem: (v: number) => CSSUnitValue;
    vw: (v: number) => CSSUnitValue;
    vh: (v: number) => CSSUnitValue;
    vmin: (v: number) => CSSUnitValue;
    vmax: (v: number) => CSSUnitValue;
    deg: (v: number) => CSSUnitValue;
    grad: (v: number) => CSSUnitValue;
    rad: (v: number) => CSSUnitValue;
    turn: (v: number) => CSSUnitValue;
    s: (v: number) => CSSUnitValue;
    ms: (v: number) => CSSUnitValue;
    fr: (v: number) => CSSUnitValue;
    parseStylesheetSync: typeof parseStylesheetSync;
    parseRuleListSync: typeof parseRuleListSync;
    parseRuleSync: typeof parseRuleSync;
    parseDeclarationListSync: typeof parseDeclarationListSync;
    parseDeclarationSync: typeof parseDeclarationSync;
    parseValueSync: typeof parseValueSync;
    parseValueListSync: typeof parseValueListSync;
    parseCommaValueListSync: typeof parseCommaValueListSync;
    parseStylesheet: typeof parseStylesheet;
    parseRuleList: typeof parseRuleList;
    parseRule: typeof parseRule;
    parseDeclarationList: typeof parseDeclarationList;
    parseDeclaration: (css: string, options?: CSSParserOptions) => Promise<CSSParserDeclaration | null>;
    parseValue: (css: string) => Promise<CSSToken>;
    parseValueList: (css: string) => Promise<CSSToken[]>;
    parseCommaValueList: (css: string) => Promise<CSSToken[][]>;
};

declare abstract class CSSStyleValue {
    abstract toString(): string;
    static parse(property: string, css: string): CSSStyleValue | null;
}
declare class CSSKeywordValue extends CSSStyleValue {
    value: string;
    constructor(value: string);
    toString(): string;
    serialize(): string;
}
declare abstract class CSSNumericValue extends CSSStyleValue {
    abstract serialize(): string;
    add(...values: (number | CSSNumericValue)[]): CSSNumericValue;
    sub(...values: (number | CSSNumericValue)[]): CSSNumericValue;
    mul(...values: (number | CSSNumericValue)[]): CSSNumericValue;
    div(...values: (number | CSSNumericValue)[]): CSSNumericValue;
    min(...values: (number | CSSNumericValue)[]): CSSNumericValue;
    max(...values: (number | CSSNumericValue)[]): CSSNumericValue;
    equals(...values: (number | CSSNumericValue)[]): boolean;
    private _equals;
}
type CSSUnit = 'number' | 'percent' | 'em' | 'ex' | 'ch' | 'rem' | 'vw' | 'vh' | 'vmin' | 'vmax' | 'vi' | 'vb' | 'svw' | 'svh' | 'svi' | 'svb' | 'svmin' | 'svmax' | 'lvw' | 'lvh' | 'lvi' | 'lvb' | 'lvmin' | 'lvmax' | 'dvw' | 'dvh' | 'dvi' | 'dvb' | 'dvmin' | 'dvmax' | 'cm' | 'mm' | 'in' | 'pt' | 'pc' | 'px' | 'q' | 'deg' | 'grad' | 'rad' | 'turn' | 's' | 'ms' | 'hz' | 'khz' | 'dpi' | 'dpcm' | 'dppx' | 'rex' | 'cap' | 'rcap' | 'rch' | 'ic' | 'ric' | 'lh' | 'rlh' | 'cqw' | 'cqh' | 'cqi' | 'cqb' | 'cqmin' | 'cqmax' | 'fr';
interface DOMMatrixReadOnly {
    readonly is2D: boolean;
    readonly a: number;
    readonly b: number;
    readonly c: number;
    readonly d: number;
    readonly e: number;
    readonly f: number;
    readonly m11: number;
    readonly m12: number;
    readonly m13: number;
    readonly m14: number;
    readonly m21: number;
    readonly m22: number;
    readonly m23: number;
    readonly m24: number;
    readonly m31: number;
    readonly m32: number;
    readonly m33: number;
    readonly m34: number;
    readonly m41: number;
    readonly m42: number;
    readonly m43: number;
    readonly m44: number;
}
declare class CSSUnitValue extends CSSNumericValue {
    value: number;
    unit: CSSUnit;
    constructor(value: number, unit: CSSUnit);
    toString(): string;
    serialize(): string;
}
/**
 * Converts a parsed token into a Typed OM CSSStyleValue.
 */
declare function createCSSStyleValue(token: Token): CSSStyleValue | null;
declare class CSSVariableReferenceValue {
    variable: string;
    fallback: CSSUnparsedValue | null;
    constructor(variable: string, fallback?: CSSUnparsedValue | null);
    toString(): string;
}
declare class CSSUnparsedValue extends CSSStyleValue {
    private values;
    constructor(values: (string | CSSVariableReferenceValue)[]);
    toString(): string;
    serialize(): string;
}
declare abstract class CSSMathValue extends CSSNumericValue {
    abstract serialize(): string;
    toString(): string;
    abstract get operator(): string;
}
declare class CSSNumericNode extends CSSMathValue {
    value: number;
    unit: string;
    constructor(value: number, unit: string);
    get operator(): string;
    serialize(): string;
}
declare class CSSMathNegate extends CSSMathValue {
    child: CSSMathValue;
    constructor(child: number | CSSNumericValue);
    get operator(): string;
    serialize(): string;
    toString(): string;
}
declare class CSSMathInvert extends CSSMathValue {
    child: CSSMathValue;
    constructor(child: number | CSSNumericValue);
    get operator(): string;
    serialize(): string;
    toString(): string;
}
declare class CSSMathSum extends CSSMathValue {
    children: CSSMathValue[];
    constructor(...args: (number | CSSNumericValue)[]);
    get operator(): string;
    serialize(): string;
}
declare class CSSMathProduct extends CSSMathValue {
    children: CSSMathValue[];
    constructor(...args: (number | CSSNumericValue)[]);
    get operator(): string;
    serialize(): string;
}
declare class CSSMathMin extends CSSMathValue {
    children: CSSMathValue[];
    constructor(...args: (number | CSSNumericValue)[]);
    get operator(): string;
    serialize(): string;
}
declare class CSSMathMax extends CSSMathValue {
    children: CSSMathValue[];
    constructor(...args: (number | CSSNumericValue)[]);
    get operator(): string;
    serialize(): string;
}
declare class CSSMathClamp extends CSSMathValue {
    min: CSSMathValue;
    val: CSSMathValue;
    max: CSSMathValue;
    constructor(min: number | CSSNumericValue, val: number | CSSNumericValue, max: number | CSSNumericValue);
    get operator(): string;
    serialize(): string;
}
declare class CSSMathExpression extends CSSMathValue {
    root: CSSMathValue;
    name: string;
    constructor(root: CSSMathValue, name?: string);
    get operator(): string;
    serialize(): string;
    toString(): string;
}
declare abstract class CSSTransformComponent {
    is2D: boolean;
    abstract toString(): string;
}
declare class CSSTranslate extends CSSTransformComponent {
    x: CSSNumericValue;
    y: CSSNumericValue;
    z?: CSSNumericValue;
    constructor(x: CSSNumericValue, y: CSSNumericValue, z?: CSSNumericValue);
    toString(): string;
}
declare class CSSScale extends CSSTransformComponent {
    x: CSSNumericValue;
    y: CSSNumericValue;
    z?: CSSNumericValue;
    constructor(x: CSSNumericValue, y: CSSNumericValue, z?: CSSNumericValue);
    toString(): string;
}
declare class CSSRotate extends CSSTransformComponent {
    x?: CSSNumericValue;
    y?: CSSNumericValue;
    z?: CSSNumericValue;
    angle: CSSNumericValue;
    constructor(angle: CSSNumericValue);
    constructor(x: CSSNumericValue, y: CSSNumericValue, z: CSSNumericValue, angle: CSSNumericValue);
    toString(): string;
}
declare class CSSSkew extends CSSTransformComponent {
    ax: CSSNumericValue;
    ay: CSSNumericValue;
    constructor(ax: CSSNumericValue, ay: CSSNumericValue);
    toString(): string;
}
declare class CSSSkewX extends CSSTransformComponent {
    ax: CSSNumericValue;
    constructor(ax: CSSNumericValue);
    toString(): string;
}
declare class CSSSkewY extends CSSTransformComponent {
    ay: CSSNumericValue;
    constructor(ay: CSSNumericValue);
    toString(): string;
}
declare class CSSPerspective extends CSSTransformComponent {
    length: CSSNumericValue | string | CSSKeywordValue;
    constructor(length: CSSNumericValue | string | CSSKeywordValue);
    toString(): string;
}
declare class CSSMatrixComponent extends CSSTransformComponent {
    matrix: DOMMatrixReadOnly;
    constructor(matrix: DOMMatrixReadOnly);
    toString(): string;
}
declare class CSSTransformValue extends CSSStyleValue {
    components: CSSTransformComponent[];
    constructor(components: CSSTransformComponent[]);
    get is2D(): boolean;
    toString(): string;
    static parse(css: string): CSSTransformValue;
}
declare class StylePropertyMapReadOnly {
    private declarations;
    constructor(declarations: Declaration[]);
    get(property: string): CSSStyleValue | null;
    protected _getForDecl(decl: Declaration): CSSStyleValue | null;
    has(property: string): boolean;
}
interface StyleLike {
    declarations: Declaration[];
    getPropertyValue(property: string): string;
    setProperty(property: string, value: string): void;
    removeProperty(property: string): void;
    length: number;
    item(index: number): string;
}
declare class StylePropertyMap extends StylePropertyMapReadOnly {
    private _style;
    constructor(style: StyleLike);
    get(property: string): CSSStyleValue | null;
    getAll(property: string): CSSStyleValue[];
    has(property: string): boolean;
    set(property: string, ...values: (CSSStyleValue | string)[]): void;
    append(property: string, ...values: (CSSStyleValue | string)[]): void;
    delete(property: string): void;
    clear(): void;
}

/**
 * CSS Token Types according to CSS Syntax Module Level 3.
 * @see https://drafts.csswg.org/css-syntax-3/#tokenization
 */
type TokenType = 'ident' | 'function' | 'at-keyword' | 'hash' | 'string' | 'bad-string' | 'url' | 'bad-url' | 'delim' | 'number' | 'percentage' | 'dimension' | 'whitespace' | 'CDO' | 'CDC' | 'colon' | 'semicolon' | 'comma' | '[' | ']' | '{' | '}' | '(' | ')' | 'comment' | 'unicode-range' | 'EOF';
interface Token {
    type: TokenType;
    value: string;
    unit?: string;
    numberType?: 'integer' | 'number';
    hashType?: 'id' | 'unrestricted';
    startIndex?: number;
    endIndex?: number;
    originalText?: string;
    unicodeRangeStart?: number;
    unicodeRangeEnd?: number;
}
interface TokenStream {
    next(): Token;
    peek(): Token;
}
type ComponentValue = Token | SimpleBlock | CSSFunction;
interface SimpleBlock {
    type: 'simple-block';
    associatedToken: Token;
    value: ComponentValue[];
}
interface CSSFunction {
    type: 'function';
    name: string;
    value: ComponentValue[];
}
interface Declaration {
    type: 'declaration';
    name: string;
    value: ComponentValue[];
    important: boolean;
}
interface ASTAtRule {
    type: 'at-rule';
    name: string;
    prelude: ComponentValue[];
    childRules?: (ASTAtRule | CSSRule$1)[];
    cssRules?: CSSRuleList$1;
    block?: SimpleBlock;
}
type Rule = ASTAtRule | CSSRule$1;
/**
 * CSSOM Interfaces according to CSSOM spec.
 * @see https://drafts.csswg.org/cssom-1/
 */
interface StyleSheet {
    readonly type: string;
    readonly href: string | null;
    readonly ownerNode: unknown | null;
    readonly parentStyleSheet: StyleSheet | null;
    readonly title: string | null;
    readonly media: unknown;
    disabled: boolean;
}
interface CSSStyleSheet$1 extends StyleSheet {
    readonly ownerRule: CSSRule$1 | null;
    readonly cssRules: CSSRuleList$1;
    insertRule(rule: string, index?: number): number;
    deleteRule(index: number): void;
    replace(text: string): Promise<CSSStyleSheet$1>;
    replaceSync(text: string): void;
}
interface CSSRuleList$1 {
    readonly length: number;
    item(index: number): CSSRule$1 | null;
    [index: number]: CSSRule$1;
}
interface CSSRule$1 {
    cssText: string;
    readonly parentRule: CSSRule$1 | null;
    readonly parentStyleSheet: CSSStyleSheet$1 | null;
    readonly type: number;
    readonly STYLE_RULE: number;
    readonly CHARSET_RULE: number;
    readonly IMPORT_RULE: number;
    readonly MEDIA_RULE: number;
    readonly FONT_FACE_RULE: number;
    readonly PAGE_RULE: number;
    readonly KEYFRAMES_RULE: number;
    readonly KEYFRAME_RULE: number;
    readonly MARGIN_RULE: number;
    readonly NAMESPACE_RULE: number;
    readonly COUNTER_STYLE_RULE: number;
    readonly SUPPORTS_RULE: number;
    readonly DOCUMENT_RULE: number;
    readonly FONT_FEATURE_VALUES_RULE: number;
    readonly VIEWPORT_RULE: number;
    readonly REGION_STYLE_RULE: number;
    readonly NESTED_DECLARATIONS_RULE: number;
    readonly PROPERTY_RULE: number;
    readonly CONTAINER_RULE: number;
}
/**
 * Structured Selector AST
 * @see https://drafts.csswg.org/selectors-4/#grammar
 */
interface SelectorList {
    type: 'selector-list';
    selectors: ComplexSelector[];
}
interface ComplexSelector {
    type: 'complex-selector';
    items: (CompoundSelector | Combinator)[];
    tokens: ComponentValue[];
}
type Combinator = {
    type: 'combinator';
    value: ' ' | '>' | '+' | '~' | '||';
};
interface CompoundSelector {
    type: 'compound-selector';
    selectors: SimpleSelector[];
}
type SimpleSelector = TypeSelector | UniversalSelector | IDSelector | ClassSelector | AttributeSelector | PseudoClassSelector | PseudoElementSelector;
interface TypeSelector {
    type: 'type-selector';
    name: string;
    namespace?: string;
}
interface UniversalSelector {
    type: 'universal-selector';
    namespace?: string;
}
interface IDSelector {
    type: 'id-selector';
    name: string;
}
interface ClassSelector {
    type: 'class-selector';
    name: string;
}
interface AttributeSelector {
    type: 'attribute-selector';
    name: string;
    namespace?: string;
    operator?: string;
    value?: string;
    flags?: string;
}
interface PseudoClassSelector {
    type: 'pseudo-class-selector';
    name: string;
    argument?: ComponentValue[] | SelectorList;
}
interface PseudoElementSelector {
    type: 'pseudo-element-selector';
    name: string;
    argument?: ComponentValue[];
}

declare class CSSStyleDeclaration {
    [index: number]: string;
    private _declarations;
    private _declMap;
    parentRule: CSSRule | null;
    constructor(declarations?: Declaration[]);
    private _addDeclaration;
    get declarations(): Declaration[];
    get length(): number;
    item(index: number): string;
    getPropertyValue(property: string): string;
    getPropertyPriority(property: string): string;
    private _getPropertyAliases;
    setProperty(property: string, value: string | null, priority?: string): void;
    removeProperty(property: string): string;
    get cssText(): string;
    set cssText(value: string);
    get cssFloat(): string;
    set cssFloat(value: string);
}
interface CSSStyleSheetInit {
    baseURL?: string;
    media?: MediaList | string;
    disabled?: boolean;
}
declare class StyleSheetList {
    private _sheets;
    constructor(sheets: CSSStyleSheet[]);
    get length(): number;
    item(index: number): CSSStyleSheet | null;
}
interface LinkStyle {
    readonly sheet: CSSStyleSheet | null;
}
declare class MediaList {
    private _mediaQueries;
    constructor(mediaText?: string);
    get mediaText(): string;
    set mediaText(value: string);
    get length(): number;
    item(index: number): string | null;
    appendMedium(medium: string): void;
    deleteMedium(medium: string): void;
}
declare class CSSStyleSheet {
    readonly type = "text/css";
    readonly href: string | null;
    readonly ownerNode: Node | null;
    readonly parentStyleSheet: CSSStyleSheet | null;
    readonly title: string | null;
    readonly media: MediaList;
    private _disabledFlag;
    readonly ownerRule: CSSRule | null;
    readonly cssRules: CSSRuleList;
    private _rules;
    private _parseRule;
    private _alternateFlag;
    private _originCleanFlag;
    private _constructedFlag;
    private _disallowModificationFlag;
    private _constructorDocument;
    private _baseURL;
    constructor(rulesOrOptions?: Rule[] | CSSStyleSheetInit, parseRuleOrNothing?: (text: string) => Rule);
    get disabled(): boolean;
    set disabled(value: boolean);
    replace(text: string): Promise<CSSStyleSheet>;
    replaceSync(text: string): void;
    insertRule(rule: string, index?: number): number;
    deleteRule(index: number): void;
}
declare class CSSRule {
    parentRule: CSSRule | null;
    parentStyleSheet: CSSStyleSheet | null;
    static readonly STYLE_RULE = 1;
    static readonly CHARSET_RULE = 2;
    static readonly IMPORT_RULE = 3;
    static readonly MEDIA_RULE = 4;
    static readonly FONT_FACE_RULE = 5;
    static readonly PAGE_RULE = 6;
    static readonly KEYFRAMES_RULE = 7;
    static readonly KEYFRAME_RULE = 8;
    static readonly MARGIN_RULE = 9;
    static readonly NAMESPACE_RULE = 10;
    static readonly COUNTER_STYLE_RULE = 11;
    static readonly SUPPORTS_RULE = 12;
    static readonly DOCUMENT_RULE = 13;
    static readonly FONT_FEATURE_VALUES_RULE = 14;
    static readonly VIEWPORT_RULE = 15;
    static readonly REGION_STYLE_RULE = 16;
    static readonly NESTED_DECLARATIONS_RULE = 17;
    static readonly PROPERTY_RULE = 18;
    static readonly CONTAINER_RULE = 19;
    get STYLE_RULE(): number;
    get CHARSET_RULE(): number;
    get IMPORT_RULE(): number;
    get MEDIA_RULE(): number;
    get FONT_FACE_RULE(): number;
    get PAGE_RULE(): number;
    get KEYFRAMES_RULE(): number;
    get KEYFRAME_RULE(): number;
    get MARGIN_RULE(): number;
    get NAMESPACE_RULE(): number;
    get COUNTER_STYLE_RULE(): number;
    get SUPPORTS_RULE(): number;
    get DOCUMENT_RULE(): number;
    get FONT_FEATURE_VALUES_RULE(): number;
    get VIEWPORT_RULE(): number;
    get REGION_STYLE_RULE(): number;
    get NESTED_DECLARATIONS_RULE(): number;
    get PROPERTY_RULE(): number;
    get CONTAINER_RULE(): number;
    get type(): number;
    get cssText(): string;
    set cssText(value: string);
}
declare class CSSRuleList {
    [index: number]: CSSRule;
    private _rules;
    constructor(rules: Rule[]);
    get length(): number;
    item(index: number): CSSRule | null;
}
declare class CSSGroupingRule extends CSSRule {
    cssRules: CSSRuleList;
    protected _rules: Rule[];
    private _parseRuleInBlock;
    constructor(rules: Rule[], parseRuleInBlock: (text: string) => Rule);
    insertRule(rule: string, index?: number): number;
    deleteRule(index: number): void;
}
declare class CSSStyleRule extends CSSGroupingRule {
    private _selectorText;
    private _selectorAST;
    private _style;
    styleMap: StylePropertyMapReadOnly;
    constructor(selectorText: string, styleDeclarations: Declaration[], rules: Rule[], parseRuleInBlock: (text: string) => Rule, selectorAST?: SelectorList | null);
    get style(): CSSStyleDeclaration;
    set style(value: string);
    get selectorText(): string;
    set selectorText(value: string);
    get selectorAST(): SelectorList | null;
    get type(): number;
    get cssText(): string;
    set cssText(_value: string);
}
declare class CSSMediaRule extends CSSGroupingRule {
    media: MediaList;
    constructor(mediaText: string, rules: Rule[], parseRuleInBlock: (text: string) => Rule);
    get type(): number;
    get cssText(): string;
    set cssText(_value: string);
}
declare class CSSSupportsRule extends CSSGroupingRule {
    conditionText: string;
    constructor(conditionText: string, rules: Rule[], parseRuleInBlock: (text: string) => Rule);
    get type(): number;
    get cssText(): string;
    set cssText(_value: string);
}
declare class CSSContainerRule extends CSSGroupingRule {
    containerQuery: string;
    constructor(containerQuery: string, rules: Rule[], parseRuleInBlock: (text: string) => Rule);
    get type(): number;
    get cssText(): string;
    set cssText(_value: string);
}
declare class CSSLayerBlockRule extends CSSGroupingRule {
    name: string;
    constructor(name: string, rules: Rule[], parseRuleInBlock: (text: string) => Rule);
    get type(): number;
    get cssText(): string;
    set cssText(_value: string);
}
declare class CSSLayerStatementRule extends CSSRule {
    nameList: string[];
    constructor(nameList: string[]);
    get type(): number;
    get cssText(): string;
    set cssText(_value: string);
}
declare class CSSStartingStyleRule extends CSSGroupingRule {
    constructor(_prelude: string, rules: Rule[], parseRuleInBlock: (text: string) => Rule);
    get type(): number;
    get cssText(): string;
    set cssText(_value: string);
}
declare class CSSViewTransitionRule extends CSSRule {
    navigation: string;
    constructor(declarations: Declaration[]);
    get type(): number;
    get cssText(): string;
    set cssText(_value: string);
}
declare class CSSKeyframesRule extends CSSRule {
    name: string;
    cssRules: CSSRuleList;
    private _rules;
    constructor(name: string, rules: Rule[]);
    get type(): number;
    get cssText(): string;
    set cssText(_value: string);
}
declare class CSSKeyframeRule extends CSSRule {
    keyText: string;
    style: CSSStyleDeclaration;
    constructor(keyText: string, styleDeclarations: Declaration[]);
    get type(): number;
    get cssText(): string;
    set cssText(_value: string);
}
declare class CSSNestedDeclarations extends CSSRule {
    style: CSSStyleDeclaration;
    constructor(styleDeclarations: Declaration[]);
    get type(): number;
    get cssText(): string;
    set cssText(_value: string);
}
declare class CSSFontFaceRule extends CSSRule {
    style: CSSStyleDeclaration;
    constructor(styleDeclarations: Declaration[]);
    get type(): number;
    get cssText(): string;
    set cssText(_value: string);
}
declare class CSSPageDescriptors extends CSSStyleDeclaration {
}
declare class CSSMarginDescriptors extends CSSStyleDeclaration {
}
declare class CSSMarginRule extends CSSRule {
    name: string;
    style: CSSMarginDescriptors;
    constructor(name: string, declarations: Declaration[]);
    get type(): number;
    get cssText(): string;
    set cssText(_value: string);
}
declare class CSSImportRule extends CSSRule {
    href: string;
    media: MediaList;
    styleSheet: CSSStyleSheet | null;
    layerName: string | null;
    supportsText: string | null;
    constructor(href: string, mediaText?: string, layerName?: string | null, supportsText?: string | null);
    get type(): number;
    get cssText(): string;
    set cssText(_value: string);
}
declare class CSSNamespaceRule extends CSSRule {
    namespaceURI: string;
    prefix: string;
    constructor(prefix: string, namespaceURI: string);
    get type(): number;
    get cssText(): string;
    set cssText(_value: string);
}
declare class CSSPageRule extends CSSGroupingRule {
    selectorText: string;
    style: CSSPageDescriptors;
    constructor(selectorText: string, declarations: Declaration[], rules: Rule[], parseRuleInBlock: (text: string) => Rule);
    get type(): number;
    get cssText(): string;
    set cssText(_value: string);
}
declare class CSSPropertyRule extends CSSRule {
    readonly name: string;
    readonly syntax: string;
    readonly inherits: boolean;
    readonly initialValue: string | null;
    constructor(name: string, syntax: string, inherits: boolean, initialValue: string | null);
    get type(): number;
    get cssText(): string;
    set cssText(_value: string);
}
declare class CSSUnknownRule extends CSSRule {
    name: string;
    prelude: unknown[];
    block?: unknown;
    childRules?: CSSRule[];
    constructor(name: string, prelude: unknown[], block?: unknown, childRules?: CSSRule[]);
    get type(): number;
    get cssText(): string;
}

/**
 * Skeleton Parser for CSSOM.
 * Implements top-level parsing algorithms from CSS Syntax Module Level 3.
 * @see https://drafts.csswg.org/css-syntax-3/#parsing
 */
declare class Parser {
    #private;
    private tokens;
    private atRuleHandlers;
    private isSupportedAtRule;
    constructor(tokens: TokenStream | Token[]);
    private get nextToken();
    private consumeToken;
    private discardToken;
    /**
     * Parse a list of component values.
     * @see https://drafts.csswg.org/css-syntax-3/#parse-a-list-of-component-values
     */
    parseComponentValues(): ComponentValue[];
    /**
     * Parse a stylesheet.
     * @see https://drafts.csswg.org/css-syntax-3/#parse-a-stylesheet
     */
    parseStyleSheet(): CSSStyleSheet;
    parseRule(ruleString: string): Rule | null;
    /**
     * Parse a list of declarations (style attribute value).
     * @see https://drafts.csswg.org/css-syntax-3/#parse-a-list-of-declarations
     */
    parseStyleAttribute(): CSSStyleDeclaration;
    /**
     * Consume a list of rules.
     * @see https://drafts.csswg.org/css-syntax-3/#consume-list-of-rules
     */
    consumeListOfRules(topLevel: boolean): Rule[];
    /**
     * Consume a rule.
     * @see https://drafts.csswg.org/css-syntax-3/#consume-rule
     * // 5.4.6 https://drafts.csswg.org/css-syntax/#parse-rule
     */
    consumeRule(nested?: boolean): Rule | null;
    /**
     * Consume an at-rule.
     * @see https://drafts.csswg.org/css-syntax-3/#consume-at-rule
     */
    private consumeAtRule;
    private consumeListOfRulesFromValues;
    private consumeNestedRules;
    private handleMediaRule;
    private handleGroupingAtRule;
    private handleLayerRule;
    private handleViewTransitionRule;
    private handleKeyframesRule;
    private handleFontFaceRule;
    private handlePageRule;
    private handleMarginRule;
    private handlePropertyRule;
    private handleImportRule;
    private handleNamespaceRule;
    /**
     * Consume a qualified rule.
     * @see https://drafts.csswg.org/css-syntax-3/#consume-qualified-rule
     */
    private consumeQualifiedRule;
    /**
     * Consume a list of declarations.
     * @see https://drafts.csswg.org/css-syntax-3/#consume-list-of-declarations
     */
    consumeDeclarationsFromBlockContents(values: ComponentValue[]): Declaration[];
    /**
     * Consume a block's contents.
     * @see https://drafts.csswg.org/css-syntax/#consume-block-contents
     * // 5.5.5 https://drafts.csswg.org/css-syntax/#consume-block-contents
     */
    private consumeBlockContents;
    private consumeDeclarationFromValues;
    private getOriginalText;
    private validateCustomPropertyValue;
    private consumeNestedQualifiedRuleFromValues;
    private consumeAtRuleFromValues;
    private isValidSelector;
    private createStyleRule;
    static parseSelectorAST(text: string): SelectorList | null;
    private normalizeNestedSelector;
    /**
     * Consume a simple block.
     * @see https://drafts.csswg.org/css-syntax-3/#consume-block
     */
    private consumeBlock;
    /**
     * Consume a function.
     * @see https://drafts.csswg.org/css-syntax-3/#consume-function
     */
    private consumeFunction;
    private getMirrorToken;
    /**
     * Consume a component value.
     * @see https://drafts.csswg.org/css-syntax-3/#consume-component-value
     */
    consumeComponentValue(): ComponentValue;
    static parseSelector(text: string): string | null;
    static parseRuleText(text: string): Rule;
    static parseStyleSheetText(text: string): Rule[];
    static parseRuleInBlockText(text: string): Rule;
    static calculateSpecificity(selector: string | SelectorList): [number, number, number];
    static getCascadedStyle(element: unknown, rules: Rule[]): Record<string, string>;
    /**
     * Resolves a CSS value string by expanding var() functions using the provided style declaration.
     * @see https://drafts.csswg.org/css-variables-1/#using-variables
     */
    static resolveVariables(style: CSSStyleDeclaration, property: string, envMap?: Record<string, string>): string;
}

declare function tokenize(input: string, unicodeRangesAllowed?: boolean): Token[];

declare function serialize(nodes: ComponentValue[], preserveCase?: boolean): string;

declare abstract class AbstractTokenizer {
    unicodeRangesAllowed: boolean;
    protected abstract get cp(): number;
    protected abstract peek(offset: number): number;
    protected abstract consume(): number;
    protected abstract reconsume(): void;
    protected abstract slice(start: number, end: number): string;
    protected abstract getPosition(): number;
    protected consumeToken(): Token;
    protected consumeComments(): void;
    protected consumeNumericToken(): Token;
    protected consumeIdentLikeToken(): Token;
    protected consumeStringToken(endingCodePoint: number): Token;
    protected consumeUrlToken(): Token;
    protected consumeEscapedCodePoint(): number;
    protected isValidEscape(cp1: number, cp2: number): boolean;
    protected wouldStartIdentSequence(cp1: number, cp2: number, cp3: number): boolean;
    protected wouldStartNumber(cp1: number, cp2: number, cp3: number): boolean;
    protected consumeIdentSequence(): string;
    protected consumeNumber(): {
        value: number;
        type: 'integer' | 'number';
    };
    protected consumeRemnantsOfBadUrl(): void;
    protected wouldStartUnicodeRange(cp1: number, cp2: number, cp3: number): boolean;
    protected consumeUnicodeRangeToken(): Token;
    protected startsComment(): boolean;
    protected isWhitespace(cp: number): boolean;
    protected isNewline(cp: number): boolean;
    protected isDigit(cp: number): boolean;
    protected isHexDigit(cp: number): boolean;
    protected isIdentStartCodePoint(cp: number): boolean;
    protected isIdentCodePoint(cp: number): boolean;
    protected isNonAsciiIdentCodePoint(cp: number): boolean;
    protected isNonPrintable(cp: number): boolean;
}

declare class StreamingTokenizer extends AbstractTokenizer {
    private codePoints;
    private pos;
    private isEOF;
    private tokens;
    private remnant;
    constructor();
    appendChunk(chunk: string): void;
    close(): void;
    getTokens(): Token[];
    private preprocessChunk;
    private tokenizeLoop;
    protected get cp(): number;
    protected peek(offset: number): number;
    protected consume(): number;
    protected reconsume(): void;
    protected slice(start: number, end: number): string;
    protected getPosition(): number;
}

export { type ASTAtRule, CSS, CSSContainerRule, CSSFontFaceRule, type CSSFunction, CSSGroupingRule, CSSImportRule, CSSKeyframeRule, CSSKeyframesRule, CSSKeywordValue, CSSLayerBlockRule, CSSLayerStatementRule, CSSMarginDescriptors, CSSMarginRule, CSSMathClamp, CSSMathExpression, CSSMathInvert, CSSMathMax, CSSMathMin, CSSMathNegate, CSSMathProduct, CSSMathSum, CSSMathValue, CSSMatrixComponent, CSSMediaRule, CSSNamespaceRule, CSSNestedDeclarations, CSSNumericNode, CSSNumericValue, CSSPageDescriptors, CSSPageRule, CSSParserAtRule, CSSParserBlock, CSSParserDeclaration, CSSParserFunction, type CSSParserOptions, CSSParserQualifiedRule, CSSParserRule, CSSParserValue, CSSPerspective, CSSPropertyRule, CSSRotate, CSSRule, CSSRuleList, CSSScale, CSSSkew, CSSSkewX, CSSSkewY, CSSStartingStyleRule, CSSStyleDeclaration, CSSStyleRule, CSSStyleSheet, type CSSStyleSheetInit, CSSStyleValue, CSSSupportsRule, type CSSToken, CSSTransformComponent, CSSTransformValue, CSSTranslate, type CSSUnit, CSSUnitValue, CSSUnknownRule, CSSUnparsedValue, CSSVariableReferenceValue, CSSViewTransitionRule, type ComponentValue, type DOMMatrixReadOnly, type Declaration, type LinkStyle, MediaList, Parser, type Rule, type SimpleBlock, StreamingTokenizer, StylePropertyMap, StylePropertyMapReadOnly, StyleSheetList, type Token, type TokenType, createCSSStyleValue, parseCommaValueListSync, parseDeclarationList, parseDeclarationListSync, parseDeclarationSync, parseRule, parseRuleList, parseRuleListSync, parseRuleSync, parseStylesheet, parseStylesheetSync, parseValueListSync, parseValueSync, serialize, tokenize };
