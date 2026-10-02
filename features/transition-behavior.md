# CSS `transition-behavior`

## Fallbacks

{{ BASELINE_STATUS("transition-behavior", "css.properties.transition-behavior.transitionable_display") }}

Firefox 129+ parses `transition-behavior: allow-discrete` (`CSS.supports('transition-behavior', 'allow-discrete')` returns `true`) without actually transitioning the `display` property (Firefox bug 1882408), causing elements to disappear immediately on exit.

To reliably detect discrete `display` transition support, probe whether a temporary element's computed `display` remains visible when transitioned to `none` rather than relying solely on `CSS.supports('transition-behavior', 'allow-discrete')`:

```javascript
let supportsDisplayTransition;
function canTransitionDisplay() {
  if (supportsDisplayTransition !== undefined) return supportsDisplayTransition;
  if (!window.CSS?.supports?.('transition-behavior', 'allow-discrete') || !document.body) {
    return false;
  }
  const probe = document.createElement('div');
  // The shorthand is intentional here: browsers that don't parse allow-discrete
  // drop the whole declaration, so display: none applies instantly and the probe
  // correctly returns false. !important guards against global reduced-motion
  // resets like `* { transition: none !important }`.
  probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  getComputedStyle(probe).display;
  probe.style.display = 'none';
  supportsDisplayTransition = getComputedStyle(probe).display === 'block';
  probe.remove();
  return supportsDisplayTransition;
}
```
