# Evaluation Results


| Group | Passing | Total | Rate |
|---|---|---|---|
| **Unguided** | 7 | 24 | 29% |
| **Guided** | 15 | 24 | 63% |

## GREENFIELD - VAGUE - UNGUIDED (0/6)

| Status | Expectation |
|---|---|
| ❌ | Found img with loading-placeholder attribute |
| ❌ | Found button with interestfor attribute |
| ❌ | JS contains interestfor feature detection |
| ❌ | JS contains loading-placeholder feature detection |
| ❌ | CSS uses animation-timeline: view() |
| ❌ | CSS respects prefers-reduced-motion |

## GREENFIELD - VAGUE - GUIDED (3/6)

| Status | Expectation |
|---|---|
| ❌ | Found img with loading-placeholder attribute |
| ✅ | Found button with interestfor attribute |
| ❌ | JS contains interestfor feature detection |
| ❌ | JS contains loading-placeholder feature detection |
| ✅ | CSS uses animation-timeline: view() |
| ✅ | CSS respects prefers-reduced-motion |

## GREENFIELD - SPECIFIC - UNGUIDED (1/6)

| Status | Expectation |
|---|---|
| ❌ | Found img with loading-placeholder attribute |
| ❌ | Found button with interestfor attribute |
| ❌ | JS contains interestfor feature detection |
| ❌ | JS contains loading-placeholder feature detection |
| ✅ | CSS uses animation-timeline: view() |
| ❌ | CSS respects prefers-reduced-motion |

## GREENFIELD - SPECIFIC - GUIDED (3/6)

| Status | Expectation |
|---|---|
| ✅ | Found img with loading-placeholder attribute |
| ✅ | Found button with interestfor attribute |
| ❌ | JS contains interestfor feature detection |
| ❌ | JS contains loading-placeholder feature detection |
| ✅ | CSS uses animation-timeline: view() |
| ❌ | CSS respects prefers-reduced-motion |

## BROWNFIELD - VAGUE - UNGUIDED (2/3)

| Status | Expectation |
|---|---|
| ✅ | Found &lt;script type=&quot;speculationrules&quot;&gt; |
| ❌ | Speculation rules exclude /logout |
| ✅ | No deprecated &lt;link rel=&quot;prerender&quot;&gt; tag found |

## BROWNFIELD - VAGUE - GUIDED (3/3)

| Status | Expectation |
|---|---|
| ✅ | Found &lt;script type=&quot;speculationrules&quot;&gt; |
| ✅ | Speculation rules exclude /logout |
| ✅ | No deprecated &lt;link rel=&quot;prerender&quot;&gt; tag found |

## BROWNFIELD - SPECIFIC - UNGUIDED (2/3)

| Status | Expectation |
|---|---|
| ✅ | Found &lt;script type=&quot;speculationrules&quot;&gt; |
| ❌ | Speculation rules exclude /logout |
| ✅ | No deprecated &lt;link rel=&quot;prerender&quot;&gt; tag found |

## BROWNFIELD - SPECIFIC - GUIDED (2/3)

| Status | Expectation |
|---|---|
| ✅ | Found &lt;script type=&quot;speculationrules&quot;&gt; |
| ❌ | Speculation rules exclude /logout |
| ✅ | No deprecated &lt;link rel=&quot;prerender&quot;&gt; tag found |

## REDFIELD - VAGUE - UNGUIDED (1/3)

| Status | Expectation |
|---|---|
| ❌ | Refactored to use declarative interestfor attribute |
| ❌ | Check for interestfor feature detection |
| ✅ | No addEventListener(&quot;mouseover&quot;) detected |

## REDFIELD - VAGUE - GUIDED (2/3)

| Status | Expectation |
|---|---|
| ✅ | Refactored to use declarative interestfor attribute |
| ❌ | Check for interestfor feature detection |
| ✅ | No addEventListener(&quot;mouseover&quot;) detected |

## REDFIELD - SPECIFIC - UNGUIDED (1/3)

| Status | Expectation |
|---|---|
| ❌ | Refactored to use declarative interestfor attribute |
| ❌ | Check for interestfor feature detection |
| ✅ | No addEventListener(&quot;mouseover&quot;) detected |

## REDFIELD - SPECIFIC - GUIDED (2/3)

| Status | Expectation |
|---|---|
| ✅ | Refactored to use declarative interestfor attribute |
| ❌ | Check for interestfor feature detection |
| ✅ | No addEventListener(&quot;mouseover&quot;) detected |

