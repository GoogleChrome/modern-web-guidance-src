# Skills Source

This directory contains standalone and discipline-level skill implementations. These skills are processed by the build pipeline based on explicit configuration.

## How to Use

Create a subdirectory for your skill and add a `SKILL.md` file.

```
skills-src/
  my-skill/
    SKILL.md
```

Every `SKILL.md` file should start with `name` and `description` in the frontmatter, where the `name` is required to match the subdirectory name.

For help creating the contents of the skill, see the [`skill-creator`](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md?plain=1) skill.

There may only be one `SKILL.md` file per skill directory, however additional resources or examples could be added in a `resources` or `examples` subdirectory. For example:

```
skills-src/
  my-skill/
    SKILL.md
    resources/
      my-skill-1.txt
      my-skill-2.txt
    examples/
      demo.html
      demo.js
      demo.css
```
