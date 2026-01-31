# Evaluation Results


| Group | Median Pass Rate | Test Runs |
|---|---|---|
| **Unguided** | 40% | 3 |
| **Guided** | 88% | 3 |

## GREENFIELD - VAGUE - UNGUIDED (Median: 14%)

**Pass rates across runs:** 14%, 14%, 14%

### Run 1 Details (1/7)

| Status | Expectation |
|---|---|
| ❌ | Found img with loading-placeholder attribute |
| ❌ | Found button with interestfor attribute |
| ✅ | No deprecated interesttarget attribute found |
| ❌ | JS contains interestfor feature detection |
| ❌ | JS contains loading-placeholder feature detection |
| ❌ | CSS uses animation-timeline: view() |
| ❌ | CSS respects prefers-reduced-motion |

## GREENFIELD - VAGUE - GUIDED (Median: 71%)

**Pass rates across runs:** 43%, 71%, 86%

### Run 2 Details (5/7)

| Status | Expectation |
|---|---|
| ✅ | Found img with loading-placeholder attribute |
| ✅ | Found button with interestfor attribute |
| ✅ | No deprecated interesttarget attribute found |
| ✅ | JS contains interestfor feature detection |
| ❌ | JS contains loading-placeholder feature detection |
| ✅ | CSS uses animation-timeline: view() |
| ❌ | CSS respects prefers-reduced-motion |

## GREENFIELD - SPECIFIC - UNGUIDED (Median: 29%)

**Pass rates across runs:** 29%, 29%, 29%

### Run 1 Details (2/7)

| Status | Expectation |
|---|---|
| ❌ | Found img with loading-placeholder attribute |
| ❌ | Found button with interestfor attribute |
| ✅ | No deprecated interesttarget attribute found |
| ❌ | JS contains interestfor feature detection |
| ❌ | JS contains loading-placeholder feature detection |
| ✅ | CSS uses animation-timeline: view() |
| ❌ | CSS respects prefers-reduced-motion |

## GREENFIELD - SPECIFIC - GUIDED (Median: 57%)

**Pass rates across runs:** 43%, 57%, 86%

### Run 3 Details (4/7)

| Status | Expectation |
|---|---|
| ✅ | Found img with loading-placeholder attribute |
| ✅ | Found button with interestfor attribute |
| ✅ | No deprecated interesttarget attribute found |
| ❌ | JS contains interestfor feature detection |
| ❌ | JS contains loading-placeholder feature detection |
| ✅ | CSS uses animation-timeline: view() |
| ❌ | CSS respects prefers-reduced-motion |

## BROWNFIELD - VAGUE - UNGUIDED (Median: 67%)

**Pass rates across runs:** 33%, 67%, 100%

### Run 1 Details (2/3)

| Status | Expectation |
|---|---|
| ✅ | Found &lt;script type=&quot;speculationrules&quot;&gt; |
| ❌ | Speculation rules exclude /logout |
| ✅ | No deprecated &lt;link rel=&quot;prerender&quot;&gt; tag found |

## BROWNFIELD - VAGUE - GUIDED (Median: 100%)

**Pass rates across runs:** 33%, 100%, 100%

### Run 1 Details (3/3)

| Status | Expectation |
|---|---|
| ✅ | Found &lt;script type=&quot;speculationrules&quot;&gt; |
| ✅ | Speculation rules exclude /logout |
| ✅ | No deprecated &lt;link rel=&quot;prerender&quot;&gt; tag found |

## BROWNFIELD - SPECIFIC - UNGUIDED (Median: 67%)

**Pass rates across runs:** 67%, 67%, 67%

### Run 1 Details (2/3)

| Status | Expectation |
|---|---|
| ✅ | Found &lt;script type=&quot;speculationrules&quot;&gt; |
| ❌ | Speculation rules exclude /logout |
| ✅ | No deprecated &lt;link rel=&quot;prerender&quot;&gt; tag found |

## BROWNFIELD - SPECIFIC - GUIDED (Median: 100%)

**Pass rates across runs:** 67%, 100%, 100%

### Run 2 Details (3/3)

| Status | Expectation |
|---|---|
| ✅ | Found &lt;script type=&quot;speculationrules&quot;&gt; |
| ✅ | Speculation rules exclude /logout |
| ✅ | No deprecated &lt;link rel=&quot;prerender&quot;&gt; tag found |

## REDFIELD - VAGUE - UNGUIDED (Median: 50%)

**Pass rates across runs:** 50%, 50%, 50%

### Run 1 Details (2/4)

| Status | Expectation |
|---|---|
| ❌ | Refactored to use declarative interestfor attribute |
| ✅ | No interesttarget attribute detected |
| ❌ | Check for interestfor feature detection |
| ✅ | No addEventListener(&quot;mouseover&quot;) detected |

## REDFIELD - VAGUE - GUIDED (Median: 100%)

**Pass rates across runs:** 75%, 100%, 100%

### Run 1 Details (4/4)

| Status | Expectation |
|---|---|
| ✅ | Refactored to use declarative interestfor attribute |
| ✅ | No interesttarget attribute detected |
| ✅ | Check for interestfor feature detection |
| ✅ | No addEventListener(&quot;mouseover&quot;) detected |

## REDFIELD - SPECIFIC - UNGUIDED (Median: 25%)

**Pass rates across runs:** 25%, 25%, 25%

### Run 1 Details (1/4)

| Status | Expectation |
|---|---|
| ❌ | Refactored to use declarative interestfor attribute |
| ❌ | No interesttarget attribute detected |
| ❌ | Check for interestfor feature detection |
| ✅ | No addEventListener(&quot;mouseover&quot;) detected |

## REDFIELD - SPECIFIC - GUIDED (Median: 75%)

**Pass rates across runs:** 75%, 75%, 75%

### Run 1 Details (3/4)

| Status | Expectation |
|---|---|
| ✅ | Refactored to use declarative interestfor attribute |
| ✅ | No interesttarget attribute detected |
| ❌ | Check for interestfor feature detection |
| ✅ | No addEventListener(&quot;mouseover&quot;) detected |

