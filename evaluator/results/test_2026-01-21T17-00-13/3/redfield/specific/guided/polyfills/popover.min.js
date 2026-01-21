var d=class extends Event{oldState;newState;constructor(t,{oldState:o="",newState:r="",...i}={}){super(t,i),this.oldState=String(o||""),this.newState=String(r||"")}},W=new WeakMap;function x(e,t,o){W.set(e,setTimeout(()=>{W.has(e)&&e.dispatchEvent(new d("toggle",{cancelable:!1,oldState:t,newState:o}))},0))}var R=globalThis.ShadowRoot||function(){},J=globalThis.HTMLDialogElement||function(){},b=new WeakMap,f=new WeakMap,c=new WeakMap,v=new WeakMap;function y(e){return v.get(e)||"hidden"}var H=new WeakMap;function M(e){return[...e].pop()}function V(e){let t=e.popoverTargetElement;if(!(t instanceof HTMLElement))return;let o=y(t);e.popoverTargetAction==="show"&&o==="showing"||e.popoverTargetAction==="hide"&&o==="hidden"||(o==="showing"?E(t,!0,!0):g(t,!1)&&(H.set(t,e),k(t)))}function g(e,t){return!(e.popover!=="auto"&&e.popover!=="manual"&&e.popover!=="hint"||!e.isConnected||t&&y(e)!=="showing"||!t&&y(e)!=="hidden"||e instanceof J&&e.hasAttribute("open")||document.fullscreenElement===e)}function q(e){if(!e)return 0;let t=f.get(document)||new Set,o=c.get(document)||new Set;return o.has(e)?[...o].indexOf(e)+t.size+1:t.has(e)?[...t].indexOf(e)+1:0}function X(e){let t=U(e),o=Y(e);return q(t)>q(o)?t:o}function S(e){let t,o=c.get(e)||new Set,r=f.get(e)||new Set,i=o.size>0?o:r.size>0?r:null;return i?(t=M(i),t.isConnected?t:(i.delete(t),S(e))):null}function j(e){for(let t of e||[])if(!t.isConnected)e.delete(t);else return t;return null}function m(e){return typeof e.getRootNode=="function"?e.getRootNode():e.parentNode?m(e.parentNode):e}function U(e){for(;e;){if(e instanceof HTMLElement&&e.popover==="auto"&&v.get(e)==="showing")return e;if(e=e instanceof Element&&e.assignedSlot||e.parentElement||m(e),e instanceof R&&(e=e.host),e instanceof Document)return}}function Y(e){for(;e;){let t=e.popoverTargetElement;if(t instanceof HTMLElement)return t;if(e=e.parentElement||m(e),e instanceof R&&(e=e.host),e instanceof Document)return}}function z(e,t){let o=new Map,r=0;for(let a of t||[])o.set(a,r),r+=1;o.set(e,r),r+=1;let i=null;function l(a){if(!a)return;let p=!1,n=null,s=null;for(;!p;){if(n=U(a)||null,n===null||!o.has(n))return;(e.popover==="hint"||n.popover==="auto")&&(p=!0),p||(a=n.parentElement)}s=o.get(n),(i===null||o.get(i)<s)&&(i=n)}return l(e.parentElement||m(e)),i}function Z(e){return e.hidden||e instanceof R||(e instanceof HTMLButtonElement||e instanceof HTMLInputElement||e instanceof HTMLSelectElement||e instanceof HTMLTextAreaElement||e instanceof HTMLOptGroupElement||e instanceof HTMLOptionElement||e instanceof HTMLFieldSetElement)&&e.disabled||e instanceof HTMLInputElement&&e.type==="hidden"||e instanceof HTMLAnchorElement&&e.href===""?!1:typeof e.tabIndex=="number"&&e.tabIndex!==-1}function ee(e){if(e.shadowRoot&&e.shadowRoot.delegatesFocus!==!0)return null;let t=e;t.shadowRoot&&(t=t.shadowRoot);let o=t.querySelector("[autofocus]");if(o)return o;{let l=t.querySelectorAll("slot");for(let a of l){let p=a.assignedElements({flatten:!0});for(let n of p){if(n.hasAttribute("autofocus"))return n;if(o=n.querySelector("[autofocus]"),o)return o}}}let r=e.ownerDocument.createTreeWalker(t,NodeFilter.SHOW_ELEMENT),i=r.currentNode;for(;i;){if(Z(i))return i;i=r.nextNode()}}function te(e){var t;(t=ee(e))==null||t.focus()}var P=new WeakMap;function k(e){if(!g(e,!1))return;let t=e.ownerDocument;if(!e.dispatchEvent(new d("beforetoggle",{cancelable:!0,oldState:"closed",newState:"open"}))||!g(e,!1))return;let o=!1,r=e.popover,i=null,l=z(e,f.get(t)||new Set),a=z(e,c.get(t)||new Set);if(r==="auto"&&(O(c.get(t)||new Set,o,!0),h(l||t,o,!0),i="auto"),r==="hint"&&(a?(h(a,o,!0),i="hint"):(O(c.get(t)||new Set,o,!0),l?(h(l,o,!0),i="auto"):i="hint")),r==="auto"||r==="hint"){if(r!==e.popover||!g(e,!1))return;S(t)||(o=!0),i==="auto"?(f.has(t)||f.set(t,new Set),f.get(t).add(e)):i==="hint"&&(c.has(t)||c.set(t,new Set),c.get(t).add(e))}P.delete(e);let p=t.activeElement;e.classList.add(":popover-open"),v.set(e,"showing"),b.has(t)||b.set(t,new Set),b.get(t).add(e),$(H.get(e),!0),te(e),o&&p&&e.popover==="auto"&&P.set(e,p),x(e,"closed","open")}function E(e,t=!1,o=!1){var p,n;if(!g(e,!0))return;let r=e.ownerDocument;if(["auto","hint"].includes(e.popover)&&(h(e,t,o),!g(e,!0)))return;let i=f.get(r)||new Set,l=i.has(e)&&M(i)===e;if($(H.get(e),!1),H.delete(e),o&&(e.dispatchEvent(new d("beforetoggle",{oldState:"open",newState:"closed"})),l&&M(i)!==e&&h(e,t,o),!g(e,!0)))return;(p=b.get(r))==null||p.delete(e),i.delete(e),(n=c.get(r))==null||n.delete(e),e.classList.remove(":popover-open"),v.set(e,"hidden"),o&&x(e,"open","closed");let a=P.get(e);a&&(P.delete(e),t&&a.focus())}function oe(e,t=!1,o=!1){let r=S(e);for(;r;)E(r,t,o),r=S(e)}function O(e,t=!1,o=!1){let r=j(e);for(;r;)E(r,t,o),r=j(e)}function K(e,t,o,r){let i=!1,l=!1;for(;i||!l;){l=!0;let a=null,p=!1;for(let n of t)if(n===e)p=!0;else if(p){a=n;break}if(!a)return;for(;y(a)==="showing"&&t.size;)E(M(t),o,r);t.has(e)&&M(t)!==e&&(i=!0),i&&(r=!1)}}function h(e,t,o){var i,l;let r=e.ownerDocument||e;if(e instanceof Document)return oe(r,t,o);if((i=c.get(r))!=null&&i.has(e)){K(e,c.get(r),t,o);return}O(c.get(r)||new Set,t,o),(l=f.get(r))!=null&&l.has(e)&&K(e,f.get(r),t,o)}var D=new WeakMap;function N(e){if(!e.isTrusted)return;let t=e.composedPath()[0];if(!t)return;let o=t.ownerDocument;if(!S(o))return;let i=X(t);if(i&&e.type==="pointerdown")D.set(o,i);else if(e.type==="pointerup"){let l=D.get(o)===i;D.delete(o),l&&h(i||o,!1,!0)}}var I=new WeakMap;function $(e,t=!1){if(!e)return;I.has(e)||I.set(e,e.getAttribute("aria-expanded"));let o=e.popoverTargetElement;if(o instanceof HTMLElement&&o.popover==="auto")e.setAttribute("aria-expanded",String(t));else{let r=I.get(e);r?e.setAttribute("aria-expanded",r):e.removeAttribute("aria-expanded")}}var G=globalThis.ShadowRoot||function(){};function Q(){return typeof HTMLElement<"u"&&typeof HTMLElement.prototype=="object"&&"popover"in HTMLElement.prototype}function w(e,t,o){let r=e[t];Object.defineProperty(e,t,{value(i){return r.call(this,o(i))}})}var ne=/(^|[^\\]):popover-open\b/g;function re(){return typeof globalThis.CSSLayerBlockRule=="function"}function ie(){let e=re();return`
${e?"@layer popover-polyfill {":""}
  :where([popover]) {
    position: fixed;
    z-index: 2147483647;
    inset: 0;
    padding: 0.25em;
    width: fit-content;
    height: fit-content;
    border-width: initial;
    border-color: initial;
    border-image: initial;
    border-style: solid;
    background-color: canvas;
    color: canvastext;
    overflow: auto;
    margin: auto;
  }

  :where([popover]:not(.\\:popover-open)) {
    display: none;
  }

  :where(dialog[popover].\\:popover-open) {
    display: block;
  }

  :where(dialog[popover][open]) {
    display: revert;
  }

  :where([anchor].\\:popover-open) {
    inset: auto;
  }

  :where([anchor]:popover-open) {
    inset: auto;
  }

  @supports not (background-color: canvas) {
    :where([popover]) {
      background-color: white;
      color: black;
    }
  }

  @supports (width: -moz-fit-content) {
    :where([popover]) {
      width: -moz-fit-content;
      height: -moz-fit-content;
    }
  }

  @supports not (inset: 0) {
    :where([popover]) {
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
    }
  }
${e?"}":""}
`}var T=null;function F(e){let t=ie();if(T===null)try{T=new CSSStyleSheet,T.replaceSync(t)}catch{T=!1}if(T===!1){let o=document.createElement("style");o.textContent=t,e instanceof Document?e.head.prepend(o):e.prepend(o)}else e.adoptedStyleSheets=[T,...e.adoptedStyleSheets]}function _(){if(typeof window>"u")return;window.ToggleEvent=window.ToggleEvent||d;function e(n){return n!=null&&n.includes(":popover-open")&&(n=n.replace(ne,"$1.\\:popover-open")),n}w(Document.prototype,"querySelector",e),w(Document.prototype,"querySelectorAll",e),w(Element.prototype,"querySelector",e),w(Element.prototype,"querySelectorAll",e),w(Element.prototype,"matches",e),w(Element.prototype,"closest",e),w(DocumentFragment.prototype,"querySelectorAll",e),Object.defineProperties(HTMLElement.prototype,{popover:{enumerable:!0,configurable:!0,get(){if(!this.hasAttribute("popover"))return null;let n=(this.getAttribute("popover")||"").toLowerCase();return n===""||n=="auto"?"auto":n=="hint"?"hint":"manual"},set(n){n===null?this.removeAttribute("popover"):this.setAttribute("popover",n)}},showPopover:{enumerable:!0,configurable:!0,value(n={}){k(this)}},hidePopover:{enumerable:!0,configurable:!0,value(){E(this,!0,!0)}},togglePopover:{enumerable:!0,configurable:!0,value(n={}){return typeof n=="boolean"&&(n={force:n}),v.get(this)==="showing"&&n.force===void 0||n.force===!1?E(this,!0,!0):(n.force===void 0||n.force===!0)&&k(this),v.get(this)==="showing"}}});let t=Element.prototype.attachShadow;t&&Object.defineProperties(Element.prototype,{attachShadow:{enumerable:!0,configurable:!0,writable:!0,value(n){let s=t.call(this,n);return F(s),s}}});let o=HTMLElement.prototype.attachInternals;o&&Object.defineProperties(HTMLElement.prototype,{attachInternals:{enumerable:!0,configurable:!0,writable:!0,value(){let n=o.call(this);return n.shadowRoot&&F(n.shadowRoot),n}}});let r=new WeakMap;function i(n){Object.defineProperties(n.prototype,{popoverTargetElement:{enumerable:!0,configurable:!0,set(s){if(s===null)this.removeAttribute("popovertarget"),r.delete(this);else if(s instanceof Element)this.setAttribute("popovertarget",""),r.set(this,s);else throw new TypeError("popoverTargetElement must be an element or null")},get(){if(this.localName!=="button"&&this.localName!=="input"||this.localName==="input"&&this.type!=="reset"&&this.type!=="image"&&this.type!=="button"||this.disabled||this.form&&this.type==="submit")return null;let s=r.get(this);if(s&&s.isConnected)return s;if(s&&!s.isConnected)return r.delete(this),null;let u=m(this),L=this.getAttribute("popovertarget");return(u instanceof Document||u instanceof G)&&L&&u.getElementById(L)||null}},popoverTargetAction:{enumerable:!0,configurable:!0,get(){let s=(this.getAttribute("popovertargetaction")||"").toLowerCase();return s==="show"||s==="hide"?s:"toggle"},set(s){this.setAttribute("popovertargetaction",s)}}})}i(HTMLButtonElement),i(HTMLInputElement);let l=n=>{if(n.defaultPrevented)return;let s=n.composedPath(),u=s[0];if(!(u instanceof Element)||u!=null&&u.shadowRoot)return;let L=m(u);if(!(L instanceof G||L instanceof Document))return;let B=s.find(A=>{var C;return(C=A.matches)==null?void 0:C.call(A,"[popovertargetaction],[popovertarget]")});if(B){V(B),n.preventDefault();return}},a=n=>{let s=n.key,u=n.target;!n.defaultPrevented&&u&&(s==="Escape"||s==="Esc")&&h(u.ownerDocument,!0,!0)};(n=>{n.addEventListener("click",l),n.addEventListener("keydown",a),n.addEventListener("pointerdown",N),n.addEventListener("pointerup",N)})(document),F(document)}Q()||_();
//# sourceMappingURL=popover.min.js.map
