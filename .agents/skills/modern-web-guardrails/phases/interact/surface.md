# Command: surface

Surfaces baseline conflicts to the developer one at a time.

## Purpose
To prompt the developer to reconcile issues interactively.

## Questions Layout
Format each prompt exactly:

```
⚠️ CONFLICT [Type N of M]: <label>

  <file A>  →  <tool>  →  <rule>: <setting-A>
  <file B>  →  <tool>  →  <rule>: <setting-B>

  Which should be authoritative?
    A) <file A> wins — update <file B> to match
    B) <file B> wins — update <file A> to match
    C) Keep both as-is — divergence is intentional
    D) Explain the concrete browser coverage difference
```
Wait for input before showing the next conflict.
