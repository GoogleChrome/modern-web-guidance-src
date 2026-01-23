---
description: Optimize website performance by reducing Interaction to Next Paint (INP) to improve user experience and conversion rates.
filename: optimize-inp
category: webperf
---

# Optimize Interaction to Next Paint (INP)

## Best Practices

QuintoAndar significantly improved its web performance by reducing its Interaction to Next Paint (INP) by 80%, leading to a 36% increase in conversions year-over-year. Recognizing the importance of fast, responsive sites for user engagement, they implemented a "[Code Yellow](https://rosslazer.com/posts/code-yellow/)" to prioritize performance across all teams.

Using tools like [Real User Monitoring (RUM)](/articles/vitals-measurement-getting-started) and techniques such as `async`/`await` for long task optimization and React transitions, QuintoAndar successfully reduced interaction times and improved the user experience. The changes—including removing third-party pixels and rendering optimizations,—resulted in better performance metrics.

### Optimizing Long Tasks

Delays over 200 milliseconds are noticeable to users. To address slow interactions, employ `async`/`await` to create yield points in your JavaScript code, allowing for useful visual feedback to occur more quickly.

```js
function yieldToMain () {
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
}

async function handleFilterClick () {
  showLoadingSpinner();
  await yieldToMain(); // Yield point
  await loadFilterData();
  showModal();
}
```

**Note:** Consider using `scheduler.yield` for more suitable future implementations.

### Using React Transitions

For applications built with React, utilize the [`useTransition` hook](https://react.dev/reference/react/useTransition) to update application state without blocking the user interface.

```jsx
import React, { useState, useTransition } from 'react';

function App() {
    const [isPending, startTransition] = useTransition();
    const [value, setValue] = useState('');

    const onInputChange = event => {
      setValue(event.target.value) // high-priority

      startTransition(() => {
    	  // Time-consuming task—for example, filter and update the list...
      });
    }

    return (
      <div className="App">
        <input
          value={value}
          onChange={onInputChange}
          placeholder='Start typing...'
        />
      </div>
    );
}

export default App;
```

### Other Optimization Techniques

Incorporate techniques such as [memoization](https://en.wikipedia.org/wiki/Memoization#:~:text=In%20computing%2C%20memoization%20or%20memoisation,the%20same%20inputs%20occur%20again.), [debouncing](https://developer.mozilla.org/docs/Glossary/Debounce), [abort controllers](https://developer.mozilla.org/docs/Web/API/AbortController), and [Suspense](https://react.dev/reference/react/Suspense) to further improve INP.

For example, debouncing can prevent unnecessary updates when the user is typing quickly:

```js
useEffect(() => {
  const handler = setTimeout(() => {
    setDebouncedValue(value);
  }, 300); // Adjust debounce delay as needed

  return () => clearTimeout(handler);
}, [value]);
```

### Addressing Input Delay

[Total Blocking Time (TBT)](/articles/tbt) can serve as a proxy for INP, enabling estimation of the impact of structural changes like:
- Removing third-party pixels.
- Eliminating CSS-in-JS.
- Rendering optimizations.

These initiatives directly address [input delay](/articles/optimize-input-delay), the time between user interaction and event handler execution. Input delays often increase when other tasks run concurrently.

## Preventing Regressions

### Governance Mechanisms

Establish alert mechanisms for key metrics, segmented by application or experience. Monitor performance data from real users and send it to a time-series database for dashboarding and alarms. Implement alarms with variable thresholds to detect unusual outcomes before fixed thresholds are breached. Convene a bi-weekly committee to refine alarm thresholds.

### Incident Management

Create and strictly follow incident procedures using [runbooks](https://en.wikipedia.org/wiki/Runbook) that detail steps for each type of issue.

### Canary Releases

Implement a canary release system that deploys new releases in stages. At each stage, check for performance regressions. If performance degrades, automatically roll back the release to prevent unoptimized features from reaching production.

## Fallback Strategies

If users encounter browsers that do not support specific features, implement fallback strategies.

### Real User Monitoring (RUM)

- **DO** use RUM tools for detailed tracking of slow interactions.
- **DO** break down INP into sub-parts like [input delay, processing time, and presentation delay](/articles/optimize-inp).
- **DO** analyze [Long Animation Frames (LoAF)](https://developer.chrome.com/docs/web-platform/long-animation-frames).

### `async`/`await`

- **DO** use `async`/`await` for long task optimization.
- **DO** ensure `yieldToMain` or equivalent is correctly implemented.

### React Transitions

- **DO** use the `useTransition` hook for non-blocking UI updates.
- **DO** feature detect the availability of React transitions.

### Debouncing and Memoization

- **DO** implement debouncing to limit excessive function calls.
- **DO** use memoization to cache results of expensive computations.

### Canary Releases

- **DO** implement a staged rollout process for new releases.
- **DO** monitor performance metrics at each stage.
- **DO** have an automated rollback mechanism.