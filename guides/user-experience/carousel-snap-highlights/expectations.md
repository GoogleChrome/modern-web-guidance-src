* The carousel container has `scroll-snap-type: inline mandatory` (or `x mandatory`) applied.
* Each carousel item has `container-type: scroll-state` applied.
* The carousel container has `overflow-x: auto` or `overflow-inline: auto`.
* The `.card` element inside a snapped `.carousel-item` has a blue background (`rgb(0, 123, 255)`).
* The `.card` element inside a snapped `.carousel-item` is scaled up to `1.15`.
* The `.card` element inside a snapped `.carousel-item` has a box shadow applied.
* The highlight effects (scale, background, shadow) are NOT applied when the user prefers reduced motion.
* When the carousel is scrolled so a different item is snapped, the highlight styles move to the new snapped item's card.
* Non-snapped items remain in their default state (grey background, no scale)
* If scroll-state is not supported, the `.is-snapped` class is correctly toggled by JavaScript.
