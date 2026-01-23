---
description: Use the URLPattern API to simplify URL matching and parameter extraction in web applications.
filename: url-pattern-api-best-practices
category: ui
---

# URLPattern API Best Practices

The `URLPattern` API provides a standardized and powerful way to match URLs and extract dynamic parameters, simplifying routing and URL manipulation compared to traditional methods like regular expressions.

## Basic URL Pattern Matching

For simple URL matching, use `URLPattern` with the `pathname` property to check if a URL matches a specific path. This is more readable and concise than using regular expressions.

```js
const pattern = new URLPattern({ pathname: "/products/:id" });
console.log(pattern.test("https://example.com/products/123")); // true
```

## Extracting Dynamic Parameters

When you need to extract dynamic segments from a URL, `URLPattern` offers named parameters, which are more explicit and less fragile than positional capture groups in regular expressions.

```js
// Pattern to match /books/<category>/<id>
const pattern = new URLPattern({ pathname: "/books/:category/:id" });
const result = pattern.exec("/books/classics/12345");

// `result.pathname.groups` will return:
// { category: "classics", id: "12345" }
const { category, id: bookId } = result.pathname.groups;
```

## Composing Multipart Matches

`URLPattern` allows you to match against different parts of a URL simultaneously, such as the hostname and pathname, providing a more comprehensive matching capability.

```js
const pattern = new URLPattern({ hostname: "*.cdn.com", pathname: "/images/*" });

if (pattern.test(req.url)) {
  // Do something
}
```

## Project Dependencies

By using the `URLPattern` API, which is now widely available, you can eliminate the need for third-party routing libraries, reducing your application's bundle size and simplifying dependency management.

## Detailed Usage Scenarios

### Matching Paths and Extracting Parameters

This is a common use case for client-side routing. Use `.test()` for boolean checks and `.exec()` to retrieve named groups.

```js
const pattern = new URLPattern({ pathname: "/products/:category/:id" });

console.log(pattern.test("https://example.com/products/electronics/123")); // → true

const result = pattern.exec("https://example.com/products/electronics/123");
if (result) {
  const { category, id } = result.pathname.groups;
  console.log(`Loading product ${id} from the ${category} category.`); // → "Loading product 123 from the electronics category."
}
```

### Matching Subdomains and More

`URLPattern` is a full URL matcher, ideal for applications that need to differentiate behavior based on subdomains.

```js
const apiPattern = new URLPattern({
  hostname: ":subdomain.myapp.com",
  pathname: "/api/v:version/*"
});

const result = apiPattern.exec("https://api.myapp.com/api/v2/users");
if (result) {
  const { subdomain } = result.hostname.groups;
  const { version } = result.pathname.groups;
  console.log(`Request to the '${subdomain}' subdomain, API version ${version}.`); // → "Request to the 'api' subdomain, API version 2."
}
```

### Wildcards and Regular Expressions

For greater flexibility, `URLPattern` supports wildcards (`*`) and the embedding of regular expressions within patterns.

```js
// :userId(\\d+) ensures userId is a digit
// * matches any character until the next separator
const assetPattern = new URLPattern({
  pathname: "/users/:userId(\\d+)/assets/*.(jpg|png|gif)"
});

const result1 = assetPattern.exec("https://example.com/users/123/assets/profile.jpg");
console.log(result1?.pathname.groups.userId); // → "123"

const result2 = assetPattern.exec("https://example.com/users/abc/assets/avatar.png");
console.log(result2); // → null (fails because 'abc' is not a digit)
```

### Routing in Service Workers

`URLPattern` is highly effective in service workers for intercepting `fetch` requests and applying different caching strategies without complex conditional logic.

```js
// Inside your service worker file:

const IMAGE_ASSETS = new URLPattern({ pathname: "/images/*" });
const API_CALLS = new URLPattern({ pathname: "/api/*" });

self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  if (IMAGE_ASSETS.test(url)) {
    event.respondWith(cacheFirst(event.request)); // Apply cache-first for images
  } else if (API_CALLS.test(url)) {
    event.respondWith(networkFirst(event.request)); // Apply network-first for API calls
  }
});
```

For comprehensive details on all `URLPattern` capabilities, refer to the [MDN Web Docs](https://developer.mozilla.org/docs/Web/API/URLPattern).