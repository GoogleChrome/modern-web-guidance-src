# Evaluation Results


| Group | Pass Rate | Test Runs |
|---|---|---|
| **Unguided** | 30% (3/10) | 1 |
| **Guided** | 80% (8/10) | 1 |

## CARDS-APP - CONTENT-VIS - UNGUIDED (Median: 29%)

**Pass rates across runs:** 29%

### Run 1 Details (2/7)

| Status | Expectation |
|---|---|
| ❌ | Should contain content-visibility: auto |
| ❌ | Should contain contain-intrinsic-size |
| ❌ | Cards below the fold should have content-visibility: auto |
| ❌ | Cards should have contain-intrinsic-size set |
| ✅ | Initial render should be FAST (&lt;150ms) |
| ❌ | Off-screen content remains in A11y tree |
| ✅ | No console warnings for forced layout |

## CARDS-APP - CONTENT-VIS - GUIDED (Median: 100%)

**Pass rates across runs:** 100%

### Run 1 Details (7/7)

| Status | Expectation |
|---|---|
| ✅ | Should contain content-visibility: auto |
| ✅ | Should contain contain-intrinsic-size |
| ✅ | Cards below the fold should have content-visibility: auto |
| ✅ | Cards should have contain-intrinsic-size set |
| ✅ | Initial render should be FAST (&lt;150ms) |
| ✅ | Off-screen content remains in A11y tree |
| ✅ | No console warnings for forced layout |

## CARDS-APP - PRELOAD-PRERENDER - UNGUIDED (Median: 33%)

**Pass rates across runs:** 33%

### Run 1 Details (1/3)

| Status | Expectation |
|---|---|
| ❌ | Should have &lt;script type=&quot;speculationrules&quot;&gt; |
| ❌ | Speculation rules should exclude /logout |
| ✅ | Should NOT have deprecated &lt;link rel=&quot;prerender&quot;&gt; tag |

## CARDS-APP - PRELOAD-PRERENDER - GUIDED (Median: 33%)

**Pass rates across runs:** 33%

### Run 1 Details (1/3)

| Status | Expectation |
|---|---|
| ❌ | Should have &lt;script type=&quot;speculationrules&quot;&gt; |
| ❌ | Speculation rules should exclude /logout |
| ✅ | Should NOT have deprecated &lt;link rel=&quot;prerender&quot;&gt; tag |

