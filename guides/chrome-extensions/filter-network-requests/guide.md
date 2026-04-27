---
name: filter-network-requests
description: Block, redirect, or modify network requests declaratively without observing individual requests at runtime.
---

# Filter Network Requests

The Declarative Net Request (DNR) API lets extensions block, redirect, allow, and modify HTTP headers using rules declared in JSON files. Chrome evaluates these rules natively — faster and more battery-efficient than observing individual requests in JavaScript.

## Manifest setup

```json
{
  "permissions": ["declarativeNetRequest"],
  "declarative_net_request": {
    "rule_resources": [{
      "id": "ruleset_1",
      "enabled": true,
      "path": "rules/rules.json"   // path to your static rule file
    }]
  }
}
```

## Static rules (bundled with the extension)

`rules/rules.json`:
```json
[
  {
    "id": 1,
    "priority": 1,
    "action": { "type": "block" },
    "condition": {
      "urlFilter": "||doubleclick.net",
      "resourceTypes": ["script", "image", "xmlhttprequest", "sub_frame"]
    }
  },
  {
    "id": 2,
    "priority": 1,
    "action": {
      "type": "redirect",
      "redirect": { "url": "https://my-proxy.example.com/api" }
    },
    "condition": {
      "urlFilter": "||api.example.com/v1/*",
      "resourceTypes": ["xmlhttprequest"]
    }
  },
  {
    "id": 3,
    "priority": 1,
    "action": {
      "type": "modifyHeaders",
      "responseHeaders": [
        { "header": "Access-Control-Allow-Origin", "operation": "set", "value": "*" }
      ]
    },
    "condition": {
      "urlFilter": "||api.example.com/*",
      "resourceTypes": ["xmlhttprequest"]
    }
  }
]
```

### Action types

| Type | Effect |
|------|--------|
| `"block"` | Cancel the request |
| `"redirect"` | Redirect to another URL |
| `"allow"` | Explicitly allow (bypasses lower-priority block rules) |
| `"modifyHeaders"` | Add, set, or remove request/response headers |
| `"upgradeScheme"` | Upgrade HTTP to HTTPS |

### URL filter patterns

| Pattern | Matches |
|---------|---------|
| `"doubleclick.net"` | Any URL containing "doubleclick.net" |
| `"||doubleclick.net"` | Domain starts with doubleclick.net (anchored) |
| `"||example.com/ads/*"` | Specific path on example.com |
| `"*://*.tracking.com/*"` | Any subdomain of tracking.com |

### Resource types

`main_frame`, `sub_frame`, `stylesheet`, `script`, `image`, `font`, `xmlhttprequest`, `media`, `websocket`, `other`

## Dynamic rules (added at runtime)

Dynamic rules let users customize filter lists or toggle rules without extension updates:

```js
// Add a rule at runtime
await chrome.declarativeNetRequest.updateDynamicRules({
  addRules: [{
    id: 1000,                        // must be unique across all dynamic rules
    priority: 1,
    action: { type: 'block' },
    condition: {
      urlFilter: 'ads.example.com',
      resourceTypes: ['script', 'image']
    }
  }],
  removeRuleIds: []                  // IDs of rules to remove
});

// List current dynamic rules
const rules = await chrome.declarativeNetRequest.getDynamicRules();
```

## Count matched rules (development only)

For debugging, add `"declarativeNetRequestFeedback"` permission and listen to `onRuleMatchedDebug`. This only works for unpacked (development) extensions:

```js
chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
  console.log('Rule matched:', info.rule.ruleId, 'for', info.request.url);
});
```

## Rule limits

| Ruleset type | Limit |
|-------------|-------|
| Static rules (guaranteed) | 30,000 per extension |
| Static rules (shared pool) | +300,000 shared across all extensions |
| Dynamic rules | 30,000 |
| Session rules | 5,000 |
