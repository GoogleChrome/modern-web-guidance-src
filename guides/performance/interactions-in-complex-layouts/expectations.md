# Expectations: `interactions-in-complex-layouts`

- Target column elements must have `content-visibility: auto` applied in their computed styles.
- Target column elements must have a non-zero `contain-intrinsic-size` specified.
- If `content-visibility` is not supported, target column elements should have `contain: layout style paint` (or similar) applied to provide partial layout isolation.
