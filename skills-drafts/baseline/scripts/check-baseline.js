"use strict";

var features = {
  "a": {
    "name": "<a>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "abbr": {
    "name": "<abbr>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "2",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "4",
        "safari_ios": "3.2"
      }
    }
  },
  "abortable-fetch": {
    "name": "Abortable fetch",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2019-03-25",
      "baseline_high_date": "2021-09-25",
      "support": {
        "chrome": "66",
        "chrome_android": "66",
        "edge": "16",
        "firefox": "57",
        "firefox_android": "57",
        "safari": "12.1",
        "safari_ios": "12.2"
      }
    }
  },
  "aborting": {
    "name": "AbortController and AbortSignal",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2019-03-25",
      "baseline_high_date": "2021-09-25",
      "support": {
        "chrome": "66",
        "chrome_android": "66",
        "edge": "16",
        "firefox": "57",
        "firefox_android": "57",
        "safari": "12.1",
        "safari_ios": "12.2"
      }
    }
  },
  "abortsignal-any": {
    "name": "AbortSignal.any()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-03-19",
      "support": {
        "chrome": "116",
        "chrome_android": "116",
        "edge": "116",
        "firefox": "124",
        "firefox_android": "124",
        "safari": "17.4",
        "safari_ios": "17.4"
      }
    }
  },
  "abortsignal-timeout": {
    "name": "AbortSignal.timeout()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-04-18",
      "support": {
        "chrome": "124",
        "chrome_android": "124",
        "edge": "124",
        "firefox": "100",
        "firefox_android": "100",
        "safari": "16",
        "safari_ios": "16"
      }
    }
  },
  "abs-sign": {
    "name": "abs() and sign()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-06-26",
      "support": {
        "chrome": "138",
        "chrome_android": "138",
        "edge": "138",
        "firefox": "118",
        "firefox_android": "118",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "absolute-positioning": {
    "name": "Absolute positioning",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "accelerometer": {
    "name": "Accelerometer",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "91",
        "chrome_android": "91",
        "edge": "91"
      }
    }
  },
  "accent-color": {
    "name": "accent-color",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "93",
        "edge": "93",
        "firefox": "92",
        "firefox_android": "92"
      }
    }
  },
  "accesskey": {
    "name": "accesskey",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "17",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "5",
        "firefox_android": "5",
        "safari": "6",
        "safari_ios": "6"
      }
    }
  },
  "accessor-methods": {
    "name": "Accessor methods",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3",
        "safari_ios": "1"
      }
    }
  },
  "active-view-transition": {
    "name": "Active view transition",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2026-01-13",
      "support": {
        "chrome": "125",
        "chrome_android": "125",
        "edge": "125",
        "firefox": "147",
        "firefox_android": "147",
        "safari": "18.2",
        "safari_ios": "18.2"
      }
    }
  },
  "address": {
    "name": "<address>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "alerts": {
    "name": "Alerts",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "align-content-block": {
    "name": "align-content in block layouts",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-04-16",
      "support": {
        "chrome": "123",
        "chrome_android": "123",
        "edge": "123",
        "firefox": "125",
        "firefox_android": "125",
        "safari": "17.4",
        "safari_ios": "17.4"
      }
    }
  },
  "alignment-baseline": {
    "name": "alignment-baseline",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "79",
        "safari": "5.1",
        "safari_ios": "5"
      }
    }
  },
  "all": {
    "name": "all",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "37",
        "chrome_android": "37",
        "edge": "79",
        "firefox": "27",
        "firefox_android": "27",
        "safari": "9.1",
        "safari_ios": "9.3"
      }
    }
  },
  "alt-text-generated-content": {
    "name": "Alt text for generated content",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-07-09",
      "support": {
        "chrome": "77",
        "chrome_android": "77",
        "edge": "79",
        "firefox": "128",
        "firefox_android": "128",
        "safari": "17.4",
        "safari_ios": "17.4"
      }
    }
  },
  "alternative-style-sheets": {
    "name": "Alternative style sheets",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "3",
        "firefox_android": "4"
      }
    }
  },
  "ambient-light": {
    "name": "Ambient light sensor",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "anchor-positioning": {
    "name": "Anchor positioning",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "angle-instanced-arrays": {
    "name": "ANGLE_instanced_arrays WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2016-06-07",
      "baseline_high_date": "2018-12-07",
      "support": {
        "chrome": "32",
        "chrome_android": "30",
        "edge": "12",
        "firefox": "47",
        "firefox_android": "47",
        "safari": "8",
        "safari_ios": "8"
      }
    }
  },
  "animation-composition": {
    "name": "animation-composition",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-07-04",
      "baseline_high_date": "2026-01-04",
      "support": {
        "chrome": "112",
        "chrome_android": "112",
        "edge": "112",
        "firefox": "115",
        "firefox_android": "115",
        "safari": "16",
        "safari_ios": "16"
      }
    }
  },
  "animations-css": {
    "name": "Animations (CSS)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-09-30",
      "baseline_high_date": "2018-03-30",
      "support": {
        "chrome": "43",
        "chrome_android": "43",
        "edge": "12",
        "firefox": "16",
        "firefox_android": "16",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "app-file-handlers": {
    "name": "File handlers",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "102",
        "edge": "102"
      }
    }
  },
  "app-launch-handler": {
    "name": "Launch handler",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "110",
        "edge": "110"
      }
    }
  },
  "app-protocol-handlers": {
    "name": "Protocol handlers",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "96",
        "edge": "96"
      }
    }
  },
  "app-share-targets": {
    "name": "Share targets",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "89",
        "chrome_android": "76",
        "edge": "89"
      }
    }
  },
  "app-shortcuts": {
    "name": "Application shortcuts",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "96",
        "chrome_android": "84",
        "edge": "96",
        "safari": "17.4"
      }
    }
  },
  "appearance": {
    "name": "appearance",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-03-14",
      "baseline_high_date": "2024-09-14",
      "support": {
        "chrome": "84",
        "chrome_android": "84",
        "edge": "84",
        "firefox": "80",
        "firefox_android": "80",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "arguments-callee": {
    "name": "arguments.callee",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "aria-attribute-reflection": {
    "name": "ARIA attribute reflection",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-10-24",
      "support": {
        "chrome": "103",
        "chrome_android": "103",
        "edge": "103",
        "firefox": "119",
        "firefox_android": "119",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "arianotify": {
    "name": "ariaNotify()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "array": {
    "name": "Array (initial support)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "array-at": {
    "name": "Array at()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-03-14",
      "baseline_high_date": "2024-09-14",
      "support": {
        "chrome": "92",
        "chrome_android": "92",
        "edge": "92",
        "firefox": "90",
        "firefox_android": "90",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "array-by-copy": {
    "name": "Array by copy",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-07-04",
      "baseline_high_date": "2026-01-04",
      "support": {
        "chrome": "110",
        "chrome_android": "110",
        "edge": "110",
        "firefox": "115",
        "firefox_android": "115",
        "safari": "16",
        "safari_ios": "16"
      }
    }
  },
  "array-copywithin": {
    "name": "Array copyWithin()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2016-09-20",
      "baseline_high_date": "2019-03-20",
      "support": {
        "chrome": "45",
        "chrome_android": "45",
        "edge": "12",
        "firefox": "34",
        "firefox_android": "34",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "array-fill": {
    "name": "Array fill()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2016-09-20",
      "baseline_high_date": "2019-03-20",
      "support": {
        "chrome": "45",
        "chrome_android": "45",
        "edge": "12",
        "firefox": "37",
        "firefox_android": "37",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "array-find": {
    "name": "Array find() and findIndex()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2016-09-20",
      "baseline_high_date": "2019-03-20",
      "support": {
        "chrome": "45",
        "chrome_android": "45",
        "edge": "12",
        "firefox": "37",
        "firefox_android": "37",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "array-findlast": {
    "name": "Array findLast() and findLastIndex()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-08-23",
      "baseline_high_date": "2025-02-23",
      "support": {
        "chrome": "97",
        "chrome_android": "97",
        "edge": "97",
        "firefox": "104",
        "firefox_android": "104",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "array-flat": {
    "name": "Array flat() and flatMap()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "69",
        "chrome_android": "69",
        "edge": "79",
        "firefox": "62",
        "firefox_android": "62",
        "safari": "12",
        "safari_ios": "12"
      }
    }
  },
  "array-from": {
    "name": "Array.from()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2016-09-20",
      "baseline_high_date": "2019-03-20",
      "support": {
        "chrome": "45",
        "chrome_android": "45",
        "edge": "12",
        "firefox": "38",
        "firefox_android": "38",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "array-fromasync": {
    "name": "Array.fromAsync()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-01-25",
      "support": {
        "chrome": "121",
        "chrome_android": "121",
        "edge": "121",
        "firefox": "115",
        "firefox_android": "115",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "array-group": {
    "name": "Array grouping",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-03-05",
      "support": {
        "chrome": "117",
        "chrome_android": "117",
        "edge": "117",
        "firefox": "119",
        "firefox_android": "119",
        "safari": "17.4",
        "safari_ios": "17.4"
      }
    }
  },
  "array-includes": {
    "name": "Array includes()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2016-09-20",
      "baseline_high_date": "2019-03-20",
      "support": {
        "chrome": "47",
        "chrome_android": "47",
        "edge": "14",
        "firefox": "43",
        "firefox_android": "43",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "array-isarray": {
    "name": "Array.isArray()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "4",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "4",
        "firefox_android": "4",
        "safari": "5",
        "safari_ios": "5"
      }
    }
  },
  "array-iteration-methods": {
    "name": "Array iteration methods",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "3",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "3",
        "firefox_android": "4",
        "safari": "4",
        "safari_ios": "3.2"
      }
    }
  },
  "array-iterators": {
    "name": "Array iterators",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2018-05-09",
      "baseline_high_date": "2020-11-09",
      "support": {
        "chrome": "66",
        "chrome_android": "66",
        "edge": "14",
        "firefox": "60",
        "firefox_android": "60",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "array-of": {
    "name": "Array.of()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2016-09-20",
      "baseline_high_date": "2019-03-20",
      "support": {
        "chrome": "45",
        "chrome_android": "45",
        "edge": "12",
        "firefox": "38",
        "firefox_android": "38",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "array-splice": {
    "name": "Array splice()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "article": {
    "name": "<article>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "5",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "4",
        "firefox_android": "4",
        "safari": "5",
        "safari_ios": "4.2"
      }
    }
  },
  "aside": {
    "name": "<aside>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "5",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "4",
        "firefox_android": "4",
        "safari": "5",
        "safari_ios": "4.2"
      }
    }
  },
  "aspect-ratio": {
    "name": "aspect-ratio",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-09-20",
      "baseline_high_date": "2024-03-20",
      "support": {
        "chrome": "88",
        "chrome_android": "88",
        "edge": "88",
        "firefox": "89",
        "firefox_android": "89",
        "safari": "15",
        "safari_ios": "15"
      }
    }
  },
  "async-await": {
    "name": "Async functions",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-04-05",
      "baseline_high_date": "2019-10-05",
      "support": {
        "chrome": "55",
        "chrome_android": "55",
        "edge": "15",
        "firefox": "52",
        "firefox_android": "52",
        "safari": "10.1",
        "safari_ios": "10.3"
      }
    }
  },
  "async-clipboard": {
    "name": "Async clipboard",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-06-11",
      "support": {
        "chrome": "76",
        "chrome_android": "76",
        "edge": "79",
        "firefox": "127",
        "firefox_android": "127",
        "safari": "13.1",
        "safari_ios": "13.4"
      }
    }
  },
  "async-generators": {
    "name": "Async generators",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "63",
        "chrome_android": "63",
        "edge": "79",
        "firefox": "57",
        "firefox_android": "57",
        "safari": "12",
        "safari_ios": "12"
      }
    }
  },
  "async-iterable-streams": {
    "name": "Asynchronously iterable streams",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "124",
        "chrome_android": "124",
        "edge": "124",
        "firefox": "110",
        "firefox_android": "110"
      }
    }
  },
  "async-iterators": {
    "name": "Async iterators and the for await..of loop",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "63",
        "chrome_android": "63",
        "edge": "79",
        "firefox": "57",
        "firefox_android": "57",
        "safari": "12",
        "safari_ios": "12"
      }
    }
  },
  "atomics-pause": {
    "name": "Atomics.pause()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-04-01",
      "support": {
        "chrome": "133",
        "chrome_android": "133",
        "edge": "133",
        "firefox": "137",
        "firefox_android": "137",
        "safari": "18.4",
        "safari_ios": "18.4"
      }
    }
  },
  "atomics-wait-async": {
    "name": "Atomics.waitAsync()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-11-11",
      "support": {
        "chrome": "90",
        "chrome_android": "90",
        "edge": "90",
        "firefox": "145",
        "firefox_android": "145",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "attr": {
    "name": "attr()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "133",
        "chrome_android": "133",
        "edge": "133"
      }
    }
  },
  "attr-contents": {
    "name": "attr() (content only)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "2",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3.1",
        "safari_ios": "2"
      }
    }
  },
  "attribution-reporting": {
    "name": "Attribution reporting",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "133",
        "chrome_android": "133",
        "edge": "133"
      }
    }
  },
  "audio": {
    "name": "<audio>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "3",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "3.5",
        "firefox_android": "4",
        "safari": "3.1",
        "safari_ios": "3"
      }
    }
  },
  "audio-session": {
    "name": "Audio session",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "audio-video-tracks": {
    "name": "Audio and video tracks",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "safari": "8",
        "safari_ios": "8"
      }
    }
  },
  "audio-worklet": {
    "name": "AudioWorklet",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-04-26",
      "baseline_high_date": "2023-10-26",
      "support": {
        "chrome": "66",
        "chrome_android": "66",
        "edge": "79",
        "firefox": "76",
        "firefox_android": "79",
        "safari": "14.1",
        "safari_ios": "14.5"
      }
    }
  },
  "audiolistener": {
    "name": "AudioListener",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "52",
        "chrome_android": "52",
        "edge": "79",
        "safari": "14.1",
        "safari_ios": "14.5"
      }
    }
  },
  "audiolistener-setposition-setorientation": {
    "name": "AudioListener setPosition() and setOrientation()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "14",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "25",
        "firefox_android": "25",
        "safari": "6",
        "safari_ios": "6"
      }
    }
  },
  "autocapitalize": {
    "name": "autocapitalize",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "66",
        "chrome_android": "66",
        "edge": "79",
        "firefox": "111",
        "firefox_android": "111",
        "safari_ios": "10.3"
      }
    }
  },
  "autocorrect": {
    "name": "autocorrect",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "136",
        "firefox_android": "136",
        "safari": "14.1",
        "safari_ios": "14.5"
      }
    }
  },
  "autofill": {
    "name": ":autofill",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "110",
        "chrome_android": "110",
        "edge": "110",
        "safari": "15",
        "safari_ios": "15"
      }
    }
  },
  "autofocus": {
    "name": "autofocus",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "4",
        "safari_ios": "3.2"
      }
    }
  },
  "autonomous-custom-elements": {
    "name": "Autonomous custom elements",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "54",
        "chrome_android": "54",
        "edge": "79",
        "firefox": "63",
        "firefox_android": "63",
        "safari": "10.1",
        "safari_ios": "10.3"
      }
    }
  },
  "avif": {
    "name": "AVIF",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-01-25",
      "support": {
        "chrome": "85",
        "chrome_android": "85",
        "edge": "121",
        "firefox": "113",
        "firefox_android": "113",
        "safari": "16.4",
        "safari_ios": "16.1"
      }
    }
  },
  "b": {
    "name": "<b>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "backdrop": {
    "name": "::backdrop",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-03-14",
      "baseline_high_date": "2024-09-14",
      "support": {
        "chrome": "37",
        "chrome_android": "37",
        "edge": "79",
        "firefox": "47",
        "firefox_android": "47",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "backdrop-filter": {
    "name": "backdrop-filter",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-09-16",
      "support": {
        "chrome": "76",
        "chrome_android": "76",
        "edge": "79",
        "firefox": "103",
        "firefox_android": "103",
        "safari": "18",
        "safari_ios": "18"
      }
    }
  },
  "background": {
    "name": "background",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "3.6",
        "firefox_android": "4",
        "safari": "1.3",
        "safari_ios": "1"
      }
    }
  },
  "background-attachment": {
    "name": "background-attachment",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "25",
        "firefox_android": "25",
        "safari": "15.4"
      }
    }
  },
  "background-blend-mode": {
    "name": "background-blend-mode",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "35",
        "chrome_android": "59",
        "edge": "79",
        "firefox": "30",
        "firefox_android": "54",
        "safari": "8",
        "safari_ios": "8"
      }
    }
  },
  "background-clip": {
    "name": "background-clip",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "21",
        "chrome_android": "25",
        "edge": "12",
        "firefox": "22",
        "firefox_android": "22",
        "safari": "5.1",
        "safari_ios": "5"
      }
    }
  },
  "background-clip-border-area": {
    "name": "background-clip: border-area",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "safari": "18.2",
        "safari_ios": "18.2"
      }
    }
  },
  "background-clip-text": {
    "name": "background-clip: text",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "120",
        "chrome_android": "120",
        "edge": "120",
        "safari": "14",
        "safari_ios": "14"
      }
    }
  },
  "background-color": {
    "name": "background-color",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "background-fetch": {
    "name": "Background fetch",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "74",
        "chrome_android": "74",
        "edge": "79"
      }
    }
  },
  "background-image": {
    "name": "background-image",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "3.6",
        "firefox_android": "4",
        "safari": "1.3",
        "safari_ios": "1"
      }
    }
  },
  "background-origin": {
    "name": "background-origin",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "21",
        "chrome_android": "25",
        "edge": "12",
        "firefox": "22",
        "firefox_android": "22",
        "safari": "5.1",
        "safari_ios": "4"
      }
    }
  },
  "background-position": {
    "name": "background-position",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "25",
        "chrome_android": "25",
        "edge": "12",
        "firefox": "13",
        "firefox_android": "14",
        "safari": "7",
        "safari_ios": "7"
      }
    }
  },
  "background-repeat": {
    "name": "background-repeat",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2016-09-20",
      "baseline_high_date": "2019-03-20",
      "support": {
        "chrome": "30",
        "chrome_android": "30",
        "edge": "12",
        "firefox": "49",
        "firefox_android": "49",
        "safari": "8",
        "safari_ios": "8"
      }
    }
  },
  "background-size": {
    "name": "background-size",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "21",
        "chrome_android": "25",
        "edge": "12",
        "firefox": "9",
        "firefox_android": "18",
        "safari": "5.1",
        "safari_ios": "4.2"
      }
    }
  },
  "background-sync": {
    "name": "Background sync",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "49",
        "chrome_android": "49",
        "edge": "79"
      }
    }
  },
  "badging": {
    "name": "Badging",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "81",
        "edge": "81",
        "safari": "17",
        "safari_ios": "16.4"
      }
    }
  },
  "barcode": {
    "name": "Barcode detector",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome_android": "83"
      }
    }
  },
  "barprop": {
    "name": "BarProp",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3",
        "safari_ios": "1"
      }
    }
  },
  "base": {
    "name": "<base>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3",
        "safari_ios": "2"
      }
    }
  },
  "base64encodedecode": {
    "name": "Base64 encoding and decoding",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2016-09-20",
      "baseline_high_date": "2019-03-20",
      "support": {
        "chrome": "30",
        "chrome_android": "30",
        "edge": "12",
        "firefox": "4",
        "firefox_android": "4",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "baseline-shift": {
    "name": "baseline-shift",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "79",
        "safari": "4",
        "safari_ios": "3.2"
      }
    }
  },
  "baseline-source": {
    "name": "baseline-source",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "111",
        "chrome_android": "111",
        "edge": "111",
        "firefox": "115",
        "firefox_android": "115"
      }
    }
  },
  "battery": {
    "name": "Battery status",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "38",
        "chrome_android": "38",
        "edge": "79"
      }
    }
  },
  "bdi": {
    "name": "<bdi>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "16",
        "chrome_android": "18",
        "edge": "79",
        "firefox": "10",
        "firefox_android": "10",
        "safari": "6",
        "safari_ios": "6"
      }
    }
  },
  "bdo": {
    "name": "<bdo>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "\u226415",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "10",
        "firefox_android": "10",
        "safari": "\u22644",
        "safari_ios": "\u22643.2"
      }
    }
  },
  "beacons": {
    "name": "Beacons",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2018-04-12",
      "baseline_high_date": "2020-10-12",
      "support": {
        "chrome": "39",
        "chrome_android": "42",
        "edge": "14",
        "firefox": "31",
        "firefox_android": "31",
        "safari": "11.1",
        "safari_ios": "11.3"
      }
    }
  },
  "before-after": {
    "name": "::before and ::after",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1.5",
        "firefox_android": "4",
        "safari": "4",
        "safari_ios": "3.2"
      }
    }
  },
  "beforeinstallprompt": {
    "name": "beforeinstallprompt",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "76",
        "chrome_android": "76",
        "edge": "79"
      }
    }
  },
  "beforeunload": {
    "name": "beforeunload",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3"
      }
    }
  },
  "bfcache-blocking-reasons": {
    "name": "Back/forward cache blocking reasons",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "125",
        "chrome_android": "125",
        "edge": "125"
      }
    }
  },
  "bigint": {
    "name": "BigInt",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-09-16",
      "baseline_high_date": "2023-03-16",
      "support": {
        "chrome": "67",
        "chrome_android": "67",
        "edge": "79",
        "firefox": "68",
        "firefox_android": "68",
        "safari": "14",
        "safari_ios": "14"
      }
    }
  },
  "bigint64array": {
    "name": "BigInt64Array",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-09-20",
      "baseline_high_date": "2024-03-20",
      "support": {
        "chrome": "67",
        "chrome_android": "67",
        "edge": "79",
        "firefox": "68",
        "firefox_android": "68",
        "safari": "15",
        "safari_ios": "15"
      }
    }
  },
  "blocking-render": {
    "name": 'blocking="render"',
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "105",
        "chrome_android": "105",
        "edge": "105",
        "safari": "18.2",
        "safari_ios": "18.2"
      }
    }
  },
  "blockquote": {
    "name": "<blockquote>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "\u22644",
        "safari_ios": "\u22643.2"
      }
    }
  },
  "body": {
    "name": "<body>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3",
        "safari_ios": "1"
      }
    }
  },
  "border-image": {
    "name": "Border images",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-02-01",
      "baseline_high_date": "2019-08-01",
      "support": {
        "chrome": "56",
        "chrome_android": "56",
        "edge": "12",
        "firefox": "50",
        "firefox_android": "50",
        "safari": "9.1",
        "safari_ios": "9.3"
      }
    }
  },
  "border-radius": {
    "name": "border-radius",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "4",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "4",
        "firefox_android": "4",
        "safari": "5",
        "safari_ios": "4.2"
      }
    }
  },
  "borders": {
    "name": "Borders",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "14",
        "safari": "1",
        "safari_ios": "3"
      }
    }
  },
  "box-decoration-break": {
    "name": "box-decoration-break",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "130",
        "chrome_android": "130",
        "edge": "130",
        "firefox": "32",
        "firefox_android": "32"
      }
    }
  },
  "box-shadow": {
    "name": "box-shadow",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "10",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "4",
        "firefox_android": "4",
        "safari": "5.1",
        "safari_ios": "5"
      }
    }
  },
  "box-sizing": {
    "name": "box-sizing",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "10",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "29",
        "firefox_android": "29",
        "safari": "5.1",
        "safari_ios": "6"
      }
    }
  },
  "br": {
    "name": "<br>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3",
        "safari_ios": "1"
      }
    }
  },
  "broadcast-channel": {
    "name": "BroadcastChannel",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-03-14",
      "baseline_high_date": "2024-09-14",
      "support": {
        "chrome": "54",
        "chrome_android": "54",
        "edge": "79",
        "firefox": "38",
        "firefox_android": "38",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "brotli": {
    "name": "Brotli compression",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-09-19",
      "baseline_high_date": "2020-03-19",
      "support": {
        "chrome": "50",
        "chrome_android": "51",
        "edge": "15",
        "firefox": "44",
        "firefox_android": "44",
        "safari": "11",
        "safari_ios": "11"
      }
    }
  },
  "button": {
    "name": "<button>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "calc": {
    "name": "calc()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "26",
        "chrome_android": "28",
        "edge": "12",
        "firefox": "16",
        "firefox_android": "16",
        "safari": "7",
        "safari_ios": "7"
      }
    }
  },
  "calc-constants": {
    "name": "calc() keywords",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-06-06",
      "baseline_high_date": "2025-12-06",
      "support": {
        "chrome": "110",
        "chrome_android": "110",
        "edge": "110",
        "firefox": "114",
        "firefox_android": "114",
        "safari": "16",
        "safari_ios": "16"
      }
    }
  },
  "calc-size": {
    "name": "calc-size()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "129",
        "chrome_android": "129",
        "edge": "129"
      }
    }
  },
  "canvas": {
    "name": "<canvas>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1.5",
        "firefox_android": "4",
        "safari": "2",
        "safari_ios": "1"
      }
    }
  },
  "canvas-2d": {
    "name": "2D canvas",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1.5",
        "firefox_android": "4",
        "safari": "2",
        "safari_ios": "1"
      }
    }
  },
  "canvas-2d-alpha": {
    "name": "2D canvas opacity",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "32",
        "chrome_android": "32",
        "edge": "79",
        "firefox": "30",
        "firefox_android": "30"
      }
    }
  },
  "canvas-2d-color-management": {
    "name": "Color management for 2D canvas",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "92",
        "chrome_android": "92",
        "edge": "92",
        "safari": "15.2",
        "safari_ios": "15.2"
      }
    }
  },
  "canvas-2d-desynchronized": {
    "name": "Desynchronized 2D canvas",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "81",
        "chrome_android": "75",
        "edge": "79",
        "safari": "15",
        "safari_ios": "15"
      }
    }
  },
  "canvas-2d-willreadfrequently": {
    "name": "willReadFrequently",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-09-16",
      "support": {
        "chrome": "99",
        "chrome_android": "99",
        "edge": "99",
        "firefox": "28",
        "firefox_android": "28",
        "safari": "18",
        "safari_ios": "18"
      }
    }
  },
  "canvas-context-lost": {
    "name": "contextlost and contextrestored",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "99",
        "chrome_android": "99",
        "edge": "99",
        "firefox": "125",
        "firefox_android": "125"
      }
    }
  },
  "canvas-createconicgradient": {
    "name": "Canvas createConicGradient()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-04-11",
      "baseline_high_date": "2025-10-11",
      "support": {
        "chrome": "99",
        "chrome_android": "99",
        "edge": "99",
        "firefox": "112",
        "firefox_android": "112",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "canvas-reset": {
    "name": "Canvas reset()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-12-11",
      "support": {
        "chrome": "99",
        "chrome_android": "99",
        "edge": "99",
        "firefox": "113",
        "firefox_android": "113",
        "safari": "17.2",
        "safari_ios": "17.2"
      }
    }
  },
  "canvas-roundrect": {
    "name": "Canvas roundRect()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-04-11",
      "baseline_high_date": "2025-10-11",
      "support": {
        "chrome": "99",
        "chrome_android": "99",
        "edge": "99",
        "firefox": "112",
        "firefox_android": "112",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "cap": {
    "name": "cap unit",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-12-11",
      "support": {
        "chrome": "118",
        "chrome_android": "118",
        "edge": "118",
        "firefox": "97",
        "firefox_android": "97",
        "safari": "17.2",
        "safari_ios": "17.2"
      }
    }
  },
  "capture-handle": {
    "name": "Capture Handle",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "102",
        "edge": "102"
      }
    }
  },
  "capture-stream-audio-video": {
    "name": "captureStream() for <audio> and <video>",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "62",
        "chrome_android": "62",
        "edge": "79"
      }
    }
  },
  "capture-stream-canvas": {
    "name": "captureStream() for <canvas>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "51",
        "chrome_android": "51",
        "edge": "79",
        "firefox": "43",
        "firefox_android": "43",
        "safari": "11",
        "safari_ios": "11"
      }
    }
  },
  "caret-color": {
    "name": "caret-color",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "57",
        "chrome_android": "57",
        "edge": "79",
        "firefox": "53",
        "firefox_android": "53",
        "safari": "11.1",
        "safari_ios": "11.3"
      }
    }
  },
  "caret-shape": {
    "name": "caret-shape",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "144",
        "chrome_android": "144",
        "edge": "144"
      }
    }
  },
  "cascade-layers": {
    "name": "Cascade layers",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-03-14",
      "baseline_high_date": "2024-09-14",
      "support": {
        "chrome": "99",
        "chrome_android": "99",
        "edge": "99",
        "firefox": "97",
        "firefox_android": "97",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "case-insensitive-attributes": {
    "name": "Case-insensitive attribute selector",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "49",
        "chrome_android": "49",
        "edge": "79",
        "firefox": "47",
        "firefox_android": "47",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "case-sensitive-attributes": {
    "name": "Case-sensitive attribute selector",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "66",
        "firefox_android": "66"
      }
    }
  },
  "ch": {
    "name": "ch unit",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "27",
        "chrome_android": "27",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "7",
        "safari_ios": "7"
      }
    }
  },
  "change-event": {
    "name": "Change event",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3",
        "safari_ios": "2"
      }
    }
  },
  "channel-messaging": {
    "name": "Channel messaging",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-09-22",
      "baseline_high_date": "2018-03-22",
      "support": {
        "chrome": "4",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "41",
        "firefox_android": "41",
        "safari": "5",
        "safari_ios": "4.2"
      }
    }
  },
  "charset": {
    "name": "@charset",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "2",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1.5",
        "firefox_android": "4",
        "safari": "4",
        "safari_ios": "4"
      }
    }
  },
  "check-visibility": {
    "name": "checkVisibility()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-03-05",
      "support": {
        "chrome": "105",
        "chrome_android": "105",
        "edge": "105",
        "firefox": "106",
        "firefox_android": "106",
        "safari": "17.4",
        "safari_ios": "17.4"
      }
    }
  },
  "cite": {
    "name": "<cite>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "\u22644",
        "safari_ios": "\u22643.2"
      }
    }
  },
  "class-syntax": {
    "name": "Classes",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2016-03-08",
      "baseline_high_date": "2018-09-08",
      "support": {
        "chrome": "42",
        "chrome_android": "42",
        "edge": "13",
        "firefox": "45",
        "firefox_android": "45",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "clear-site-data": {
    "name": "Clearing site data",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-09-18",
      "support": {
        "chrome": "117",
        "chrome_android": "117",
        "edge": "117",
        "firefox": "63",
        "firefox_android": "63",
        "safari": "17",
        "safari_ios": "17"
      }
    }
  },
  "clip": {
    "name": "clip",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "79",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1.3",
        "safari_ios": "1"
      }
    }
  },
  "clip-path": {
    "name": "clip-path",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-01-21",
      "baseline_high_date": "2023-07-21",
      "support": {
        "chrome": "88",
        "chrome_android": "88",
        "edge": "88",
        "firefox": "71",
        "firefox_android": "79",
        "safari": "13.1",
        "safari_ios": "13"
      }
    }
  },
  "clip-path-animatable": {
    "name": "Animatable clipping paths",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "55",
        "chrome_android": "55",
        "edge": "79",
        "firefox": "49",
        "firefox_android": "49",
        "safari": "12.1",
        "safari_ios": "12.2"
      }
    }
  },
  "clip-path-boxes": {
    "name": "Clip path boxes",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-11-02",
      "support": {
        "chrome": "119",
        "chrome_android": "119",
        "edge": "119",
        "firefox": "54",
        "firefox_android": "54",
        "safari": "13.1",
        "safari_ios": "13.4"
      }
    }
  },
  "clipboard-custom-format": {
    "name": "Custom formats for clipboard items",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "104",
        "chrome_android": "104",
        "edge": "104"
      }
    }
  },
  "clipboard-events": {
    "name": "Clipboard events",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-03-27",
      "baseline_high_date": "2019-09-27",
      "support": {
        "chrome": "41",
        "chrome_android": "41",
        "edge": "12",
        "firefox": "22",
        "firefox_android": "22",
        "safari": "10.1",
        "safari_ios": "10.3"
      }
    }
  },
  "clipboard-supports": {
    "name": "ClipboardItem.supports()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-03-31",
      "support": {
        "chrome": "121",
        "chrome_android": "121",
        "edge": "121",
        "firefox": "127",
        "firefox_android": "127",
        "safari": "18.4",
        "safari_ios": "18.4"
      }
    }
  },
  "clipboard-svg": {
    "name": "SVG clipboard items",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "124",
        "chrome_android": "124",
        "edge": "124"
      }
    }
  },
  "clipboard-unsanitized-formats": {
    "name": "Read unsanitized clipboard data",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "122",
        "chrome_android": "122",
        "edge": "122"
      }
    }
  },
  "clipboardchange": {
    "name": "clipboardchange",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "144",
        "chrome_android": "144",
        "edge": "144"
      }
    }
  },
  "closewatcher": {
    "name": "CloseWatcher",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "126",
        "chrome_android": "126",
        "edge": "126"
      }
    }
  },
  "code": {
    "name": "<code>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "\u22644",
        "safari_ios": "\u22643.2"
      }
    }
  },
  "color": {
    "name": "Color",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "color-adjust": {
    "name": "color-adjust",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "48",
        "firefox_android": "48",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "color-contrast": {
    "name": "color-contrast()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "color-function": {
    "name": "color()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-05-09",
      "baseline_high_date": "2025-11-09",
      "support": {
        "chrome": "111",
        "chrome_android": "111",
        "edge": "111",
        "firefox": "113",
        "firefox_android": "113",
        "safari": "15",
        "safari_ios": "15"
      }
    }
  },
  "color-gamut": {
    "name": "color-gamut media query",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-02-14",
      "baseline_high_date": "2025-08-14",
      "support": {
        "chrome": "58",
        "chrome_android": "58",
        "edge": "79",
        "firefox": "110",
        "firefox_android": "110",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "color-mix": {
    "name": "color-mix()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-05-09",
      "baseline_high_date": "2025-11-09",
      "support": {
        "chrome": "111",
        "chrome_android": "111",
        "edge": "111",
        "firefox": "113",
        "firefox_android": "113",
        "safari": "16.2",
        "safari_ios": "16.2"
      }
    }
  },
  "color-scheme": {
    "name": "color-scheme",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-02-03",
      "baseline_high_date": "2024-08-03",
      "support": {
        "chrome": "98",
        "chrome_android": "98",
        "edge": "98",
        "firefox": "96",
        "firefox_android": "96",
        "safari": "13",
        "safari_ios": "13"
      }
    }
  },
  "colrv0": {
    "name": "COLRv0",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "53",
        "chrome_android": "53",
        "edge": "79",
        "firefox": "31",
        "firefox_android": "31",
        "safari": "11.1",
        "safari_ios": "11.3"
      }
    }
  },
  "colrv1": {
    "name": "COLRv1",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "98",
        "chrome_android": "98",
        "edge": "98",
        "firefox": "107",
        "firefox_android": "107"
      }
    }
  },
  "column-breaks": {
    "name": "Column breaks",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "102",
        "chrome_android": "102",
        "edge": "102"
      }
    }
  },
  "column-fill": {
    "name": "column-fill",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-03-07",
      "baseline_high_date": "2019-09-07",
      "support": {
        "chrome": "50",
        "chrome_android": "50",
        "edge": "12",
        "firefox": "52",
        "firefox_android": "52",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "column-pseudo": {
    "name": "::column",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "135",
        "chrome_android": "135",
        "edge": "135"
      }
    }
  },
  "column-span": {
    "name": "column-span",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-07-28",
      "baseline_high_date": "2023-01-28",
      "support": {
        "chrome": "50",
        "chrome_android": "50",
        "edge": "12",
        "firefox": "71",
        "firefox_android": "79",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "composed-ranges": {
    "name": "Selection composed ranges",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-08-19",
      "support": {
        "chrome": "137",
        "chrome_android": "137",
        "edge": "137",
        "firefox": "142",
        "firefox_android": "142",
        "safari": "17",
        "safari_ios": "17"
      }
    }
  },
  "composition-events": {
    "name": "Composition events",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-04-19",
      "baseline_high_date": "2019-10-19",
      "support": {
        "chrome": "26",
        "chrome_android": "26",
        "edge": "12",
        "firefox": "53",
        "firefox_android": "53",
        "safari": "7",
        "safari_ios": "7"
      }
    }
  },
  "compression-dictionary-transport": {
    "name": "Compression Dictionary Transport",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "130",
        "chrome_android": "130",
        "edge": "130"
      }
    }
  },
  "compression-streams": {
    "name": "Compression streams",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-05-09",
      "baseline_high_date": "2025-11-09",
      "support": {
        "chrome": "80",
        "chrome_android": "80",
        "edge": "80",
        "firefox": "113",
        "firefox_android": "113",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "compute-pressure": {
    "name": "CPU compute pressure",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "125",
        "edge": "125"
      }
    }
  },
  "conic-gradients": {
    "name": "Conic gradients",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-11-17",
      "baseline_high_date": "2023-05-17",
      "support": {
        "chrome": "69",
        "chrome_android": "69",
        "edge": "79",
        "firefox": "83",
        "firefox_android": "83",
        "safari": "12.1",
        "safari_ios": "12.2"
      }
    }
  },
  "console": {
    "name": "Console",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "4",
        "firefox_android": "4",
        "safari": "3",
        "safari_ios": "1"
      }
    }
  },
  "constraint-validation": {
    "name": "Constraint validation API",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2018-12-11",
      "baseline_high_date": "2021-06-11",
      "support": {
        "chrome": "40",
        "chrome_android": "40",
        "edge": "18",
        "firefox": "51",
        "firefox_android": "64",
        "safari": "10.1",
        "safari_ios": "10.3"
      }
    }
  },
  "constructed-stylesheets": {
    "name": "Constructed stylesheets",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-03-27",
      "baseline_high_date": "2025-09-27",
      "support": {
        "chrome": "73",
        "chrome_android": "73",
        "edge": "79",
        "firefox": "101",
        "firefox_android": "101",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "contact-picker": {
    "name": "Contact picker",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome_android": "80"
      }
    }
  },
  "contain": {
    "name": "contain",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-03-14",
      "baseline_high_date": "2024-09-14",
      "support": {
        "chrome": "52",
        "chrome_android": "52",
        "edge": "79",
        "firefox": "69",
        "firefox_android": "79",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "contain-inline-size": {
    "name": "Inline-size containment",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-09-12",
      "baseline_high_date": "2025-03-12",
      "support": {
        "chrome": "105",
        "chrome_android": "105",
        "edge": "105",
        "firefox": "101",
        "firefox_android": "101",
        "safari": "16",
        "safari_ios": "16"
      }
    }
  },
  "contain-intrinsic-size": {
    "name": "contain-intrinsic-size",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-09-18",
      "support": {
        "chrome": "83",
        "chrome_android": "83",
        "edge": "83",
        "firefox": "107",
        "firefox_android": "107",
        "safari": "17",
        "safari_ios": "17"
      }
    }
  },
  "contain-layout": {
    "name": "Layout containment",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-03-14",
      "baseline_high_date": "2024-09-14",
      "support": {
        "chrome": "52",
        "chrome_android": "52",
        "edge": "79",
        "firefox": "69",
        "firefox_android": "79",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "contain-paint": {
    "name": "Paint containment",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-03-14",
      "baseline_high_date": "2024-09-14",
      "support": {
        "chrome": "52",
        "chrome_android": "52",
        "edge": "79",
        "firefox": "69",
        "firefox_android": "79",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "contain-size": {
    "name": "Size containment",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-03-14",
      "baseline_high_date": "2024-09-14",
      "support": {
        "chrome": "52",
        "chrome_android": "52",
        "edge": "79",
        "firefox": "69",
        "firefox_android": "79",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "contain-style": {
    "name": "Style containment",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-07-26",
      "baseline_high_date": "2025-01-26",
      "support": {
        "chrome": "52",
        "chrome_android": "52",
        "edge": "79",
        "firefox": "103",
        "firefox_android": "103",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "container-anchor-position-queries": {
    "name": "Anchor position container queries",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "143",
        "chrome_android": "143",
        "edge": "143"
      }
    }
  },
  "container-queries": {
    "name": "Container queries",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-02-14",
      "baseline_high_date": "2025-08-14",
      "support": {
        "chrome": "105",
        "chrome_android": "105",
        "edge": "105",
        "firefox": "110",
        "firefox_android": "110",
        "safari": "16",
        "safari_ios": "16"
      }
    }
  },
  "container-scroll-state-queries": {
    "name": "Container scroll-state queries",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "133",
        "chrome_android": "133",
        "edge": "133"
      }
    }
  },
  "container-style-queries": {
    "name": "Container style queries",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "111",
        "chrome_android": "111",
        "edge": "111",
        "safari": "18",
        "safari_ios": "18"
      }
    }
  },
  "content": {
    "name": "Content",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "content-index": {
    "name": "Content Index",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome_android": "84"
      }
    }
  },
  "content-visibility": {
    "name": "content-visibility",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-09-15",
      "support": {
        "chrome": "108",
        "chrome_android": "108",
        "edge": "108",
        "firefox": "130",
        "firefox_android": "130",
        "safari": "26",
        "safari_ios": "26"
      }
    }
  },
  "contenteditable": {
    "name": "contenteditable",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "4",
        "firefox_android": "4",
        "safari": "\u22644",
        "safari_ios": "\u22643.2"
      }
    }
  },
  "contenteditable-plaintextonly": {
    "name": 'contenteditable="plaintext-only"',
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-03-04",
      "support": {
        "chrome": "51",
        "chrome_android": "51",
        "edge": "12",
        "firefox": "136",
        "firefox_android": "136",
        "safari": "5.1",
        "safari_ios": "5"
      }
    }
  },
  "context-fill-stroke": {
    "name": "context-fill and context-stroke",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "124",
        "chrome_android": "124",
        "edge": "124",
        "firefox": "111",
        "firefox_android": "111"
      }
    }
  },
  "contrast-color": {
    "name": "contrast-color()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "146",
        "firefox_android": "146",
        "safari": "26",
        "safari_ios": "26"
      }
    }
  },
  "controls-list": {
    "name": "controlslist",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "58",
        "chrome_android": "58",
        "edge": "79"
      }
    }
  },
  "cookie-enabled": {
    "name": "cookieEnabled",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-09-16",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "18",
        "safari_ios": "18"
      }
    }
  },
  "cookie-store": {
    "name": "Cookie store",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "87",
        "chrome_android": "87",
        "edge": "87"
      }
    }
  },
  "cookies": {
    "name": "Cookies",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "corner-shape": {
    "name": "corner-shape",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "139",
        "chrome_android": "139",
        "edge": "139"
      }
    }
  },
  "cors": {
    "name": "CORS",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "4",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "3.5",
        "firefox_android": "4",
        "safari": "4",
        "safari_ios": "3.2"
      }
    }
  },
  "counter-reset-reversed": {
    "name": "Reversed counter-reset",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "96",
        "firefox_android": "96"
      }
    }
  },
  "counter-set": {
    "name": "counter-set",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-12-11",
      "support": {
        "chrome": "85",
        "chrome_android": "85",
        "edge": "85",
        "firefox": "68",
        "firefox_android": "68",
        "safari": "17.2",
        "safari_ios": "17.2"
      }
    }
  },
  "counter-style": {
    "name": "@counter-style",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-09-18",
      "support": {
        "chrome": "91",
        "chrome_android": "91",
        "edge": "91",
        "firefox": "33",
        "firefox_android": "33",
        "safari": "17",
        "safari_ios": "17"
      }
    }
  },
  "counters": {
    "name": "Counters (CSS)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "2",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "25",
        "safari": "3",
        "safari_ios": "1"
      }
    }
  },
  "createimagebitmap": {
    "name": "createImageBitmap",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-12-11",
      "support": {
        "chrome": "59",
        "chrome_android": "59",
        "edge": "79",
        "firefox": "98",
        "firefox_android": "98",
        "safari": "17.2",
        "safari_ios": "17.2"
      }
    }
  },
  "credential-management": {
    "name": "Credential management",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "60",
        "chrome_android": "60",
        "edge": "79",
        "firefox": "60",
        "firefox_android": "60",
        "safari": "13",
        "safari_ios": "13"
      }
    }
  },
  "crisp-edges": {
    "name": "crisp-edges",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "65",
        "firefox_android": "65",
        "safari": "7",
        "safari_ios": "7"
      }
    }
  },
  "cross-document-view-transitions": {
    "name": "Cross-document view transitions",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "126",
        "chrome_android": "126",
        "edge": "126",
        "safari": "18.2",
        "safari_ios": "18.2"
      }
    }
  },
  "cross-fade": {
    "name": "cross-fade()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "safari": "10",
        "safari_ios": "9.3"
      }
    }
  },
  "csp": {
    "name": "Content Security Policy (CSP)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2016-08-02",
      "baseline_high_date": "2019-02-02",
      "support": {
        "chrome": "25",
        "chrome_android": "25",
        "edge": "14",
        "firefox": "23",
        "firefox_android": "23",
        "safari": "7",
        "safari_ios": "7"
      }
    }
  },
  "css-escape": {
    "name": "CSS.escape()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "46",
        "chrome_android": "46",
        "edge": "79",
        "firefox": "31",
        "firefox_android": "31",
        "safari": "10.1",
        "safari_ios": "10.3"
      }
    }
  },
  "css-modules": {
    "name": "CSS import attributes",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "123",
        "chrome_android": "123",
        "edge": "123",
        "firefox": "147",
        "firefox_android": "147"
      }
    }
  },
  "css-object-model": {
    "name": "CSS object model",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-09-30",
      "baseline_high_date": "2018-03-30",
      "support": {
        "chrome": "28",
        "chrome_android": "28",
        "edge": "12",
        "firefox": "22",
        "firefox_android": "22",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "css-object-model-discouraged": {
    "name": "CSS object model (DOM level 2)",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "css-supports": {
    "name": "CSS.supports()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "61",
        "chrome_android": "61",
        "edge": "79",
        "firefox": "55",
        "firefox_android": "55",
        "safari": "11",
        "safari_ios": "11"
      }
    }
  },
  "css-typed-om": {
    "name": "CSS typed object model",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "66",
        "chrome_android": "66",
        "edge": "79",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "cubic-bezier-easing": {
    "name": "cubic-bezier() easing",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "16",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "4",
        "firefox_android": "4",
        "safari": "6",
        "safari_ios": "6"
      }
    }
  },
  "currentcolor": {
    "name": "currentColor",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1.5",
        "firefox_android": "4",
        "safari": "4",
        "safari_ios": "3.2"
      }
    }
  },
  "cursor": {
    "name": "Cursor styles",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "68",
        "chrome_android": "68",
        "edge": "79",
        "firefox": "27",
        "firefox_android": "95",
        "safari": "11"
      }
    }
  },
  "custom-ellipses": {
    "name": "Custom ellipses",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "9",
        "firefox_android": "9"
      }
    }
  },
  "custom-media-queries": {
    "name": "Custom media queries",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "custom-properties": {
    "name": "Custom properties",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-04-05",
      "baseline_high_date": "2019-10-05",
      "support": {
        "chrome": "49",
        "chrome_android": "49",
        "edge": "15",
        "firefox": "31",
        "firefox_android": "31",
        "safari": "9.1",
        "safari_ios": "9.3"
      }
    }
  },
  "customizable-select": {
    "name": "Customizable <select>",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "135",
        "chrome_android": "135",
        "edge": "135"
      }
    }
  },
  "customized-built-in-elements": {
    "name": "Customized built-in elements",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "67",
        "chrome_android": "67",
        "edge": "79",
        "firefox": "63",
        "firefox_android": "63"
      }
    }
  },
  "data": {
    "name": "<data>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-10-24",
      "baseline_high_date": "2020-04-24",
      "support": {
        "chrome": "62",
        "chrome_android": "62",
        "edge": "14",
        "firefox": "22",
        "firefox_android": "22",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "data-urls": {
    "name": "Data URLs",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "\u22644",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "\u22642",
        "firefox_android": "4",
        "safari": "\u22643.1",
        "safari_ios": "\u22642"
      }
    }
  },
  "datalist": {
    "name": "<datalist>",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "69",
        "chrome_android": "69",
        "edge": "12",
        "firefox": "110",
        "safari": "12.1",
        "safari_ios": "12.2"
      }
    }
  },
  "dataset": {
    "name": "Dataset",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "7",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "6",
        "firefox_android": "6",
        "safari": "5.1",
        "safari_ios": "5"
      }
    }
  },
  "date": {
    "name": "Date",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "date-get-year-set-year": {
    "name": "getYear() and setYear()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "date-to-gmt-string": {
    "name": "toGMTString()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "declarative-shadow-dom": {
    "name": "Declarative shadow DOM",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-02-20",
      "support": {
        "chrome": "111",
        "chrome_android": "111",
        "edge": "111",
        "firefox": "123",
        "firefox_android": "123",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "dedicated-workers": {
    "name": "Dedicated workers",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "4",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "4",
        "firefox_android": "4",
        "safari": "4",
        "safari_ios": "5"
      }
    }
  },
  "default": {
    "name": ":default",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "10",
        "chrome_android": "18",
        "edge": "79",
        "firefox": "4",
        "firefox_android": "4",
        "safari": "5",
        "safari_ios": "5"
      }
    }
  },
  "del": {
    "name": "<del>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "\u22644",
        "safari_ios": "\u22643.2"
      }
    }
  },
  "description-list": {
    "name": "Description list",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "\u22644",
        "safari_ios": "\u22643.2"
      }
    }
  },
  "destructuring": {
    "name": "Destructuring",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "60",
        "chrome_android": "60",
        "edge": "79",
        "firefox": "55",
        "firefox_android": "55",
        "safari": "11.1",
        "safari_ios": "11.3"
      }
    }
  },
  "details": {
    "name": "<details>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "12",
        "chrome_android": "18",
        "edge": "79",
        "firefox": "49",
        "firefox_android": "49",
        "safari": "6",
        "safari_ios": "6"
      }
    }
  },
  "details-content": {
    "name": "::details-content",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-09-16",
      "support": {
        "chrome": "131",
        "chrome_android": "131",
        "edge": "131",
        "firefox": "143",
        "firefox_android": "143",
        "safari": "18.4",
        "safari_ios": "18.4"
      }
    }
  },
  "details-name": {
    "name": "Mutually exclusive <details> elements",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-09-03",
      "support": {
        "chrome": "120",
        "chrome_android": "120",
        "edge": "120",
        "firefox": "130",
        "firefox_android": "130",
        "safari": "17.2",
        "safari_ios": "17.2"
      }
    }
  },
  "device-memory": {
    "name": "Device memory",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "97",
        "chrome_android": "97",
        "edge": "97"
      }
    }
  },
  "device-orientation-events": {
    "name": "Device orientation events",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-09-18",
      "support": {
        "chrome": "31",
        "chrome_android": "31",
        "edge": "12",
        "firefox": "6",
        "firefox_android": "6",
        "safari": "17",
        "safari_ios": "4.2"
      }
    }
  },
  "device-posture": {
    "name": "Device posture",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "132",
        "chrome_android": "132",
        "edge": "132"
      }
    }
  },
  "device-queries": {
    "name": "Device media queries",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "2",
        "firefox_android": "4",
        "safari": "3",
        "safari_ios": "1"
      }
    }
  },
  "devicepixelratio": {
    "name": "devicePixelRatio",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "18",
        "firefox_android": "18"
      }
    }
  },
  "dfn": {
    "name": "<dfn>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "15",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "6",
        "safari_ios": "6"
      }
    }
  },
  "dialog": {
    "name": "<dialog>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-03-14",
      "baseline_high_date": "2024-09-14",
      "support": {
        "chrome": "37",
        "chrome_android": "37",
        "edge": "79",
        "firefox": "98",
        "firefox_android": "98",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "dialog-closedby": {
    "name": "<dialog closedby>",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "134",
        "chrome_android": "134",
        "edge": "134",
        "firefox": "141",
        "firefox_android": "141"
      }
    }
  },
  "digital-credentials": {
    "name": "Digital credentials",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "141",
        "chrome_android": "141",
        "edge": "141",
        "safari": "26",
        "safari_ios": "26"
      }
    }
  },
  "digital-goods": {
    "name": "Digital goods",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome_android": "101",
        "edge": "134"
      }
    }
  },
  "dir-pseudo": {
    "name": ":dir()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-12-07",
      "support": {
        "chrome": "120",
        "chrome_android": "120",
        "edge": "120",
        "firefox": "49",
        "firefox_android": "49",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "dirname": {
    "name": "dirname",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-08-01",
      "baseline_high_date": "2026-02-01",
      "support": {
        "chrome": "17",
        "chrome_android": "18",
        "edge": "79",
        "firefox": "116",
        "firefox_android": "116",
        "safari": "6",
        "safari_ios": "6"
      }
    }
  },
  "display": {
    "name": "Display",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "display-animation": {
    "name": "display animation",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "117",
        "chrome_android": "117",
        "edge": "117",
        "safari": "18",
        "safari_ios": "18"
      }
    }
  },
  "display-contents": {
    "name": "display: contents",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "display-flow-root": {
    "name": "display: flow-root",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "58",
        "chrome_android": "58",
        "edge": "79",
        "firefox": "53",
        "firefox_android": "53",
        "safari": "13",
        "safari_ios": "13"
      }
    }
  },
  "display-grid-lanes": {
    "kind": "moved",
    "redirect_target": "masonry"
  },
  "display-list-item": {
    "name": "display: list-item",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "display-mode": {
    "name": "display-mode media query",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "47",
        "edge": "79",
        "firefox_android": "116"
      }
    }
  },
  "display-ruby": {
    "name": "display: ruby",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "88",
        "firefox_android": "88"
      }
    }
  },
  "display-table": {
    "name": "display: table",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "\u22642017-04-05",
      "baseline_high_date": "\u22642019-10-05",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "\u226415",
        "firefox": "3",
        "firefox_android": "4",
        "safari": "\u22644",
        "safari_ios": "\u22643.2"
      }
    }
  },
  "div": {
    "name": "<div>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "document-caretpositionfrompoint": {
    "name": "document.caretPositionFromPoint()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-12-12",
      "support": {
        "chrome": "128",
        "chrome_android": "128",
        "edge": "128",
        "firefox": "20",
        "firefox_android": "20",
        "safari": "26.2",
        "safari_ios": "26.2"
      }
    }
  },
  "document-colors": {
    "name": "Document colors",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "64",
        "chrome_android": "64",
        "edge": "12",
        "firefox": "69",
        "firefox_android": "79",
        "safari": "11",
        "safari_ios": "11"
      }
    }
  },
  "document-picture-in-picture": {
    "name": "Document picture-in-picture",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "130",
        "edge": "130"
      }
    }
  },
  "document-write": {
    "name": "document.write()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "45",
        "chrome_android": "45",
        "edge": "12",
        "firefox": "69",
        "firefox_android": "79",
        "safari": "11",
        "safari_ios": "11"
      }
    }
  },
  "dom": {
    "name": "DOM",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "dom-geometry": {
    "name": "DOM Geometry",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "61",
        "chrome_android": "61",
        "edge": "79",
        "firefox": "33",
        "firefox_android": "33",
        "safari": "11",
        "safari_ios": "11"
      }
    }
  },
  "dominant-baseline": {
    "name": "dominant-baseline",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "79",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "4",
        "safari_ios": "3.2"
      }
    }
  },
  "domparser": {
    "name": "DOMParser",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2016-03-21",
      "baseline_high_date": "2018-09-21",
      "support": {
        "chrome": "31",
        "chrome_android": "31",
        "edge": "12",
        "firefox": "12",
        "firefox_android": "14",
        "safari": "9.1",
        "safari_ios": "9.3"
      }
    }
  },
  "download": {
    "name": "download",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2019-09-19",
      "baseline_high_date": "2022-03-19",
      "support": {
        "chrome": "14",
        "chrome_android": "18",
        "edge": "18",
        "firefox": "20",
        "firefox_android": "20",
        "safari": "10.1",
        "safari_ios": "13"
      }
    }
  },
  "draganddrop": {
    "name": "Drag and Drop",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "3",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "3.5",
        "firefox_android": "4",
        "safari": "4",
        "safari_ios": "3.2"
      }
    }
  },
  "dynamic-range": {
    "name": "dynamic-range media query",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-05-03",
      "baseline_high_date": "2024-11-03",
      "support": {
        "chrome": "98",
        "chrome_android": "98",
        "edge": "98",
        "firefox": "100",
        "firefox_android": "100",
        "safari": "13.1",
        "safari_ios": "13.4"
      }
    }
  },
  "early-data": {
    "name": "Early data",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "58",
        "firefox_android": "58"
      }
    }
  },
  "edit-context": {
    "name": "EditContext",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "121",
        "chrome_android": "121",
        "edge": "121"
      }
    }
  },
  "element": {
    "name": "element()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "element-capture": {
    "name": "Element capture",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "132",
        "edge": "132"
      }
    }
  },
  "element-from-point": {
    "name": "document.elementFromPoint() and document.elementsFromPoint()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "43",
        "chrome_android": "43",
        "edge": "79",
        "firefox": "46",
        "firefox_android": "46",
        "safari": "11.1",
        "safari_ios": "11.3"
      }
    }
  },
  "element-timing": {
    "name": "Element timing",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "77",
        "chrome_android": "77",
        "edge": "79"
      }
    }
  },
  "em": {
    "name": "<em>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "\u22644",
        "safari_ios": "\u22643.2"
      }
    }
  },
  "em-unit": {
    "name": "em unit",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "embed": {
    "name": "<embed>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "79",
        "firefox": "1.5",
        "firefox_android": "4",
        "safari": "\u22644",
        "safari_ios": "\u22643.2"
      }
    }
  },
  "empty": {
    "name": ":empty",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3.1",
        "safari_ios": "2"
      }
    }
  },
  "encrypted-media-extensions": {
    "name": "Encrypted media extensions",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2019-03-25",
      "baseline_high_date": "2021-09-25",
      "support": {
        "chrome": "42",
        "chrome_android": "42",
        "edge": "13",
        "firefox": "38",
        "firefox_android": "38",
        "safari": "12.1",
        "safari_ios": "12.2"
      }
    }
  },
  "enterkeyhint": {
    "name": "enterkeyhint",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-11-02",
      "baseline_high_date": "2024-05-02",
      "support": {
        "chrome": "77",
        "chrome_android": "77",
        "edge": "79",
        "firefox": "94",
        "firefox_android": "94",
        "safari": "13.1",
        "safari_ios": "13.4"
      }
    }
  },
  "error-cause": {
    "name": "Error cause",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-09-20",
      "baseline_high_date": "2024-03-20",
      "support": {
        "chrome": "93",
        "chrome_android": "93",
        "edge": "93",
        "firefox": "91",
        "firefox_android": "91",
        "safari": "15",
        "safari_ios": "15"
      }
    }
  },
  "escape-unescape": {
    "name": "escape() and unescape()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "event-timing": {
    "name": "Event timing",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-12-12",
      "support": {
        "chrome": "76",
        "chrome_android": "76",
        "edge": "79",
        "firefox": "89",
        "firefox_android": "89",
        "safari": "26.2",
        "safari_ios": "26.2"
      }
    }
  },
  "events": {
    "name": "Events",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "ex": {
    "name": "ex unit",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "execcommand": {
    "name": "execCommand()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "69",
        "firefox_android": "79",
        "safari": "1.3",
        "safari_ios": "1"
      }
    }
  },
  "exp-functions": {
    "name": "pow(), sqrt(), hypot(), log(), and exp()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-12-07",
      "support": {
        "chrome": "120",
        "chrome_android": "120",
        "edge": "120",
        "firefox": "118",
        "firefox_android": "118",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "explicit-resource-management": {
    "name": "Explicit resource management",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "134",
        "chrome_android": "134",
        "edge": "134",
        "firefox": "141",
        "firefox_android": "141"
      }
    }
  },
  "exponentiation": {
    "name": "Exponentiation operator",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-03-27",
      "baseline_high_date": "2019-09-27",
      "support": {
        "chrome": "52",
        "chrome_android": "52",
        "edge": "14",
        "firefox": "52",
        "firefox_android": "52",
        "safari": "10.1",
        "safari_ios": "10.3"
      }
    }
  },
  "ext-blend-minmax": {
    "name": "EXT_blend_minmax WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2018-04-30",
      "baseline_high_date": "2020-10-30",
      "support": {
        "chrome": "38",
        "chrome_android": "38",
        "edge": "17",
        "firefox": "47",
        "firefox_android": "35",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "ext-color-buffer-float": {
    "name": "EXT_color_buffer_float WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-09-20",
      "baseline_high_date": "2024-03-20",
      "support": {
        "chrome": "56",
        "chrome_android": "56",
        "edge": "79",
        "firefox": "51",
        "firefox_android": "51",
        "safari": "15",
        "safari_ios": "15"
      }
    }
  },
  "ext-color-buffer-half-float": {
    "name": "EXT_color_buffer_half_float WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-09-16",
      "baseline_high_date": "2023-03-16",
      "support": {
        "chrome": "63",
        "chrome_android": "63",
        "edge": "17",
        "firefox": "47",
        "firefox_android": "36",
        "safari": "14",
        "safari_ios": "14"
      }
    }
  },
  "ext-disjoint-timer-query": {
    "name": "EXT_disjoint_timer_query WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "ext-float-blend": {
    "name": "EXT_float_blend WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "75",
        "chrome_android": "75",
        "edge": "79",
        "firefox": "67",
        "firefox_android": "67",
        "safari": "14.1"
      }
    }
  },
  "ext-frag-depth": {
    "name": "EXT_frag_depth WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "38",
        "chrome_android": "38",
        "edge": "93",
        "firefox": "47",
        "safari": "9",
        "safari_ios": "15"
      }
    }
  },
  "ext-shader-texture-lod": {
    "name": "EXT_shader_texture_lod WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "38",
        "chrome_android": "38",
        "edge": "93",
        "firefox": "47",
        "safari": "8",
        "safari_ios": "8"
      }
    }
  },
  "ext-srgb": {
    "name": "EXT_sRGB WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-02-07",
      "baseline_high_date": "2022-08-07",
      "support": {
        "chrome": "40",
        "chrome_android": "40",
        "edge": "80",
        "firefox": "58",
        "firefox_android": "28",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "ext-texture-compression-bptc": {
    "name": "EXT_texture_compression_bptc WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "93",
        "chrome_android": "92",
        "edge": "93",
        "firefox": "68",
        "safari": "16"
      }
    }
  },
  "ext-texture-compression-rgtc": {
    "name": "EXT_texture_compression_rgtc WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "93",
        "chrome_android": "83",
        "edge": "93",
        "safari": "14.1"
      }
    }
  },
  "ext-texture-filter-anisotropic": {
    "name": "EXT_texture_filter_anisotropic WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2016-06-07",
      "baseline_high_date": "2018-12-07",
      "support": {
        "chrome": "34",
        "chrome_android": "34",
        "edge": "12",
        "firefox": "47",
        "firefox_android": "47",
        "safari": "9.1",
        "safari_ios": "9.3"
      }
    }
  },
  "ext-texture-norm16": {
    "name": "EXT_texture_norm16 WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "87",
        "chrome_android": "87",
        "edge": "87",
        "safari": "16",
        "safari_ios": "16"
      }
    }
  },
  "external": {
    "name": "window.external",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "9",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "2",
        "firefox_android": "4"
      }
    }
  },
  "eyedropper": {
    "name": "Eyedropper",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "96",
        "edge": "96"
      }
    }
  },
  "fast-seek": {
    "name": "fastSeek()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "31",
        "firefox_android": "31",
        "safari": "8",
        "safari_ios": "8"
      }
    }
  },
  "feature-policy": {
    "name": "Feature policy",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "74",
        "chrome_android": "74",
        "edge": "79"
      }
    }
  },
  "fedcm": {
    "name": "Federated credential management",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "116",
        "chrome_android": "116",
        "edge": "116"
      }
    }
  },
  "federated-credentials": {
    "name": "Federated credentials",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "51",
        "chrome_android": "51",
        "edge": "79"
      }
    }
  },
  "fencedframe": {
    "name": "<fencedframe>",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "126",
        "chrome_android": "126",
        "edge": "126"
      }
    }
  },
  "fetch": {
    "name": "Fetch",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-03-27",
      "baseline_high_date": "2019-09-27",
      "support": {
        "chrome": "42",
        "chrome_android": "42",
        "edge": "14",
        "firefox": "39",
        "firefox_android": "39",
        "safari": "10.1",
        "safari_ios": "10.3"
      }
    }
  },
  "fetch-metadata": {
    "name": "Fetch metadata request headers",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "80",
        "chrome_android": "80",
        "edge": "80",
        "firefox": "90",
        "firefox_android": "90"
      }
    }
  },
  "fetch-priority": {
    "name": "Fetch priority",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-10-29",
      "support": {
        "chrome": "103",
        "chrome_android": "103",
        "edge": "103",
        "firefox": "132",
        "firefox_android": "132",
        "safari": "17.2",
        "safari_ios": "17.2"
      }
    }
  },
  "fetch-request-streams": {
    "name": "Fetch upload streams",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "105",
        "chrome_android": "105",
        "edge": "105",
        "safari": "11.1",
        "safari_ios": "11.3"
      }
    }
  },
  "fetchlater": {
    "name": "fetchLater",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "135",
        "chrome_android": "135",
        "edge": "135"
      }
    }
  },
  "field-sizing": {
    "name": "field-sizing",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "123",
        "chrome_android": "123",
        "edge": "123",
        "safari": "26.2",
        "safari_ios": "26.2"
      }
    }
  },
  "fieldset": {
    "name": "<fieldset> and <legend>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "\u22644",
        "safari_ios": "\u22643.2"
      }
    }
  },
  "figure": {
    "name": "<figure> and <figcaption>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "8",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "4",
        "firefox_android": "4",
        "safari": "5.1",
        "safari_ios": "5"
      }
    }
  },
  "file": {
    "name": "File API",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "38",
        "chrome_android": "38",
        "edge": "79",
        "firefox": "28",
        "firefox_android": "28",
        "safari": "10.1",
        "safari_ios": "10.3"
      }
    }
  },
  "file-selector-button": {
    "name": "::file-selector-button",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-04-26",
      "baseline_high_date": "2023-10-26",
      "support": {
        "chrome": "89",
        "chrome_android": "89",
        "edge": "89",
        "firefox": "82",
        "firefox_android": "82",
        "safari": "14.1",
        "safari_ios": "14.5"
      }
    }
  },
  "file-system-access": {
    "name": "File system access",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "86",
        "chrome_android": "132",
        "edge": "86"
      }
    }
  },
  "filter": {
    "name": "filter",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2016-09-07",
      "baseline_high_date": "2019-03-07",
      "support": {
        "chrome": "53",
        "chrome_android": "53",
        "edge": "12",
        "firefox": "35",
        "firefox_android": "35",
        "safari": "9.1",
        "safari_ios": "9.3"
      }
    }
  },
  "filter-function": {
    "name": "filter()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "safari": "9.1",
        "safari_ios": "9.3"
      }
    }
  },
  "first-letter": {
    "name": "::first-letter",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "first-line": {
    "name": "::first-line",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "fit-content": {
    "name": "fit-content",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-11-02",
      "baseline_high_date": "2024-05-02",
      "support": {
        "chrome": "46",
        "chrome_android": "46",
        "edge": "79",
        "firefox": "94",
        "firefox_android": "94",
        "safari": "11",
        "safari_ios": "11"
      }
    }
  },
  "fit-content-function": {
    "name": "fit-content()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "fixed-positioning": {
    "name": "Fixed positioning",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "flexbox": {
    "name": "Flexbox",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-09-30",
      "baseline_high_date": "2018-03-30",
      "support": {
        "chrome": "29",
        "chrome_android": "29",
        "edge": "12",
        "firefox": "20",
        "firefox_android": "20",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "flexbox-gap": {
    "name": "Flexbox gap",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-04-26",
      "baseline_high_date": "2023-10-26",
      "support": {
        "chrome": "84",
        "chrome_android": "84",
        "edge": "84",
        "firefox": "63",
        "firefox_android": "63",
        "safari": "14.1",
        "safari_ios": "14.5"
      }
    }
  },
  "float-clear": {
    "name": "float and clear",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "float16array": {
    "name": "Float16Array",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-04-04",
      "support": {
        "chrome": "135",
        "chrome_android": "135",
        "edge": "135",
        "firefox": "129",
        "firefox_android": "129",
        "safari": "18.2",
        "safari_ios": "18.2"
      }
    }
  },
  "focus-events": {
    "name": "Focus events",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "24",
        "firefox_android": "24",
        "safari": "3.1",
        "safari_ios": "2"
      }
    }
  },
  "focus-visible": {
    "name": ":focus-visible",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-03-14",
      "baseline_high_date": "2024-09-14",
      "support": {
        "chrome": "86",
        "chrome_android": "86",
        "edge": "86",
        "firefox": "85",
        "firefox_android": "85",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "focus-within": {
    "name": ":focus-within",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "60",
        "chrome_android": "60",
        "edge": "79",
        "firefox": "52",
        "firefox_android": "52",
        "safari": "10.1",
        "safari_ios": "10.3"
      }
    }
  },
  "font-display": {
    "name": "font-display",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "60",
        "chrome_android": "60",
        "edge": "79",
        "firefox": "58",
        "firefox_android": "58",
        "safari": "11.1",
        "safari_ios": "11.3"
      }
    }
  },
  "font-face": {
    "name": "@font-face",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2016-09-20",
      "baseline_high_date": "2019-03-20",
      "support": {
        "chrome": "36",
        "chrome_android": "36",
        "edge": "14",
        "firefox": "39",
        "firefox_android": "39",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "font-family": {
    "name": "font-family",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "font-family-math": {
    "name": "Math font family",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-12-12",
      "support": {
        "chrome": "109",
        "chrome_android": "109",
        "edge": "109",
        "firefox": "145",
        "firefox_android": "145",
        "safari": "26.2",
        "safari_ios": "26.2"
      }
    }
  },
  "font-family-system": {
    "name": "System font",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-09-07",
      "baseline_high_date": "2024-03-07",
      "support": {
        "chrome": "56",
        "chrome_android": "56",
        "edge": "79",
        "firefox": "92",
        "firefox_android": "92",
        "safari": "11",
        "safari_ios": "11"
      }
    }
  },
  "font-family-ui": {
    "name": "UI fonts",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "safari": "13.1",
        "safari_ios": "13.4"
      }
    }
  },
  "font-feature-settings": {
    "name": "font-feature-settings",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-04-05",
      "baseline_high_date": "2019-10-05",
      "support": {
        "chrome": "48",
        "chrome_android": "48",
        "edge": "15",
        "firefox": "34",
        "firefox_android": "34",
        "safari": "9.1",
        "safari_ios": "9.3"
      }
    }
  },
  "font-kerning": {
    "name": "font-kerning",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "33",
        "chrome_android": "33",
        "edge": "79",
        "firefox": "32",
        "firefox_android": "32",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "font-language-override": {
    "name": "font-language-override",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "143",
        "chrome_android": "143",
        "edge": "143",
        "firefox": "34",
        "firefox_android": "34"
      }
    }
  },
  "font-loading": {
    "name": "Font loading",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "35",
        "chrome_android": "35",
        "edge": "79",
        "firefox": "41",
        "firefox_android": "41",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "font-metric-overrides": {
    "name": "Font metric overrides",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "87",
        "chrome_android": "87",
        "edge": "87",
        "firefox": "89",
        "firefox_android": "89"
      }
    }
  },
  "font-optical-sizing": {
    "name": "font-optical-sizing",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-03-24",
      "baseline_high_date": "2022-09-24",
      "support": {
        "chrome": "79",
        "chrome_android": "79",
        "edge": "17",
        "firefox": "62",
        "firefox_android": "62",
        "safari": "13.1",
        "safari_ios": "13.4"
      }
    }
  },
  "font-palette": {
    "name": "font-palette",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-11-15",
      "baseline_high_date": "2025-05-15",
      "support": {
        "chrome": "101",
        "chrome_android": "101",
        "edge": "101",
        "firefox": "107",
        "firefox_android": "107",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "font-palette-animation": {
    "name": "font-palette animation",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "121",
        "chrome_android": "121",
        "edge": "121"
      }
    }
  },
  "font-shorthand": {
    "name": "Font shorthand",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "font-size": {
    "name": "font-size",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "font-size-adjust": {
    "name": "font-size-adjust",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-07-25",
      "support": {
        "chrome": "127",
        "chrome_android": "127",
        "edge": "127",
        "firefox": "118",
        "firefox_android": "118",
        "safari": "17",
        "safari_ios": "17"
      }
    }
  },
  "font-stretch": {
    "name": "font-stretch",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "62",
        "chrome_android": "62",
        "edge": "79",
        "firefox": "62",
        "firefox_android": "62",
        "safari": "11.1",
        "safari_ios": "11.3"
      }
    }
  },
  "font-style": {
    "name": "font-style",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "font-synthesis": {
    "name": "font-synthesis",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-01-06",
      "baseline_high_date": "2024-07-06",
      "support": {
        "chrome": "97",
        "chrome_android": "97",
        "edge": "97",
        "firefox": "34",
        "firefox_android": "34",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "font-synthesis-position": {
    "name": "font-synthesis-position",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "118",
        "firefox_android": "118"
      }
    }
  },
  "font-synthesis-small-caps": {
    "name": "font-synthesis-small-caps",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-03-27",
      "baseline_high_date": "2025-09-27",
      "support": {
        "chrome": "97",
        "chrome_android": "97",
        "edge": "97",
        "firefox": "111",
        "firefox_android": "111",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "font-synthesis-style": {
    "name": "font-synthesis-style",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-03-27",
      "baseline_high_date": "2025-09-27",
      "support": {
        "chrome": "97",
        "chrome_android": "97",
        "edge": "97",
        "firefox": "111",
        "firefox_android": "111",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "font-synthesis-weight": {
    "name": "font-synthesis-weight",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-03-27",
      "baseline_high_date": "2025-09-27",
      "support": {
        "chrome": "97",
        "chrome_android": "97",
        "edge": "97",
        "firefox": "111",
        "firefox_android": "111",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "font-variant": {
    "name": "font-variant",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "font-variant-alternates": {
    "name": "font-variant-alternates",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-03-13",
      "baseline_high_date": "2025-09-13",
      "support": {
        "chrome": "111",
        "chrome_android": "111",
        "edge": "111",
        "firefox": "34",
        "firefox_android": "34",
        "safari": "9.1",
        "safari_ios": "9.3"
      }
    }
  },
  "font-variant-caps": {
    "name": "font-variant-caps",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "52",
        "chrome_android": "52",
        "edge": "79",
        "firefox": "34",
        "firefox_android": "34",
        "safari": "9.1",
        "safari_ios": "9.3"
      }
    }
  },
  "font-variant-east-asian": {
    "name": "font-variant-east-asian",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "63",
        "chrome_android": "63",
        "edge": "79",
        "firefox": "34",
        "firefox_android": "34",
        "safari": "9.1",
        "safari_ios": "9.3"
      }
    }
  },
  "font-variant-emoji": {
    "name": "font-variant-emoji",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "131",
        "chrome_android": "131",
        "edge": "131",
        "firefox": "141",
        "firefox_android": "141"
      }
    }
  },
  "font-variant-ligatures": {
    "name": "font-variant-ligatures",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "34",
        "chrome_android": "34",
        "edge": "79",
        "firefox": "34",
        "firefox_android": "34",
        "safari": "9.1",
        "safari_ios": "9.3"
      }
    }
  },
  "font-variant-numeric": {
    "name": "font-variant-numeric",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "52",
        "chrome_android": "52",
        "edge": "79",
        "firefox": "34",
        "firefox_android": "34",
        "safari": "9.1",
        "safari_ios": "9.3"
      }
    }
  },
  "font-variant-position": {
    "name": "font-variant-position",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "34",
        "firefox_android": "34"
      }
    }
  },
  "font-variation-settings": {
    "name": "font-variation-settings",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2018-09-05",
      "baseline_high_date": "2021-03-05",
      "support": {
        "chrome": "62",
        "chrome_android": "62",
        "edge": "17",
        "firefox": "62",
        "firefox_android": "62",
        "safari": "11",
        "safari_ios": "11"
      }
    }
  },
  "font-weight": {
    "name": "font-weight",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "2",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "font-width": {
    "name": "font-width",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "safari": "18.4"
      }
    }
  },
  "forced-colors": {
    "name": "Forced colors",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-09-12",
      "baseline_high_date": "2025-03-12",
      "support": {
        "chrome": "89",
        "chrome_android": "89",
        "edge": "79",
        "firefox": "89",
        "firefox_android": "89",
        "safari": "16",
        "safari_ios": "16"
      }
    }
  },
  "form": {
    "name": "<form>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3",
        "safari_ios": "2"
      }
    }
  },
  "form-associated-custom-elements": {
    "name": "Form-associated custom elements",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-03-27",
      "baseline_high_date": "2025-09-27",
      "support": {
        "chrome": "77",
        "chrome_android": "77",
        "edge": "79",
        "firefox": "98",
        "firefox_android": "98",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "form-validity-pseudos": {
    "name": "Form validity pseudo-classes",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "10",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "4",
        "firefox_android": "4",
        "safari": "5",
        "safari_ios": "5"
      }
    }
  },
  "fullscreen": {
    "name": "Fullscreen API",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "71",
        "chrome_android": "71",
        "edge": "79",
        "firefox": "64",
        "firefox_android": "64",
        "safari": "16.4"
      }
    }
  },
  "function": {
    "name": "@function",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "139",
        "chrome_android": "139",
        "edge": "139"
      }
    }
  },
  "functions": {
    "name": "Functions",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "functions-caller-arguments": {
    "name": "Function caller and arguments",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3",
        "safari_ios": "1"
      }
    }
  },
  "gamepad": {
    "name": "Gamepad",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-03-27",
      "baseline_high_date": "2019-09-27",
      "support": {
        "chrome": "35",
        "chrome_android": "35",
        "edge": "12",
        "firefox": "29",
        "firefox_android": "32",
        "safari": "10.1",
        "safari_ios": "10.3"
      }
    }
  },
  "gamepad-haptics": {
    "name": "Gamepad haptic feedback",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "68",
        "chrome_android": "68",
        "edge": "79",
        "safari": "16.4"
      }
    }
  },
  "gamepad-touch": {
    "name": "Gamepad touch buttons",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "73",
        "chrome_android": "73",
        "edge": "15",
        "firefox": "55",
        "firefox_android": "55"
      }
    }
  },
  "gamepad-vr": {
    "name": "Gamepad VR hands and poses",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "55",
        "firefox_android": "55"
      }
    }
  },
  "gap-decorations": {
    "name": "Gap decorations",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "generators": {
    "name": "Generators",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2016-09-20",
      "baseline_high_date": "2019-03-20",
      "support": {
        "chrome": "39",
        "chrome_android": "39",
        "edge": "13",
        "firefox": "26",
        "firefox_android": "26",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "geolocation": {
    "name": "Geolocation API",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "5",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "3.5",
        "firefox_android": "4",
        "safari": "5",
        "safari_ios": "\u22643"
      }
    }
  },
  "geolocation-element": {
    "name": "<geolocation>",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "get-computed-style": {
    "name": "getComputedStyle()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "11",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "3.5",
        "firefox_android": "4",
        "safari": "5.1",
        "safari_ios": "5"
      }
    }
  },
  "getallrecords": {
    "name": "IndexedDB getAllRecords()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "141",
        "chrome_android": "141",
        "edge": "141"
      }
    }
  },
  "getboxquads": {
    "name": "getBoxQuads()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "gethtml": {
    "name": "getHTML()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-09-16",
      "support": {
        "chrome": "125",
        "chrome_android": "125",
        "edge": "125",
        "firefox": "128",
        "firefox_android": "128",
        "safari": "18",
        "safari_ios": "18"
      }
    }
  },
  "getorinsert": {
    "name": "Map getOrInsert()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2026-02-14",
      "support": {
        "chrome": "145",
        "chrome_android": "145",
        "edge": "145",
        "firefox": "144",
        "firefox_android": "144",
        "safari": "26.2",
        "safari_ios": "26.2"
      }
    }
  },
  "globalthis": {
    "name": "globalThis",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "71",
        "chrome_android": "71",
        "edge": "79",
        "firefox": "65",
        "firefox_android": "65",
        "safari": "12.1",
        "safari_ios": "12.2"
      }
    }
  },
  "glyph-orientation-vertical": {
    "name": "glyph-orientation-vertical",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "safari": "4",
        "safari_ios": "3.2"
      }
    }
  },
  "gpc": {
    "name": "Global privacy control",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "120",
        "firefox_android": "122"
      }
    }
  },
  "gradient-interpolation": {
    "name": "Gradient interpolation",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-06-11",
      "support": {
        "chrome": "111",
        "chrome_android": "111",
        "edge": "111",
        "firefox": "127",
        "firefox_android": "127",
        "safari": "16.2",
        "safari_ios": "16.2"
      }
    }
  },
  "gradients": {
    "name": "Gradients",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "26",
        "chrome_android": "26",
        "edge": "12",
        "firefox": "3.6",
        "firefox_android": "4",
        "safari": "7",
        "safari_ios": "7"
      }
    }
  },
  "grid": {
    "name": "Grid",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-10-17",
      "baseline_high_date": "2020-04-17",
      "support": {
        "chrome": "57",
        "chrome_android": "57",
        "edge": "16",
        "firefox": "52",
        "firefox_android": "52",
        "safari": "10.1",
        "safari_ios": "10.3"
      }
    }
  },
  "grid-animation": {
    "name": "Grid animation",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-10-27",
      "baseline_high_date": "2025-04-27",
      "support": {
        "chrome": "107",
        "chrome_android": "107",
        "edge": "107",
        "firefox": "66",
        "firefox_android": "66",
        "safari": "16",
        "safari_ios": "16"
      }
    }
  },
  "grid-lanes": {
    "kind": "moved",
    "redirect_target": "masonry"
  },
  "gyroscope": {
    "name": "Gyroscope",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "67",
        "chrome_android": "67",
        "edge": "79"
      }
    }
  },
  "hanging-punctuation": {
    "name": "Hanging punctuation",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "hardware-concurrency": {
    "name": "hardwareConcurrency",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-03-14",
      "baseline_high_date": "2024-09-14",
      "support": {
        "chrome": "37",
        "chrome_android": "37",
        "edge": "15",
        "firefox": "48",
        "firefox_android": "48",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "has": {
    "name": ":has()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-12-19",
      "support": {
        "chrome": "105",
        "chrome_android": "105",
        "edge": "105",
        "firefox": "121",
        "firefox_android": "121",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "has-slotted": {
    "name": ":has-slotted",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "136",
        "firefox_android": "136"
      }
    }
  },
  "hashbang-comments": {
    "name": "Hashbang comments",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-03-24",
      "baseline_high_date": "2022-09-24",
      "support": {
        "chrome": "74",
        "chrome_android": "74",
        "edge": "79",
        "firefox": "67",
        "firefox_android": "67",
        "safari": "13.1",
        "safari_ios": "13.4"
      }
    }
  },
  "hashchange": {
    "name": "hashchange",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "16",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "11",
        "firefox_android": "14",
        "safari": "6",
        "safari_ios": "6"
      }
    }
  },
  "head": {
    "name": "<head>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "header-footer": {
    "name": "<header> and <footer>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "5",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "4",
        "firefox_android": "4",
        "safari": "5",
        "safari_ios": "4.2"
      }
    }
  },
  "heading-selectors": {
    "name": "Heading pseudo-classes",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "headings": {
    "name": "<h1> through <h6>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3",
        "safari_ios": "1"
      }
    }
  },
  "hgroup": {
    "name": "<hgroup>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "5",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "4",
        "firefox_android": "4",
        "safari": "5",
        "safari_ios": "4.2"
      }
    }
  },
  "hidden-until-found": {
    "name": 'hidden="until-found"',
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "102",
        "chrome_android": "102",
        "edge": "102",
        "firefox": "148",
        "firefox_android": "148"
      }
    }
  },
  "highlight": {
    "name": "Custom highlights",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "105",
        "chrome_android": "105",
        "edge": "105",
        "safari": "17.2",
        "safari_ios": "17.2"
      }
    }
  },
  "highlightsfrompoint": {
    "name": "Custom highlights from point",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "140",
        "chrome_android": "140",
        "edge": "140"
      }
    }
  },
  "history": {
    "name": "History",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "5",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "4",
        "firefox_android": "4",
        "safari": "5",
        "safari_ios": "4"
      }
    }
  },
  "host": {
    "name": "Host",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "54",
        "chrome_android": "54",
        "edge": "79",
        "firefox": "63",
        "firefox_android": "63",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "host-context": {
    "name": ":host-context()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "54",
        "chrome_android": "54",
        "edge": "79"
      }
    }
  },
  "hr": {
    "name": "<hr>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3",
        "safari_ios": "1"
      }
    }
  },
  "hsl": {
    "name": "HSL",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "65",
        "chrome_android": "65",
        "edge": "79",
        "firefox": "52",
        "firefox_android": "52",
        "safari": "12.1",
        "safari_ios": "12.2"
      }
    }
  },
  "hsts": {
    "name": "HTTP Strict Transport Security",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "4",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "4",
        "firefox_android": "4",
        "safari": "7",
        "safari_ios": "7"
      }
    }
  },
  "html": {
    "name": "<html>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "html-media-capture": {
    "name": "HTML media capture",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome_android": "25",
        "firefox_android": "79",
        "safari_ios": "10"
      }
    }
  },
  "html-wrapper-methods": {
    "name": "HTML wrapper methods",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "http-authentication": {
    "name": "HTTP authentication",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "http11": {
    "name": "HTTP/1.1",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "http2": {
    "name": "HTTP/2",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-09-30",
      "baseline_high_date": "2018-03-30",
      "support": {
        "chrome": "41",
        "chrome_android": "41",
        "edge": "12",
        "firefox": "36",
        "firefox_android": "36",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "http3": {
    "name": "HTTP/3",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-09-16",
      "support": {
        "chrome": "87",
        "chrome_android": "87",
        "edge": "87",
        "firefox": "88",
        "firefox_android": "88",
        "safari": "18",
        "safari_ios": "18"
      }
    }
  },
  "hwb": {
    "name": "HWB",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-04-28",
      "baseline_high_date": "2024-10-28",
      "support": {
        "chrome": "101",
        "chrome_android": "101",
        "edge": "101",
        "firefox": "96",
        "firefox_android": "96",
        "safari": "15",
        "safari_ios": "15"
      }
    }
  },
  "hyphenate-character": {
    "name": "Hyphenate character",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-09-18",
      "support": {
        "chrome": "106",
        "chrome_android": "106",
        "edge": "106",
        "firefox": "98",
        "firefox_android": "98",
        "safari": "17",
        "safari_ios": "17"
      }
    }
  },
  "hyphenate-limit-chars": {
    "name": "Hyphenate limit chars",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "109",
        "chrome_android": "109",
        "edge": "109",
        "firefox": "137",
        "firefox_android": "137"
      }
    }
  },
  "hyphens": {
    "name": "Hyphenation",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-09-18",
      "support": {
        "chrome": "88",
        "chrome_android": "55",
        "edge": "88",
        "firefox": "43",
        "firefox_android": "43",
        "safari": "17",
        "safari_ios": "17"
      }
    }
  },
  "i": {
    "name": "<i>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "ic": {
    "name": "ic unit",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-10-03",
      "baseline_high_date": "2025-04-03",
      "support": {
        "chrome": "106",
        "chrome_android": "106",
        "edge": "106",
        "firefox": "97",
        "firefox_android": "97",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "idle-detection": {
    "name": "Idle detection",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "94",
        "chrome_android": "94",
        "edge": "114"
      }
    }
  },
  "if": {
    "name": "if()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "137",
        "chrome_android": "137",
        "edge": "137"
      }
    }
  },
  "iframe": {
    "name": "<iframe>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "\u22644",
        "safari_ios": "\u22643.2"
      }
    }
  },
  "iframe-credentialless": {
    "name": "Credentialless iframes",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "110",
        "chrome_android": "110",
        "edge": "110"
      }
    }
  },
  "iframe-sandbox": {
    "name": "Sandboxed iframes",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "5",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "17",
        "firefox_android": "17",
        "safari": "5",
        "safari_ios": "4"
      }
    }
  },
  "iframe-srcdoc": {
    "name": "srcdoc",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "20",
        "chrome_android": "25",
        "edge": "79",
        "firefox": "25",
        "firefox_android": "25",
        "safari": "6",
        "safari_ios": "6"
      }
    }
  },
  "image-function": {
    "name": "image()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "image-maps": {
    "name": "Image maps",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "image-orientation": {
    "name": "image-orientation",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-04-13",
      "baseline_high_date": "2022-10-13",
      "support": {
        "chrome": "81",
        "chrome_android": "81",
        "edge": "81",
        "firefox": "26",
        "firefox_android": "26",
        "safari": "13.1",
        "safari_ios": "13.4"
      }
    }
  },
  "image-rendering": {
    "name": "image-rendering",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-10-05",
      "baseline_high_date": "2024-04-05",
      "support": {
        "chrome": "41",
        "chrome_android": "41",
        "edge": "79",
        "firefox": "93",
        "firefox_android": "93",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "image-set": {
    "name": "image-set()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-09-18",
      "support": {
        "chrome": "113",
        "chrome_android": "113",
        "edge": "113",
        "firefox": "89",
        "firefox_android": "89",
        "safari": "17",
        "safari_ios": "17"
      }
    }
  },
  "imagebitmaprenderingcontext": {
    "name": "ImageBitmapRenderingContext",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "66",
        "chrome_android": "66",
        "edge": "79",
        "firefox": "50",
        "firefox_android": "50",
        "safari": "11.1",
        "safari_ios": "11.3"
      }
    }
  },
  "ime-mode": {
    "name": "ime-mode",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "3",
        "firefox_android": "4"
      }
    }
  },
  "img": {
    "name": "<img>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "import": {
    "name": "@import",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "import-assertions": {
    "name": "Import assertions",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "import-maps": {
    "name": "Import maps",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-03-27",
      "baseline_high_date": "2025-09-27",
      "support": {
        "chrome": "89",
        "chrome_android": "89",
        "edge": "89",
        "firefox": "108",
        "firefox_android": "108",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "indeterminate": {
    "name": ":indeterminate",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "39",
        "chrome_android": "39",
        "edge": "79",
        "firefox": "51",
        "firefox_android": "51",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "indexeddb": {
    "name": "IndexedDB",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-09-20",
      "baseline_high_date": "2024-03-20",
      "support": {
        "chrome": "58",
        "chrome_android": "58",
        "edge": "79",
        "firefox": "51",
        "firefox_android": "51",
        "safari": "15",
        "safari_ios": "15"
      }
    }
  },
  "individual-transforms": {
    "name": "Individual transform properties",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-08-05",
      "baseline_high_date": "2025-02-05",
      "support": {
        "chrome": "104",
        "chrome_android": "104",
        "edge": "104",
        "firefox": "72",
        "firefox_android": "79",
        "safari": "14.1",
        "safari_ios": "14.5"
      }
    }
  },
  "inert": {
    "name": "inert",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-04-11",
      "baseline_high_date": "2025-10-11",
      "support": {
        "chrome": "102",
        "chrome_android": "102",
        "edge": "102",
        "firefox": "112",
        "firefox_android": "112",
        "safari": "15.5",
        "safari_ios": "15.5"
      }
    }
  },
  "inherit-value": {
    "name": "inherit",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "initial-letter": {
    "name": "initial-letter",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "110",
        "chrome_android": "110",
        "edge": "110"
      }
    }
  },
  "initial-value": {
    "name": "initial",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-11-12",
      "baseline_high_date": "2018-05-12",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "13",
        "firefox": "19",
        "firefox_android": "19",
        "safari": "1.2",
        "safari_ios": "1"
      }
    }
  },
  "ink": {
    "name": "Ink",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "94",
        "chrome_android": "94",
        "edge": "93"
      }
    }
  },
  "input": {
    "name": "<input>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "input-button": {
    "name": '<input type="button">',
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "input-checkbox": {
    "name": '<input type="checkbox">',
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "3.6",
        "firefox_android": "4",
        "safari": "3",
        "safari_ios": "1"
      }
    }
  },
  "input-color": {
    "name": '<input type="color">',
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "20",
        "chrome_android": "25",
        "edge": "14",
        "firefox": "29",
        "safari": "12.1",
        "safari_ios": "12.2"
      }
    }
  },
  "input-color-alpha": {
    "name": "`alpha` and `colorspace` attributes for `<input type=color>`",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "safari": "18.4",
        "safari_ios": "18.4"
      }
    }
  },
  "input-date-time": {
    "name": "Date and time <input> types",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-04-26",
      "baseline_high_date": "2023-10-26",
      "support": {
        "chrome": "20",
        "chrome_android": "25",
        "edge": "12",
        "firefox": "57",
        "firefox_android": "57",
        "safari": "14.1",
        "safari_ios": "5"
      }
    }
  },
  "input-email-tel-url": {
    "name": "Email, telephone, and URL <input> types",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "5",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "4",
        "firefox_android": "4",
        "safari": "5",
        "safari_ios": "3"
      }
    }
  },
  "input-event": {
    "name": "input (event)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "79",
        "firefox": "6",
        "firefox_android": "6",
        "safari": "3.1",
        "safari_ios": "2"
      }
    }
  },
  "input-file": {
    "name": '<input type="file">',
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "2",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "3",
        "firefox_android": "4",
        "safari": "4",
        "safari_ios": "3"
      }
    }
  },
  "input-file-multiple": {
    "name": '<input type="file" multiple>',
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "2",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "3.6",
        "firefox_android": "4",
        "safari": "4",
        "safari_ios": "3.2"
      }
    }
  },
  "input-file-webkitdirectory": {
    "name": '<input type="file" webkitdirectory>',
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-08-19",
      "support": {
        "chrome": "13",
        "chrome_android": "132",
        "edge": "13",
        "firefox": "50",
        "firefox_android": "142",
        "safari": "11.1",
        "safari_ios": "18.4"
      }
    }
  },
  "input-hidden": {
    "name": '<input type="hidden">',
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "input-image": {
    "name": '<input type="image">',
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "input-number": {
    "name": '<input type="number">',
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "7",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "29",
        "firefox_android": "29",
        "safari": "5.1",
        "safari_ios": "5"
      }
    }
  },
  "input-password": {
    "name": '<input type="password">',
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "input-radio": {
    "name": '<input type="radio">',
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "input-range": {
    "name": '<input type="range">',
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-03-16",
      "baseline_high_date": "2019-09-16",
      "support": {
        "chrome": "4",
        "chrome_android": "57",
        "edge": "12",
        "firefox": "23",
        "firefox_android": "52",
        "safari": "3.1",
        "safari_ios": "5"
      }
    }
  },
  "input-reset": {
    "name": '<input type="reset">',
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "input-selectors": {
    "name": "Input selectors",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3.1",
        "safari_ios": "2"
      }
    }
  },
  "input-submit": {
    "name": '<input type="submit">',
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "inputmode": {
    "name": "inputmode",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-12-07",
      "baseline_high_date": "2024-06-07",
      "support": {
        "chrome": "66",
        "chrome_android": "66",
        "edge": "79",
        "firefox": "95",
        "firefox_android": "79",
        "safari": "12.1",
        "safari_ios": "12.2"
      }
    }
  },
  "ins": {
    "name": "<ins>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "\u22644",
        "safari_ios": "\u22643.2"
      }
    }
  },
  "insertable-streams": {
    "name": "Insertable streams for MediaStreamTrack",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "safari": "18",
        "safari_ios": "18"
      }
    }
  },
  "install": {
    "name": "<install>",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "interaction": {
    "name": "Interaction media queries",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2018-12-11",
      "baseline_high_date": "2021-06-11",
      "support": {
        "chrome": "41",
        "chrome_android": "41",
        "edge": "12",
        "firefox": "64",
        "firefox_android": "64",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "interactivity": {
    "name": "interactivity",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "135",
        "chrome_android": "135",
        "edge": "135"
      }
    }
  },
  "interest-invokers": {
    "name": "Interest invokers",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "142",
        "chrome_android": "142",
        "edge": "142"
      }
    }
  },
  "interpolate-size": {
    "name": "interpolate-size",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "129",
        "chrome_android": "129",
        "edge": "129"
      }
    }
  },
  "intersection-observer": {
    "name": "Intersection observer",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2019-03-25",
      "baseline_high_date": "2021-09-25",
      "support": {
        "chrome": "58",
        "chrome_android": "58",
        "edge": "16",
        "firefox": "55",
        "firefox_android": "55",
        "safari": "12.1",
        "safari_ios": "12.2"
      }
    }
  },
  "intersection-observer-v2": {
    "name": "Intersection observer visibility tracking",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "74",
        "chrome_android": "74",
        "edge": "79"
      }
    }
  },
  "intl": {
    "name": "Intl",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-09-28",
      "baseline_high_date": "2020-03-28",
      "support": {
        "chrome": "24",
        "chrome_android": "25",
        "edge": "12",
        "firefox": "29",
        "firefox_android": "56",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "intl-display-names": {
    "name": "Intl.DisplayNames",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-04-26",
      "baseline_high_date": "2023-10-26",
      "support": {
        "chrome": "81",
        "chrome_android": "81",
        "edge": "81",
        "firefox": "86",
        "firefox_android": "86",
        "safari": "14.1",
        "safari_ios": "14.5"
      }
    }
  },
  "intl-duration-format": {
    "name": "Intl.DurationFormat",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-03-04",
      "support": {
        "chrome": "129",
        "chrome_android": "129",
        "edge": "129",
        "firefox": "136",
        "firefox_android": "136",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "intl-list-format": {
    "name": "Intl.ListFormat",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-04-26",
      "baseline_high_date": "2023-10-26",
      "support": {
        "chrome": "72",
        "chrome_android": "72",
        "edge": "79",
        "firefox": "78",
        "firefox_android": "79",
        "safari": "14.1",
        "safari_ios": "14.5"
      }
    }
  },
  "intl-locale": {
    "name": "Intl.Locale",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-09-16",
      "baseline_high_date": "2023-03-16",
      "support": {
        "chrome": "74",
        "chrome_android": "74",
        "edge": "79",
        "firefox": "75",
        "firefox_android": "79",
        "safari": "14",
        "safari_ios": "14"
      }
    }
  },
  "intl-locale-info": {
    "name": "Intl.Locale info",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "130",
        "chrome_android": "130",
        "edge": "130",
        "safari": "17",
        "safari_ios": "17"
      }
    }
  },
  "intl-plural-rules": {
    "name": "Intl.PluralRules",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2019-09-19",
      "baseline_high_date": "2022-03-19",
      "support": {
        "chrome": "63",
        "chrome_android": "63",
        "edge": "18",
        "firefox": "58",
        "firefox_android": "58",
        "safari": "13",
        "safari_ios": "13"
      }
    }
  },
  "intl-relative-time-format": {
    "name": "Intl.RelativeTimeFormat",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-09-16",
      "baseline_high_date": "2023-03-16",
      "support": {
        "chrome": "71",
        "chrome_android": "71",
        "edge": "79",
        "firefox": "76",
        "firefox_android": "79",
        "safari": "14",
        "safari_ios": "14"
      }
    }
  },
  "intl-segmenter": {
    "name": "Intl.Segmenter",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-04-16",
      "support": {
        "chrome": "87",
        "chrome_android": "87",
        "edge": "87",
        "firefox": "125",
        "firefox_android": "125",
        "safari": "14.1",
        "safari_ios": "14.5"
      }
    }
  },
  "inverted-colors": {
    "name": "inverted-colors media query",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "safari": "9.1",
        "safari_ios": "10"
      }
    }
  },
  "invoker-commands": {
    "name": "Invoker commands",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-12-12",
      "support": {
        "chrome": "135",
        "chrome_android": "135",
        "edge": "135",
        "firefox": "144",
        "firefox_android": "144",
        "safari": "26.2",
        "safari_ios": "26.2"
      }
    }
  },
  "is": {
    "name": ":is()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-01-21",
      "baseline_high_date": "2023-07-21",
      "support": {
        "chrome": "88",
        "chrome_android": "88",
        "edge": "88",
        "firefox": "82",
        "firefox_android": "82",
        "safari": "14",
        "safari_ios": "14"
      }
    }
  },
  "is-error": {
    "name": "Error.isError()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "134",
        "chrome_android": "134",
        "edge": "134",
        "firefox": "138",
        "firefox_android": "138"
      }
    }
  },
  "is-input-pending": {
    "name": "isInputPending()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "87",
        "chrome_android": "87",
        "edge": "87"
      }
    }
  },
  "is-secure-context": {
    "name": "isSecureContext",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2018-04-12",
      "baseline_high_date": "2020-10-12",
      "support": {
        "chrome": "55",
        "chrome_android": "55",
        "edge": "15",
        "firefox": "52",
        "firefox_android": "52",
        "safari": "11.1",
        "safari_ios": "11.3"
      }
    }
  },
  "isolation": {
    "name": "isolation",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "41",
        "chrome_android": "41",
        "edge": "79",
        "firefox": "36",
        "firefox_android": "36",
        "safari": "8",
        "safari_ios": "8"
      }
    }
  },
  "iterator-concat": {
    "name": "Iterator.concat()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "147",
        "firefox_android": "147"
      }
    }
  },
  "iterator-methods": {
    "name": "Iterator methods",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-03-31",
      "support": {
        "chrome": "122",
        "chrome_android": "122",
        "edge": "122",
        "firefox": "131",
        "firefox_android": "131",
        "safari": "18.4",
        "safari_ios": "18.4"
      }
    }
  },
  "iterators": {
    "name": "Iterators and the for...of loop",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "38",
        "chrome_android": "38",
        "edge": "12",
        "firefox": "13",
        "firefox_android": "14",
        "safari": "7",
        "safari_ios": "7"
      }
    }
  },
  "javascript": {
    "name": "JavaScript (initial core language support)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "5",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "5",
        "safari_ios": "4.2"
      }
    }
  },
  "jpegxl": {
    "name": "JPEG XL",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "safari": "17",
        "safari_ios": "17"
      }
    }
  },
  "js-modules": {
    "name": "JavaScript modules",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2018-05-09",
      "baseline_high_date": "2020-11-09",
      "support": {
        "chrome": "61",
        "chrome_android": "61",
        "edge": "16",
        "firefox": "60",
        "firefox_android": "60",
        "safari": "11",
        "safari_ios": "11"
      }
    }
  },
  "js-modules-service-workers": {
    "name": "JavaScript modules in service workers",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2026-01-13",
      "support": {
        "chrome": "91",
        "chrome_android": "91",
        "edge": "91",
        "firefox": "147",
        "firefox_android": "147",
        "safari": "15",
        "safari_ios": "15"
      }
    }
  },
  "js-modules-shared-workers": {
    "name": "JavaScript modules in shared workers",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "80",
        "edge": "80",
        "firefox": "114",
        "firefox_android": "114",
        "safari": "16",
        "safari_ios": "16"
      }
    }
  },
  "js-modules-workers": {
    "name": "JavaScript modules in workers",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-06-06",
      "baseline_high_date": "2025-12-06",
      "support": {
        "chrome": "80",
        "chrome_android": "80",
        "edge": "80",
        "firefox": "114",
        "firefox_android": "114",
        "safari": "15",
        "safari_ios": "15"
      }
    }
  },
  "json": {
    "name": "JSON",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "3",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "3.5",
        "firefox_android": "4",
        "safari": "4",
        "safari_ios": "4"
      }
    }
  },
  "json-modules": {
    "name": "JSON import attributes",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-04-29",
      "support": {
        "chrome": "123",
        "chrome_android": "123",
        "edge": "123",
        "firefox": "138",
        "firefox_android": "138",
        "safari": "17.2",
        "safari_ios": "17.2"
      }
    }
  },
  "json-raw": {
    "name": "JSON source text access",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-03-31",
      "support": {
        "chrome": "114",
        "chrome_android": "114",
        "edge": "114",
        "firefox": "135",
        "firefox_android": "135",
        "safari": "18.4",
        "safari_ios": "18.4"
      }
    }
  },
  "justify-self-block": {
    "name": "justify-self in block layouts",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "130",
        "chrome_android": "130",
        "edge": "130"
      }
    }
  },
  "kbd": {
    "name": "<kbd>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "\u22644",
        "safari_ios": "\u22643.2"
      }
    }
  },
  "keyboard-events": {
    "name": "Keyboard events",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "6",
        "firefox_android": "6",
        "safari": "1.2",
        "safari_ios": "1"
      }
    }
  },
  "keyboard-lock": {
    "name": "Keyboard lock",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "68",
        "chrome_android": "68",
        "edge": "79"
      }
    }
  },
  "keyboard-map": {
    "name": "Keyboard map",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "69",
        "chrome_android": "69",
        "edge": "79"
      }
    }
  },
  "khr-parallel-shader-compile": {
    "name": "KHR_parallel_shader_compile WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "76",
        "chrome_android": "76",
        "edge": "79",
        "safari": "14.1",
        "safari_ios": "14.5"
      }
    }
  },
  "lab": {
    "name": "Lab and LCH",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-05-09",
      "baseline_high_date": "2025-11-09",
      "support": {
        "chrome": "111",
        "chrome_android": "111",
        "edge": "111",
        "firefox": "113",
        "firefox_android": "113",
        "safari": "15",
        "safari_ios": "15"
      }
    }
  },
  "label": {
    "name": "<label>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "\u22644",
        "safari_ios": "\u22643.2"
      }
    }
  },
  "lang": {
    "name": ":lang()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3.1",
        "safari_ios": "2"
      }
    }
  },
  "lang-attr": {
    "name": "lang",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "\u22644",
        "safari_ios": "\u22643.2"
      }
    }
  },
  "language": {
    "name": "Language",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "languagedetector": {
    "name": "Language detector",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "138"
      }
    }
  },
  "largest-contentful-paint": {
    "name": "Largest contentful paint (LCP)",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-12-12",
      "support": {
        "chrome": "77",
        "chrome_android": "77",
        "edge": "79",
        "firefox": "122",
        "firefox_android": "122",
        "safari": "26.2",
        "safari_ios": "26.2"
      }
    }
  },
  "layout-direction-override": {
    "name": "Layout direction override",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "48",
        "chrome_android": "48",
        "edge": "79",
        "firefox": "50",
        "firefox_android": "50",
        "safari": "11",
        "safari_ios": "11"
      }
    }
  },
  "layout-instability": {
    "name": "Layout instability",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "84",
        "chrome_android": "84",
        "edge": "84"
      }
    }
  },
  "let-const": {
    "name": "Let and const",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2016-09-20",
      "baseline_high_date": "2019-03-20",
      "support": {
        "chrome": "49",
        "chrome_android": "49",
        "edge": "14",
        "firefox": "44",
        "firefox_android": "44",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "letter-spacing": {
    "name": "letter-spacing",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "lh": {
    "name": "lh unit",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-11-21",
      "support": {
        "chrome": "109",
        "chrome_android": "109",
        "edge": "109",
        "firefox": "120",
        "firefox_android": "120",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "light-dark": {
    "name": "light-dark()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-05-13",
      "support": {
        "chrome": "123",
        "chrome_android": "123",
        "edge": "123",
        "firefox": "120",
        "firefox_android": "120",
        "safari": "17.5",
        "safari_ios": "17.5"
      }
    }
  },
  "line-break": {
    "name": "line-break",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-07-28",
      "baseline_high_date": "2023-01-28",
      "support": {
        "chrome": "83",
        "chrome_android": "83",
        "edge": "83",
        "firefox": "69",
        "firefox_android": "79",
        "safari": "13",
        "safari_ios": "13"
      }
    }
  },
  "line-clamp": {
    "name": "line-clamp",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "line-height": {
    "name": "line-height",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "linear-easing": {
    "name": "linear() easing",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-12-11",
      "support": {
        "chrome": "113",
        "chrome_android": "113",
        "edge": "113",
        "firefox": "112",
        "firefox_android": "112",
        "safari": "17.2",
        "safari_ios": "17.2"
      }
    }
  },
  "link": {
    "name": "<link>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "\u22644",
        "safari_ios": "\u22643.2"
      }
    }
  },
  "link-rel-dns-prefetch": {
    "name": '<link rel="dns-prefetch">',
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-09-15",
      "support": {
        "chrome": "46",
        "chrome_android": "46",
        "edge": "79",
        "firefox": "127",
        "firefox_android": "127",
        "safari": "5",
        "safari_ios": "26"
      }
    }
  },
  "link-rel-expect": {
    "name": '<link rel="expect">',
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "124",
        "chrome_android": "124",
        "edge": "124"
      }
    }
  },
  "link-rel-preconnect": {
    "name": '<link rel="preconnect">',
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "46",
        "chrome_android": "46",
        "edge": "79",
        "firefox": "39",
        "firefox_android": "39",
        "safari": "11.1",
        "safari_ios": "11.3"
      }
    }
  },
  "link-rel-prefetch": {
    "name": '<link rel="prefetch">',
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "8",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "2",
        "firefox_android": "4"
      }
    }
  },
  "link-rel-preload": {
    "name": '<link rel="preload">',
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-01-26",
      "baseline_high_date": "2023-07-26",
      "support": {
        "chrome": "50",
        "chrome_android": "50",
        "edge": "79",
        "firefox": "85",
        "firefox_android": "85",
        "safari": "11.1",
        "safari_ios": "11.3"
      }
    }
  },
  "link-selectors": {
    "name": "Link selectors",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "65",
        "chrome_android": "65",
        "edge": "79",
        "firefox": "50",
        "firefox_android": "50",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "list-elements": {
    "name": "<ol>, <ul>, and <li>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "\u22644",
        "safari_ios": "\u22643.2"
      }
    }
  },
  "list-style": {
    "name": "List style",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "loading-lazy": {
    "name": "Lazy-loading images and iframes",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-12-19",
      "support": {
        "chrome": "77",
        "chrome_android": "77",
        "edge": "79",
        "firefox": "121",
        "firefox_android": "121",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "loading-lazy-media": {
    "name": "Lazy-loading media",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "local-fonts": {
    "name": "Local fonts",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "103",
        "edge": "103"
      }
    }
  },
  "local-network-access": {
    "name": "Local network access",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "localstorage": {
    "name": "localStorage and sessionStorage",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "4",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "3.5",
        "firefox_android": "6",
        "safari": "4",
        "safari_ios": "3.2"
      }
    }
  },
  "location": {
    "name": "Location",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "logical-assignments": {
    "name": "Logical assignments",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-09-16",
      "baseline_high_date": "2023-03-16",
      "support": {
        "chrome": "85",
        "chrome_android": "85",
        "edge": "85",
        "firefox": "79",
        "firefox_android": "79",
        "safari": "14",
        "safari_ios": "14"
      }
    }
  },
  "logical-properties": {
    "name": "Logical properties",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-09-20",
      "baseline_high_date": "2024-03-20",
      "support": {
        "chrome": "89",
        "chrome_android": "89",
        "edge": "89",
        "firefox": "66",
        "firefox_android": "66",
        "safari": "15",
        "safari_ios": "15"
      }
    }
  },
  "long-animation-frames": {
    "name": "Long animation frames",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "123",
        "chrome_android": "123",
        "edge": "123"
      }
    }
  },
  "longtasks": {
    "name": "Long tasks",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "58",
        "chrome_android": "58",
        "edge": "79"
      }
    }
  },
  "magnetometer": {
    "name": "Magnetometer",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "main": {
    "name": "<main>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "26",
        "chrome_android": "26",
        "edge": "12",
        "firefox": "21",
        "firefox_android": "21",
        "safari": "7",
        "safari_ios": "7"
      }
    }
  },
  "managed-media-source": {
    "name": "Managed media source",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "safari": "17",
        "safari_ios": "17.1"
      }
    }
  },
  "manifest": {
    "name": "Web app manifest",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "53",
        "chrome_android": "53",
        "edge": "79",
        "firefox_android": "79",
        "safari": "17",
        "safari_ios": "15.4"
      }
    }
  },
  "manifest-localization": {
    "name": "Web app manifest localization",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "map": {
    "name": "Map (initial support)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "38",
        "chrome_android": "38",
        "edge": "12",
        "firefox": "13",
        "firefox_android": "14",
        "safari": "8",
        "safari_ios": "8"
      }
    }
  },
  "margin": {
    "name": "margin",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "margin-trim": {
    "name": "margin-trim",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "mark": {
    "name": "<mark>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "7",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "4",
        "firefox_android": "4",
        "safari": "5.1",
        "safari_ios": "5"
      }
    }
  },
  "marker": {
    "name": "::marker",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "86",
        "chrome_android": "86",
        "edge": "86",
        "firefox": "80",
        "firefox_android": "80"
      }
    }
  },
  "mask-border": {
    "name": "mask-border",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "safari": "17.2",
        "safari_ios": "17.2"
      }
    }
  },
  "mask-type": {
    "name": "mask-type",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "24",
        "chrome_android": "25",
        "edge": "79",
        "firefox": "35",
        "firefox_android": "35",
        "safari": "7",
        "safari_ios": "7"
      }
    }
  },
  "masks": {
    "name": "Masks",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-12-07",
      "support": {
        "chrome": "120",
        "chrome_android": "120",
        "edge": "120",
        "firefox": "53",
        "firefox_android": "53",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "masonry": {
    "name": "Masonry",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "matchmedia": {
    "name": "matchMedia",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "9",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "6",
        "firefox_android": "6",
        "safari": "5.1",
        "safari_ios": "5"
      }
    }
  },
  "math-sum-precise": {
    "name": "Math.sumPrecise()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "137",
        "firefox_android": "137",
        "safari": "26.2",
        "safari_ios": "26.2"
      }
    }
  },
  "mathml": {
    "name": "MathML",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-01-12",
      "baseline_high_date": "2025-07-12",
      "support": {
        "chrome": "109",
        "chrome_android": "109",
        "edge": "109",
        "firefox": "4",
        "firefox_android": "4",
        "safari": "5.1",
        "safari_ios": "5"
      }
    }
  },
  "mathml-full": {
    "name": "MathML Full",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "measure-memory": {
    "name": "Memory measurement",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "89",
        "chrome_android": "89",
        "edge": "89"
      }
    }
  },
  "media-capabilities": {
    "name": "Media capabilities",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-04-28",
      "baseline_high_date": "2024-10-28",
      "support": {
        "chrome": "101",
        "chrome_android": "101",
        "edge": "101",
        "firefox": "63",
        "firefox_android": "63",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "media-capture": {
    "name": "Media capture",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-09-19",
      "baseline_high_date": "2020-03-19",
      "support": {
        "chrome": "53",
        "chrome_android": "53",
        "edge": "12",
        "firefox": "36",
        "firefox_android": "36",
        "safari": "11",
        "safari_ios": "11"
      }
    }
  },
  "media-playback-quality": {
    "name": "Media playback quality",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-02-04",
      "baseline_high_date": "2022-08-04",
      "support": {
        "chrome": "80",
        "chrome_android": "80",
        "edge": "12",
        "firefox": "42",
        "firefox_android": "42",
        "safari": "8",
        "safari_ios": "12.2"
      }
    }
  },
  "media-pseudos": {
    "name": "Media element pseudo-classes",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "media-queries": {
    "name": "Media queries",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3",
        "safari_ios": "1"
      }
    }
  },
  "media-query-range-syntax": {
    "name": "Media query range syntax",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-03-27",
      "baseline_high_date": "2025-09-27",
      "support": {
        "chrome": "104",
        "chrome_android": "104",
        "edge": "104",
        "firefox": "102",
        "firefox_android": "102",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "media-session": {
    "name": "Media session",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "73",
        "chrome_android": "57",
        "edge": "79",
        "firefox": "82",
        "safari": "15",
        "safari_ios": "15"
      }
    }
  },
  "media-source": {
    "name": "Media source",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "31",
        "chrome_android": "31",
        "edge": "12",
        "firefox": "42",
        "firefox_android": "41",
        "safari": "8"
      }
    }
  },
  "mediacontroller": {
    "name": "MediaController",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "safari": "7",
        "safari_ios": "7"
      }
    }
  },
  "mediastream-recording": {
    "name": "MediaStream recording",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-04-26",
      "baseline_high_date": "2023-10-26",
      "support": {
        "chrome": "49",
        "chrome_android": "49",
        "edge": "79",
        "firefox": "25",
        "firefox_android": "25",
        "safari": "14.1",
        "safari_ios": "14"
      }
    }
  },
  "menu": {
    "name": "<menu>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3",
        "safari_ios": "1"
      }
    }
  },
  "messageerror": {
    "name": "messageerror",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-03-27",
      "baseline_high_date": "2025-09-27",
      "support": {
        "chrome": "60",
        "chrome_android": "60",
        "edge": "18",
        "firefox": "57",
        "firefox_android": "57",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "meta": {
    "name": "<meta>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "meta-application-title": {
    "name": '<meta name="application-title">',
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "134",
        "chrome_android": "134",
        "edge": "134"
      }
    }
  },
  "meta-text-scale": {
    "name": '<meta name="text-scale">',
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "meta-theme-color": {
    "name": '<meta name="theme-color">',
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome_android": "92",
        "safari": "15",
        "safari_ios": "15"
      }
    }
  },
  "meter": {
    "name": "<meter>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2018-10-02",
      "baseline_high_date": "2021-04-02",
      "support": {
        "chrome": "6",
        "chrome_android": "18",
        "edge": "18",
        "firefox": "56",
        "firefox_android": "56",
        "safari": "6",
        "safari_ios": "10.3"
      }
    }
  },
  "min-max-clamp": {
    "name": "min(), max(), and clamp()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-07-28",
      "baseline_high_date": "2023-01-28",
      "support": {
        "chrome": "79",
        "chrome_android": "79",
        "edge": "79",
        "firefox": "75",
        "firefox_android": "79",
        "safari": "13.1",
        "safari_ios": "13.4"
      }
    }
  },
  "min-max-content": {
    "name": "min-content and max-content",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "46",
        "chrome_android": "46",
        "edge": "79",
        "firefox": "66",
        "firefox_android": "66",
        "safari": "11",
        "safari_ios": "11"
      }
    }
  },
  "min-max-width-height": {
    "name": "Min and max width and height",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "18",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1.3",
        "safari_ios": "1"
      }
    }
  },
  "mix-blend-mode": {
    "name": "mix-blend-mode",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "41",
        "chrome_android": "41",
        "edge": "79",
        "firefox": "32",
        "firefox_android": "32",
        "safari": "8",
        "safari_ios": "8"
      }
    }
  },
  "mixed-content": {
    "name": "Mixed content handling",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "\u226479",
        "chrome_android": "\u226479",
        "edge": "79",
        "firefox": "\u226423",
        "firefox_android": "\u226423",
        "safari": "\u22649.1",
        "safari_ios": "\u22649.3"
      }
    }
  },
  "modal": {
    "name": ":modal",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-09-02",
      "baseline_high_date": "2025-03-02",
      "support": {
        "chrome": "105",
        "chrome_android": "105",
        "edge": "105",
        "firefox": "103",
        "firefox_android": "103",
        "safari": "15.6",
        "safari_ios": "15.6"
      }
    }
  },
  "modulepreload": {
    "name": '<link rel="modulepreload">',
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-09-18",
      "support": {
        "chrome": "66",
        "chrome_android": "66",
        "edge": "79",
        "firefox": "115",
        "firefox_android": "115",
        "safari": "17",
        "safari_ios": "17"
      }
    }
  },
  "motion-path": {
    "name": "Motion path",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-09-12",
      "baseline_high_date": "2025-03-12",
      "support": {
        "chrome": "55",
        "chrome_android": "55",
        "edge": "79",
        "firefox": "72",
        "firefox_android": "79",
        "safari": "16",
        "safari_ios": "16"
      }
    }
  },
  "mouse-events": {
    "name": "Mouse events",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "move-before": {
    "name": "moveBefore()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "133",
        "chrome_android": "133",
        "edge": "133",
        "firefox": "144",
        "firefox_android": "144"
      }
    }
  },
  "multi-column": {
    "name": "Multi-column layout",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-03-07",
      "baseline_high_date": "2019-09-07",
      "support": {
        "chrome": "50",
        "chrome_android": "50",
        "edge": "12",
        "firefox": "52",
        "firefox_android": "52",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "mutation-events": {
    "name": "Mutation events",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "mutationobserver": {
    "name": "MutationObserver",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "26",
        "chrome_android": "26",
        "edge": "12",
        "firefox": "14",
        "firefox_android": "14",
        "safari": "7",
        "safari_ios": "7"
      }
    }
  },
  "named-color": {
    "name": "Named colors",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "namespace": {
    "name": "@namespace",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "nav": {
    "name": "<nav>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "5",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "4",
        "firefox_android": "4",
        "safari": "5",
        "safari_ios": "4.2"
      }
    }
  },
  "navigation": {
    "name": "Navigation API",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2026-01-13",
      "support": {
        "chrome": "102",
        "chrome_android": "102",
        "edge": "102",
        "firefox": "147",
        "firefox_android": "147",
        "safari": "26.2",
        "safari_ios": "26.2"
      }
    }
  },
  "navigation-precommit-handlers": {
    "name": "Navigation precommit handlers",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "148",
        "firefox_android": "148"
      }
    }
  },
  "navigation-timing": {
    "name": "Navigation timing",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-10-25",
      "baseline_high_date": "2024-04-25",
      "support": {
        "chrome": "57",
        "chrome_android": "57",
        "edge": "12",
        "firefox": "58",
        "firefox_android": "58",
        "safari": "15",
        "safari_ios": "15.1"
      }
    }
  },
  "navigator": {
    "name": "Navigator",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "navigator-install": {
    "name": "navigator.install()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "nesting": {
    "name": "Nesting",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-12-11",
      "support": {
        "chrome": "120",
        "chrome_android": "120",
        "edge": "120",
        "firefox": "117",
        "firefox_android": "117",
        "safari": "17.2",
        "safari_ios": "17.2"
      }
    }
  },
  "network-information": {
    "name": "Network Information",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "67",
        "chrome_android": "67"
      }
    }
  },
  "non-cookie-storage-access": {
    "name": "Non-cookie storage access",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "125"
      }
    }
  },
  "not": {
    "name": ":not()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-01-21",
      "baseline_high_date": "2023-07-21",
      "support": {
        "chrome": "88",
        "chrome_android": "88",
        "edge": "88",
        "firefox": "84",
        "firefox_android": "84",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "notifications": {
    "name": "Notifications",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "20",
        "edge": "14",
        "firefox": "22",
        "firefox_android": "22",
        "safari": "7"
      }
    }
  },
  "notifications-apps": {
    "name": "Notifications from service workers and installed apps",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-03-27",
      "baseline_high_date": "2025-09-27",
      "support": {
        "chrome": "20",
        "chrome_android": "42",
        "edge": "14",
        "firefox": "22",
        "firefox_android": "22",
        "safari": "7",
        "safari_ios": "16.4"
      }
    }
  },
  "nth-child": {
    "name": ":nth-child()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "3.5",
        "firefox_android": "4",
        "safari": "3.1",
        "safari_ios": "2"
      }
    }
  },
  "nth-child-of": {
    "name": ":nth-child() of <selector>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-05-09",
      "baseline_high_date": "2025-11-09",
      "support": {
        "chrome": "111",
        "chrome_android": "111",
        "edge": "111",
        "firefox": "113",
        "firefox_android": "113",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "nth-of-type": {
    "name": ":nth-of-type() pseudo-classes",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "4",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "3.5",
        "firefox_android": "4",
        "safari": "3.1",
        "safari_ios": "2"
      }
    }
  },
  "nullish-coalescing": {
    "name": "Nullish coalescing",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-09-16",
      "baseline_high_date": "2023-03-16",
      "support": {
        "chrome": "85",
        "chrome_android": "85",
        "edge": "85",
        "firefox": "79",
        "firefox_android": "79",
        "safari": "14",
        "safari_ios": "14"
      }
    }
  },
  "number": {
    "name": "Math and numbers",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "numeric-factory-functions": {
    "name": "Numeric factory functions",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "66",
        "chrome_android": "66",
        "edge": "79",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "numeric-separators": {
    "name": "Numeric separators",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-07-28",
      "baseline_high_date": "2023-01-28",
      "support": {
        "chrome": "75",
        "chrome_android": "75",
        "edge": "79",
        "firefox": "70",
        "firefox_android": "79",
        "safari": "13",
        "safari_ios": "13"
      }
    }
  },
  "numeric-seperators": {
    "kind": "moved",
    "redirect_target": "numeric-separators"
  },
  "object": {
    "name": "<object>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3",
        "safari_ios": "2"
      }
    }
  },
  "object-fit": {
    "name": "object-fit",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "32",
        "chrome_android": "32",
        "edge": "79",
        "firefox": "36",
        "firefox_android": "36",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "object-hasown": {
    "name": "Object.hasOwn()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-03-14",
      "baseline_high_date": "2024-09-14",
      "support": {
        "chrome": "93",
        "chrome_android": "93",
        "edge": "93",
        "firefox": "92",
        "firefox_android": "92",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "object-object": {
    "name": "Object",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "object-position": {
    "name": "object-position",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "32",
        "chrome_android": "32",
        "edge": "79",
        "firefox": "36",
        "firefox_android": "36",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "object-view-box": {
    "name": "object-view-box",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "104",
        "chrome_android": "104",
        "edge": "104"
      }
    }
  },
  "observable": {
    "name": "Observable",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "135",
        "chrome_android": "135",
        "edge": "135"
      }
    }
  },
  "oes-element-index-uint": {
    "name": "OES_element_index_uint WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "24",
        "chrome_android": "25",
        "edge": "12",
        "firefox": "24",
        "firefox_android": "24",
        "safari": "8",
        "safari_ios": "8"
      }
    }
  },
  "oes-fbo-render-mipmap": {
    "name": "OES_fbo_render_mipmap WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-04-26",
      "baseline_high_date": "2023-10-26",
      "support": {
        "chrome": "80",
        "chrome_android": "80",
        "edge": "80",
        "firefox": "71",
        "firefox_android": "79",
        "safari": "14.1",
        "safari_ios": "14.5"
      }
    }
  },
  "oes-standard-derivatives": {
    "name": "OES_standard_derivatives WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "10",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "10",
        "firefox_android": "10",
        "safari": "8",
        "safari_ios": "8"
      }
    }
  },
  "oes-texture-float": {
    "name": "OES_texture_float WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "10",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "6",
        "firefox_android": "6",
        "safari": "8",
        "safari_ios": "8"
      }
    }
  },
  "oes-texture-float-linear": {
    "name": "OES_texture_float_linear WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "29",
        "chrome_android": "29",
        "edge": "12",
        "firefox": "24",
        "firefox_android": "24",
        "safari": "8",
        "safari_ios": "8"
      }
    }
  },
  "oes-texture-half-float": {
    "name": "OES_texture_half_float WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2016-08-02",
      "baseline_high_date": "2019-02-02",
      "support": {
        "chrome": "27",
        "chrome_android": "27",
        "edge": "14",
        "firefox": "29",
        "firefox_android": "29",
        "safari": "8",
        "safari_ios": "8"
      }
    }
  },
  "oes-texture-half-float-linear": {
    "name": "OES_texture_half_float_linear WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "29",
        "chrome_android": "29",
        "edge": "14",
        "firefox": "30",
        "safari": "8",
        "safari_ios": "8"
      }
    }
  },
  "oes-vertex-array-object": {
    "name": "OES_vertex_array_object WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2018-04-30",
      "baseline_high_date": "2020-10-30",
      "support": {
        "chrome": "24",
        "chrome_android": "25",
        "edge": "17",
        "firefox": "25",
        "firefox_android": "25",
        "safari": "8",
        "safari_ios": "9"
      }
    }
  },
  "offline-audio-context": {
    "name": "OfflineAudioContext",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-04-26",
      "baseline_high_date": "2023-10-26",
      "support": {
        "chrome": "35",
        "chrome_android": "35",
        "edge": "12",
        "firefox": "25",
        "firefox_android": "25",
        "safari": "14.1",
        "safari_ios": "14.5"
      }
    }
  },
  "offscreen-canvas": {
    "name": "Offscreen canvas",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-03-27",
      "baseline_high_date": "2025-09-27",
      "support": {
        "chrome": "69",
        "chrome_android": "69",
        "edge": "79",
        "firefox": "105",
        "firefox_android": "105",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "oklab": {
    "name": "Oklab and OkLCh",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-05-09",
      "baseline_high_date": "2025-11-09",
      "support": {
        "chrome": "111",
        "chrome_android": "111",
        "edge": "111",
        "firefox": "113",
        "firefox_android": "113",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "online": {
    "name": "Online status",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "2",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1.5",
        "firefox_android": "4",
        "safari": "4",
        "safari_ios": "3.2"
      }
    }
  },
  "opacity": {
    "name": "opacity",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "2",
        "safari_ios": "1"
      }
    }
  },
  "opacity-svg": {
    "name": "Opacity (SVG)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "\u22642020-03-24",
      "baseline_high_date": "\u22642022-09-24",
      "support": {
        "chrome": "\u226480",
        "chrome_android": "\u226480",
        "edge": "\u226480",
        "firefox": "1.5",
        "firefox_android": "4",
        "safari": "\u226413.1",
        "safari_ios": "\u226413.4"
      }
    }
  },
  "open-closed": {
    "kind": "moved",
    "redirect_target": "open-pseudo"
  },
  "open-pseudo": {
    "name": ":open",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "133",
        "chrome_android": "133",
        "edge": "133",
        "firefox": "136",
        "firefox_android": "136"
      }
    }
  },
  "optional-catch-binding": {
    "name": "Optional catch binding",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "66",
        "chrome_android": "66",
        "edge": "79",
        "firefox": "58",
        "firefox_android": "58",
        "safari": "11.1",
        "safari_ios": "11.3"
      }
    }
  },
  "orientation-sensor": {
    "name": "Orientation Sensor",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "67",
        "chrome_android": "67",
        "edge": "79"
      }
    }
  },
  "origin": {
    "name": "Origin",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "145",
        "chrome_android": "145",
        "edge": "145"
      }
    }
  },
  "origin-private-file-system": {
    "name": "Origin private file system",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-03-27",
      "baseline_high_date": "2025-09-27",
      "support": {
        "chrome": "108",
        "chrome_android": "109",
        "edge": "108",
        "firefox": "111",
        "firefox_android": "111",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "outline": {
    "name": "outline",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-03-27",
      "baseline_high_date": "2025-09-27",
      "support": {
        "chrome": "94",
        "chrome_android": "94",
        "edge": "94",
        "firefox": "88",
        "firefox_android": "88",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "outlines": {
    "name": "Outlines",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-04-05",
      "baseline_high_date": "2019-10-05",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "15",
        "firefox": "1.5",
        "firefox_android": "4",
        "safari": "1.2",
        "safari_ios": "1"
      }
    }
  },
  "output": {
    "name": "<output>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "\u22642018-10-02",
      "baseline_high_date": "\u22642021-04-02",
      "support": {
        "chrome": "10",
        "chrome_android": "18",
        "edge": "\u226418",
        "firefox": "4",
        "firefox_android": "4",
        "safari": "7",
        "safari_ios": "7"
      }
    }
  },
  "overflow": {
    "name": "Overflow media queries",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-09-18",
      "support": {
        "chrome": "113",
        "chrome_android": "113",
        "edge": "113",
        "firefox": "66",
        "firefox_android": "66",
        "safari": "17",
        "safari_ios": "17"
      }
    }
  },
  "overflow-anchor": {
    "name": "overflow-anchor",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "56",
        "chrome_android": "56",
        "edge": "79",
        "firefox": "66",
        "firefox_android": "66"
      }
    }
  },
  "overflow-clip": {
    "name": "overflow: clip",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-09-12",
      "baseline_high_date": "2025-03-12",
      "support": {
        "chrome": "90",
        "chrome_android": "90",
        "edge": "90",
        "firefox": "81",
        "firefox_android": "81",
        "safari": "16",
        "safari_ios": "16"
      }
    }
  },
  "overflow-clip-margin": {
    "name": "overflow-clip-margin",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "overflow-overlay": {
    "name": "overflow: overlay",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "114",
        "chrome_android": "114",
        "edge": "114",
        "firefox": "112",
        "firefox_android": "112",
        "safari": "12",
        "safari_ios": "12"
      }
    }
  },
  "overflow-shorthand": {
    "name": "overflow",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-03-24",
      "baseline_high_date": "2022-09-24",
      "support": {
        "chrome": "68",
        "chrome_android": "68",
        "edge": "79",
        "firefox": "61",
        "firefox_android": "61",
        "safari": "13.1",
        "safari_ios": "13.4"
      }
    }
  },
  "overflow-wrap": {
    "name": "overflow-wrap",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2018-10-02",
      "baseline_high_date": "2021-04-02",
      "support": {
        "chrome": "23",
        "chrome_android": "25",
        "edge": "18",
        "firefox": "49",
        "firefox_android": "49",
        "safari": "7",
        "safari_ios": "7"
      }
    }
  },
  "overlay": {
    "name": "overlay",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "117",
        "chrome_android": "117",
        "edge": "117"
      }
    }
  },
  "overscroll-behavior": {
    "name": "overscroll-behavior",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-09-12",
      "baseline_high_date": "2025-03-12",
      "support": {
        "chrome": "63",
        "chrome_android": "63",
        "edge": "18",
        "firefox": "59",
        "firefox_android": "59",
        "safari": "16",
        "safari_ios": "16"
      }
    }
  },
  "ovr-multiview2": {
    "name": "OVR_multiview2 WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome_android": "93"
      }
    }
  },
  "p": {
    "name": "<p>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3",
        "safari_ios": "1"
      }
    }
  },
  "padding": {
    "name": "padding",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "page-break-aliases": {
    "name": "Page break aliases",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12"
      }
    }
  },
  "page-breaks": {
    "name": "Page breaks",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2019-01-29",
      "baseline_high_date": "2021-07-29",
      "support": {
        "chrome": "50",
        "chrome_android": "50",
        "edge": "12",
        "firefox": "65",
        "firefox_android": "65",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "page-lifecycle": {
    "name": "Page lifecycle",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "68",
        "chrome_android": "68",
        "edge": "79"
      }
    }
  },
  "page-orientation": {
    "name": "page-orientation",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "85",
        "chrome_android": "85",
        "edge": "85",
        "firefox": "122",
        "firefox_android": "122"
      }
    }
  },
  "page-selectors": {
    "name": "Page selectors",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "18",
        "chrome_android": "18",
        "edge": "12",
        "safari": "6",
        "safari_ios": "6"
      }
    }
  },
  "page-setup": {
    "name": "Page setup",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-12-11",
      "support": {
        "chrome": "15",
        "chrome_android": "18",
        "edge": "79",
        "firefox": "95",
        "firefox_android": "95",
        "safari": "18.2",
        "safari_ios": "18.2"
      }
    }
  },
  "page-transition-events": {
    "name": "Page transition events",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "4",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1.5",
        "firefox_android": "4",
        "safari": "5",
        "safari_ios": "4"
      }
    }
  },
  "page-visibility": {
    "name": "Page visibility",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "33",
        "chrome_android": "33",
        "edge": "12",
        "firefox": "18",
        "firefox_android": "18",
        "safari": "7",
        "safari_ios": "7"
      }
    }
  },
  "page-visibility-state": {
    "name": "Page visibility state",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "115",
        "chrome_android": "115",
        "edge": "115"
      }
    }
  },
  "paint": {
    "name": "paint()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "65",
        "chrome_android": "65",
        "edge": "79"
      }
    }
  },
  "paint-order": {
    "name": "paint-order",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-03-22",
      "support": {
        "chrome": "123",
        "chrome_android": "123",
        "edge": "123",
        "firefox": "\u226466",
        "firefox_android": "\u226466",
        "safari": "\u226412",
        "safari_ios": "\u226412"
      }
    }
  },
  "paint-timing": {
    "name": "Paint timing",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-04-26",
      "baseline_high_date": "2023-10-26",
      "support": {
        "chrome": "60",
        "chrome_android": "60",
        "edge": "79",
        "firefox": "84",
        "firefox_android": "84",
        "safari": "14.1",
        "safari_ios": "14.5"
      }
    }
  },
  "parse-html-unsafe": {
    "name": "Unsanitized HTML parsing methods",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-09-15",
      "support": {
        "chrome": "124",
        "chrome_android": "124",
        "edge": "124",
        "firefox": "128",
        "firefox_android": "128",
        "safari": "26",
        "safari_ios": "26"
      }
    }
  },
  "partitioned-cookies": {
    "name": "Partitioned cookies",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "114",
        "chrome_android": "114",
        "edge": "114"
      }
    }
  },
  "password-credentials": {
    "name": "Password credentials",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "60",
        "chrome_android": "60",
        "edge": "79"
      }
    }
  },
  "path-shape": {
    "name": "path()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "payment-handler": {
    "name": "Payment handler",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "70",
        "chrome_android": "70",
        "edge": "79"
      }
    }
  },
  "payment-request": {
    "name": "Payment request",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "60",
        "chrome_android": "53",
        "edge": "15",
        "safari": "11.1",
        "safari_ios": "11.3"
      }
    }
  },
  "pdf-viewer": {
    "name": "pdfViewerEnabled",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-03-27",
      "baseline_high_date": "2025-09-27",
      "support": {
        "chrome": "94",
        "chrome_android": "94",
        "edge": "94",
        "firefox": "99",
        "firefox_android": "99",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "performance": {
    "name": "Performance",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-09-16",
      "baseline_high_date": "2018-03-16",
      "support": {
        "chrome": "6",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "7",
        "firefox_android": "7",
        "safari": "8",
        "safari_ios": "9"
      }
    }
  },
  "performancetiming": {
    "name": "PerformanceTiming and PerformanceNavigation",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "56",
        "chrome_android": "56",
        "edge": "18",
        "firefox": "56",
        "firefox_android": "56",
        "safari": "14.1",
        "safari_ios": "14.5"
      }
    }
  },
  "periodic-background-sync": {
    "name": "Periodic background sync",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "80",
        "chrome_android": "80",
        "edge": "80"
      }
    }
  },
  "permissions": {
    "name": "Permissions",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-09-12",
      "baseline_high_date": "2025-03-12",
      "support": {
        "chrome": "44",
        "chrome_android": "44",
        "edge": "79",
        "firefox": "46",
        "firefox_android": "46",
        "safari": "16",
        "safari_ios": "16"
      }
    }
  },
  "permissions-policy": {
    "name": "Permissions policy",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "108",
        "chrome_android": "108",
        "edge": "108"
      }
    }
  },
  "physical-properties": {
    "name": "Physical properties",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "picture": {
    "name": "<picture>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2016-03-21",
      "baseline_high_date": "2018-09-21",
      "support": {
        "chrome": "38",
        "chrome_android": "38",
        "edge": "13",
        "firefox": "38",
        "firefox_android": "38",
        "safari": "9.1",
        "safari_ios": "9.3"
      }
    }
  },
  "picture-in-picture": {
    "name": "Picture-in-picture (video)",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "69",
        "chrome_android": "105",
        "edge": "79",
        "safari": "13.1",
        "safari_ios": "13.4"
      }
    }
  },
  "ping": {
    "name": "ping",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "12",
        "chrome_android": "18",
        "edge": "17",
        "safari": "6",
        "safari_ios": "6"
      }
    }
  },
  "placeholder": {
    "name": "::placeholder",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "57",
        "chrome_android": "57",
        "edge": "79",
        "firefox": "51",
        "firefox_android": "51",
        "safari": "10.1",
        "safari_ios": "10.3"
      }
    }
  },
  "placeholder-shown": {
    "name": ":placeholder-shown",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "47",
        "chrome_android": "47",
        "edge": "79",
        "firefox": "51",
        "firefox_android": "51",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "png": {
    "name": "PNG",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "59",
        "chrome_android": "59",
        "edge": "79",
        "firefox": "3",
        "firefox_android": "4",
        "safari": "8",
        "safari_ios": "8"
      }
    }
  },
  "pointer-events": {
    "name": "pointer-events",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "2",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "3.6",
        "firefox_android": "4",
        "safari": "4",
        "safari_ios": "3.2"
      }
    }
  },
  "pointer-events-api": {
    "name": "Pointer Events",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-07-28",
      "baseline_high_date": "2023-01-28",
      "support": {
        "chrome": "55",
        "chrome_android": "55",
        "edge": "12",
        "firefox": "59",
        "firefox_android": "79",
        "safari": "13",
        "safari_ios": "13"
      }
    }
  },
  "pointer-lock": {
    "name": "Pointer lock",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "37",
        "edge": "13",
        "firefox": "50",
        "firefox_android": "50",
        "safari": "10.1"
      }
    }
  },
  "popover": {
    "name": "Popover",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-01-27",
      "support": {
        "chrome": "116",
        "chrome_android": "116",
        "edge": "116",
        "firefox": "125",
        "firefox_android": "125",
        "safari": "17",
        "safari_ios": "18.3"
      }
    }
  },
  "popover-hint": {
    "name": 'popover="hint"',
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "133",
        "chrome_android": "133",
        "edge": "133"
      }
    }
  },
  "portal": {
    "name": "Portals",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "position": {
    "name": "Position",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "postmessage": {
    "name": "postMessage",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "2",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "3",
        "firefox_android": "4",
        "safari": "4",
        "safari_ios": "3.2"
      }
    }
  },
  "pre": {
    "name": "<pre>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "\u22644",
        "safari_ios": "\u22643.2"
      }
    }
  },
  "prefers-color-scheme": {
    "name": "prefers-color-scheme media query",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "76",
        "chrome_android": "76",
        "edge": "79",
        "firefox": "67",
        "firefox_android": "67",
        "safari": "12.1",
        "safari_ios": "13"
      }
    }
  },
  "prefers-contrast": {
    "name": "prefers-contrast media query",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-05-31",
      "baseline_high_date": "2024-11-30",
      "support": {
        "chrome": "96",
        "chrome_android": "96",
        "edge": "96",
        "firefox": "101",
        "firefox_android": "101",
        "safari": "14.1",
        "safari_ios": "14.5"
      }
    }
  },
  "prefers-reduced-data": {
    "name": "prefers-reduced-data media query",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "prefers-reduced-motion": {
    "name": "prefers-reduced-motion media query",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "74",
        "chrome_android": "74",
        "edge": "79",
        "firefox": "63",
        "firefox_android": "64",
        "safari": "10.1",
        "safari_ios": "10.3"
      }
    }
  },
  "prefers-reduced-transparency": {
    "name": "prefers-reduced-transparency media query",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "119",
        "chrome_android": "119",
        "edge": "119"
      }
    }
  },
  "preloading-responsive-images": {
    "name": "Preloading responsive images",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-12-11",
      "support": {
        "chrome": "73",
        "chrome_android": "73",
        "edge": "79",
        "firefox": "78",
        "firefox_android": "79",
        "safari": "17.2",
        "safari_ios": "17.2"
      }
    }
  },
  "presentation-api": {
    "name": "Presentation API",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "47",
        "chrome_android": "47",
        "edge": "79"
      }
    }
  },
  "preserves-pitch": {
    "name": "preservesPitch",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-12-11",
      "support": {
        "chrome": "86",
        "chrome_android": "86",
        "edge": "86",
        "firefox": "101",
        "firefox_android": "101",
        "safari": "17.2",
        "safari_ios": "17.2"
      }
    }
  },
  "print": {
    "name": "window.print()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-06-06",
      "baseline_high_date": "2025-12-06",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "114",
        "safari": "1.1",
        "safari_ios": "1"
      }
    }
  },
  "print-color-adjust": {
    "name": "print-color-adjust",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-05-01",
      "support": {
        "chrome": "136",
        "chrome_android": "136",
        "edge": "136",
        "firefox": "97",
        "firefox_android": "97",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "print-events": {
    "name": "Print events",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2019-09-19",
      "baseline_high_date": "2022-03-19",
      "support": {
        "chrome": "63",
        "chrome_android": "63",
        "edge": "12",
        "firefox": "6",
        "firefox_android": "6",
        "safari": "13",
        "safari_ios": "13"
      }
    }
  },
  "private-click-measurement": {
    "name": "Private click measurement",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "private-network-access": {
    "name": "Private network access",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "profiler": {
    "name": "Profiler",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "94",
        "chrome_android": "94",
        "edge": "94"
      }
    }
  },
  "progress": {
    "name": "<progress>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "6",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "6",
        "firefox_android": "6",
        "safari": "6",
        "safari_ios": "7"
      }
    }
  },
  "progress-function": {
    "name": "progress()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "138",
        "chrome_android": "138",
        "edge": "138",
        "safari": "26",
        "safari_ios": "26"
      }
    }
  },
  "promise": {
    "name": "Promise (initial support)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "32",
        "chrome_android": "32",
        "edge": "12",
        "firefox": "29",
        "firefox_android": "29",
        "safari": "8",
        "safari_ios": "8"
      }
    }
  },
  "promise-allsettled": {
    "name": "Promise.allSettled()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-07-28",
      "baseline_high_date": "2023-01-28",
      "support": {
        "chrome": "76",
        "chrome_android": "76",
        "edge": "79",
        "firefox": "71",
        "firefox_android": "79",
        "safari": "13",
        "safari_ios": "13"
      }
    }
  },
  "promise-any": {
    "name": "Promise.any()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-09-16",
      "baseline_high_date": "2023-03-16",
      "support": {
        "chrome": "85",
        "chrome_android": "85",
        "edge": "85",
        "firefox": "79",
        "firefox_android": "79",
        "safari": "14",
        "safari_ios": "14"
      }
    }
  },
  "promise-finally": {
    "name": "Promise finally()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2018-10-02",
      "baseline_high_date": "2021-04-02",
      "support": {
        "chrome": "63",
        "chrome_android": "63",
        "edge": "18",
        "firefox": "58",
        "firefox_android": "58",
        "safari": "11.1",
        "safari_ios": "11.3"
      }
    }
  },
  "promise-try": {
    "name": "Promise.try()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-01-07",
      "support": {
        "chrome": "128",
        "chrome_android": "128",
        "edge": "128",
        "firefox": "134",
        "firefox_android": "134",
        "safari": "18.2",
        "safari_ios": "18.2"
      }
    }
  },
  "promise-withresolvers": {
    "name": "Promise.withResolvers()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-03-05",
      "support": {
        "chrome": "119",
        "chrome_android": "119",
        "edge": "119",
        "firefox": "121",
        "firefox_android": "121",
        "safari": "17.4",
        "safari_ios": "17.4"
      }
    }
  },
  "proto": {
    "name": "__proto__",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3",
        "safari_ios": "1"
      }
    }
  },
  "proxy-reflect": {
    "name": "Proxy and Reflect",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2016-09-20",
      "baseline_high_date": "2019-03-20",
      "support": {
        "chrome": "49",
        "chrome_android": "49",
        "edge": "12",
        "firefox": "18",
        "firefox_android": "18",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "push": {
    "name": "Push messages",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-03-27",
      "baseline_high_date": "2025-09-27",
      "support": {
        "chrome": "50",
        "chrome_android": "50",
        "edge": "17",
        "firefox": "44",
        "firefox_android": "48",
        "safari": "16",
        "safari_ios": "16.4"
      }
    }
  },
  "q": {
    "name": "<q>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3",
        "safari_ios": "2"
      }
    }
  },
  "q-unit": {
    "name": "Q unit",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-03-24",
      "baseline_high_date": "2022-09-24",
      "support": {
        "chrome": "63",
        "chrome_android": "63",
        "edge": "79",
        "firefox": "49",
        "firefox_android": "49",
        "safari": "13.1",
        "safari_ios": "13.4"
      }
    }
  },
  "queuemicrotask": {
    "name": "queueMicrotask()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-07-28",
      "baseline_high_date": "2023-01-28",
      "support": {
        "chrome": "71",
        "chrome_android": "71",
        "edge": "79",
        "firefox": "69",
        "firefox_android": "79",
        "safari": "12.1",
        "safari_ios": "12.2"
      }
    }
  },
  "quotes": {
    "name": "Quotes",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-04-26",
      "baseline_high_date": "2023-10-26",
      "support": {
        "chrome": "87",
        "chrome_android": "87",
        "edge": "87",
        "firefox": "70",
        "firefox_android": "79",
        "safari": "14.1",
        "safari_ios": "14.5"
      }
    }
  },
  "random-function": {
    "name": "random()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "safari": "26.2",
        "safari_ios": "26.2"
      }
    }
  },
  "rcap": {
    "name": "rcap unit",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2026-01-13",
      "support": {
        "chrome": "118",
        "chrome_android": "118",
        "edge": "118",
        "firefox": "147",
        "firefox_android": "147",
        "safari": "17.2",
        "safari_ios": "17.2"
      }
    }
  },
  "rch": {
    "name": "rch unit",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2026-01-13",
      "support": {
        "chrome": "111",
        "chrome_android": "111",
        "edge": "111",
        "firefox": "147",
        "firefox_android": "147",
        "safari": "17.2",
        "safari_ios": "17.2"
      }
    }
  },
  "read-write-pseudos": {
    "name": ":read-only and :read-write",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-07-28",
      "baseline_high_date": "2023-01-28",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "13",
        "firefox": "78",
        "firefox_android": "79",
        "safari": "4",
        "safari_ios": "3.2"
      }
    }
  },
  "readable-byte-streams": {
    "name": "Readable byte streams",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "89",
        "chrome_android": "89",
        "edge": "89",
        "firefox": "102",
        "firefox_android": "102"
      }
    }
  },
  "readablestream-from": {
    "name": "ReadableStream.from()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "117",
        "firefox_android": "117"
      }
    }
  },
  "reading-flow": {
    "name": "reading-flow",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "137",
        "chrome_android": "137",
        "edge": "137"
      }
    }
  },
  "rect-xywx": {
    "name": "rect() and xywh()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-01-23",
      "support": {
        "chrome": "119",
        "chrome_android": "119",
        "edge": "119",
        "firefox": "122",
        "firefox_android": "122",
        "safari": "17.2",
        "safari_ios": "17.2"
      }
    }
  },
  "referencetarget": {
    "name": "Reference target",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "referrer-policy": {
    "name": "Referrer policy",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-09-20",
      "baseline_high_date": "2024-03-20",
      "support": {
        "chrome": "85",
        "chrome_android": "85",
        "edge": "85",
        "firefox": "87",
        "firefox_android": "87",
        "safari": "15",
        "safari_ios": "15"
      }
    }
  },
  "regexp": {
    "name": "Regular expressions",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "regexp-compile": {
    "name": "RegExp compile()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3.1",
        "safari_ios": "2"
      }
    }
  },
  "regexp-escape": {
    "name": "RegExp.escape()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-05-01",
      "support": {
        "chrome": "136",
        "chrome_android": "136",
        "edge": "136",
        "firefox": "134",
        "firefox_android": "134",
        "safari": "18.2",
        "safari_ios": "18.2"
      }
    }
  },
  "regexp-static-properties": {
    "name": "RegExp static properties",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3",
        "safari_ios": "1"
      }
    }
  },
  "region-capture": {
    "name": "Region capture",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "104",
        "edge": "104"
      }
    }
  },
  "registered-custom-properties": {
    "name": "Registered custom properties",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-07-09",
      "support": {
        "chrome": "85",
        "chrome_android": "85",
        "edge": "85",
        "firefox": "128",
        "firefox_android": "128",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "registerprotocolhandler": {
    "name": "registerProtocolHandler",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "13",
        "edge": "79",
        "firefox": "2",
        "firefox_android": "4"
      }
    }
  },
  "related-apps": {
    "name": "Related apps",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome_android": "84",
        "edge": "85"
      }
    }
  },
  "related-website-sets": {
    "name": "Related website sets",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "119",
        "chrome_android": "120",
        "edge": "119"
      }
    }
  },
  "relative-color": {
    "name": "Relative colors",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-09-16",
      "support": {
        "chrome": "125",
        "chrome_android": "125",
        "edge": "125",
        "firefox": "128",
        "firefox_android": "128",
        "safari": "18",
        "safari_ios": "18"
      }
    }
  },
  "relative-positioning": {
    "name": "Relative positioning",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "rem": {
    "name": "rem",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "4",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "3.6",
        "firefox_android": "4",
        "safari": "5",
        "safari_ios": "4"
      }
    }
  },
  "remote-playback": {
    "name": "Remote playback",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "121",
        "chrome_android": "56",
        "edge": "121",
        "safari": "13.1",
        "safari_ios": "13.4"
      }
    }
  },
  "reporting": {
    "name": "Reporting API",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "96",
        "chrome_android": "96",
        "edge": "96",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "request-animation-frame": {
    "name": "requestAnimationFrame()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "24",
        "chrome_android": "25",
        "edge": "12",
        "firefox": "23",
        "firefox_android": "23",
        "safari": "7",
        "safari_ios": "7"
      }
    }
  },
  "request-animation-frame-workers": {
    "name": "requestAnimationFrame() in workers",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-03-27",
      "baseline_high_date": "2025-09-27",
      "support": {
        "chrome": "69",
        "chrome_android": "69",
        "edge": "79",
        "firefox": "99",
        "firefox_android": "99",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "request-video-frame-callback": {
    "name": "requestVideoFrameCallback()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-10-29",
      "support": {
        "chrome": "83",
        "chrome_android": "83",
        "edge": "83",
        "firefox": "132",
        "firefox_android": "132",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "requestclose": {
    "name": "dialog.requestClose()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-05-27",
      "support": {
        "chrome": "134",
        "chrome_android": "134",
        "edge": "134",
        "firefox": "139",
        "firefox_android": "139",
        "safari": "18.4",
        "safari_ios": "18.4"
      }
    }
  },
  "requestidlecallback": {
    "name": "requestIdleCallback()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "47",
        "chrome_android": "47",
        "edge": "79",
        "firefox": "55",
        "firefox_android": "55"
      }
    }
  },
  "resizable-buffers": {
    "name": "Resizable buffers",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-07-09",
      "support": {
        "chrome": "111",
        "chrome_android": "111",
        "edge": "111",
        "firefox": "128",
        "firefox_android": "128",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "resize": {
    "name": "resize (CSS property)",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "4",
        "chrome_android": "18",
        "edge": "79",
        "firefox": "5",
        "safari": "4"
      }
    }
  },
  "resize-observer": {
    "name": "Resize observer",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-07-28",
      "baseline_high_date": "2023-01-28",
      "support": {
        "chrome": "64",
        "chrome_android": "64",
        "edge": "79",
        "firefox": "69",
        "firefox_android": "79",
        "safari": "13.1",
        "safari_ios": "13.4"
      }
    }
  },
  "resolution": {
    "name": "resolution media query",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-09-12",
      "baseline_high_date": "2025-03-12",
      "support": {
        "chrome": "68",
        "chrome_android": "68",
        "edge": "79",
        "firefox": "62",
        "firefox_android": "62",
        "safari": "16",
        "safari_ios": "16"
      }
    }
  },
  "resolution-compat": {
    "name": "resolution media query (compatibility prefixes)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2018-10-23",
      "baseline_high_date": "2021-04-23",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "63",
        "firefox_android": "63",
        "safari": "3",
        "safari_ios": "1"
      }
    }
  },
  "resource-size": {
    "name": "Resource size",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-03-27",
      "baseline_high_date": "2025-09-27",
      "support": {
        "chrome": "54",
        "chrome_android": "54",
        "edge": "17",
        "firefox": "45",
        "firefox_android": "45",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "resource-timing": {
    "name": "Resource timing",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-09-19",
      "baseline_high_date": "2020-03-19",
      "support": {
        "chrome": "29",
        "chrome_android": "29",
        "edge": "12",
        "firefox": "35",
        "firefox_android": "35",
        "safari": "11",
        "safari_ios": "11"
      }
    }
  },
  "revert-value": {
    "name": "revert",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-07-27",
      "baseline_high_date": "2023-01-27",
      "support": {
        "chrome": "84",
        "chrome_android": "84",
        "edge": "84",
        "firefox": "67",
        "firefox_android": "67",
        "safari": "9.1",
        "safari_ios": "9.3"
      }
    }
  },
  "rex": {
    "name": "rex unit",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2026-01-13",
      "support": {
        "chrome": "111",
        "chrome_android": "111",
        "edge": "111",
        "firefox": "147",
        "firefox_android": "147",
        "safari": "17.2",
        "safari_ios": "17.2"
      }
    }
  },
  "rgb": {
    "name": "RGB",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "65",
        "chrome_android": "65",
        "edge": "79",
        "firefox": "52",
        "firefox_android": "52",
        "safari": "12.1",
        "safari_ios": "12.2"
      }
    }
  },
  "rhythmic-sizing": {
    "name": "Rhythmic sizing",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "ric": {
    "name": "ric unit",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2026-01-13",
      "support": {
        "chrome": "111",
        "chrome_android": "111",
        "edge": "111",
        "firefox": "147",
        "firefox_android": "147",
        "safari": "17.2",
        "safari_ios": "17.2"
      }
    }
  },
  "rlh": {
    "name": "rlh unit",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-11-21",
      "support": {
        "chrome": "111",
        "chrome_android": "111",
        "edge": "111",
        "firefox": "120",
        "firefox_android": "120",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "root": {
    "name": ":root",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "round-mod-rem": {
    "name": "round(), mod(), and rem()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-05-17",
      "support": {
        "chrome": "125",
        "chrome_android": "125",
        "edge": "125",
        "firefox": "118",
        "firefox_android": "118",
        "safari": "17.2",
        "safari_ios": "17.2"
      }
    }
  },
  "ruby": {
    "name": "<ruby>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "5",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "38",
        "firefox_android": "38",
        "safari": "5",
        "safari_ios": "4.2"
      }
    }
  },
  "ruby-align": {
    "name": "ruby-align",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-12-11",
      "support": {
        "chrome": "128",
        "chrome_android": "128",
        "edge": "128",
        "firefox": "38",
        "firefox_android": "38",
        "safari": "18.2",
        "safari_ios": "18.2"
      }
    }
  },
  "ruby-overhang": {
    "name": "ruby-overhang",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "safari": "18.2",
        "safari_ios": "18.2"
      }
    }
  },
  "ruby-position": {
    "name": "ruby-position",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-12-11",
      "support": {
        "chrome": "84",
        "chrome_android": "84",
        "edge": "84",
        "firefox": "38",
        "firefox_android": "38",
        "safari": "18.2",
        "safari_ios": "18.2"
      }
    }
  },
  "s": {
    "name": "<s>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "\u22644",
        "safari_ios": "\u22643.2"
      }
    }
  },
  "safe-area-inset": {
    "name": "Safe area inset environment variables",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "69",
        "chrome_android": "69",
        "edge": "79",
        "firefox": "65",
        "firefox_android": "65",
        "safari": "11.1",
        "safari_ios": "11.3"
      }
    }
  },
  "samp": {
    "name": "<samp>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "\u22644",
        "safari_ios": "\u22643.2"
      }
    }
  },
  "sanitizer": {
    "name": "Sanitizer API",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "148",
        "firefox_android": "148"
      }
    }
  },
  "savedata": {
    "name": "Save-Data",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "65",
        "chrome_android": "65",
        "edge": "79"
      }
    }
  },
  "scheduler": {
    "name": "Scheduler API",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "129",
        "chrome_android": "129",
        "edge": "129",
        "firefox": "142",
        "firefox_android": "142"
      }
    }
  },
  "scope": {
    "name": "@scope",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-12-12",
      "support": {
        "chrome": "143",
        "chrome_android": "143",
        "edge": "143",
        "firefox": "146",
        "firefox_android": "146",
        "safari": "26.2",
        "safari_ios": "26.2"
      }
    }
  },
  "scope-pseudo": {
    "name": ":scope (pseudo-class)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "27",
        "chrome_android": "27",
        "edge": "79",
        "firefox": "32",
        "firefox_android": "32",
        "safari": "7",
        "safari_ios": "7"
      }
    }
  },
  "scoped-custom-element-registries": {
    "name": "Scoped custom element registries",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "safari": "26",
        "safari_ios": "26"
      }
    }
  },
  "screen": {
    "name": "Screen",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "screen-capture": {
    "name": "Screen capture",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "72",
        "edge": "79",
        "firefox": "33",
        "safari": "13"
      }
    }
  },
  "screen-orientation": {
    "name": "Screen orientation",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-03-27",
      "baseline_high_date": "2025-09-27",
      "support": {
        "chrome": "38",
        "chrome_android": "39",
        "edge": "79",
        "firefox": "43",
        "firefox_android": "43",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "screen-orientation-lock": {
    "name": "Screen orientation lock",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome_android": "38",
        "firefox": "144",
        "firefox_android": "144"
      }
    }
  },
  "screen-wake-lock": {
    "name": "Screen wake lock",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-03-31",
      "support": {
        "chrome": "84",
        "chrome_android": "84",
        "edge": "84",
        "firefox": "126",
        "firefox_android": "126",
        "safari": "16.4",
        "safari_ios": "18.4"
      }
    }
  },
  "script": {
    "name": "<script> and <noscript>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3",
        "safari_ios": "2"
      }
    }
  },
  "scripting": {
    "name": "scripting media query",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-12-07",
      "support": {
        "chrome": "120",
        "chrome_android": "120",
        "edge": "120",
        "firefox": "113",
        "firefox_android": "113",
        "safari": "17",
        "safari_ios": "17"
      }
    }
  },
  "scroll-behavior": {
    "name": "scroll-behavior",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-03-14",
      "baseline_high_date": "2024-09-14",
      "support": {
        "chrome": "61",
        "chrome_android": "61",
        "edge": "79",
        "firefox": "36",
        "firefox_android": "36",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "scroll-buttons": {
    "name": "::scroll-button",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "scroll-driven-animations": {
    "name": "Scroll-driven animations",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "115",
        "chrome_android": "115",
        "edge": "115",
        "safari": "26",
        "safari_ios": "26"
      }
    }
  },
  "scroll-elements": {
    "name": "Scroll methods on elements",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-09-16",
      "baseline_high_date": "2023-03-16",
      "support": {
        "chrome": "61",
        "chrome_android": "61",
        "edge": "79",
        "firefox": "36",
        "firefox_android": "36",
        "safari": "14",
        "safari_ios": "14"
      }
    }
  },
  "scroll-initial-target": {
    "name": "scroll-initial-target",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "133",
        "chrome_android": "133",
        "edge": "133"
      }
    }
  },
  "scroll-into-view": {
    "name": "scrollIntoView()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "79",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3",
        "safari_ios": "1"
      }
    }
  },
  "scroll-into-view-container": {
    "name": "scrollIntoView() container",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "140",
        "chrome_android": "140",
        "edge": "140"
      }
    }
  },
  "scroll-marker-targets": {
    "name": "Scroll marker target pseudo-classes",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "142",
        "chrome_android": "142",
        "edge": "142"
      }
    }
  },
  "scroll-markers": {
    "name": "Scroll markers",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "135",
        "chrome_android": "135",
        "edge": "135"
      }
    }
  },
  "scroll-snap": {
    "name": "Scroll snap",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "69",
        "chrome_android": "69",
        "edge": "79",
        "firefox": "68",
        "firefox_android": "68",
        "safari": "11",
        "safari_ios": "11"
      }
    }
  },
  "scroll-snap-events": {
    "name": "Scroll snap events",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "129",
        "chrome_android": "129",
        "edge": "129"
      }
    }
  },
  "scroll-target-group": {
    "name": "scroll-target-group",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "140",
        "chrome_android": "140",
        "edge": "140"
      }
    }
  },
  "scroll-to-text-fragment": {
    "name": "Scroll to text fragment",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-10-01",
      "support": {
        "chrome": "80",
        "chrome_android": "80",
        "edge": "80",
        "firefox": "131",
        "firefox_android": "131",
        "safari": "16.1",
        "safari_ios": "16.1"
      }
    }
  },
  "scrollbar-color": {
    "name": "scrollbar-color",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-12-12",
      "support": {
        "chrome": "121",
        "chrome_android": "121",
        "edge": "121",
        "firefox": "64",
        "firefox_android": "64",
        "safari": "26.2",
        "safari_ios": "26.2"
      }
    }
  },
  "scrollbar-gutter": {
    "name": "scrollbar-gutter",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-12-11",
      "support": {
        "chrome": "94",
        "chrome_android": "94",
        "edge": "94",
        "firefox": "97",
        "firefox_android": "97",
        "safari": "18.2",
        "safari_ios": "18.2"
      }
    }
  },
  "scrollbar-width": {
    "name": "scrollbar-width",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-12-11",
      "support": {
        "chrome": "121",
        "chrome_android": "121",
        "edge": "121",
        "firefox": "64",
        "firefox_android": "64",
        "safari": "18.2",
        "safari_ios": "18.2"
      }
    }
  },
  "scrollend": {
    "name": "scrollend",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-12-12",
      "support": {
        "chrome": "114",
        "chrome_android": "114",
        "edge": "114",
        "firefox": "109",
        "firefox_android": "109",
        "safari": "26.2",
        "safari_ios": "26.2"
      }
    }
  },
  "search": {
    "name": "<search>",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-10-13",
      "support": {
        "chrome": "118",
        "chrome_android": "118",
        "edge": "118",
        "firefox": "118",
        "firefox_android": "118",
        "safari": "17",
        "safari_ios": "17"
      }
    }
  },
  "search-input-type": {
    "name": '<input type="search">',
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "5",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "4",
        "firefox_android": "4",
        "safari": "5",
        "safari_ios": "4.2"
      }
    }
  },
  "section": {
    "name": "<section>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "5",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "4",
        "firefox_android": "4",
        "safari": "5",
        "safari_ios": "4.2"
      }
    }
  },
  "secure-payment-confirmation": {
    "name": "Secure payment confirmation",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "139",
        "chrome_android": "139",
        "edge": "139"
      }
    }
  },
  "select": {
    "name": "<select>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "selection": {
    "name": "::selection",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "62",
        "firefox_android": "62",
        "safari": "1.1"
      }
    }
  },
  "selection-api": {
    "name": "Selection",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-03-07",
      "baseline_high_date": "2019-09-07",
      "support": {
        "chrome": "11",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "52",
        "firefox_android": "52",
        "safari": "5.1",
        "safari_ios": "5"
      }
    }
  },
  "selectors": {
    "name": "Selectors (core)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3",
        "safari_ios": "1"
      }
    }
  },
  "serial": {
    "name": "Web serial",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "89",
        "edge": "89"
      }
    }
  },
  "serializable-errors": {
    "name": "Serializable errors",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "77",
        "chrome_android": "77",
        "edge": "79",
        "firefox": "103",
        "firefox_android": "103"
      }
    }
  },
  "server-sent-events": {
    "name": "Server-sent events",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "6",
        "chrome_android": "18",
        "edge": "79",
        "firefox": "6",
        "firefox_android": "45",
        "safari": "5",
        "safari_ios": "5"
      }
    }
  },
  "server-timing": {
    "name": "Server timing",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-03-27",
      "baseline_high_date": "2025-09-27",
      "support": {
        "chrome": "65",
        "chrome_android": "65",
        "edge": "79",
        "firefox": "61",
        "firefox_android": "61",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "service-workers": {
    "name": "Service workers",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2018-04-30",
      "baseline_high_date": "2020-10-30",
      "support": {
        "chrome": "45",
        "chrome_android": "45",
        "edge": "17",
        "firefox": "44",
        "firefox_android": "44",
        "safari": "11.1",
        "safari_ios": "11.3"
      }
    }
  },
  "set": {
    "name": "Set (initial support)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "38",
        "chrome_android": "38",
        "edge": "12",
        "firefox": "13",
        "firefox_android": "14",
        "safari": "8",
        "safari_ios": "8"
      }
    }
  },
  "set-methods": {
    "name": "Set methods",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-06-11",
      "support": {
        "chrome": "122",
        "chrome_android": "122",
        "edge": "122",
        "firefox": "127",
        "firefox_android": "127",
        "safari": "17",
        "safari_ios": "17"
      }
    }
  },
  "setinterval": {
    "name": "setInterval",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "3",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "3.5",
        "firefox_android": "4",
        "safari": "4",
        "safari_ios": "5"
      }
    }
  },
  "settimeout": {
    "name": "setTimeout()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "3",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "3.5",
        "firefox_android": "4",
        "safari": "4",
        "safari_ios": "5"
      }
    }
  },
  "shadow-dom": {
    "name": "Shadow DOM",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "53",
        "chrome_android": "53",
        "edge": "79",
        "firefox": "63",
        "firefox_android": "63",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "shadow-parts": {
    "name": "Shadow parts",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-07-28",
      "baseline_high_date": "2023-01-28",
      "support": {
        "chrome": "73",
        "chrome_android": "73",
        "edge": "79",
        "firefox": "72",
        "firefox_android": "79",
        "safari": "13.1",
        "safari_ios": "13.4"
      }
    }
  },
  "shape-function": {
    "name": "shape()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2026-02-24",
      "support": {
        "chrome": "135",
        "chrome_android": "135",
        "edge": "135",
        "firefox": "148",
        "firefox_android": "148",
        "safari": "18.4",
        "safari_ios": "18.4"
      }
    }
  },
  "shape-outside": {
    "name": "shape-outside",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "37",
        "chrome_android": "37",
        "edge": "79",
        "firefox": "62",
        "firefox_android": "62",
        "safari": "10.1",
        "safari_ios": "10.3"
      }
    }
  },
  "shapes": {
    "name": "shapes",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "37",
        "chrome_android": "37",
        "edge": "79",
        "firefox": "54",
        "firefox_android": "54",
        "safari": "10.1",
        "safari_ios": "10.3"
      }
    }
  },
  "share": {
    "name": "navigator.share()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "128",
        "chrome_android": "61",
        "edge": "93",
        "firefox_android": "79",
        "safari": "12.1",
        "safari_ios": "12.2"
      }
    }
  },
  "shared-memory": {
    "name": "SharedArrayBuffer and Atomics",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-12-13",
      "baseline_high_date": "2024-06-13",
      "support": {
        "chrome": "68",
        "chrome_android": "89",
        "edge": "79",
        "firefox": "79",
        "firefox_android": "79",
        "safari": "15.2",
        "safari_ios": "15.2"
      }
    }
  },
  "shared-storage": {
    "name": "Shared storage",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "126",
        "chrome_android": "126",
        "edge": "126"
      }
    }
  },
  "shared-storage-locks": {
    "name": "Shared storage locks",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "134",
        "chrome_android": "134",
        "edge": "134"
      }
    }
  },
  "shared-workers": {
    "name": "Shared worker",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "5",
        "edge": "79",
        "firefox": "29",
        "firefox_android": "33",
        "safari": "16",
        "safari_ios": "16"
      }
    }
  },
  "show-picker-input": {
    "name": "showPicker() for <input>",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "99",
        "chrome_android": "99",
        "edge": "99",
        "firefox": "101",
        "firefox_android": "101",
        "safari": "17.4"
      }
    }
  },
  "show-picker-select": {
    "name": "showPicker() for <select>",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "121",
        "chrome_android": "121",
        "edge": "121",
        "firefox": "122",
        "firefox_android": "122"
      }
    }
  },
  "sibling-count": {
    "name": "sibling-count() and sibling-index()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "138",
        "chrome_android": "138",
        "edge": "138",
        "safari": "26.2",
        "safari_ios": "26.2"
      }
    }
  },
  "signature-based-resource-integrity": {
    "name": "Signature-based resource integrity",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "141",
        "chrome_android": "141",
        "edge": "141"
      }
    }
  },
  "single-color-gradients": {
    "kind": "split",
    "redirect_targets": [
      "gradients",
      "conic-gradients"
    ]
  },
  "sizes-auto": {
    "name": '<img sizes="auto" loading="lazy">',
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "126",
        "chrome_android": "126",
        "edge": "126"
      }
    }
  },
  "slot": {
    "name": "<slot>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "53",
        "chrome_android": "53",
        "edge": "79",
        "firefox": "63",
        "firefox_android": "63",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "slot-assign": {
    "name": "Imperative slot assignment",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-03-27",
      "baseline_high_date": "2025-09-27",
      "support": {
        "chrome": "92",
        "chrome_android": "92",
        "edge": "92",
        "firefox": "92",
        "firefox_android": "92",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "small": {
    "name": "<small>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "\u22644",
        "safari_ios": "\u22643.2"
      }
    }
  },
  "smil-svg-animations": {
    "name": "SMIL SVG animations",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "19",
        "chrome_android": "25",
        "edge": "79",
        "firefox": "4",
        "firefox_android": "4",
        "safari": "6",
        "safari_ios": "6"
      }
    }
  },
  "smooth": {
    "name": "image-rendering: smooth",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "93",
        "firefox_android": "93"
      }
    }
  },
  "source": {
    "name": "<source>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "3",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "3.5",
        "firefox_android": "4",
        "safari": "3.1",
        "safari_ios": "2"
      }
    }
  },
  "sourcemap-header": {
    "name": "Sourcemap header",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "18",
        "chrome_android": "18",
        "edge": "79",
        "firefox": "55",
        "firefox_android": "55",
        "safari": "7",
        "safari_ios": "7"
      }
    }
  },
  "span": {
    "name": "<span>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "speak": {
    "name": "speak",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "speak-as": {
    "name": "speak-as",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "safari": "11.1",
        "safari_ios": "11.3"
      }
    }
  },
  "speculation-rules": {
    "name": "Speculation rules",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "109",
        "chrome_android": "109",
        "edge": "109"
      }
    }
  },
  "speech-recognition": {
    "name": "Speech recognition",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "139",
        "chrome_android": "139",
        "edge": "139"
      }
    }
  },
  "speech-recognition-grammar": {
    "name": "Speech recognition grammar",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "speech-synthesis": {
    "name": "Speech synthesis",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2018-09-05",
      "baseline_high_date": "2021-03-05",
      "support": {
        "chrome": "33",
        "chrome_android": "33",
        "edge": "14",
        "firefox": "49",
        "firefox_android": "62",
        "safari": "7",
        "safari_ios": "7"
      }
    }
  },
  "spellcheck": {
    "name": "spellcheck",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-11-28",
      "baseline_high_date": "2020-05-28",
      "support": {
        "chrome": "9",
        "chrome_android": "47",
        "edge": "12",
        "firefox": "2",
        "firefox_android": "57",
        "safari": "5.1",
        "safari_ios": "5"
      }
    }
  },
  "spelling-grammar-error": {
    "name": "::spelling-error and ::grammar-error",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "121",
        "chrome_android": "121",
        "edge": "121",
        "safari": "17.4",
        "safari_ios": "17.4"
      }
    }
  },
  "spread": {
    "name": "Spread syntax",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "60",
        "chrome_android": "60",
        "edge": "79",
        "firefox": "55",
        "firefox_android": "55",
        "safari": "11.1",
        "safari_ios": "11.3"
      }
    }
  },
  "srcset": {
    "name": "srcset and sizes",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-03-27",
      "baseline_high_date": "2019-09-27",
      "support": {
        "chrome": "38",
        "chrome_android": "38",
        "edge": "13",
        "firefox": "38",
        "firefox_android": "38",
        "safari": "10.1",
        "safari_ios": "10.3"
      }
    }
  },
  "stable-array-sort": {
    "name": "Stable array sort",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "70",
        "chrome_android": "70",
        "edge": "79",
        "firefox": "3",
        "firefox_android": "4",
        "safari": "10.1",
        "safari_ios": "10.3"
      }
    }
  },
  "starting-style": {
    "name": "@starting-style",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-08-06",
      "support": {
        "chrome": "117",
        "chrome_android": "117",
        "edge": "117",
        "firefox": "129",
        "firefox_android": "129",
        "safari": "17.5",
        "safari_ios": "17.5"
      }
    }
  },
  "state": {
    "name": ":state()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-05-17",
      "support": {
        "chrome": "125",
        "chrome_android": "125",
        "edge": "125",
        "firefox": "126",
        "firefox_android": "126",
        "safari": "17.4",
        "safari_ios": "17.4"
      }
    }
  },
  "static-positioning": {
    "name": "Static positioning",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "steps-easing": {
    "name": "steps() easing",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-09-16",
      "baseline_high_date": "2023-03-16",
      "support": {
        "chrome": "77",
        "chrome_android": "77",
        "edge": "79",
        "firefox": "65",
        "firefox_android": "65",
        "safari": "14",
        "safari_ios": "14"
      }
    }
  },
  "sticky-positioning": {
    "name": "Sticky positioning",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2019-09-19",
      "baseline_high_date": "2022-03-19",
      "support": {
        "chrome": "56",
        "chrome_android": "56",
        "edge": "16",
        "firefox": "59",
        "firefox_android": "59",
        "safari": "13",
        "safari_ios": "13"
      }
    }
  },
  "storage-access": {
    "name": "Storage access",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-12-05",
      "support": {
        "chrome": "119",
        "chrome_android": "120",
        "edge": "85",
        "firefox": "65",
        "firefox_android": "65",
        "safari": "11.1",
        "safari_ios": "11.3"
      }
    }
  },
  "storage-buckets": {
    "name": "Storage buckets",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "122",
        "chrome_android": "122",
        "edge": "122"
      }
    }
  },
  "storage-manager": {
    "name": "Storage manager",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-09-18",
      "support": {
        "chrome": "61",
        "chrome_android": "61",
        "edge": "79",
        "firefox": "57",
        "firefox_android": "57",
        "safari": "17",
        "safari_ios": "17"
      }
    }
  },
  "streams": {
    "name": "Streams",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-06-28",
      "baseline_high_date": "2024-12-28",
      "support": {
        "chrome": "67",
        "chrome_android": "67",
        "edge": "79",
        "firefox": "102",
        "firefox_android": "102",
        "safari": "14.1",
        "safari_ios": "14.5"
      }
    }
  },
  "stretch": {
    "name": "stretch",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "138",
        "chrome_android": "138",
        "edge": "138"
      }
    }
  },
  "string-at": {
    "name": "String at()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-03-14",
      "baseline_high_date": "2024-09-14",
      "support": {
        "chrome": "92",
        "chrome_android": "92",
        "edge": "92",
        "firefox": "90",
        "firefox_android": "90",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "string-codepoint": {
    "name": "String codePointAt() and fromCodePoint()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-09-30",
      "baseline_high_date": "2018-03-30",
      "support": {
        "chrome": "41",
        "chrome_android": "41",
        "edge": "12",
        "firefox": "29",
        "firefox_android": "29",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "string-includes": {
    "name": "String includes()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-09-30",
      "baseline_high_date": "2018-03-30",
      "support": {
        "chrome": "41",
        "chrome_android": "41",
        "edge": "12",
        "firefox": "40",
        "firefox_android": "40",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "string-matchall": {
    "name": "String matchAll()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "73",
        "chrome_android": "73",
        "edge": "79",
        "firefox": "67",
        "firefox_android": "67",
        "safari": "13",
        "safari_ios": "13"
      }
    }
  },
  "string-normalize": {
    "name": "String normalize()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2016-09-20",
      "baseline_high_date": "2019-03-20",
      "support": {
        "chrome": "34",
        "chrome_android": "34",
        "edge": "12",
        "firefox": "31",
        "firefox_android": "31",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "string-pad": {
    "name": "String padStart() and padEnd()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-04-05",
      "baseline_high_date": "2019-10-05",
      "support": {
        "chrome": "57",
        "chrome_android": "57",
        "edge": "15",
        "firefox": "48",
        "firefox_android": "48",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "string-raw": {
    "name": "String raw()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-09-30",
      "baseline_high_date": "2018-03-30",
      "support": {
        "chrome": "41",
        "chrome_android": "41",
        "edge": "12",
        "firefox": "34",
        "firefox_android": "34",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "string-repeat": {
    "name": "String repeat()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-09-30",
      "baseline_high_date": "2018-03-30",
      "support": {
        "chrome": "41",
        "chrome_android": "36",
        "edge": "12",
        "firefox": "24",
        "firefox_android": "24",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "string-replaceall": {
    "name": "String replaceAll()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-08-27",
      "baseline_high_date": "2023-02-27",
      "support": {
        "chrome": "85",
        "chrome_android": "85",
        "edge": "85",
        "firefox": "77",
        "firefox_android": "79",
        "safari": "13.1",
        "safari_ios": "13.4"
      }
    }
  },
  "string-startsends-with": {
    "name": "String startsWith() and endsWith()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-09-30",
      "baseline_high_date": "2018-03-30",
      "support": {
        "chrome": "41",
        "chrome_android": "36",
        "edge": "12",
        "firefox": "17",
        "firefox_android": "17",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "string-trim-startend": {
    "name": "String trimStart() and trimEnd()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "66",
        "chrome_android": "66",
        "edge": "79",
        "firefox": "61",
        "firefox_android": "61",
        "safari": "12",
        "safari_ios": "12"
      }
    }
  },
  "string-wellformed": {
    "name": "String isWellFormed() and toWellFormed()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-10-24",
      "support": {
        "chrome": "111",
        "chrome_android": "111",
        "edge": "111",
        "firefox": "119",
        "firefox_android": "119",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "strings": {
    "name": "String (initial support)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "strong": {
    "name": "<strong>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "\u22644",
        "safari_ios": "\u22643.2"
      }
    }
  },
  "structured-clone": {
    "name": "structuredClone()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-03-14",
      "baseline_high_date": "2024-09-14",
      "support": {
        "chrome": "98",
        "chrome_android": "98",
        "edge": "98",
        "firefox": "94",
        "firefox_android": "94",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "style": {
    "name": "<style>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "style-attr": {
    "name": "style (attribute)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "style-query-range-syntax": {
    "name": "Range syntax for style queries",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "142",
        "chrome_android": "142",
        "edge": "142"
      }
    }
  },
  "sub-sup": {
    "name": "<sub> and <sup>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "\u22644",
        "safari_ios": "\u22643.2"
      }
    }
  },
  "subgrid": {
    "name": "Subgrid",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-09-15",
      "support": {
        "chrome": "117",
        "chrome_android": "117",
        "edge": "117",
        "firefox": "71",
        "firefox_android": "79",
        "safari": "16",
        "safari_ios": "16"
      }
    }
  },
  "summarizer": {
    "name": "Summarizer",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "138"
      }
    }
  },
  "supports": {
    "name": "@supports",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-09-30",
      "baseline_high_date": "2018-03-30",
      "support": {
        "chrome": "28",
        "chrome_android": "28",
        "edge": "12",
        "firefox": "22",
        "firefox_android": "22",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "supports-at-rule": {
    "name": "at-rule()",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "supports-compat": {
    "name": "@supports (compatibility prefix)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2016-09-20",
      "baseline_high_date": "2019-03-20",
      "support": {
        "chrome": "2",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "49",
        "firefox_android": "49",
        "safari": "4",
        "safari_ios": "3.2"
      }
    }
  },
  "svg": {
    "name": "SVG",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "79",
        "firefox": "3",
        "firefox_android": "4",
        "safari": "3",
        "safari_ios": "2"
      }
    }
  },
  "svg-discouraged": {
    "name": "SVG 1.1",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "svg-filters": {
    "name": "SVG filters",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "5",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "3",
        "firefox_android": "4",
        "safari": "6",
        "safari_ios": "6"
      }
    }
  },
  "symbol": {
    "name": "Symbol",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-09-30",
      "baseline_high_date": "2018-03-30",
      "support": {
        "chrome": "38",
        "chrome_android": "38",
        "edge": "12",
        "firefox": "36",
        "firefox_android": "36",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "system-color": {
    "name": "System colors",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "tab-size": {
    "name": "tab-size",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-08-10",
      "baseline_high_date": "2024-02-10",
      "support": {
        "chrome": "42",
        "chrome_android": "42",
        "edge": "79",
        "firefox": "91",
        "firefox_android": "91",
        "safari": "13.1",
        "safari_ios": "13.4"
      }
    }
  },
  "tabindex": {
    "name": "tabindex",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2018-10-02",
      "baseline_high_date": "2021-04-02",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "18",
        "firefox": "1.5",
        "firefox_android": "4",
        "safari": "3.1",
        "safari_ios": "2"
      }
    }
  },
  "table": {
    "name": "Tables",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "table-discouraged": {
    "name": "Table styling",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "target": {
    "name": ":target",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1.3",
        "safari_ios": "2"
      }
    }
  },
  "target-text": {
    "name": "::target-text",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-12-11",
      "support": {
        "chrome": "89",
        "chrome_android": "89",
        "edge": "89",
        "firefox": "131",
        "firefox_android": "131",
        "safari": "18.2",
        "safari_ios": "18.2"
      }
    }
  },
  "target-within": {
    "name": ":target-within",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "template": {
    "name": "<template>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-11-12",
      "baseline_high_date": "2018-05-12",
      "support": {
        "chrome": "26",
        "chrome_android": "26",
        "edge": "13",
        "firefox": "22",
        "firefox_android": "22",
        "safari": "8",
        "safari_ios": "8"
      }
    }
  },
  "template-literals": {
    "name": "Template literals",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "62",
        "chrome_android": "62",
        "edge": "79",
        "firefox": "53",
        "firefox_android": "53",
        "safari": "11",
        "safari_ios": "11"
      }
    }
  },
  "temporal": {
    "name": "Temporal",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "144",
        "chrome_android": "144",
        "edge": "144",
        "firefox": "139",
        "firefox_android": "139"
      }
    }
  },
  "text-align": {
    "name": "text-align",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "text-align-last": {
    "name": "text-align-last",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-09-12",
      "baseline_high_date": "2025-03-12",
      "support": {
        "chrome": "47",
        "chrome_android": "47",
        "edge": "12",
        "firefox": "49",
        "firefox_android": "49",
        "safari": "16",
        "safari_ios": "16"
      }
    }
  },
  "text-autospace": {
    "name": "text-autospace",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "text-box": {
    "name": "text-box",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "133",
        "chrome_android": "133",
        "edge": "133",
        "safari": "18.2",
        "safari_ios": "18.2"
      }
    }
  },
  "text-combine-upright": {
    "name": "text-combine-upright",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-03-14",
      "baseline_high_date": "2024-09-14",
      "support": {
        "chrome": "48",
        "chrome_android": "48",
        "edge": "79",
        "firefox": "48",
        "firefox_android": "48",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "text-decoration": {
    "name": "text-decoration",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "text-decoration-line-blink": {
    "name": "text-decoration-line: blink",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "57",
        "chrome_android": "57",
        "edge": "79",
        "firefox": "36",
        "firefox_android": "36",
        "safari": "12.1",
        "safari_ios": "12.2"
      }
    }
  },
  "text-decoration-selection": {
    "name": "text-decoration in ::selection",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "105",
        "chrome_android": "105",
        "edge": "105"
      }
    }
  },
  "text-decoration-skip-ink": {
    "name": "text-decoration-skip-ink",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-03-14",
      "baseline_high_date": "2024-09-14",
      "support": {
        "chrome": "64",
        "chrome_android": "64",
        "edge": "79",
        "firefox": "70",
        "firefox_android": "79",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "text-decoration-skip-ink-all": {
    "name": "text-decoration-skip-ink: all",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "75",
        "firefox_android": "79",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "text-decoration-spelling-grammar": {
    "name": "Spelling and grammar text decorations",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-12-12",
      "support": {
        "chrome": "121",
        "chrome_android": "121",
        "edge": "121",
        "firefox": "137",
        "firefox_android": "137",
        "safari": "26.2",
        "safari_ios": "26.2"
      }
    }
  },
  "text-emphasis": {
    "name": "text-emphasis",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-03-03",
      "baseline_high_date": "2024-09-03",
      "support": {
        "chrome": "99",
        "chrome_android": "99",
        "edge": "99",
        "firefox": "46",
        "firefox_android": "46",
        "safari": "7",
        "safari_ios": "7"
      }
    }
  },
  "text-encoding": {
    "name": "Text encoding and decoding",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "38",
        "chrome_android": "38",
        "edge": "79",
        "firefox": "19",
        "firefox_android": "19",
        "safari": "10.1",
        "safari_ios": "10.3"
      }
    }
  },
  "text-indent": {
    "name": "text-indent",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "text-indent-each-line": {
    "name": "text-indent: each-line",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "121",
        "firefox_android": "121",
        "safari": "15",
        "safari_ios": "15"
      }
    }
  },
  "text-indent-hanging": {
    "name": "text-indent: hanging",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "121",
        "firefox_android": "121",
        "safari": "15",
        "safari_ios": "15"
      }
    }
  },
  "text-justify": {
    "name": "text-justify",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "145",
        "chrome_android": "145",
        "edge": "145",
        "firefox": "55",
        "firefox_android": "55"
      }
    }
  },
  "text-orientation": {
    "name": "text-orientation",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-09-16",
      "baseline_high_date": "2023-03-16",
      "support": {
        "chrome": "48",
        "chrome_android": "48",
        "edge": "79",
        "firefox": "41",
        "firefox_android": "41",
        "safari": "14",
        "safari_ios": "14"
      }
    }
  },
  "text-overflow": {
    "name": "Text overflow",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "7",
        "firefox_android": "7",
        "safari": "1.3",
        "safari_ios": "1"
      }
    }
  },
  "text-shadow": {
    "name": "text-shadow",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "2",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "3.5",
        "firefox_android": "4",
        "safari": "1.1",
        "safari_ios": "1"
      }
    }
  },
  "text-size-adjust": {
    "name": "text-size-adjust",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "54",
        "chrome_android": "54",
        "edge": "79"
      }
    }
  },
  "text-spacing-trim": {
    "name": "text-spacing-trim",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "123",
        "chrome_android": "123",
        "edge": "123"
      }
    }
  },
  "text-stroke-fill": {
    "name": "Text stroke and fill  (compatibility prefixes)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-04-05",
      "baseline_high_date": "2019-10-05",
      "support": {
        "chrome": "4",
        "chrome_android": "18",
        "edge": "15",
        "firefox": "49",
        "firefox_android": "49",
        "safari": "3",
        "safari_ios": "2"
      }
    }
  },
  "text-tracks": {
    "name": "Text tracks",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "23",
        "chrome_android": "25",
        "edge": "12",
        "firefox": "31",
        "firefox_android": "31",
        "safari": "6",
        "safari_ios": "6"
      }
    }
  },
  "text-transform": {
    "name": "text-transform",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "text-underline-offset": {
    "name": "text-underline-offset",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-11-19",
      "baseline_high_date": "2023-05-19",
      "support": {
        "chrome": "87",
        "chrome_android": "87",
        "edge": "87",
        "firefox": "70",
        "firefox_android": "79",
        "safari": "12.1",
        "safari_ios": "12.2"
      }
    }
  },
  "text-underline-position": {
    "name": "text-underline-position",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-07-28",
      "baseline_high_date": "2023-01-28",
      "support": {
        "chrome": "33",
        "chrome_android": "33",
        "edge": "12",
        "firefox": "74",
        "firefox_android": "79",
        "safari": "12.1",
        "safari_ios": "12.2"
      }
    }
  },
  "text-wrap": {
    "name": "text-wrap",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-10-17",
      "support": {
        "chrome": "130",
        "chrome_android": "130",
        "edge": "130",
        "firefox": "124",
        "firefox_android": "124",
        "safari": "17.5",
        "safari_ios": "17.5"
      }
    }
  },
  "text-wrap-balance": {
    "name": "text-wrap: balance",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-05-13",
      "support": {
        "chrome": "114",
        "chrome_android": "114",
        "edge": "114",
        "firefox": "121",
        "firefox_android": "121",
        "safari": "17.5",
        "safari_ios": "17.5"
      }
    }
  },
  "text-wrap-mode": {
    "kind": "moved",
    "redirect_target": "text-wrap"
  },
  "text-wrap-nowrap": {
    "kind": "moved",
    "redirect_target": "text-wrap"
  },
  "text-wrap-pretty": {
    "name": "text-wrap: pretty",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "117",
        "chrome_android": "117",
        "edge": "117",
        "safari": "26",
        "safari_ios": "26"
      }
    }
  },
  "text-wrap-stable": {
    "kind": "moved",
    "redirect_target": "text-wrap"
  },
  "text-wrap-style": {
    "kind": "split",
    "redirect_targets": [
      "text-wrap",
      "text-wrap-balance",
      "text-wrap-pretty"
    ]
  },
  "textarea": {
    "name": "<textarea>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "\u22644",
        "safari_ios": "\u22643"
      }
    }
  },
  "time": {
    "name": "<time>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-10-24",
      "baseline_high_date": "2020-04-24",
      "support": {
        "chrome": "62",
        "chrome_android": "62",
        "edge": "14",
        "firefox": "22",
        "firefox_android": "22",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "time-relative-selectors": {
    "name": "Time-relative pseudo-selectors",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "23",
        "chrome_android": "25",
        "edge": "79",
        "safari": "7",
        "safari_ios": "7"
      }
    }
  },
  "title": {
    "name": "<title>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "title-attr": {
    "name": "title (attribute)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "\u22644",
        "safari_ios": "\u22643.2"
      }
    }
  },
  "toggleevent-source": {
    "name": "ToggleEvent source",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "140",
        "chrome_android": "140",
        "edge": "140",
        "firefox": "145",
        "firefox_android": "145"
      }
    }
  },
  "top-level-await": {
    "name": "Top-level await",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "89",
        "chrome_android": "89",
        "edge": "89",
        "firefox": "89",
        "firefox_android": "89"
      }
    }
  },
  "topics": {
    "name": "Topics",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "126",
        "chrome_android": "126",
        "edge": "126"
      }
    }
  },
  "touch-action": {
    "name": "touch-action",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2019-09-19",
      "baseline_high_date": "2022-03-19",
      "support": {
        "chrome": "36",
        "chrome_android": "36",
        "edge": "12",
        "firefox": "52",
        "firefox_android": "52",
        "safari": "13",
        "safari_ios": "9.3"
      }
    }
  },
  "touch-events": {
    "name": "Touch events",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "22",
        "chrome_android": "25",
        "edge": "12",
        "firefox": "52",
        "firefox_android": "6",
        "safari_ios": "\u22643"
      }
    }
  },
  "transferable-arraybuffer": {
    "name": "Transferable ArrayBuffer",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-03-05",
      "support": {
        "chrome": "114",
        "chrome_android": "114",
        "edge": "114",
        "firefox": "122",
        "firefox_android": "122",
        "safari": "17.4",
        "safari_ios": "17.4"
      }
    }
  },
  "transferable-streams": {
    "name": "Transferable streams",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "87",
        "chrome_android": "87",
        "edge": "87",
        "firefox": "103",
        "firefox_android": "103"
      }
    }
  },
  "transform-box": {
    "name": "transform-box",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-04-16",
      "support": {
        "chrome": "118",
        "chrome_android": "118",
        "edge": "118",
        "firefox": "125",
        "firefox_android": "125",
        "safari": "13.1",
        "safari_ios": "13.4"
      }
    }
  },
  "transforms2d": {
    "name": "2D transforms",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-09-30",
      "baseline_high_date": "2018-03-30",
      "support": {
        "chrome": "36",
        "chrome_android": "36",
        "edge": "12",
        "firefox": "16",
        "firefox_android": "16",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "transforms3d": {
    "name": "3D transforms",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-03-14",
      "baseline_high_date": "2024-09-14",
      "support": {
        "chrome": "36",
        "chrome_android": "36",
        "edge": "12",
        "firefox": "16",
        "firefox_android": "16",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "transformstream-transformer-cancel": {
    "name": "TransformStream transformer cancel() method",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "transition-behavior": {
    "name": "transition-behavior",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-08-06",
      "support": {
        "chrome": "117",
        "chrome_android": "117",
        "edge": "117",
        "firefox": "129",
        "firefox_android": "129",
        "safari": "17.4",
        "safari_ios": "17.4"
      }
    }
  },
  "transitions": {
    "name": "Transitions (CSS)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-09-30",
      "baseline_high_date": "2018-03-30",
      "support": {
        "chrome": "26",
        "chrome_android": "26",
        "edge": "12",
        "firefox": "16",
        "firefox_android": "16",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "translate": {
    "name": "translate",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-03-14",
      "baseline_high_date": "2025-09-14",
      "support": {
        "chrome": "19",
        "chrome_android": "25",
        "edge": "79",
        "firefox": "111",
        "firefox_android": "111",
        "safari": "6",
        "safari_ios": "6"
      }
    }
  },
  "translator": {
    "name": "Translator",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "138"
      }
    }
  },
  "trig-functions": {
    "name": "sin(), cos(), tan(), asin(), acos(), atan(), and atan2() (CSS)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-03-13",
      "baseline_high_date": "2025-09-13",
      "support": {
        "chrome": "111",
        "chrome_android": "111",
        "edge": "111",
        "firefox": "108",
        "firefox_android": "108",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "trusted-types": {
    "name": "Trusted types",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2026-02-24",
      "support": {
        "chrome": "83",
        "chrome_android": "83",
        "edge": "83",
        "firefox": "148",
        "firefox_android": "148",
        "safari": "26",
        "safari_ios": "26"
      }
    }
  },
  "two-value-display": {
    "name": "Two-value display property",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-07-21",
      "baseline_high_date": "2026-01-21",
      "support": {
        "chrome": "115",
        "chrome_android": "115",
        "edge": "115",
        "firefox": "70",
        "firefox_android": "79",
        "safari": "15",
        "safari_ios": "15"
      }
    }
  },
  "typed-array-iteration-methods": {
    "name": "Typed array iteration methods",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2016-09-20",
      "baseline_high_date": "2019-03-20",
      "support": {
        "chrome": "45",
        "chrome_android": "45",
        "edge": "12",
        "firefox": "38",
        "firefox_android": "38",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "typed-array-iterators": {
    "name": "Typed array iterators",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2016-09-20",
      "baseline_high_date": "2019-03-20",
      "support": {
        "chrome": "45",
        "chrome_android": "45",
        "edge": "12",
        "firefox": "37",
        "firefox_android": "37",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "typed-arrays": {
    "name": "Typed arrays (initial support)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "7",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "4",
        "firefox_android": "4",
        "safari": "5.1",
        "safari_ios": "4.2"
      }
    }
  },
  "u": {
    "name": "<u>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "ua-client-hints": {
    "name": "User agent client hints",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "90",
        "chrome_android": "90",
        "edge": "90"
      }
    }
  },
  "uint8array-base64-hex": {
    "name": "Uint8Array base64 and hex conversion",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-09-05",
      "support": {
        "chrome": "140",
        "chrome_android": "140",
        "edge": "140",
        "firefox": "133",
        "firefox_android": "133",
        "safari": "18.2",
        "safari_ios": "18.2"
      }
    }
  },
  "unicode-point-escapes": {
    "name": "Unicode point escapes",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-09-30",
      "baseline_high_date": "2018-03-30",
      "support": {
        "chrome": "44",
        "chrome_android": "44",
        "edge": "12",
        "firefox": "40",
        "firefox_android": "40",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "unset-value": {
    "name": "unset",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2016-03-21",
      "baseline_high_date": "2018-09-21",
      "support": {
        "chrome": "41",
        "chrome_android": "41",
        "edge": "13",
        "firefox": "27",
        "firefox_android": "27",
        "safari": "9.1",
        "safari_ios": "9.3"
      }
    }
  },
  "update": {
    "name": "Update frequency media query",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-09-18",
      "support": {
        "chrome": "113",
        "chrome_android": "113",
        "edge": "113",
        "firefox": "102",
        "firefox_android": "102",
        "safari": "17",
        "safari_ios": "17"
      }
    }
  },
  "upgrade-insecure-requests": {
    "name": "Upgrade insecure requests",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2018-04-30",
      "baseline_high_date": "2020-10-30",
      "support": {
        "chrome": "44",
        "chrome_android": "44",
        "edge": "17",
        "firefox": "48",
        "firefox_android": "48",
        "safari": "10.1",
        "safari_ios": "10.3"
      }
    }
  },
  "url": {
    "name": "URL",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "32",
        "chrome_android": "32",
        "edge": "12",
        "firefox": "19",
        "firefox_android": "19",
        "safari": "7",
        "safari_ios": "7"
      }
    }
  },
  "url-canparse": {
    "name": "URL.canParse()",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-12-07",
      "support": {
        "chrome": "120",
        "chrome_android": "120",
        "edge": "120",
        "firefox": "115",
        "firefox_android": "115",
        "safari": "17",
        "safari_ios": "17"
      }
    }
  },
  "urlpattern": {
    "name": "URLPattern",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-09-15",
      "support": {
        "chrome": "95",
        "chrome_android": "95",
        "edge": "95",
        "firefox": "142",
        "firefox_android": "142",
        "safari": "26",
        "safari_ios": "26"
      }
    }
  },
  "user-action-pseudos": {
    "name": "User action pseudo-classes",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "2",
        "safari_ios": "1"
      }
    }
  },
  "user-activation": {
    "name": "User activation",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-11-21",
      "support": {
        "chrome": "72",
        "chrome_android": "72",
        "edge": "79",
        "firefox": "120",
        "firefox_android": "120",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "user-agent-sniffing": {
    "name": "User agent sniffing",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "4",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "3.5",
        "firefox_android": "4",
        "safari": "4",
        "safari_ios": "5"
      }
    }
  },
  "user-pseudos": {
    "name": ":user-valid and :user-invalid",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-11-02",
      "support": {
        "chrome": "119",
        "chrome_android": "119",
        "edge": "119",
        "firefox": "88",
        "firefox_android": "88",
        "safari": "16.5",
        "safari_ios": "16.5"
      }
    }
  },
  "user-select": {
    "name": "user-select",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "54",
        "chrome_android": "54",
        "edge": "79",
        "firefox": "69",
        "firefox_android": "79"
      }
    }
  },
  "var": {
    "name": "<var>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "\u22644",
        "safari_ios": "\u22643.2"
      }
    }
  },
  "vertical-align": {
    "name": "vertical-align",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "vertical-form-controls": {
    "name": "Vertical form controls",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-04-18",
      "support": {
        "chrome": "124",
        "chrome_android": "124",
        "edge": "124",
        "firefox": "120",
        "firefox_android": "120",
        "safari": "17.4",
        "safari_ios": "17.4"
      }
    }
  },
  "vibration": {
    "name": "Vibration",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "32",
        "chrome_android": "32",
        "edge": "79"
      }
    }
  },
  "video": {
    "name": "<video>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "3",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "3.5",
        "firefox_android": "4",
        "safari": "3.1",
        "safari_ios": "3"
      }
    }
  },
  "video-dynamic-range": {
    "name": "video-dynamic-range media query",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "100",
        "firefox_android": "100"
      }
    }
  },
  "view-transition-class": {
    "name": "view-transition-class",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-10-14",
      "support": {
        "chrome": "125",
        "chrome_android": "125",
        "edge": "125",
        "firefox": "144",
        "firefox_android": "144",
        "safari": "18.2",
        "safari_ios": "18.2"
      }
    }
  },
  "view-transitions": {
    "name": "View transitions",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-10-14",
      "support": {
        "chrome": "111",
        "chrome_android": "111",
        "edge": "111",
        "firefox": "144",
        "firefox_android": "144",
        "safari": "18",
        "safari_ios": "18"
      }
    }
  },
  "view-transitions-element-scoped": {
    "name": "Element-scoped view transitions",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "viewport-segments": {
    "name": "Viewport segments",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "138",
        "chrome_android": "138",
        "edge": "138"
      }
    }
  },
  "viewport-unit-variants": {
    "name": "Small, large, and dynamic viewport units",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-12-05",
      "baseline_high_date": "2025-06-05",
      "support": {
        "chrome": "108",
        "chrome_android": "108",
        "edge": "108",
        "firefox": "101",
        "firefox_android": "101",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "viewport-units": {
    "name": "Viewport units",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-10-17",
      "baseline_high_date": "2020-04-17",
      "support": {
        "chrome": "26",
        "chrome_android": "26",
        "edge": "16",
        "firefox": "19",
        "firefox_android": "19",
        "safari": "7",
        "safari_ios": "7"
      }
    }
  },
  "virtual-keyboard": {
    "name": "Virtual keyboard",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "94",
        "chrome_android": "94",
        "edge": "94"
      }
    }
  },
  "virtual-pressure-sources": {
    "name": "Virtual pressure sources",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "129",
        "chrome_android": "129",
        "edge": "129"
      }
    }
  },
  "virtual-sensors": {
    "name": "Virtual sensors",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "120",
        "chrome_android": "120",
        "edge": "120"
      }
    }
  },
  "visibility": {
    "name": "visibility",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1.3",
        "safari_ios": "1"
      }
    }
  },
  "visual-viewport": {
    "name": "Visual viewport API",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-08-10",
      "baseline_high_date": "2024-02-10",
      "support": {
        "chrome": "61",
        "chrome_android": "61",
        "edge": "79",
        "firefox": "91",
        "firefox_android": "68",
        "safari": "13",
        "safari_ios": "13"
      }
    }
  },
  "wasm": {
    "name": "WebAssembly",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-10-17",
      "baseline_high_date": "2020-04-17",
      "support": {
        "chrome": "57",
        "chrome_android": "57",
        "edge": "16",
        "firefox": "52",
        "firefox_android": "52",
        "safari": "11",
        "safari_ios": "11"
      }
    }
  },
  "wasm-bigint": {
    "name": "BigInt to i64 conversion (WebAssembly)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-04-26",
      "baseline_high_date": "2023-10-26",
      "support": {
        "chrome": "85",
        "chrome_android": "85",
        "edge": "85",
        "firefox": "78",
        "firefox_android": "79",
        "safari": "14.1",
        "safari_ios": "14.5"
      }
    }
  },
  "wasm-branch-hinting": {
    "name": "Branch hinting (WebAssembly)",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "137",
        "chrome_android": "137",
        "edge": "137",
        "safari": "16",
        "safari_ios": "16"
      }
    }
  },
  "wasm-bulk-memory": {
    "name": "Bulk memory operations (WebAssembly)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-10-25",
      "baseline_high_date": "2024-04-25",
      "support": {
        "chrome": "75",
        "chrome_android": "75",
        "edge": "79",
        "firefox": "78",
        "firefox_android": "79",
        "safari": "15.1",
        "safari_ios": "15.1"
      }
    }
  },
  "wasm-exception-handling": {
    "name": "Exception handling (WebAssembly)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-05-03",
      "baseline_high_date": "2024-11-03",
      "support": {
        "chrome": "95",
        "chrome_android": "95",
        "edge": "95",
        "firefox": "100",
        "firefox_android": "100",
        "safari": "15.2",
        "safari_ios": "15.2"
      }
    }
  },
  "wasm-exnref-exceptions": {
    "name": "Exception references with exnref (WebAssembly)",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "137",
        "chrome_android": "137",
        "firefox": "131",
        "firefox_android": "131",
        "safari": "18.4",
        "safari_ios": "18.4"
      }
    }
  },
  "wasm-extended-constant-expressions": {
    "name": "Extended constant expressions (WebAssembly)",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-03-05",
      "support": {
        "chrome": "114",
        "chrome_android": "114",
        "edge": "114",
        "firefox": "112",
        "firefox_android": "112",
        "safari": "17.4",
        "safari_ios": "17.4"
      }
    }
  },
  "wasm-garbage-collection": {
    "name": "Garbage collection (WebAssembly)",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-12-11",
      "support": {
        "chrome": "119",
        "chrome_android": "119",
        "edge": "119",
        "firefox": "120",
        "firefox_android": "120",
        "safari": "18.2",
        "safari_ios": "18.2"
      }
    }
  },
  "wasm-jspi": {
    "name": "JavaScript promise integration (WebAssembly)",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "137",
        "edge": "137"
      }
    }
  },
  "wasm-memory64": {
    "name": "Memory64 (WebAssembly)",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "133",
        "chrome_android": "133",
        "edge": "133",
        "firefox": "134",
        "firefox_android": "134"
      }
    }
  },
  "wasm-multi-memory": {
    "name": "Multi-memory (WebAssembly)",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "120",
        "chrome_android": "120",
        "edge": "120",
        "firefox": "125",
        "firefox_android": "125"
      }
    }
  },
  "wasm-multi-value": {
    "name": "Multi-value (WebAssembly)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-10-20",
      "baseline_high_date": "2023-04-20",
      "support": {
        "chrome": "86",
        "chrome_android": "86",
        "edge": "86",
        "firefox": "78",
        "firefox_android": "79",
        "safari": "13.1",
        "safari_ios": "13.4"
      }
    }
  },
  "wasm-mutable-globals": {
    "name": "Import and export of mutable globals (WebAssembly)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-03-24",
      "baseline_high_date": "2022-09-24",
      "support": {
        "chrome": "69",
        "chrome_android": "69",
        "edge": "79",
        "firefox": "62",
        "firefox_android": "62",
        "safari": "13.1",
        "safari_ios": "13.4"
      }
    }
  },
  "wasm-non-trapping-float-to-int": {
    "name": "Non-trapping float-to-int conversion (WebAssembly)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-10-25",
      "baseline_high_date": "2024-04-25",
      "support": {
        "chrome": "75",
        "chrome_android": "75",
        "edge": "18",
        "firefox": "64",
        "firefox_android": "64",
        "safari": "15.1",
        "safari_ios": "15.1"
      }
    }
  },
  "wasm-reference-types": {
    "name": "Reference types (WebAssembly)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-11-19",
      "baseline_high_date": "2024-05-19",
      "support": {
        "chrome": "96",
        "chrome_android": "96",
        "edge": "96",
        "firefox": "79",
        "firefox_android": "79",
        "safari": "15.1",
        "safari_ios": "15.1"
      }
    }
  },
  "wasm-sign-extension-operators": {
    "name": "Sign extension operators (WebAssembly)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-04-26",
      "baseline_high_date": "2023-10-26",
      "support": {
        "chrome": "69",
        "chrome_android": "69",
        "edge": "18",
        "firefox": "62",
        "firefox_android": "62",
        "safari": "14.1",
        "safari_ios": "14.5"
      }
    }
  },
  "wasm-simd": {
    "name": "Fixed-width SIMD (WebAssembly)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-03-27",
      "baseline_high_date": "2025-09-27",
      "support": {
        "chrome": "91",
        "chrome_android": "91",
        "edge": "91",
        "firefox": "89",
        "firefox_android": "89",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "wasm-simd-relaxed": {
    "name": "Relaxed-width SIMD (WebAssembly)",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "114",
        "chrome_android": "114",
        "edge": "114",
        "firefox": "146",
        "firefox_android": "146"
      }
    }
  },
  "wasm-string-builtins": {
    "name": "String builtins (WebAssembly)",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "130",
        "chrome_android": "130",
        "edge": "130",
        "firefox": "134",
        "firefox_android": "134"
      }
    }
  },
  "wasm-tail-call-optimization": {
    "name": "Tail call optimization (WebAssembly)",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-12-11",
      "support": {
        "chrome": "112",
        "chrome_android": "112",
        "edge": "112",
        "firefox": "121",
        "firefox_android": "121",
        "safari": "18.2",
        "safari_ios": "18.2"
      }
    }
  },
  "wasm-threads": {
    "name": "Threads and atomics (WebAssembly)",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-12-13",
      "baseline_high_date": "2024-06-13",
      "support": {
        "chrome": "74",
        "chrome_android": "88",
        "edge": "79",
        "firefox": "79",
        "firefox_android": "79",
        "safari": "15.2",
        "safari_ios": "15.2"
      }
    }
  },
  "wasm-typed-fun-refs": {
    "name": "Typed function references (WebAssembly)",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-09-16",
      "support": {
        "chrome": "119",
        "chrome_android": "119",
        "edge": "119",
        "firefox": "120",
        "firefox_android": "120",
        "safari": "18",
        "safari_ios": "18"
      }
    }
  },
  "wbr": {
    "name": "<wbr>",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "4",
        "safari_ios": "3.2"
      }
    }
  },
  "weak-references": {
    "name": "Weak references",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-04-26",
      "baseline_high_date": "2023-10-26",
      "support": {
        "chrome": "84",
        "chrome_android": "84",
        "edge": "84",
        "firefox": "79",
        "firefox_android": "79",
        "safari": "14.1",
        "safari_ios": "14.5"
      }
    }
  },
  "weakmap": {
    "name": "WeakMap",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "36",
        "chrome_android": "36",
        "edge": "12",
        "firefox": "6",
        "firefox_android": "6",
        "safari": "8",
        "safari_ios": "8"
      }
    }
  },
  "weakset": {
    "name": "WeakSet",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-09-30",
      "baseline_high_date": "2018-03-30",
      "support": {
        "chrome": "36",
        "chrome_android": "36",
        "edge": "12",
        "firefox": "34",
        "firefox_android": "34",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "web-animations": {
    "name": "Web animations",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-09-16",
      "baseline_high_date": "2023-03-16",
      "support": {
        "chrome": "84",
        "chrome_android": "84",
        "edge": "84",
        "firefox": "75",
        "firefox_android": "79",
        "safari": "14",
        "safari_ios": "14"
      }
    }
  },
  "web-audio": {
    "name": "Web Audio",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-04-26",
      "baseline_high_date": "2023-10-26",
      "support": {
        "chrome": "35",
        "chrome_android": "35",
        "edge": "12",
        "firefox": "25",
        "firefox_android": "25",
        "safari": "14.1",
        "safari_ios": "14.5"
      }
    }
  },
  "web-bluetooth": {
    "name": "Web Bluetooth",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "70",
        "chrome_android": "56",
        "edge": "79"
      }
    }
  },
  "web-cryptography": {
    "name": "Web Cryptography",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "37",
        "chrome_android": "37",
        "edge": "12",
        "firefox": "34",
        "firefox_android": "34",
        "safari": "11",
        "safari_ios": "11"
      }
    }
  },
  "web-install": {
    "kind": "moved",
    "redirect_target": "navigator-install"
  },
  "web-locks": {
    "name": "Locks",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-03-14",
      "baseline_high_date": "2024-09-14",
      "support": {
        "chrome": "69",
        "chrome_android": "69",
        "edge": "79",
        "firefox": "96",
        "firefox_android": "96",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "web-midi": {
    "name": "Web MIDI",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "43",
        "chrome_android": "43",
        "edge": "79",
        "firefox": "108"
      }
    }
  },
  "web-nfc": {
    "name": "Web NFC",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome_android": "100"
      }
    }
  },
  "web-otp": {
    "name": "WebOTP",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "93",
        "chrome_android": "84",
        "edge": "93"
      }
    }
  },
  "webauthn": {
    "name": "Web authentication",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-09-07",
      "baseline_high_date": "2024-03-07",
      "support": {
        "chrome": "67",
        "chrome_android": "70",
        "edge": "18",
        "firefox": "60",
        "firefox_android": "92",
        "safari": "13",
        "safari_ios": "13"
      }
    }
  },
  "webauthn-public-key-easy": {
    "name": "Web authentication easy public key access",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2023-10-24",
      "support": {
        "chrome": "85",
        "chrome_android": "85",
        "edge": "85",
        "firefox": "119",
        "firefox_android": "119",
        "safari": "16",
        "safari_ios": "16"
      }
    }
  },
  "webauthn-signals": {
    "name": "Web authentication signal methods",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "132",
        "chrome_android": "132",
        "edge": "132",
        "safari": "26",
        "safari_ios": "26"
      }
    }
  },
  "webcodecs": {
    "name": "WebCodecs",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "94",
        "chrome_android": "94",
        "edge": "94",
        "firefox": "130",
        "safari": "26",
        "safari_ios": "26"
      }
    }
  },
  "webdriver": {
    "name": "WebDriver",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "66"
      }
    }
  },
  "webdriver-bidi": {
    "name": "WebDriver BiDi",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "106",
        "chrome_android": "106",
        "edge": "106",
        "firefox": "102",
        "firefox_android": "102"
      }
    }
  },
  "webgl": {
    "name": "WebGL",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "9",
        "chrome_android": "25",
        "edge": "12",
        "firefox": "4",
        "firefox_android": "4",
        "safari": "5.1",
        "safari_ios": "8"
      }
    }
  },
  "webgl-color-buffer-float": {
    "name": "WEBGL_color_buffer_float WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-09-20",
      "baseline_high_date": "2024-03-20",
      "support": {
        "chrome": "63",
        "chrome_android": "63",
        "edge": "17",
        "firefox": "30",
        "firefox_android": "30",
        "safari": "14",
        "safari_ios": "15"
      }
    }
  },
  "webgl-color-management": {
    "name": "Color management for WebGL",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-10-29",
      "support": {
        "chrome": "104",
        "chrome_android": "104",
        "edge": "104",
        "firefox": "132",
        "firefox_android": "132",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "webgl-compressed-texture-astc": {
    "name": "WEBGL_compressed_texture_astc WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "47",
        "chrome_android": "47",
        "edge": "79",
        "firefox": "53",
        "firefox_android": "53",
        "safari": "12",
        "safari_ios": "12"
      }
    }
  },
  "webgl-compressed-texture-etc": {
    "name": "WEBGL_compressed_texture_etc WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "63",
        "chrome_android": "63",
        "edge": "79",
        "firefox_android": "51",
        "safari": "13.1",
        "safari_ios": "13.4"
      }
    }
  },
  "webgl-compressed-texture-etc1": {
    "name": "WEBGL_compressed_texture_etc1 WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "49",
        "chrome_android": "49",
        "edge": "79",
        "firefox_android": "30",
        "safari": "13.1",
        "safari_ios": "13.4"
      }
    }
  },
  "webgl-compressed-texture-pvrtc": {
    "name": "WEBGL_compressed_texture_pvrtc WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome_android": "28",
        "safari": "7",
        "safari_ios": "7"
      }
    }
  },
  "webgl-compressed-texture-s3tc": {
    "name": "WEBGL_compressed_texture_s3tc WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "26",
        "edge": "12",
        "firefox": "22",
        "safari": "8"
      }
    }
  },
  "webgl-compressed-texture-s3tc-srgb": {
    "name": "WEBGL_compressed_texture_s3tc_srgb WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "60",
        "chrome_android": "60",
        "edge": "80",
        "firefox": "55",
        "safari": "14.1",
        "safari_ios": "14.5"
      }
    }
  },
  "webgl-debug-renderer-info": {
    "name": "WEBGL_debug_renderer_info WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-04-19",
      "baseline_high_date": "2019-10-19",
      "support": {
        "chrome": "33",
        "chrome_android": "33",
        "edge": "12",
        "firefox": "53",
        "firefox_android": "53",
        "safari": "9.1",
        "safari_ios": "9.3"
      }
    }
  },
  "webgl-debug-shaders": {
    "name": "WEBGL_debug_shaders WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-09-16",
      "baseline_high_date": "2023-03-16",
      "support": {
        "chrome": "47",
        "chrome_android": "47",
        "edge": "79",
        "firefox": "56",
        "firefox_android": "56",
        "safari": "14",
        "safari_ios": "14"
      }
    }
  },
  "webgl-depth-texture": {
    "name": "WEBGL_depth_texture WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "26",
        "chrome_android": "26",
        "edge": "12",
        "firefox": "22",
        "firefox_android": "22",
        "safari": "8",
        "safari_ios": "8"
      }
    }
  },
  "webgl-desynchronized": {
    "name": "Desynchronized WebGL canvas",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "81",
        "chrome_android": "75",
        "edge": "79"
      }
    }
  },
  "webgl-draw-buffers": {
    "name": "WEBGL_draw_buffers WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "36",
        "edge": "17",
        "firefox": "28",
        "safari": "9",
        "safari_ios": "15"
      }
    }
  },
  "webgl-lose-context": {
    "name": "WEBGL_lose_context WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2018-04-30",
      "baseline_high_date": "2020-10-30",
      "support": {
        "chrome": "26",
        "chrome_android": "26",
        "edge": "17",
        "firefox": "22",
        "firefox_android": "22",
        "safari": "8",
        "safari_ios": "8"
      }
    }
  },
  "webgl-multi-draw": {
    "name": "WEBGL_multi_draw WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "86",
        "chrome_android": "86",
        "edge": "86",
        "safari": "15",
        "safari_ios": "15"
      }
    }
  },
  "webgl-oes-draw-buffers-indexed": {
    "name": "OES_draw_buffers_indexed WebGL extension",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2022-12-13",
      "baseline_high_date": "2025-06-13",
      "support": {
        "chrome": "100",
        "chrome_android": "100",
        "edge": "100",
        "firefox": "108",
        "firefox_android": "108",
        "safari": "16",
        "safari_ios": "16"
      }
    }
  },
  "webgl-sab": {
    "name": "SharedArrayBuffer in WebGL",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "60",
        "chrome_android": "60",
        "edge": "79",
        "firefox": "79",
        "firefox_android": "79"
      }
    }
  },
  "webgl2": {
    "name": "WebGL2",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-09-20",
      "baseline_high_date": "2024-03-20",
      "support": {
        "chrome": "56",
        "chrome_android": "58",
        "edge": "79",
        "firefox": "51",
        "firefox_android": "51",
        "safari": "15",
        "safari_ios": "15"
      }
    }
  },
  "webgl2-color-management": {
    "name": "Color management for WebGL2",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-10-29",
      "support": {
        "chrome": "104",
        "chrome_android": "104",
        "edge": "104",
        "firefox": "132",
        "firefox_android": "132",
        "safari": "16.4",
        "safari_ios": "16.4"
      }
    }
  },
  "webgl2-desynchronized": {
    "name": "Desynchronized WebGL2 canvas",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "81",
        "chrome_android": "75",
        "edge": "79"
      }
    }
  },
  "webgpu": {
    "name": "WebGPU",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome_android": "121",
        "safari": "26",
        "safari_ios": "26"
      }
    }
  },
  "webgpu-subgroups": {
    "name": "WebGPU subgroups",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "webhid": {
    "name": "WebHID",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "89",
        "edge": "89"
      }
    }
  },
  "webnn": {
    "name": "WebNN",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "webp": {
    "name": "WebP",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-09-16",
      "baseline_high_date": "2023-03-16",
      "support": {
        "chrome": "32",
        "chrome_android": "32",
        "edge": "18",
        "firefox": "65",
        "firefox_android": "65",
        "safari": "14",
        "safari_ios": "14"
      }
    }
  },
  "webrtc": {
    "name": "WebRTC",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "56",
        "chrome_android": "56",
        "edge": "79",
        "firefox": "22",
        "firefox_android": "24",
        "safari": "11",
        "safari_ios": "11"
      }
    }
  },
  "webrtc-encoded-transform": {
    "name": "WebRTC encoded transform",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2025-10-03",
      "support": {
        "chrome": "141",
        "chrome_android": "141",
        "edge": "141",
        "firefox": "117",
        "firefox_android": "117",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "webrtc-sctp": {
    "name": "WebRTC SCTP information",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2023-05-09",
      "baseline_high_date": "2025-11-09",
      "support": {
        "chrome": "76",
        "chrome_android": "76",
        "edge": "79",
        "firefox": "113",
        "firefox_android": "113",
        "safari": "15.4",
        "safari_ios": "15.4"
      }
    }
  },
  "webrtc-stats": {
    "name": "WebRTC statistics",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "58",
        "chrome_android": "58",
        "edge": "79",
        "firefox": "44",
        "firefox_android": "44",
        "safari": "11",
        "safari_ios": "11"
      }
    }
  },
  "websockets": {
    "name": "WebSockets",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "5",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "11",
        "firefox_android": "14",
        "safari": "5",
        "safari_ios": "4.2"
      }
    }
  },
  "webtransport": {
    "name": "WebTransport",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "97",
        "chrome_android": "97",
        "edge": "97",
        "firefox": "114",
        "firefox_android": "114"
      }
    }
  },
  "webusb": {
    "name": "WebUSB",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "61",
        "chrome_android": "61",
        "edge": "79"
      }
    }
  },
  "webvr": {
    "name": "WebVR",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "webvtt": {
    "name": "WebVTT",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "23",
        "chrome_android": "25",
        "edge": "12",
        "firefox": "31",
        "firefox_android": "31",
        "safari": "6",
        "safari_ios": "8"
      }
    }
  },
  "webvtt-cue-alignment": {
    "name": "WebVTT cue alignment",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "31",
        "firefox_android": "31",
        "safari": "14.1",
        "safari_ios": "14.5"
      }
    }
  },
  "webvtt-cue-settings": {
    "name": "WebVTT cue settings",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "23",
        "chrome_android": "25",
        "edge": "79",
        "firefox": "31",
        "firefox_android": "31",
        "safari": "6",
        "safari_ios": "8"
      }
    }
  },
  "webvtt-regions": {
    "name": "WebVTT regions",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "firefox": "59",
        "firefox_android": "59",
        "safari": "14.1",
        "safari_ios": "14.5"
      }
    }
  },
  "webxr-anchors": {
    "name": "Anchors (WebXR)",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "85",
        "chrome_android": "85",
        "edge": "85"
      }
    }
  },
  "webxr-ar": {
    "name": "Augmented reality",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "86",
        "chrome_android": "86",
        "edge": "86"
      }
    }
  },
  "webxr-camera": {
    "name": "Raw camera access for WebXR",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "107",
        "chrome_android": "107",
        "edge": "107"
      }
    }
  },
  "webxr-depth-sensing": {
    "name": "Depth sensing",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "90",
        "chrome_android": "90",
        "edge": "90"
      }
    }
  },
  "webxr-device": {
    "name": "WebXR",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "79",
        "chrome_android": "79",
        "edge": "79"
      }
    }
  },
  "webxr-dom-overlays": {
    "name": "DOM overlays for WebXR",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "83",
        "chrome_android": "83",
        "edge": "83"
      }
    }
  },
  "webxr-gamepads": {
    "name": "Gamepad (WebXR)",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "79",
        "chrome_android": "79",
        "edge": "79"
      }
    }
  },
  "webxr-hand-input": {
    "name": "Hand input",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "131",
        "chrome_android": "131"
      }
    }
  },
  "webxr-hit-test": {
    "name": "Hit test",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "81",
        "chrome_android": "81",
        "edge": "81"
      }
    }
  },
  "webxr-layers": {
    "name": "Layers (WebXR)",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {}
    }
  },
  "webxr-lighting-estimation": {
    "name": "Lighting estimation",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "90",
        "chrome_android": "90",
        "edge": "90"
      }
    }
  },
  "wheel-events": {
    "name": "Wheel events",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "31",
        "chrome_android": "31",
        "edge": "12",
        "firefox": "17",
        "firefox_android": "17",
        "safari": "7"
      }
    }
  },
  "where": {
    "name": ":where()",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2021-01-21",
      "baseline_high_date": "2023-07-21",
      "support": {
        "chrome": "88",
        "chrome_android": "88",
        "edge": "88",
        "firefox": "82",
        "firefox_android": "82",
        "safari": "14",
        "safari_ios": "14"
      }
    }
  },
  "white-space": {
    "name": "white-space",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "white-space-collapse": {
    "name": "white-space-collapse",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-03-19",
      "support": {
        "chrome": "114",
        "chrome_android": "114",
        "edge": "114",
        "firefox": "124",
        "firefox_android": "124",
        "safari": "17.4",
        "safari_ios": "17.4"
      }
    }
  },
  "widows-orphans": {
    "name": "Widows and orphans",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "25",
        "chrome_android": "25",
        "edge": "12",
        "safari": "1.3",
        "safari_ios": "1"
      }
    }
  },
  "width-height": {
    "name": "Width and height",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "will-change": {
    "name": "will-change",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2020-01-15",
      "baseline_high_date": "2022-07-15",
      "support": {
        "chrome": "36",
        "chrome_android": "36",
        "edge": "79",
        "firefox": "36",
        "firefox_android": "36",
        "safari": "9.1",
        "safari_ios": "9.3"
      }
    }
  },
  "window": {
    "name": "Window",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "window-controls-overlay": {
    "name": "Window Controls Overlay",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "105",
        "edge": "105"
      }
    }
  },
  "window-management": {
    "name": "Window management",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "111",
        "edge": "111"
      }
    }
  },
  "with": {
    "name": "with",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "38",
        "chrome_android": "38",
        "edge": "12",
        "firefox": "48",
        "firefox_android": "48",
        "safari": "10",
        "safari_ios": "10"
      }
    }
  },
  "word-break": {
    "name": "word-break",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-09-30",
      "baseline_high_date": "2018-03-30",
      "support": {
        "chrome": "44",
        "chrome_android": "44",
        "edge": "12",
        "firefox": "15",
        "firefox_android": "15",
        "safari": "9",
        "safari_ios": "9"
      }
    }
  },
  "word-break-auto-phrase": {
    "name": "word-break: auto-phrase",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "119",
        "chrome_android": "119",
        "edge": "119"
      }
    }
  },
  "word-break-break-word": {
    "name": "word-break: break-word",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "67",
        "firefox_android": "67",
        "safari": "3",
        "safari_ios": "2"
      }
    }
  },
  "word-spacing": {
    "name": "word-spacing",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "writing-mode": {
    "name": "writing-mode",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2017-03-27",
      "baseline_high_date": "2019-09-27",
      "support": {
        "chrome": "48",
        "chrome_android": "48",
        "edge": "12",
        "firefox": "41",
        "firefox_android": "41",
        "safari": "10.1",
        "safari_ios": "10.3"
      }
    }
  },
  "writing-mode-svg-values": {
    "name": "writing-mode SVG 1.1 values",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "48",
        "chrome_android": "48",
        "edge": "12",
        "firefox": "43",
        "firefox_android": "43",
        "safari": "10.1",
        "safari_ios": "10.3"
      }
    }
  },
  "writingsuggestions": {
    "name": "writingsuggestions",
    "kind": "feature",
    "status": {
      "baseline": false,
      "support": {
        "chrome": "124",
        "chrome_android": "124",
        "edge": "124",
        "safari": "18",
        "safari_ios": "18"
      }
    }
  },
  "xhr": {
    "name": "XMLHttpRequest",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3",
        "safari_ios": "1"
      }
    }
  },
  "xml-serializer": {
    "name": "XMLSerializer",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3",
        "safari_ios": "1"
      }
    }
  },
  "xpath": {
    "name": "XPath",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3",
        "safari_ios": "1"
      }
    }
  },
  "xslt": {
    "name": "XSLT",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "1",
        "firefox_android": "4",
        "safari": "3.1",
        "safari_ios": "2"
      }
    }
  },
  "z-index": {
    "name": "z-index",
    "kind": "feature",
    "status": {
      "baseline": "high",
      "baseline_low_date": "2015-07-29",
      "baseline_high_date": "2018-01-29",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "3",
        "firefox_android": "4",
        "safari": "1",
        "safari_ios": "1"
      }
    }
  },
  "zoom": {
    "name": "zoom",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2024-05-14",
      "support": {
        "chrome": "1",
        "chrome_android": "18",
        "edge": "12",
        "firefox": "126",
        "firefox_android": "126",
        "safari": "3.1",
        "safari_ios": "3"
      }
    }
  },
  "zstd": {
    "name": "Zstandard compression",
    "kind": "feature",
    "status": {
      "baseline": "low",
      "baseline_low_date": "2026-02-11",
      "support": {
        "chrome": "123",
        "chrome_android": "123",
        "edge": "123",
        "firefox": "126",
        "firefox_android": "126",
        "safari": "26.3",
        "safari_ios": "26.3"
      }
    }
  }
};

