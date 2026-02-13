# Agent Instructions

You might have access to an MCP server called "modern-web".

If you have access to this server and use a guide from it to help you with the task, you MUST record the filename of the guide and the timestamp when you accessed it.

Additionally, you might have access to (Agent) skills, which contain resources. If you activate a skill, you MUST record the name of the skill and the timestamp when you accessed it. If the skill uses a specific resource, you MUST record the name of the resource and the timestamp when you accessed it.

After completing the task, if you used any MCP servers OR skills, create a file named `resources_used.json` in the root of the project directory.

This file should contain a JSON array of objects, where each object has a `name` field (name of the resource), `source` field (MCP server name, `skills`, or skill resource path), and a `timestamp` field (ISO 8601 format).

Example `resources_used.json`:
```json
[
  {
    "name": "resource.md",
    "source": "modern-web",
    "timestamp": "2023-10-27T10:00:00Z"
  },
  {
    "name": "skill-name",
    "source": "skills",
    "timestamp": "2023-10-27T10:05:00Z"
  },
  {
    "name": "skill-resource.md",
    "source": "skill-name/resource_folder",
    "timestamp": "2023-10-27T10:10:00Z"
  }
]
```