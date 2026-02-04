## containment recap

 - `none` (default)
 - `layout`, `paint`, `style` - the easy ones.
   - `content` ===   these three
   - bonus benefit of `contain: layout` -- any `pos:fixed` children will be relative to it.
 - `size` - harder. the element must define its own size, can't rely on laying out its children.
   - `strict`  === `content + size`
   - `inline-size` - dunno? size but for display:inline-ish things?


--------------------


## `content-visibility` recap

`content-visibility: auto` is like a `rendering=lazy` .. or it's like the `<script defer` of rendering.

If you're familiar with css containment... `content-vis: auto` can be interpreted as  `contain: content-for-inviewport-and-strict-when-outofviewport`. 

It implicitly applies `contain: content` but then as long as the elements contents are out of viewport (aka not visible) and not focused/selected, then it'll upgrade that to `contain: strict` (adding size containment).  When the element is scrolled into viewport, the `contain: content` still applies. (Also other bonus: this stuff remains in A11y tree, unlike `vis:hidden` elements)

#### How do we use it?
Generally, we apply `content-vis:auto` to elements that hold much of the page's content and continue down the page in the non-visible area. That's when the perf benefit kicks in.

Ask.. what are the DOM islands that hold the content. These islands must continue beyond the viewport for this to be useful. Articles, cards, etc are good targets to for `content-vis: auto`;

#### Contain-intrinsic- sizes
The `contain-instrinsic-(size/width/height/block-size/inline-size)` props are needed when **size** containment is on.
They mostly assist for `content-vis: auto`, IMO.  (Yes, it feels confusing that they aren't named `content-visibilility-intrinsic-size` but... feel free to think of it like that.) As elements off-screen get size containment. these properties often are used to define the height, so that the page scrollbar is reasonable and not jumpy.

If these sizes are wrong, once the element is actually rendered, the browser will use the new/real sizes from then on out.

In the spec, there's also `container-name` and `container-type`.. but they're for container queries.

#### `content-vis: hidden`
Using `content-visibility: hidden`  is like `display:none` but..  stronger.   Strict containment is applied but no painting and no ability receive clicks, etc.  Used when you want to hide something (an offscreen nav or inactive app views), but want to reuse the cached rendering state when it reappears.

------------


@tunetheweb wants examples. 

Like if you use `height: 300px; overflow: none;` then you know nothing overflows that height and so you can safely use `contains: size`

Also wtf is the difference between layout and size

and is content-vis just a shorthand for contain?

@paulirish:  why does `style` not do what we think it should

could tldr it with:

> use `c-v:auto` on your major blocks of content that extend past the viewport.  also apply `contain-intrinsic-size: auto <their-estimated-height>px` to them.

and then introduce all the concepts after that.