function resolveFeatureId(featureId) {
  const feature = features[featureId];
  if (!feature) {
    return [];
  }
  if (feature.kind === "feature") {
    return [featureId];
  }
  if (feature.kind === "moved") {
    return resolveFeatureId(feature.redirect_target);
  }
  if (feature.kind === "split") {
    return feature.redirect_targets.flatMap(resolveFeatureId);
  }
  return [];
}

function checkBaseline(target, featureId) {
  const resolvedIds = resolveFeatureId(featureId);
  if (resolvedIds.length === 0) return false;
  return resolvedIds.every((id) => {
    const feature = features[id];
    if (!feature) return false;
    return evaluateTarget(target, feature);
  });
}
function evaluateTarget(target, feature) {
  const normalizedTarget = target.toLowerCase().trim();
  if (normalizedTarget.includes("limited availability")) {
    return true;
  }
  const status = feature.status;
  if (!status || !status.baseline) {
    return false;
  }
  if (normalizedTarget.includes("widely available")) {
    return status.baseline === "high";
  }
  if (normalizedTarget.includes("newly available") || normalizedTarget === "baseline") {
    return status.baseline === "low" || status.baseline === "high";
  }
  const yearMatch = normalizedTarget.match(/baseline (\d{4})/);
  if (yearMatch) {
    if (!status.baseline_low_date) return false;
    const releaseYear = status.baseline_low_date.split("-")[0];
    return parseInt(releaseYear, 10) <= parseInt(yearMatch[1], 10);
  }
  const dateMatch = normalizedTarget.match(/baseline widely available on (\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    if (status.baseline !== "high" || !status.baseline_high_date) return false;
    return status.baseline_high_date <= dateMatch[1];
  }
  return false;
}
var args = process.argv.slice(2);
if (args.length < 2) {
  console.log("Usage: node check-baseline.js <command> <args...>");
  console.log("Commands:");
  console.log("  lookup <feature-id>");
  console.log("  reconcile <target> <feature-id>");
  process.exit(0);
}
var command = args[0];
if (command === "lookup") {
  const featureId = args[1];
  const resolvedIds = resolveFeatureId(featureId);
  if (resolvedIds.length === 0) {
    console.log(`Feature ${featureId} not found.`);
    process.exit(1);
  }
  if (resolvedIds.length === 1 && resolvedIds[0] === featureId) {
    console.log(`Feature ${featureId} is canonical.`);
  } else {
    console.log(`Feature ${featureId} resolved to canonical ID(s): ${resolvedIds.join(", ")}`);
  }
} else if (command === "reconcile") {
  const target = args[1];
  const featureId = args[2] || args[1];
  const isOk = checkBaseline(target, featureId);
  if (isOk) {
    console.log(`Feature ${featureId} meets target ${target}`);
    process.exit(0);
  } else {
    console.log(`Feature ${featureId} does NOT meet target ${target}`);
    process.exit(1);
  }
}
