---
description: Track user experience trends over time using historical web performance data from the CrUX History API.
filename: crux-history-api-trends
category: data
---

# Tracking User Experience Trends with the CrUX History API

The Chrome UX Report (CrUX) History API provides time series of web performance data, updating weekly and offering approximately 6 months of historical data. This allows for a deeper understanding of user experience trends and changes over time, complementing the daily updates from the original CrUX API.

## Best Practices

### Querying the History API

To retrieve historical data, modify your `curl` command to use the `queryHistoryRecord` endpoint instead of `queryRecord`.

```shell
API_KEY="[YOUR_API_KEY]"
curl "https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord?key=$API_KEY" \
 --header 'Content-Type: application/json' \
 --data '{"origin": "https://web.dev", "collectionPeriodCount": 40}'
```

- **`collectionPeriodCount`**: Specify the number of historical data points to return. The maximum is 40. If not specified, it defaults to 25.
- **Data Structure**: Responses contain `histogramTimeseries` and `percentilesTimeseries` for various metrics, alongside an array of `collectionPeriods` detailing the date range for each data point.
- **Interpretation**: Each time series entry directly corresponds to a `collectionPeriods` entry by index. For example, the Nth density in `histogramTimeseries` corresponds to the Nth `collectionPeriods` entry.

### Understanding the Data

- **Weekly Updates**: The CrUX History API is updated once a week on Mondays, reflecting data up to the previous Saturday.
- **28-Day Measurement**: Each data point in the History API represents the preceding 28 days, similar to the daily API.
- **Overlapping Periods**: Be aware that the History API contains overlapping data periods. This is intentional for trend analysis.

### Querying Page-Level Data

The History API also supports querying historical data at the page level using the `url` parameter:

```shell
API_KEY="[YOUR_API_KEY]"
curl "https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord?key=$API_KEY" \
 --header 'Content-Type: application/json' \
 --data '{"url": "https://web.dev/blog/"}'
```

- **Eligibility Requirements**: Page-level data is subject to the same eligibility criteria as origin-level data.
- **Missing Data**: If historical data is unavailable for a specific page or period, you'll find `"NaN"` for `histogramTimeseries` densities and `null` for `percentilesTimeseries`.

### Visualizing the Data

- **CrUX Vis**: Utilize [CrUX Vis](https://cruxvis.withgoogle.com/) for an easy way to visualize CrUX History API data.
- **Colab Notebooks**: Explore the [CrUX History API Colab](https://colab.research.google.com/github/GoogleChrome/CrUX/blob/main/colab/crux-history-api.ipynb) for a practical example of making API calls and charting the data using Python. This resource is accessible even for non-programmers and allows for code modification.

## Fallback Strategies

The CrUX History API is a JSON-based HTTP endpoint and is broadly accessible. No specific polyfills or feature detection are typically required for direct API interaction. However, if you are building tools or applications that consume this data, ensure your implementation handles potential `null` or `"NaN"` values gracefully, especially when dealing with page-level data or periods with insufficient data.