# Skills Drafts

This directory contains experimental skill implementations that are not yet ready for production use. These skills will not be included in any of the evals or used in production unless they are moved to the `skills` directory.

## How to Use

Create a subdirectory for your skill and add a `SKILL.md` file.

```
skills-drafts/
  my-skill/
    SKILL.md
```

Every `SKILL.md` file should start with `name` and `description` in the frontmatter, where the `name` is required to match the subdirectory name.

For help creating the contents of the skill, see the [`skill-creator`](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md?plain=1) skill.

There may only be one `SKILL.md` file per skill directory, however additional resources or examples could be added in a `resources` or `examples` subdirectory. For example:

```
skills-drafts/
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
