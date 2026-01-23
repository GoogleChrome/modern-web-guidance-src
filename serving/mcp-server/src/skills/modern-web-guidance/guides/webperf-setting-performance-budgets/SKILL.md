---
description: Establish and enforce performance budgets for websites to ensure fast load times and a better user experience.
filename: setting-performance-budgets
category: webperf
---

# Setting Performance Budgets

This guide outlines how to define and implement performance budgets for your website, focusing on key metrics like First Contentful Paint (FCP) and Time to Interactive (TTI), as well as quantity-based and rule-based metrics.

## Preliminary Analysis

Before setting budgets, analyze your site's current performance.

1.  **Identify Key Pages**: Focus on pages with high user traffic or those critical to your business goals (e.g., landing pages).
2.  **Measure Timing Milestones**: Use Chrome DevTools' Lighthouse audits in a Guest window to record FCP and TTI for these key pages on both desktop and mobile.
    *   **First Contentful Paint (FCP)**: Measures when the first piece of content is rendered on the screen.
    *   **Time to Interactive (TTI)**: Measures when the page is visually rendered and can reliably respond to user input.

### Example: Doggos.com Analysis

| Device  | Page           | FCP     | TTI     |
| :------ | :------------- | :------ | :------ |
| Desktop | Homepage       | 1,680 ms | 5,550 ms |
| Desktop | Results page   | 2,060 ms | 6,690 ms |
| Mobile  | Homepage       | 1,800 ms | 6,150 ms |
| Mobile  | Results page   | 1,100 ms | 7,870 ms |

*Note: Using a Guest window provides a clean testing environment without extensions that could skew results.*

## Competitive Analysis

Analyze competitor websites to set realistic performance targets.

1.  **Identify Competitors**: Use tools like Google's "related:" keyword, Alexa's similar sites feature, or SimilarWeb to find comparable websites. Aim for about 10 competitors.
2.  **Measure Competitor Performance**: Record FCP and TTI for key pages (especially mobile) of your competitors.

### Example: Competitive Landscape (Mobile Homepage)

| Site/Homepage      | FCP     | TTI     |
| :----------------- | :------ | :------ |
| goggles.com        | **880 ms** | **3,150 ms** |
| Doggos.com         | 1,800 ms | 6,500 ms |
| quackquackgo.com   | 2,680 ms | 4,740 ms |
| ding.xyz           | 2,420 ms | 7,040 ms |

*The fastest competitor is goggles.com with an FCP of 880 ms and TTI of 3,150 ms.*

### Budget for Timing Milestones

Use the **20% rule**: to be noticeably better than the best comparable site, you need to be at least 20% faster.

**Performance budget to get Doggos.com ahead of competition:**

| Measure | Current time (Doggos.com Mobile Homepage) | Budget (20% faster than competition) |
| :------ | :---------------------------------------- | :----------------------------------- |
| FCP     | 1,800 ms                                  | 704 ms                               |
| TTI     | 6,500 ms                                  | 2,520 ms                             |

**Revised Doggos.com performance budget:**

| Measure | Current time | Initial budget (20% faster than current) | Long-term goal (20% faster than competition) |
| :------ | :----------- | :--------------------------------------- | :------------------------------------------- |
| FCP     | 1,800 ms     | 1,440 ms                                 | 704 ms                                       |
| TTI     | 6,500 ms     | 5,200 ms                                 | 2,520 ms                                     |

*If optimizing an existing site, start by setting a budget 20% faster than your current speed and iterate.*

## Combine Different Metrics

A comprehensive performance budget includes:

*   **Timing Milestones**: FCP, TTI.
*   **Quantity-Based Metrics**: Page weight and asset sizes.
*   **Rule-Based Metrics**: Performance scores from tools like Lighthouse.

### Budget for Quantity-Based Metrics

Aim to deliver critical-path resources under **170 KB** (compressed/minified) for fast loading on all devices and networks.

| Network   | Device   | JS  | Images | CSS | HTML | Fonts | Total   | Time to Interactive budget |
| :-------- | :------- | :-- | :----- | :-- | :--- | :---- | :------ | :------------------------- |
| Slow 3G   | Moto G4  | 100 | 30     | 10  | 10   | 20    | ~170 KB | 5s                         |
| Slow 4G   | Moto G4  | 200 | 50     | 35  | 30   | 30    | ~345 KB | 3s                         |
| WiFi      | Desktop  | 300 | 250    | 50  | 50   | 100   | ~750 KB | 2s                         |

*Note: These are recommended sizes for critical-path resources. Adjust based on your content type (e.g., e-commerce vs. news portal) and the inclusion of ads or analytics.*

### Budget for Rule-Based Metrics

*   **Lighthouse Performance Score**: Set a budget of **at least 85 out of 100**.
*   **Enforcement**: Use Lighthouse CI to enforce performance budgets on pull requests.

## Prioritize

Align your performance budget with user goals and device distribution.

1.  **Understand User Goals**:
    *   **News sites**: Prioritize fast rendering and low FCP for content consumption.
    *   **Interactive sites (like Doggos.com)**: Prioritize low TTI for quick user interaction.
2.  **Consider Device Distribution**: Analyze audience behavior on desktop vs. mobile using tools like the Chrome User Experience report dashboard to prioritize accordingly.

## Next Steps

*   Ensure your performance budget is enforced throughout the project lifecycle.
*   Integrate performance budget checks into your build process.