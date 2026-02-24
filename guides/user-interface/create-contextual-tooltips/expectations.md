1. The tooltip element must be hidden on page load and promoted to the Top Layer when shown, preventing clipping by parent containers.
2. The tooltip must be triggered declaratively using the `interestfor` attribute on the invoker element, with no manual `mouseenter`/`mouseleave` JavaScript event listeners.
3. The `interestfor` polyfill must be loaded to provide equivalent hover/focus tooltip behavior in browsers that do not natively support the Interest Invoker API.
4. The tooltip must be positioned relative to its trigger button using CSS anchor positioning if possible, given browser support.
5. If `popover=hint` is supported: showing the tooltip must not close an already open `popover="auto"` menu on the same page. If it is not supported, use a `popover=auto`.
6. The tooltip must automatically flip to the opposite side of the anchor if the default position would cause it to go off-screen, using `position-area: flip-block` or `position-area: flip-inline`. This also requires the CSS anchor positioning API.
7. If you have a series of tooltips, such as in an action bar remove the animation delay when you enter the tooltip set.