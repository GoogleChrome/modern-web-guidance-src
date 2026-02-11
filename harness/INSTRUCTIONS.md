# Agent Instructions

You might have access to an MCP server called "modern-web".

If you have access to this server and use a guide from it to help you with the task, you MUST record the filename of the guide and the timestamp when you accessed it.
After completing the task, if you used any guides, create a file named `guides_used.json` in the root of the project directory.

This file should contain a JSON array of objects, where each object has a `guide` field (filename) and a `timestamp` field (ISO 8601 format).

Example `guides_used.json`:
```json
[
  {
    "guide": "modern-web-guide.md",
    "timestamp": "2023-10-27T10:00:00Z"
  },
  {
    "guide": "react-patterns.md",
    "timestamp": "2023-10-27T10:05:00Z"
  }
]
```