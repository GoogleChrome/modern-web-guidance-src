---
description: Choose appropriate easing and animation durations for your project to create a responsive and enjoyable user experience.
filename: animation-easing-and-duration
category: ui
---

# Choosing the Right Animation Easing and Duration

When designing animations for your projects, selecting the correct easing function and duration is crucial for achieving a responsive, polished, and enjoyable user experience. This guide outlines best practices for making these choices.

## Best Practices for Easing

Easing functions control the acceleration and deceleration of animations, influencing how they feel to the user.

*   **Use `ease-out` for UI elements:** Generally, `ease-out` animations provide a good default. They start quickly, giving a sense of responsiveness, and slow down smoothly at the end. A **Quintic ease-out** is often a good choice for its pleasant, albeit quick, effect.
*   **Use other easing types sparingly:** Bounces or elastic eases can be engaging but should be reserved for projects where a playful or lighthearted tone is appropriate. In most UI contexts, they can be jarring and detract from the user experience.
*   **Consider aggressiveness:** Beyond the standard `ease-out`, there are various `ease-out` equations with different "aggressiveness." For a faster feel, explore options like **Quintic ease-out**.
*   **Refer to easing resources:** For a comprehensive understanding and visual examples of different easing types, consult resources like [easings.net](http://easings.net).

## Best Practices for Animation Duration

The duration of an animation significantly impacts its perceived quality.

*   **Ease-outs and Ease-ins:** Aim for durations between **200ms and 500ms**. This range allows users to perceive the animation without it feeling obstructive. Be mindful that ease-ins will have a distinct "jolt" at the end, which timing alone cannot fully mitigate.
*   **Bounce or Elastic effects:** These types of animations require longer durations, typically **800ms to 1200ms**. This extra time allows the elastic or bounce effect to "settle" naturally, preventing it from appearing aggressive or unpleasant.

## Summary of Recommendations

*   **General UI Animations:** `ease-out`, 200ms-500ms.
*   **Playful/Expressive Animations:** Bounces or elastic eases, 800ms-1200ms.

Experiment with different easing functions and durations to find what best suits your project's personality and user interface needs.

<figure>
<img src="image/a-quintic-ease-animation-cea056c19527.png" alt="A Quintic ease-out animation curve." width="640" height="600">
<figcaption>An example of a Quintic ease-out animation curve, illustrating its acceleration and deceleration.</figcaption>
</figure>

[See a Quintic ease-out animation](https://googlesamples.github.io/web-fundamentals/fundamentals/design-and-ux/animations/box-move-quintic-ease-out.html)