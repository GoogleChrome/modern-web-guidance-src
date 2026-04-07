---
base_app: daily-grind
---
- Add a scrollytelling section inside the main container. Use `#tracked` for the container of the scrollable text sections (each as a `section` element), and `#animated` for the container of the animated elements (each as a `section` element). I want the elements in `#animated` to reveal based on the scroll position of the corresponding text sections in `#tracked`, even though they are in different DOM branches. Ensure it works without using JavaScript and is performant.
- build a scrollytelling feature right under the hero section where reading through some new paragraphs triggers fade animations on elements in a totally different part of the dom, without using javascript.
- implement a cool scroll effect where scrolling past the 3 seasonal favorite cards drives an animation on a sticky element elsewhere on the page.