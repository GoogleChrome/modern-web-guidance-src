// @ts-nocheck
// src/shorthands.ts

var expandBox = (physical, logical) => (values) => {
  const filtered = values.filter((v) => v.type !== "whitespace" && v.type !== "comment" && v.type !== "EOF");
  if (filtered.length === 0) return null;
  let isLogical = false;
  let offset = 0;
  if (filtered[0].type === "ident" && filtered[0].value.toLowerCase() === "logical") {
    isLogical = true;
    offset = 1;
  }
  const data = filtered.slice(offset);
  if (data.length < 1 || data.length > 4) return null;
  const result = {};
  if (isLogical) {
    const blockStart = [data[0]];
    const inlineStart = data.length > 1 ? [data[1]] : blockStart;
    const blockEnd = data.length > 2 ? [data[2]] : blockStart;
    const inlineEnd = data.length > 3 ? [data[3]] : inlineStart;
    result[logical[0]] = blockStart;
    result[logical[1]] = inlineStart;
    result[logical[2]] = blockEnd;
    result[logical[3]] = inlineEnd;
  } else {
    const top = [data[0]];
    const right = data.length > 1 ? [data[1]] : top;
    const bottom = data.length > 2 ? [data[2]] : top;
    const left = data.length > 3 ? [data[3]] : right;
    result[physical[0]] = top;
    result[physical[1]] = right;
    result[physical[2]] = bottom;
    result[physical[3]] = left;
  }
  return result;
};
var contractBox = (physical, logical) => (values) => {
  const t = values[physical[0]];
  const r = values[physical[1]];
  const b = values[physical[2]];
  const l = values[physical[3]];
  if (t && r && b && l) {
    const st = serialize(t).trim();
    const sr = serialize(r).trim();
    const sb = serialize(b).trim();
    const sl = serialize(l).trim();
    if (st === sr && st === sb && st === sl) return st;
    if (st === sb && sr === sl) return `${st} ${sr}`;
    if (sr === sl) return `${st} ${sr} ${sb}`;
    return `${st} ${sr} ${sb} ${sl}`;
  }
  const lbs = values[logical[0]];
  const lbe = values[logical[2]];
  const lis = values[logical[1]];
  const lie = values[logical[3]];
  if (lbs && lbe && lis && lie) {
    const sbs = serialize(lbs).trim();
    const sbe = serialize(lbe).trim();
    const sis = serialize(lis).trim();
    const sie = serialize(lie).trim();
    let res = "logical ";
    if (sbs === sbe && sbs === sis && sbs === sie) res += sbs;
    else if (sbs === sbe && sis === sie) res += `${sbs} ${sis}`;
    else if (sis === sie) res += `${sbs} ${sis} ${sbe}`;
    else res += `${sbs} ${sis} ${sbe} ${sie}`;
    return res;
  }
  return null;
};
var expandTwoValue = (longhands) => (values) => {
  const filtered = values.filter((v) => v.type !== "whitespace" && v.type !== "comment" && v.type !== "EOF");
  if (filtered.length < 1 || filtered.length > 2) return null;
  const result = {};
  result[longhands[0]] = [filtered[0]];
  result[longhands[1]] = filtered.length > 1 ? [filtered[1]] : [filtered[0]];
  return result;
};
var contractTwoValue = (longhands) => (values) => {
  const v1 = values[longhands[0]];
  const v2 = values[longhands[1]];
  if (!v1 || !v2) return null;
  const s1 = serialize(v1);
  const s2 = serialize(v2);
  return s1 === s2 ? s1 : `${s1} ${s2}`;
};
var SHORTHANDS = {
  "margin": {
    longhands: ["margin-top", "margin-right", "margin-bottom", "margin-left", "margin-block-start", "margin-block-end", "margin-inline-start", "margin-inline-end"],
    expand: expandBox(["margin-top", "margin-right", "margin-bottom", "margin-left"], ["margin-block-start", "margin-inline-start", "margin-block-end", "margin-inline-end"]),
    contract: contractBox(["margin-top", "margin-right", "margin-bottom", "margin-left"], ["margin-block-start", "margin-inline-start", "margin-block-end", "margin-inline-end"])
  },
  "padding": {
    longhands: ["padding-top", "padding-right", "padding-bottom", "padding-left", "padding-block-start", "padding-block-end", "padding-inline-start", "padding-inline-end"],
    expand: expandBox(["padding-top", "padding-right", "padding-bottom", "padding-left"], ["padding-block-start", "padding-inline-start", "padding-block-end", "padding-inline-end"]),
    contract: contractBox(["padding-top", "padding-right", "padding-bottom", "padding-left"], ["padding-block-start", "padding-inline-start", "padding-block-end", "padding-inline-end"])
  },
  "margin-block": {
    longhands: ["margin-block-start", "margin-block-end"],
    expand: expandTwoValue(["margin-block-start", "margin-block-end"]),
    contract: contractTwoValue(["margin-block-start", "margin-block-end"])
  },
  "margin-inline": {
    longhands: ["margin-inline-start", "margin-inline-end"],
    expand: expandTwoValue(["margin-inline-start", "margin-inline-end"]),
    contract: contractTwoValue(["margin-inline-start", "margin-inline-end"])
  },
  "padding-block": {
    longhands: ["padding-block-start", "padding-block-end"],
    expand: expandTwoValue(["padding-block-start", "padding-block-end"]),
    contract: contractTwoValue(["padding-block-start", "padding-block-end"])
  },
  "padding-inline": {
    longhands: ["padding-inline-start", "padding-inline-end"],
    expand: expandTwoValue(["padding-inline-start", "padding-inline-end"]),
    contract: contractTwoValue(["padding-inline-start", "padding-inline-end"])
  },
  "inset-block": {
    longhands: ["inset-block-start", "inset-block-end"],
    expand: expandTwoValue(["inset-block-start", "inset-block-end"]),
    contract: contractTwoValue(["inset-block-start", "inset-block-end"])
  },
  "inset-inline": {
    longhands: ["inset-inline-start", "inset-inline-end"],
    expand: expandTwoValue(["inset-inline-start", "inset-inline-end"]),
    contract: contractTwoValue(["inset-inline-start", "inset-inline-end"])
  },
  "inset": {
    longhands: ["top", "right", "bottom", "left", "inset-block-start", "inset-block-end", "inset-inline-start", "inset-inline-end"],
    expand: expandBox(["top", "right", "bottom", "left"], ["inset-block-start", "inset-inline-start", "inset-block-end", "inset-inline-end"]),
    contract: contractBox(["top", "right", "bottom", "left"], ["inset-block-start", "inset-inline-start", "inset-block-end", "inset-inline-end"])
  },
  "border-width": {
    longhands: ["border-top-width", "border-right-width", "border-bottom-width", "border-left-width", "border-block-start-width", "border-block-end-width", "border-inline-start-width", "border-inline-end-width"],
    expand: expandBox(["border-top-width", "border-right-width", "border-bottom-width", "border-left-width"], ["border-block-start-width", "border-inline-start-width", "border-block-end-width", "border-inline-end-width"]),
    contract: contractBox(["border-top-width", "border-right-width", "border-bottom-width", "border-left-width"], ["border-block-start-width", "border-inline-start-width", "border-block-end-width", "border-inline-end-width"])
  },
  "border-style": {
    longhands: ["border-top-style", "border-right-style", "border-bottom-style", "border-left-style", "border-block-start-style", "border-block-end-style", "border-inline-start-style", "border-inline-end-style"],
    expand: expandBox(["border-top-style", "border-right-style", "border-bottom-style", "border-left-style"], ["border-block-start-style", "border-inline-start-style", "border-block-end-style", "border-inline-end-style"]),
    contract: contractBox(["border-top-style", "border-right-style", "border-bottom-style", "border-left-style"], ["border-block-start-style", "border-inline-start-style", "border-block-end-style", "border-inline-end-style"])
  },
  "border-color": {
    longhands: ["border-top-color", "border-right-color", "border-bottom-color", "border-left-color", "border-block-start-color", "border-block-end-color", "border-inline-start-color", "border-inline-end-color"],
    expand: expandBox(["border-top-color", "border-right-color", "border-bottom-color", "border-left-color"], ["border-block-start-color", "border-inline-start-color", "border-block-end-color", "border-inline-end-color"]),
    contract: contractBox(["border-top-color", "border-right-color", "border-bottom-color", "border-left-color"], ["border-block-start-color", "border-inline-start-color", "border-block-end-color", "border-inline-end-color"])
  },
  "border-block-width": {
    longhands: ["border-block-start-width", "border-block-end-width"],
    expand: expandTwoValue(["border-block-start-width", "border-block-end-width"]),
    contract: contractTwoValue(["border-block-start-width", "border-block-end-width"])
  },
  "border-block-style": {
    longhands: ["border-block-start-style", "border-block-end-style"],
    expand: expandTwoValue(["border-block-start-style", "border-block-end-style"]),
    contract: contractTwoValue(["border-block-start-style", "border-block-end-style"])
  },
  "border-block-color": {
    longhands: ["border-block-start-color", "border-block-end-color"],
    expand: expandTwoValue(["border-block-start-color", "border-block-end-color"]),
    contract: contractTwoValue(["border-block-start-color", "border-block-end-color"])
  },
  "border-inline-width": {
    longhands: ["border-inline-start-width", "border-inline-end-width"],
    expand: expandTwoValue(["border-inline-start-width", "border-inline-end-width"]),
    contract: contractTwoValue(["border-inline-start-width", "border-inline-end-width"])
  },
  "border-inline-style": {
    longhands: ["border-inline-start-style", "border-inline-end-style"],
    expand: expandTwoValue(["border-inline-start-style", "border-inline-end-style"]),
    contract: contractTwoValue(["border-inline-start-style", "border-inline-end-style"])
  },
  "border-inline-color": {
    longhands: ["border-inline-start-color", "border-inline-end-color"],
    expand: expandTwoValue(["border-inline-start-color", "border-inline-end-color"]),
    contract: contractTwoValue(["border-inline-start-color", "border-inline-end-color"])
  },
  "border-radius": {
    longhands: ["border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius", "border-start-start-radius", "border-start-end-radius", "border-end-end-radius", "border-end-start-radius"],
    expand: expandBox(["border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius"], ["border-start-start-radius", "border-start-end-radius", "border-end-end-radius", "border-end-start-radius"]),
    contract: contractBox(["border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius"], ["border-start-start-radius", "border-start-end-radius", "border-end-end-radius", "border-end-start-radius"])
  }
};
var LONGHAND_TO_SHORTHAND = {};
for (const [shorthand, def] of Object.entries(SHORTHANDS)) {
  for (const longhand of def.longhands) {
    if (!LONGHAND_TO_SHORTHAND[longhand]) LONGHAND_TO_SHORTHAND[longhand] = [];
    LONGHAND_TO_SHORTHAND[longhand].push(shorthand);
  }
}

// src/serializer.ts
function serialize(nodes, preserveCase = false, propertyName) {
  if (propertyName === "font-family") {
    return serializeFontFamily(nodes);
  }
  let result = "";
  for (const node of nodes) {
    result += serializeNode(node, preserveCase);
  }
  return result;
}
function serializeNode(node, preserveCase) {
  if (typeof node !== "object" || node === null) {
    return "";
  }
  if ("type" in node) {
    if (node.type === "simple-block") {
      const start = node.associatedToken.value;
      const end = getMirrorToken(start);
      return start + serialize(node.value, preserveCase) + end;
    }
    if (node.type === "function" && "name" in node) {
      let args = node.value;
      const funcName = preserveCase ? node.name : node.name.toLowerCase();
      if (funcName === "counter") {
        let i = args.length - 1;
        while (i >= 0 && args[i].type === "whitespace") i--;
        if (i >= 0 && args[i].type === "ident" && args[i].value === "decimal") {
          let j = i - 1;
          while (j >= 0 && args[j].type === "whitespace") j--;
          if (j >= 0 && args[j].type === "comma") {
            args = args.slice(0, j);
          }
        }
      }
      if (funcName === "attr") {
        let hasPipe = false;
        let i = 0;
        while (i < args.length && args[i].type === "whitespace") i++;
        if (i < args.length && args[i].type === "delim" && args[i].value === "|") {
          hasPipe = true;
          args = args.slice(i + 1);
        }
        if (hasPipe) {
          let k = args.length - 1;
          while (k >= 0 && args[k].type === "whitespace") k--;
          if (k >= 0 && args[k].type === "string" && args[k].value === "") {
            let l = k - 1;
            while (l >= 0 && args[l].type === "whitespace") l--;
            if (l >= 0 && args[l].type === "comma") {
              args = args.slice(0, l);
            }
          }
        }
        let start = 0;
        while (start < args.length && args[start].type === "whitespace") start++;
        let end = args.length - 1;
        while (end >= 0 && args[end].type === "whitespace") end--;
        if (start <= end) {
          args = args.slice(start, end + 1);
        } else {
          args = [];
        }
      }
      let serializedArgs = serialize(args, preserveCase);
      return funcName + "(" + serializedArgs + ")";
    }
    return serializeToken(node, preserveCase);
  }
  return "";
}
function serializeToken(token, preserveCase) {
  switch (token.type) {
    case "ident":
      return serializeIdentifier(token.value);
    case "at-keyword":
      return "@" + serializeIdentifier(token.value);
    case "hash":
      return "#" + token.value;
    case "string":
      return serializeString(token.value);
    case "url":
      return `url(${serializeString(token.value)})`;
    case "delim":
    case "number":
      return token.value;
    case "percentage":
      return token.value + "%";
    case "dimension":
      return token.value + (token.unit ? serializeIdentifier(token.unit) : "");
    case "whitespace":
      return token.value;
    case "comment":
      return token.value;
    case "CDO":
      return "<!--";
    case "CDC":
      return "-->";
    case "colon":
      return ":";
    case "semicolon":
      return ";";
    case "comma":
      return ",";
    case "[":
    case "]":
    case "{":
    case "}":
    case "(":
    case ")":
      return token.value;
    case "function":
      const funcName = preserveCase ? token.value : token.value.toLowerCase();
      return serializeIdentifier(funcName) + "(";
    case "unicode-range":
      return token.value;
    case "EOF":
      return "";
    default:
      return token.value || "";
  }
}
function getMirrorToken(start) {
  if (start === "{") return "}";
  if (start === "[") return "]";
  if (start === "(") return ")";
  return "";
}
function getOriginalText(values) {
  let text = "";
  for (const val of values) {
    if (val.type === "simple-block") {
      text += val.associatedToken.originalText || "";
      text += getOriginalText(val.value);
      const start = val.associatedToken.value;
      if (start === "{") text += "}";
      else if (start === "[") text += "]";
      else if (start === "(") text += ")";
    } else if (val.type === "function") {
      const func = val;
      text += func.name + "(";
      text += getOriginalText(func.value);
      text += ")";
    } else {
      text += val.originalText || val.value;
    }
  }
  return text;
}
function serializeIdentifier(id) {
  let result = "";
  for (let i = 0; i < id.length; i++) {
    const charCode = id.charCodeAt(i);
    const char = id[i];
    if (charCode === 0) {
      result += "\uFFFD";
      continue;
    }
    if (charCode >= 1 && charCode <= 31 || charCode === 127) {
      result += escapeAsCodePoint(charCode);
      continue;
    }
    if (i === 0 && charCode >= 48 && charCode <= 57) {
      result += escapeAsCodePoint(charCode);
      continue;
    }
    if (i === 1 && charCode >= 48 && charCode <= 57 && id.charCodeAt(0) === 45) {
      result += escapeAsCodePoint(charCode);
      continue;
    }
    if (i === 0 && charCode === 45 && id.length === 1) {
      result += "\\-";
      continue;
    }
    if (charCode >= 128 || charCode === 45 || charCode === 95 || charCode >= 48 && charCode <= 57 || charCode >= 65 && charCode <= 90 || charCode >= 97 && charCode <= 122) {
      result += char;
      continue;
    }
    result += "\\" + char;
  }
  return result;
}
function serializeString(s) {
  let result = '"';
  for (let i = 0; i < s.length; i++) {
    const charCode = s.charCodeAt(i);
    const char = s[i];
    if (charCode === 0) {
      result += "\uFFFD";
      continue;
    }
    if (charCode >= 1 && charCode <= 31 || charCode === 127) {
      result += escapeAsCodePoint(charCode);
      continue;
    }
    if (charCode === 34 || charCode === 92) {
      result += "\\" + char;
      continue;
    }
    result += char;
  }
  result += '"';
  return result;
}
function escapeAsCodePoint(charCode) {
  const hex = charCode.toString(16);
  return "\\" + hex + " ";
}
var logicalShorthands = {
  "margin-inline": { start: "margin-inline-start", end: "margin-inline-end", allowDifferent: true },
  "padding-inline": { start: "padding-inline-start", end: "padding-inline-end", allowDifferent: true },
  "margin-block": { start: "margin-block-start", end: "margin-block-end", allowDifferent: true },
  "padding-block": { start: "padding-block-start", end: "padding-block-end", allowDifferent: true },
  "inset-inline": { start: "inset-inline-start", end: "inset-inline-end", allowDifferent: true },
  "inset-block": { start: "inset-block-start", end: "inset-block-end", allowDifferent: true },
  "border-inline-width": { start: "border-inline-start-width", end: "border-inline-end-width", allowDifferent: true },
  "border-block-width": { start: "border-block-start-width", end: "border-block-end-width", allowDifferent: true },
  "border-inline-style": { start: "border-inline-start-style", end: "border-inline-end-style", allowDifferent: true },
  "border-block-style": { start: "border-block-start-style", end: "border-block-end-style", allowDifferent: true },
  "border-inline-color": { start: "border-inline-start-color", end: "border-inline-end-color", allowDifferent: true },
  "border-block-color": { start: "border-block-start-color", end: "border-block-end-color", allowDifferent: true },
  "border-inline": { start: "border-inline-start", end: "border-inline-end", allowDifferent: false },
  "border-block": { start: "border-block-start", end: "border-block-end", allowDifferent: false },
  "overflow": { start: "overflow-x", end: "overflow-y", allowDifferent: true },
  "overscroll-behavior": { start: "overscroll-behavior-x", end: "overscroll-behavior-y", allowDifferent: true }
};
var logicalShorthandsEntries = Object.entries(logicalShorthands);
var logicalShorthandsValues = Object.values(logicalShorthands);
var propertyToGroup = {
  "margin-top": "margin",
  "margin-right": "margin",
  "margin-bottom": "margin",
  "margin-left": "margin",
  "margin-inline-start": "margin",
  "margin-inline-end": "margin",
  "margin-block-start": "margin",
  "margin-block-end": "margin",
  "padding-top": "padding",
  "padding-right": "padding",
  "padding-bottom": "padding",
  "padding-left": "padding",
  "padding-inline-start": "padding",
  "padding-inline-end": "padding",
  "padding-block-start": "padding",
  "padding-block-end": "padding",
  "top": "inset",
  "right": "inset",
  "bottom": "inset",
  "left": "inset",
  "inset-inline-start": "inset",
  "inset-inline-end": "inset",
  "inset-block-start": "inset",
  "inset-block-end": "inset",
  "border-top-width": "border-width",
  "border-right-width": "border-width",
  "border-bottom-width": "border-width",
  "border-left-width": "border-width",
  "border-inline-start-width": "border-width",
  "border-inline-end-width": "border-width",
  "border-block-start-width": "border-width",
  "border-block-end-width": "border-width",
  "border-top-style": "border-style",
  "border-right-style": "border-style",
  "border-bottom-style": "border-style",
  "border-left-style": "border-style",
  "border-inline-start-style": "border-style",
  "border-inline-end-style": "border-style",
  "border-block-start-style": "border-style",
  "border-block-end-style": "border-style",
  "border-top-color": "border-color",
  "border-right-color": "border-color",
  "border-bottom-color": "border-color",
  "border-left-color": "border-color",
  "border-inline-start-color": "border-color",
  "border-inline-end-color": "border-color",
  "border-block-start-color": "border-color",
  "border-block-end-color": "border-color",
  "width": "size",
  "height": "size",
  "inline-size": "size",
  "block-size": "size",
  "min-width": "min-size",
  "min-height": "min-size",
  "min-inline-size": "min-size",
  "min-block-size": "min-size",
  "max-width": "max-size",
  "max-height": "max-size",
  "max-inline-size": "max-size",
  "max-block-size": "max-size",
  "border-top-left-radius": "border-radius",
  "border-top-right-radius": "border-radius",
  "border-bottom-right-radius": "border-radius",
  "border-bottom-left-radius": "border-radius",
  "border-start-start-radius": "border-radius",
  "border-start-end-radius": "border-radius",
  "border-end-start-radius": "border-radius",
  "border-end-end-radius": "border-radius",
  "border-top": "border",
  "border-right": "border",
  "border-bottom": "border",
  "border-left": "border",
  "border-block-start": "border",
  "border-block-end": "border",
  "border-inline-start": "border",
  "border-inline-end": "border",
  "overflow-x": "overflow",
  "overflow-y": "overflow",
  "overflow-inline": "overflow",
  "overflow-block": "overflow",
  "overscroll-behavior-x": "overscroll-behavior",
  "overscroll-behavior-y": "overscroll-behavior",
  "overscroll-behavior-inline": "overscroll-behavior",
  "overscroll-behavior-block": "overscroll-behavior"
};
var genericShorthands = {
  "border-top": ["border-top-width", "border-top-style", "border-top-color"],
  "border-right": ["border-right-width", "border-right-style", "border-right-color"],
  "border-bottom": ["border-bottom-width", "border-bottom-style", "border-bottom-color"],
  "border-left": ["border-left-width", "border-left-style", "border-left-color"],
  "border-block": ["border-block-start", "border-block-end"],
  "border-inline": ["border-inline-start", "border-inline-end"],
  "margin-block": ["margin-block-start", "margin-block-end"],
  "margin-inline": ["margin-inline-start", "margin-inline-end"],
  "padding-block": ["padding-block-start", "padding-block-end"],
  "padding-inline": ["padding-inline-start", "padding-inline-end"],
  "overflow": ["overflow-x", "overflow-y"],
  "overscroll-behavior": ["overscroll-behavior-x", "overscroll-behavior-y"]
};
var genericShorthandsEntries = Object.entries(genericShorthands);
function checkIntervening(decls, allDecls, declIndices) {
  const indices = decls.map((d) => declIndices.get(d));
  const startIdx = Math.min(...indices);
  const endIdx = Math.max(...indices);
  const group = propertyToGroup[decls[0].name];
  const names = new Set(decls.map((d) => d.name));
  for (let i = startIdx + 1; i < endIdx; i++) {
    const intervening = allDecls[i];
    if (propertyToGroup[intervening.name] === group && !names.has(intervening.name)) {
      const isOrthogonal = logicalShorthandsValues.some(
        (config) => (intervening.name === config.start || intervening.name === config.end) && !names.has(config.start) && !names.has(config.end)
      );
      if (!isOrthogonal) return true;
    }
  }
  return false;
}
function tryCombineBoxShorthand(d, declMap, processed, declarations, declIndices) {
  for (const [shorthand, def] of Object.entries(SHORTHANDS)) {
    if (def.longhands.length !== 8) continue;
    const physical = def.longhands.slice(0, 4);
    const logical = def.longhands.slice(4, 8);
    const isPhysical = physical.includes(d.name);
    const isLogical = logical.includes(d.name);
    if (!isPhysical && !isLogical) continue;
    const longhands = isPhysical ? physical : logical;
    const allDecls = longhands.map((name) => declMap.get(name));
    if (allDecls.every((other) => other && !processed.has(other) && other.important === d.important)) {
      if (checkIntervening(allDecls, declarations, declIndices)) continue;
      const vals = allDecls.map((other) => serialize(other.value).trim());
      let value = "";
      if (vals[0] === vals[1] && vals[0] === vals[2] && vals[0] === vals[3]) value = vals[0];
      else if (vals[0] === vals[2] && vals[1] === vals[3]) value = `${vals[0]} ${vals[1]}`;
      else if (vals[1] === vals[3]) value = `${vals[0]} ${vals[1]} ${vals[2]}`;
      else value = `${vals[0]} ${vals[1]} ${vals[2]} ${vals[3]}`;
      allDecls.forEach((other) => processed.add(other));
      return `${shorthand}: ${isLogical ? "logical " : ""}${value}${d.important ? " !important" : ""}`;
    }
  }
  return null;
}
function tryCombineLogicalShorthand(d, declMap, processed, declarations, declIndices) {
  for (const [shorthand, longhands] of logicalShorthandsEntries) {
    if (d.name === longhands.start || d.name === longhands.end) {
      const otherName = d.name === longhands.start ? longhands.end : longhands.start;
      const otherDecl = declMap.get(otherName);
      if (otherDecl && !processed.has(otherDecl) && d.important === otherDecl.important) {
        if (checkIntervening([d, otherDecl], declarations, declIndices)) continue;
        const startDecl = d.name === longhands.start ? d : otherDecl;
        const endDecl = d.name === longhands.end ? d : otherDecl;
        const valS = serialize(startDecl.value).trim();
        const valE = serialize(endDecl.value).trim();
        if (valS === valE) {
          processed.add(startDecl);
          processed.add(endDecl);
          return `${shorthand}: ${valS}${d.important ? " !important" : ""}`;
        } else if (longhands.allowDifferent) {
          processed.add(startDecl);
          processed.add(endDecl);
          return `${shorthand}: ${valS} ${valE}${d.important ? " !important" : ""}`;
        }
      }
    }
  }
  return null;
}
function tryCombineGenericShorthand(d, declMap, processed, declarations, declIndices) {
  for (const [shorthand, longhands] of genericShorthandsEntries) {
    if (!longhands.includes(d.name)) continue;
    const allDecls = longhands.map((name) => declMap.get(name));
    if (allDecls.every((other) => other && !processed.has(other) && other.important === d.important)) {
      if (checkIntervening(allDecls, declarations, declIndices)) continue;
      const vals = allDecls.map((other) => serialize(other.value).trim());
      if (shorthand === "border-block" || shorthand === "border-inline") {
        if (!vals.every((v) => v === vals[0])) continue;
      }
      const combinedValue = vals.filter((v) => v !== "").join(" ");
      allDecls.forEach((other) => processed.add(other));
      return { name: shorthand, value: combinedValue, important: d.important };
    }
  }
  return null;
}
function tryCombineBorderFull(d, declMap, processed, declarations, declIndices) {
  const longhands = [
    "border-top-width",
    "border-top-style",
    "border-top-color",
    "border-right-width",
    "border-right-style",
    "border-right-color",
    "border-bottom-width",
    "border-bottom-style",
    "border-bottom-color",
    "border-left-width",
    "border-left-style",
    "border-left-color"
  ];
  if (!longhands.includes(d.name)) return null;
  const allDecls = longhands.map((name) => declMap.get(name));
  if (allDecls.every((other) => other && !processed.has(other) && other.important === d.important)) {
    if (checkIntervening(allDecls, declarations, declIndices)) return null;
    const vals = allDecls.map((other) => serialize(other.value).trim());
    const sameWidth = vals[0] === vals[3] && vals[0] === vals[6] && vals[0] === vals[9];
    const sameStyle = vals[1] === vals[4] && vals[1] === vals[7] && vals[1] === vals[10];
    const sameColor = vals[2] === vals[5] && vals[2] === vals[8] && vals[2] === vals[11];
    if (sameWidth && sameStyle && sameColor) {
      const combinedValue = [vals[0], vals[1], vals[2]].filter((v) => v !== "").join(" ");
      allDecls.forEach((other) => processed.add(other));
      return `border: ${combinedValue}${d.important ? " !important" : ""}`;
    }
  }
  return null;
}
function serializeFontFamily(values) {
  let result = "";
  for (const val of values) {
    if (val.type === "string") {
      const strToken = val;
      let valStr = strToken.value;
      if (valStr.startsWith("'") && valStr.endsWith("'") || valStr.startsWith('"') && valStr.endsWith('"')) {
        valStr = valStr.slice(1, -1);
      }
      const parts = valStr.split(/\s+/);
      if (parts.length > 1 && parts.every((p) => p !== "" && serializeIdentifier(p) === p)) {
        result += valStr;
        continue;
      }
    }
    result += serializeNode(val, false);
  }
  return result.trim();
}
function serializeDeclarations(declarations) {
  if (declarations.length === 0) return "";
  const declMap = /* @__PURE__ */ new Map();
  const declIndices = /* @__PURE__ */ new Map();
  for (let i = 0; i < declarations.length; i++) {
    const d = declarations[i];
    declMap.set(d.name, d);
    declIndices.set(d, i);
  }
  const processed = /* @__PURE__ */ new Set();
  const result = [];
  for (const d of declarations) {
    if (processed.has(d)) continue;
    let combined = tryCombineBorderFull(d, declMap, processed, declarations, declIndices);
    if (!combined) {
      combined = tryCombineBoxShorthand(d, declMap, processed, declarations, declIndices);
    }
    if (!combined) {
      combined = tryCombineLogicalShorthand(d, declMap, processed, declarations, declIndices);
    }
    if (!combined) {
      const generic = tryCombineGenericShorthand(d, declMap, processed, declarations, declIndices);
      if (generic) {
        const sides = ["border-top", "border-right", "border-bottom", "border-left"];
        if (sides.includes(generic.name)) {
          const sideResults = sides.map((side) => {
            if (side === generic.name) return generic;
            const existing = declMap.get(side);
            if (existing && !processed.has(existing)) return { name: side, value: serialize(existing.value).trim(), important: existing.important, decl: existing };
            const longhands = genericShorthands[side];
            if (!longhands) return null;
            const sideLonghands = longhands.map((lh) => declMap.get(lh));
            if (sideLonghands.every((lh) => lh && !processed.has(lh) && lh.important === generic.important)) {
              if (checkIntervening(sideLonghands, declarations, declIndices)) return null;
              const vals = sideLonghands.map((lh) => serialize(lh.value).trim());
              return { name: side, value: vals.filter((v) => v !== "").join(" "), important: generic.important, longhands: sideLonghands };
            }
            return null;
          });
          if (sideResults.every((r) => r !== null && r.value === generic.value && r.important === generic.important)) {
            sideResults.forEach((r) => {
              if (r && "longhands" in r) r.longhands.forEach((lh) => processed.add(lh));
              else if (r && "decl" in r) processed.add(r.decl);
            });
            combined = `border: ${generic.value}${generic.important ? " !important" : ""}`;
          } else {
            combined = `${generic.name}: ${generic.value}${generic.important ? " !important" : ""}`;
          }
        } else {
          combined = `${generic.name}: ${generic.value}${generic.important ? " !important" : ""}`;
        }
      }
    }
    if (combined) {
      result.push(combined);
    } else {
      const isCustom = d.name.startsWith("--");
      let val = serialize(d.value, isCustom, d.name).trim();
      result.push(`${d.name}: ${val}${d.important ? " !important" : ""}`);
      processed.add(d);
    }
  }
  return result.join("; ") + ";";
}

// src/AbstractTokenizer.ts
var AbstractTokenizer = class {
  unicodeRangesAllowed = false;
  parseError(message) {
    console.warn(`CSS Parse Error: ${message}`);
  }
  // 4.3.1 Consume a token
  consumeToken() {
    while (true) {
      this.consumeComments();
      const cp = this.consume();
      if (cp === -1) {
        return { type: "EOF", value: "" };
      }
      if (this.isWhitespace(cp)) {
        while (this.isWhitespace(this.cp) || this.startsComment()) {
          if (this.startsComment()) {
            this.consumeComments();
          } else {
            this.consume();
          }
        }
        return { type: "whitespace", value: " " };
      }
      switch (cp) {
        case 34:
          return this.consumeStringToken(34);
        case 35:
          if (this.isIdentCodePoint(this.cp) || this.isValidEscape(this.cp, this.peek(1))) {
            const token = { type: "hash", value: "", hashType: "unrestricted" };
            if (this.wouldStartIdentSequence(this.cp, this.peek(1), this.peek(2))) {
              token.hashType = "id";
            }
            token.value = this.consumeIdentSequence();
            return token;
          }
          return { type: "delim", value: String.fromCodePoint(cp) };
        case 39:
          return this.consumeStringToken(39);
        case 40:
          return { type: "(", value: "(" };
        case 41:
          return { type: ")", value: ")" };
        case 43:
          if (this.wouldStartNumber(cp, this.cp, this.peek(1))) {
            this.reconsume();
            return this.consumeNumericToken();
          }
          return { type: "delim", value: "+" };
        case 44:
          return { type: "comma", value: "," };
        case 45:
          if (this.wouldStartNumber(cp, this.cp, this.peek(1))) {
            this.reconsume();
            return this.consumeNumericToken();
          }
          if (this.cp === 45 && this.peek(1) === 62) {
            this.consume();
            this.consume();
            return { type: "CDC", value: "-->" };
          }
          if (this.wouldStartIdentSequence(cp, this.cp, this.peek(1))) {
            this.reconsume();
            return this.consumeIdentLikeToken();
          }
          return { type: "delim", value: "-" };
        case 46:
          if (this.wouldStartNumber(cp, this.cp, this.peek(1))) {
            this.reconsume();
            return this.consumeNumericToken();
          }
          return { type: "delim", value: "." };
        case 47:
          return { type: "delim", value: "/" };
        case 58:
          return { type: "colon", value: ":" };
        case 59:
          return { type: "semicolon", value: ";" };
        case 60:
          if (this.cp === 33 && this.peek(1) === 45 && this.peek(2) === 45) {
            this.consume();
            this.consume();
            this.consume();
            return { type: "CDO", value: "<!--" };
          }
          return { type: "delim", value: "<" };
        case 64:
          if (this.wouldStartIdentSequence(this.cp, this.peek(1), this.peek(2))) {
            const value = this.consumeIdentSequence();
            return { type: "at-keyword", value };
          }
          return { type: "delim", value: "@" };
        case 91:
          return { type: "[", value: "[" };
        case 92:
          if (this.isValidEscape(cp, this.cp)) {
            this.reconsume();
            return this.consumeIdentLikeToken();
          }
          this.parseError("Invalid escape sequence");
          return { type: "delim", value: "\\" };
        case 93:
          return { type: "]", value: "]" };
        case 123:
          return { type: "{", value: "{" };
        case 125:
          return { type: "}", value: "}" };
      }
      if (this.isDigit(cp)) {
        this.reconsume();
        return this.consumeNumericToken();
      }
      if (this.isIdentStartCodePoint(cp)) {
        this.reconsume();
        if (this.unicodeRangesAllowed && this.wouldStartUnicodeRange(this.cp, this.peek(1), this.peek(2))) {
          this.consume();
          this.consume();
          return this.consumeUnicodeRangeToken();
        }
        return this.consumeIdentLikeToken();
      }
      return { type: "delim", value: String.fromCodePoint(cp) };
    }
  }
  // 4.3.2 Consume comments
  consumeComments() {
    while (this.cp === 47 && this.peek(1) === 42) {
      this.consume();
      this.consume();
      while (true) {
        const cp = this.consume();
        if (cp === -1) {
          this.parseError("EOF reached before comment was closed");
          return;
        }
        if (cp === 42 && this.cp === 47) {
          this.consume();
          break;
        }
      }
    }
  }
  // 4.3.3 Consume a numeric token
  consumeNumericToken() {
    const number = this.consumeNumber();
    if (this.wouldStartIdentSequence(this.cp, this.peek(1), this.peek(2))) {
      const unit = this.consumeIdentSequence();
      return { type: "dimension", value: number.value.toString(), unit, numberType: number.type, sign: number.sign };
    }
    if (this.cp === 37) {
      this.consume();
      return { type: "percentage", value: number.value.toString(), numberType: number.type, sign: number.sign };
    }
    return { type: "number", value: number.value.toString(), numberType: number.type, sign: number.sign };
  }
  // 4.3.4 Consume an ident-like token
  consumeIdentLikeToken() {
    const string = this.consumeIdentSequence();
    if (string.toLowerCase() === "url" && this.cp === 40) {
      this.consume();
      while (this.isWhitespace(this.cp) && this.isWhitespace(this.peek(1))) {
        this.consume();
      }
      const currentCp = this.cp;
      if (currentCp === 34 || currentCp === 39 || this.isWhitespace(currentCp) && (this.peek(1) === 34 || this.peek(1) === 39)) {
        return { type: "function", value: string };
      }
      return this.consumeUrlToken();
    }
    if (this.cp === 40) {
      this.consume();
      return { type: "function", value: string };
    }
    return { type: "ident", value: string };
  }
  // 4.3.5 Consume a string token
  consumeStringToken(endingCodePoint) {
    const startPos = this.getPosition();
    let hasEscapes = false;
    let result = "";
    while (true) {
      const cp = this.consume();
      if (cp === endingCodePoint || cp === -1) {
        if (cp === -1) {
          this.parseError("EOF reached before string was closed");
        }
        if (!hasEscapes) {
          const lengthOffset = cp === -1 ? 0 : 1;
          const str = this.slice(startPos, this.getPosition() - lengthOffset);
          return { type: "string", value: str };
        }
        return { type: "string", value: result };
      }
      if (this.isNewline(cp)) {
        this.parseError("Newline reached before string was closed");
        this.reconsume();
        if (!hasEscapes) {
          return { type: "bad-string", value: this.slice(startPos, this.getPosition()) };
        }
        return { type: "bad-string", value: result };
      }
      if (cp === 92) {
        if (!hasEscapes) {
          hasEscapes = true;
          this.reconsume();
          result = this.slice(startPos, this.getPosition());
          this.consume();
        }
        if (this.cp === -1) {
        } else if (this.isNewline(this.cp)) {
          this.consume();
        } else {
          result += String.fromCodePoint(this.consumeEscapedCodePoint());
        }
      } else {
        if (hasEscapes) {
          result += String.fromCodePoint(cp);
        }
      }
    }
  }
  // 4.3.6 Consume a url token
  consumeUrlToken() {
    let value = "";
    while (this.isWhitespace(this.cp)) {
      this.consume();
    }
    while (true) {
      const cp = this.consume();
      if (cp === 41 || cp === -1) {
        if (cp === -1) {
          this.parseError("EOF reached before URL was closed");
        }
        return { type: "url", value };
      }
      if (this.isWhitespace(cp)) {
        while (this.isWhitespace(this.cp)) {
          this.consume();
        }
        if (this.cp === 41 || this.cp === -1) {
          if (this.cp === -1) {
            this.parseError("EOF reached before URL was closed");
          }
          this.consume();
          return { type: "url", value };
        }
        this.consumeRemnantsOfBadUrl();
        return { type: "bad-url", value };
      }
      if (cp === 34 || cp === 39 || cp === 40 || this.isNonPrintable(cp)) {
        this.parseError("Invalid character in URL");
        this.consumeRemnantsOfBadUrl();
        return { type: "bad-url", value };
      }
      if (cp === 92) {
        if (this.isValidEscape(cp, this.cp)) {
          value += String.fromCodePoint(this.consumeEscapedCodePoint());
        } else {
          this.parseError("Invalid escape sequence in URL");
          this.consumeRemnantsOfBadUrl();
          return { type: "bad-url", value };
        }
      } else {
        value += String.fromCodePoint(cp);
      }
    }
  }
  // 4.3.7 Consume an escaped code point
  consumeEscapedCodePoint() {
    const cp = this.consume();
    if (this.isHexDigit(cp)) {
      let hex = String.fromCodePoint(cp);
      let count = 1;
      while (count < 6 && this.isHexDigit(this.cp)) {
        hex += String.fromCodePoint(this.consume());
        count++;
      }
      if (this.isWhitespace(this.cp)) {
        this.consume();
      }
      const value = parseInt(hex, 16);
      if (value === 0 || value >= 55296 && value <= 57343 || value > 1114111) {
        return 65533;
      }
      return value;
    }
    if (cp === -1) {
      return 65533;
    }
    return cp;
  }
  // 4.3.8 Check if two code points are a valid escape
  isValidEscape(cp1, cp2) {
    if (cp1 !== 92) return false;
    if (this.isNewline(cp2)) return false;
    return true;
  }
  // 4.3.9 Check if three code points would start an ident sequence
  wouldStartIdentSequence(cp1, cp2, cp3) {
    if (cp1 === 45) {
      if (this.isIdentStartCodePoint(cp2) || cp2 === 45) return true;
      if (this.isValidEscape(cp2, cp3)) return true;
      return false;
    }
    if (this.isIdentStartCodePoint(cp1)) return true;
    if (cp1 === 92) {
      if (this.isValidEscape(cp1, cp2)) return true;
      return false;
    }
    return false;
  }
  // 4.3.10 Check if three code points would start a number
  wouldStartNumber(cp1, cp2, cp3) {
    if (cp1 === 43 || cp1 === 45) {
      if (this.isDigit(cp2)) return true;
      if (cp2 === 46 && this.isDigit(cp3)) return true;
      return false;
    }
    if (cp1 === 46) {
      if (this.isDigit(cp2)) return true;
      return false;
    }
    if (this.isDigit(cp1)) return true;
    return false;
  }
  // 4.3.11 Consume an ident sequence
  consumeIdentSequence() {
    const startPos = this.getPosition();
    let hasEscapes = false;
    let result = "";
    while (true) {
      const cp = this.consume();
      if (this.isIdentCodePoint(cp)) {
        if (hasEscapes) {
          result += String.fromCodePoint(cp);
        }
      } else if (this.isValidEscape(cp, this.cp)) {
        if (!hasEscapes) {
          hasEscapes = true;
          this.reconsume();
          result = this.slice(startPos, this.getPosition());
          this.consume();
        }
        result += String.fromCodePoint(this.consumeEscapedCodePoint());
      } else {
        if (cp !== -1) {
          this.reconsume();
        }
        break;
      }
    }
    if (!hasEscapes) {
      return this.slice(startPos, this.getPosition());
    }
    return result;
  }
  // 4.3.12 Consume a number
  consumeNumber() {
    let type = "integer";
    let sign = null;
    const startPos = this.getPosition();
    if (this.cp === 43) {
      sign = "+";
      this.consume();
    } else if (this.cp === 45) {
      sign = "-";
      this.consume();
    }
    while (this.isDigit(this.cp)) {
      this.consume();
    }
    if (this.cp === 46 && this.isDigit(this.peek(1))) {
      this.consume();
      while (this.isDigit(this.cp)) {
        this.consume();
      }
      type = "number";
    }
    if ((this.cp === 69 || this.cp === 101) && (this.isDigit(this.peek(1)) || (this.peek(1) === 43 || this.peek(1) === 45) && this.isDigit(this.peek(2)))) {
      this.consume();
      const signCp = this.cp;
      if (signCp === 43 || signCp === 45) {
        this.consume();
      }
      while (this.isDigit(this.cp)) {
        this.consume();
      }
      type = "number";
    }
    const numberPart = this.slice(startPos, this.getPosition());
    return { value: parseFloat(numberPart), type, sign };
  }
  // 4.3.14 Consume the remnants of a bad url
  consumeRemnantsOfBadUrl() {
    while (true) {
      const cp = this.consume();
      if (cp === 41 || cp === -1) {
        break;
      }
      if (this.isValidEscape(cp, this.cp)) {
        this.consumeEscapedCodePoint();
      }
    }
  }
  wouldStartUnicodeRange(cp1, cp2, cp3) {
    if (cp1 !== 85 && cp1 !== 117) return false;
    if (cp2 !== 43) return false;
    if (cp3 === 63 || this.isHexDigit(cp3)) return true;
    return false;
  }
  // 4.3.13 Consume a unicode-range token
  consumeUnicodeRangeToken() {
    let hex = "";
    let hasQuestionMarks = false;
    while (hex.length < 6 && this.isHexDigit(this.cp)) {
      hex += String.fromCodePoint(this.consume());
    }
    let questionMarks = "";
    while (hex.length + questionMarks.length < 6 && this.cp === 63) {
      questionMarks += String.fromCodePoint(this.consume());
      hasQuestionMarks = true;
    }
    if (hasQuestionMarks) {
      const startStr = hex + questionMarks.replace(/\?/g, "0");
      const endStr = hex + questionMarks.replace(/\?/g, "F");
      const start2 = parseInt(startStr, 16);
      const end = parseInt(endStr, 16);
      return {
        type: "unicode-range",
        value: `U+${startStr.toUpperCase().padStart(4, "0")}-${endStr.toUpperCase().padStart(4, "0")}`,
        unicodeRangeStart: start2,
        unicodeRangeEnd: end
      };
    }
    const start = parseInt(hex, 16);
    if (this.cp === 45 && this.isHexDigit(this.peek(1))) {
      this.consume();
      let endHex = "";
      while (endHex.length < 6 && this.isHexDigit(this.cp)) {
        endHex += String.fromCodePoint(this.consume());
      }
      const end = parseInt(endHex, 16);
      return {
        type: "unicode-range",
        value: `U+${hex.toUpperCase().padStart(4, "0")}-${endHex.toUpperCase().padStart(4, "0")}`,
        unicodeRangeStart: start,
        unicodeRangeEnd: end
      };
    }
    return {
      type: "unicode-range",
      value: `U+${hex.toUpperCase().padStart(4, "0")}`,
      unicodeRangeStart: start,
      unicodeRangeEnd: start
    };
  }
  startsComment() {
    return this.cp === 47 && this.peek(1) === 42;
  }
  isWhitespace(cp) {
    return cp === 10 || cp === 9 || cp === 32;
  }
  isNewline(cp) {
    return cp === 10;
  }
  isDigit(cp) {
    return cp >= 48 && cp <= 57;
  }
  isHexDigit(cp) {
    return this.isDigit(cp) || cp >= 65 && cp <= 70 || cp >= 97 && cp <= 102;
  }
  isIdentStartCodePoint(cp) {
    return cp >= 65 && cp <= 90 || // A-Z
    cp >= 97 && cp <= 122 || // a-z
    cp === 95 || // _
    this.isNonAsciiIdentCodePoint(cp);
  }
  isIdentCodePoint(cp) {
    return this.isIdentStartCodePoint(cp) || this.isDigit(cp) || cp === 45;
  }
  isNonAsciiIdentCodePoint(cp) {
    return cp === 183 || cp >= 192 && cp <= 214 || cp >= 216 && cp <= 246 || cp >= 248 && cp <= 893 || cp >= 895 && cp <= 8191 || cp === 8204 || cp === 8205 || cp === 8255 || cp === 8256 || cp >= 8304 && cp <= 8591 || cp >= 11264 && cp <= 12271 || cp >= 12289 && cp <= 55295 || cp >= 63744 && cp <= 64975 || cp >= 65008 && cp <= 65533 || cp >= 65536;
  }
  isNonPrintable(cp) {
    return cp >= 0 && cp <= 8 || cp === 11 || cp >= 14 && cp <= 31 || cp === 127;
  }
};

// src/tokenizer.ts
function tokenize(input, unicodeRangesAllowed = false) {
  const tokenizer = new Tokenizer(input);
  tokenizer.unicodeRangesAllowed = unicodeRangesAllowed;
  return tokenizer.tokenize();
}
var Tokenizer = class extends AbstractTokenizer {
  input;
  pos = 0;
  constructor(input) {
    super();
    this.input = this.preprocess(input);
  }
  preprocess(input) {
    return input.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\f/g, "\n").replace(/\0/g, "\uFFFD").replace(/[\uD800-\uDFFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "\uFFFD");
  }
  tokenize() {
    const tokens = [];
    while (true) {
      const start = this.getPosition();
      const token = this.consumeToken();
      token.startIndex = start;
      token.endIndex = this.getPosition();
      token.originalText = this.input.slice(start, token.endIndex);
      tokens.push(token);
      if (token.type === "EOF") {
        break;
      }
    }
    return tokens;
  }
  get cp() {
    return this.pos < this.input.length ? this.input.codePointAt(this.pos) : -1;
  }
  peek(offset) {
    let index = this.pos;
    for (let i = 0; i < offset; i++) {
      if (index >= this.input.length) return -1;
      const cp = this.input.codePointAt(index);
      index += cp > 65535 ? 2 : 1;
    }
    return index < this.input.length ? this.input.codePointAt(index) : -1;
  }
  consume() {
    const cp = this.cp;
    if (cp !== -1) {
      this.pos += cp > 65535 ? 2 : 1;
    }
    return cp;
  }
  reconsume() {
    if (this.pos > 0) {
      this.pos--;
      const codeUnit = this.input.charCodeAt(this.pos);
      if (codeUnit >= 56320 && codeUnit <= 57343 && this.pos > 0) {
        const prevCodeUnit = this.input.charCodeAt(this.pos - 1);
        if (prevCodeUnit >= 55296 && prevCodeUnit <= 56319) {
          this.pos--;
        }
      }
    }
  }
  slice(start, end) {
    return this.input.slice(start, end);
  }
  getPosition() {
    return this.pos;
  }
};

// src/parse-hooks.ts
var ParseHooks = {
  parseStyleAttribute: (_tokens) => {
    throw new Error("parseStyleAttribute not injected");
  },
  consumeRule: (_tokens) => {
    throw new Error("consumeRule not injected");
  },
  consumeListOfRules: (_tokens, _topLevel) => {
    throw new Error("consumeListOfRules not injected");
  },
  parseComponentValues: (_tokens) => {
    throw new Error("parseComponentValues not injected");
  },
  parseSelector: (_text) => {
    throw new Error("parseSelector not injected");
  },
  parseSelectorAST: (_text) => {
    throw new Error("parseSelectorAST not injected");
  }
};

// src/LogicalMapping.ts
var LOGICAL_MAPPING = {
  "block-size": "height",
  "inline-size": "width",
  "min-block-size": "min-height",
  "min-inline-size": "min-width",
  "max-block-size": "max-height",
  "max-inline-size": "max-width",
  "margin-block-start": "margin-top",
  "margin-block-end": "margin-bottom",
  "margin-inline-start": "margin-left",
  "margin-inline-end": "margin-right",
  "padding-block-start": "padding-top",
  "padding-block-end": "padding-bottom",
  "padding-inline-start": "padding-left",
  "padding-inline-end": "padding-right",
  "border-block-start-width": "border-top-width",
  "border-block-end-width": "border-bottom-width",
  "border-inline-start-width": "border-left-width",
  "border-inline-end-width": "border-right-width",
  "border-block-start-style": "border-top-style",
  "border-block-end-style": "border-bottom-style",
  "border-inline-start-style": "border-left-style",
  "border-inline-end-style": "border-right-style",
  "border-block-start-color": "border-top-color",
  "border-block-end-color": "border-bottom-color",
  "border-inline-start-color": "border-left-color",
  "border-inline-end-color": "border-right-color",
  "inset-block-start": "top",
  "inset-block-end": "bottom",
  "inset-inline-start": "left",
  "inset-inline-end": "right",
  "border-start-start-radius": "border-top-left-radius",
  "border-start-end-radius": "border-top-right-radius",
  "border-end-start-radius": "border-bottom-left-radius",
  "border-end-end-radius": "border-bottom-right-radius",
  "overflow-block": "overflow-y",
  "overflow-inline": "overflow-x",
  "overscroll-behavior-block": "overscroll-behavior-y",
  "overscroll-behavior-inline": "overscroll-behavior-x"
};
var PHYSICAL_TO_LOGICAL = {};
for (const [logical, physical] of Object.entries(LOGICAL_MAPPING)) {
  if (!PHYSICAL_TO_LOGICAL[physical]) PHYSICAL_TO_LOGICAL[physical] = [];
  PHYSICAL_TO_LOGICAL[physical].push(logical);
}

// src/units.ts
var unitToBase = {
  "px": "length",
  "em": "length",
  "ex": "length",
  "ch": "length",
  "rem": "length",
  "vw": "length",
  "vh": "length",
  "vmin": "length",
  "vmax": "length",
  "cm": "length",
  "mm": "length",
  "in": "length",
  "pt": "length",
  "pc": "length",
  "deg": "angle",
  "grad": "angle",
  "rad": "angle",
  "turn": "angle",
  "s": "time",
  "ms": "time",
  "hz": "frequency",
  "khz": "frequency",
  "dpi": "resolution",
  "dpcm": "resolution",
  "dppx": "resolution",
  "fr": "flex",
  "percent": "percent",
  "number": "number"
};
var unitToPixels = {
  "px": 1,
  "in": 96,
  "pc": 16,
  "pt": 96 / 72,
  "cm": 96 / 2.54,
  "mm": 96 / 25.4
};
var unitToRadians = {
  "rad": 1,
  "deg": Math.PI / 180,
  "grad": Math.PI / 200,
  "turn": 2 * Math.PI
};
var unitToSeconds = {
  "s": 1,
  "ms": 1e-3
};

// src/math-parser.ts
function parseMathFunction(name, values) {
  const tokens = values.filter((v) => v.type !== "whitespace" && v.type !== "EOF");
  let index = 0;
  function consumeSum() {
    let left = consumeProduct();
    if (!left) return null;
    while (index < tokens.length) {
      const token = tokens[index];
      if (token.type === "delim" && (token.value === "+" || token.value === "-")) {
        index++;
        const right = consumeProduct();
        if (!right) return null;
        if (token.value === "+") {
          if (left instanceof CSSMathSum) {
            left.values.push(right);
          } else {
            left = new CSSMathSum(left, right);
          }
        } else {
          if (left instanceof CSSMathSum) {
            left.values.push(new CSSMathNegate(right));
          } else {
            left = new CSSMathSum(left, new CSSMathNegate(right));
          }
        }
      } else {
        break;
      }
    }
    return left;
  }
  function consumeProduct() {
    let left = consumeValue();
    if (!left) return null;
    while (index < tokens.length) {
      const token = tokens[index];
      if (token.type === "delim" && (token.value === "*" || token.value === "/")) {
        index++;
        const right = consumeValue();
        if (!right) return null;
        if (token.value === "*") {
          if (left instanceof CSSMathProduct) {
            left.values.push(right);
          } else {
            left = new CSSMathProduct(left, right);
          }
        } else {
          if (left instanceof CSSMathProduct) {
            left.values.push(new CSSMathInvert(right));
          } else {
            left = new CSSMathProduct(left, new CSSMathInvert(right));
          }
        }
      } else {
        break;
      }
    }
    return left;
  }
  function consumeValue() {
    if (index >= tokens.length) return null;
    const token = tokens[index];
    index++;
    if (token.type === "number") {
      return new CSSNumericNode(parseFloat(token.value), "number");
    }
    if (token.type === "percentage") {
      return new CSSNumericNode(parseFloat(token.value), "percent");
    }
    if (token.type === "dimension") {
      return new CSSNumericNode(parseFloat(token.value), token.unit || "");
    }
    if (token.type === "simple-block" && token.associatedToken.type === "(") {
      return parseMathFunction("calc", token.value);
    }
    if (token.type === "function") {
      const functionToken = token;
      return parseMathFunction(functionToken.name, functionToken.value);
    }
    if (token.type === "ident") {
      const val = token.value.toLowerCase();
      if (val === "infinity" || val === "+infinity") {
        return new CSSNumericNode(Infinity, "number");
      }
      if (val === "-infinity") {
        return new CSSNumericNode(-Infinity, "number");
      }
      if (val === "nan") {
        return new CSSNumericNode(NaN, "number");
      }
      if (val === "e") {
        return new CSSNumericNode(Math.E, "number");
      }
      if (val === "pi") {
        return new CSSNumericNode(Math.PI, "number");
      }
    }
    if (token.type === "delim" && (token.value === "+" || token.value === "-")) {
      const next = tokens[index];
      if (next && next.type === "ident" && next.value.toLowerCase() === "infinity") {
        index++;
        return new CSSNumericNode(token.value === "+" ? Infinity : -Infinity, "number");
      }
    }
    return null;
  }
  const nameLower = name.toLowerCase();
  if (nameLower === "calc") {
    const result = consumeSum();
    if (index < tokens.length) return null;
    return result ? simplify(result) : null;
  }
  if (nameLower === "min" || nameLower === "max") {
    const args = [];
    const firstArg = consumeSum();
    if (!firstArg) return null;
    args.push(firstArg);
    while (index < tokens.length) {
      const token = tokens[index];
      if (token.type === "comma") {
        index++;
        const nextArg = consumeSum();
        if (!nextArg) return null;
        args.push(nextArg);
      } else {
        break;
      }
    }
    if (index < tokens.length) return null;
    const result = nameLower === "min" ? new CSSMathMin(...args) : new CSSMathMax(...args);
    return simplify(result);
  }
  if (nameLower === "clamp") {
    const args = [];
    const firstArg = consumeSum();
    if (!firstArg) return null;
    args.push(firstArg);
    for (let i = 0; i < 2; i++) {
      if (index >= tokens.length) return null;
      const token = tokens[index];
      if (token.type !== "comma") return null;
      index++;
      const nextArg = consumeSum();
      if (!nextArg) return null;
      args.push(nextArg);
    }
    if (index < tokens.length) return null;
    const result = new CSSMathClamp(args[0], args[1], args[2]);
    return simplify(result);
  }
  const MATH_FUNCTIONS = [
    "sin",
    "cos",
    "tan",
    "asin",
    "acos",
    "atan",
    "atan2",
    "pow",
    "sqrt",
    "exp",
    "log",
    "hypot",
    "abs",
    "sign",
    "round",
    "mod",
    "rem"
  ];
  if (MATH_FUNCTIONS.includes(nameLower)) {
    const args = [];
    const firstArg = consumeSum();
    if (!firstArg) return null;
    args.push(firstArg);
    while (index < tokens.length) {
      const token = tokens[index];
      if (token.type === "comma") {
        index++;
        const nextArg = consumeSum();
        if (!nextArg) return null;
        args.push(nextArg);
      } else {
        break;
      }
    }
    if (index < tokens.length) return null;
    const result = new CSSMathFunction(nameLower, ...args);
    return simplify(result);
  }
  return null;
}
function simplify(node) {
  if (node instanceof CSSMathSum) {
    const values = [];
    for (const child of node.values) {
      const simplifiedChild = simplify(child);
      if (simplifiedChild instanceof CSSMathSum) {
        values.push(...simplifiedChild.values);
      } else {
        values.push(simplifiedChild);
      }
    }
    const combinedChildren = [];
    const numericByBase = /* @__PURE__ */ new Map();
    for (const child of values) {
      if (child instanceof CSSNumericNode) {
        const base = unitToBase[child.unit] || "other";
        let canonicalValue = child.value;
        let canonicalUnit = child.unit;
        let key = child.unit;
        if (base === "length" && unitToPixels[child.unit]) {
          canonicalValue *= unitToPixels[child.unit];
          canonicalUnit = "px";
          key = "length";
        } else if (base === "angle" && unitToRadians[child.unit]) {
          canonicalValue *= unitToRadians[child.unit] / unitToRadians["deg"];
          canonicalUnit = "deg";
          key = "angle";
        } else if (base === "time" && unitToSeconds[child.unit]) {
          canonicalValue *= unitToSeconds[child.unit];
          canonicalUnit = "s";
          key = "time";
        } else if (base === "number") {
          key = "number";
        }
        const existing = numericByBase.get(key);
        if (existing) {
          existing.value += canonicalValue;
        } else {
          numericByBase.set(key, { value: canonicalValue, unit: canonicalUnit });
        }
      } else {
        combinedChildren.push(child);
      }
    }
    for (const { value, unit } of numericByBase.values()) {
      combinedChildren.push(new CSSNumericNode(value, unit));
    }
    if (combinedChildren.length === 1) {
      return combinedChildren[0];
    }
    return new CSSMathSum(...combinedChildren);
  }
  if (node instanceof CSSMathProduct) {
    const values = [];
    for (const child of node.values) {
      const simplifiedChild = simplify(child);
      if (simplifiedChild instanceof CSSMathProduct) {
        values.push(...simplifiedChild.values);
      } else {
        values.push(simplifiedChild);
      }
    }
    const allNumeric = values.every((c) => c instanceof CSSNumericNode);
    const hasInfinityOrNaN = values.some((c) => c instanceof CSSNumericNode && (c.value === Infinity || c.value === -Infinity || Number.isNaN(c.value)));
    if (allNumeric && !hasInfinityOrNaN) {
      const numericChildren = values;
      let product = 1;
      let unit = "number";
      let nonNumberUnitCount = 0;
      for (const child of numericChildren) {
        product *= child.value;
        if (child.unit !== "number") {
          unit = child.unit;
          nonNumberUnitCount++;
        }
      }
      if (nonNumberUnitCount <= 1) {
        return new CSSNumericNode(product, unit);
      }
    }
    const combinedChildren = [];
    let numberProduct = 1;
    let hasNumbers = false;
    for (const child of values) {
      if (child instanceof CSSNumericNode && child.unit === "number") {
        numberProduct *= child.value;
        hasNumbers = true;
      } else {
        combinedChildren.push(child);
      }
    }
    if (hasNumbers) {
      combinedChildren.unshift(new CSSNumericNode(numberProduct, "number"));
    }
    const numberNode = combinedChildren.find((c) => c instanceof CSSNumericNode && c.unit === "number");
    const sumNode = combinedChildren.find((c) => c instanceof CSSMathSum);
    if (numberNode && sumNode && combinedChildren.length === 2) {
      const distributedChildren = sumNode.values.map((child) => {
        return simplify(new CSSMathProduct(numberNode, child));
      });
      return simplify(new CSSMathSum(...distributedChildren));
    }
    if (combinedChildren.length === 1) {
      return combinedChildren[0];
    }
    return new CSSMathProduct(...combinedChildren);
  }
  if (node instanceof CSSMathNegate) {
    const simplifiedChild = simplify(node.value);
    if (simplifiedChild instanceof CSSNumericNode) {
      return new CSSNumericNode(-simplifiedChild.value, simplifiedChild.unit);
    }
    if (simplifiedChild instanceof CSSMathNegate) {
      return simplifiedChild.value;
    }
    return new CSSMathNegate(simplifiedChild);
  }
  if (node instanceof CSSMathInvert) {
    const simplifiedChild = simplify(node.value);
    if (simplifiedChild instanceof CSSNumericNode && simplifiedChild.unit === "number") {
      return new CSSNumericNode(1 / simplifiedChild.value, "number");
    }
    if (simplifiedChild instanceof CSSMathInvert) {
      return simplifiedChild.value;
    }
    return new CSSMathInvert(simplifiedChild);
  }
  if (node instanceof CSSMathMin) {
    const values = node.values.map((c) => simplify(c));
    const allNumeric = values.every((c) => c instanceof CSSNumericNode);
    if (allNumeric && values.length > 0) {
      const firstUnit = values[0].unit;
      const allSameUnit = values.every((c) => c.unit === firstUnit);
      if (allSameUnit) {
        const numericValues = values.map((c) => c.value);
        return new CSSNumericNode(Math.min(...numericValues), firstUnit);
      }
    }
    return new CSSMathMin(...values);
  }
  if (node instanceof CSSMathMax) {
    const values = node.values.map((c) => simplify(c));
    const allNumeric = values.every((c) => c instanceof CSSNumericNode);
    if (allNumeric && values.length > 0) {
      const firstUnit = values[0].unit;
      const allSameUnit = values.every((c) => c.unit === firstUnit);
      if (allSameUnit) {
        const numericValues = values.map((c) => c.value);
        return new CSSNumericNode(Math.max(...numericValues), firstUnit);
      }
    }
    return new CSSMathMax(...values);
  }
  if (node instanceof CSSMathClamp) {
    const min = simplify(node.min);
    const val = simplify(node.val);
    const max = simplify(node.max);
    if (min instanceof CSSNumericNode && val instanceof CSSNumericNode && max instanceof CSSNumericNode) {
      if (min.unit === val.unit && val.unit === max.unit) {
        return new CSSNumericNode(Math.min(Math.max(val.value, min.value), max.value), val.unit);
      }
    }
    return new CSSMathClamp(min, val, max);
  }
  if (node instanceof CSSMathFunction) {
    const values = node.values.map((v) => simplify(v));
    return new CSSMathFunction(node.name, ...values);
  }
  return node;
}

// src/PropertyRegistry.ts
var VALID_COMPONENTS = /* @__PURE__ */ new Set([
  "length",
  "number",
  "percentage",
  "length-percentage",
  "color",
  "image",
  "url",
  "integer",
  "angle",
  "time",
  "resolution",
  "transform-function",
  "transform-list",
  "custom-ident"
]);
var SyntaxError2 = class extends Error {
  constructor(message) {
    super(message);
    this.name = "SyntaxError";
  }
};
function validateSyntax(syntax) {
  const s = syntax.trim();
  if (s === "*") return true;
  const parts = s.split("|").map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith("<") && part.endsWith(">")) {
      let name = part.slice(1, -1);
      if (name.endsWith("+") || name.endsWith("#")) {
        name = name.slice(0, -1);
      }
      if (!VALID_COMPONENTS.has(name)) return false;
    } else if (part.startsWith("<") && (part.endsWith(">") || part.endsWith(">+") || part.endsWith(">#"))) {
      let name = "";
      if (part.endsWith(">+")) name = part.slice(1, -2);
      else if (part.endsWith(">#")) name = part.slice(1, -2);
      else name = part.slice(1, -1);
      if (!VALID_COMPONENTS.has(name)) return false;
    } else {
      if (!/^[a-zA-Z-][a-zA-Z0-9-]*$/.test(part)) return false;
    }
  }
  return true;
}
function matchesSyntax(tokens, syntax) {
  if (syntax === "*") return true;
  const parts = syntax.split("|").map((s) => s.trim());
  for (const part of parts) {
    let type = part;
    let multiplier = "";
    if (part.endsWith("+") || part.endsWith("#")) {
      type = part.slice(0, -1);
      multiplier = part.slice(-1);
    }
    if (type.startsWith("<") && type.endsWith(">")) {
      const name = type.slice(1, -1);
      const checkItem = (itemTokens) => {
        if (itemTokens.length !== 1) return false;
        const t = itemTokens[0];
        if (name === "length") return t.type === "dimension" || t.type === "number" && parseFloat(t.value) === 0;
        if (name === "number") return t.type === "number";
        if (name === "percentage") return t.type === "percentage";
        if (name === "length-percentage") return t.type === "dimension" || t.type === "percentage" || t.type === "number" && parseFloat(t.value) === 0;
        if (name === "integer") return t.type === "number" && t.numberType === "integer";
        if (name === "angle") return t.type === "dimension" && ["deg", "grad", "rad", "turn"].includes(t.unit?.toLowerCase() || "");
        if (name === "time") return t.type === "dimension" && ["s", "ms"].includes(t.unit?.toLowerCase() || "");
        if (name === "resolution") return t.type === "dimension" && ["dpi", "dpcm", "dppx", "x"].includes(t.unit?.toLowerCase() || "");
        if (name === "color") return t.type === "ident" || t.type === "function" || t.type === "hash";
        if (name === "url") return t.type === "url" || t.type === "function" && t.name === "url";
        if (name === "image") return t.type === "url" || t.type === "function";
        if (name === "custom-ident") return t.type === "ident";
        return true;
      };
      if (multiplier === "#") {
        const items = [[]];
        for (const t of tokens) {
          if (t.type === "comma") items.push([]);
          else items[items.length - 1].push(t);
        }
        if (items.every((item) => checkItem(item))) return true;
      } else if (multiplier === "+") {
        if (tokens.every((t) => checkItem([t]))) return true;
      } else {
        if (checkItem(tokens)) return true;
      }
    } else {
      if (tokens.length === 1 && tokens[0].type === "ident" && tokens[0].value.toString().toLowerCase() === type.toLowerCase()) return true;
    }
  }
  return false;
}
function isComputationallyIndependent(tokens) {
  for (const t of tokens) {
    if (t.type === "function") {
      const name = t.name.toLowerCase();
      if (["var", "env", "attr"].includes(name)) return false;
      if (!isComputationallyIndependent(t.value)) return false;
    }
    if (t.type === "dimension") {
      const unit = t.unit?.toLowerCase();
      if (unit && !["px", "cm", "mm", "in", "pt", "pc", "deg", "grad", "rad", "turn", "s", "ms", "dpi", "dpcm", "dppx", "x"].includes(unit)) {
        return false;
      }
    }
    if (t.type === "ident" && t.value.toString().toLowerCase() === "currentcolor") return false;
    if (t.type === "simple-block") {
      if (!isComputationallyIndependent(t.value)) return false;
    }
  }
  return true;
}
var registry = /* @__PURE__ */ new Map();
var PropertyRegistry = {
  validate(definition) {
    if (!definition.name.startsWith("--")) {
      throw new SyntaxError2('Property name must start with "--"');
    }
    const syntax = definition.syntax || "*";
    if (!validateSyntax(syntax)) {
      throw new SyntaxError2(`Invalid syntax string: ${syntax}`);
    }
    if (syntax !== "*" && definition.initialValue === void 0) {
      throw new SyntaxError2("initialValue is required for non-universal syntax");
    }
    if (definition.initialValue !== void 0) {
      const tokens = tokenize(definition.initialValue).filter((t) => t.type !== "whitespace");
      const parser = new Parser(tokens);
      const values = parser.parseComponentValues();
      if (!isComputationallyIndependent(values)) {
        throw new SyntaxError2(`initialValue is not computationally independent: ${definition.initialValue}`);
      }
      if (syntax !== "*" && !matchesSyntax(values, syntax)) {
        throw new SyntaxError2(`initialValue "${definition.initialValue}" does not match syntax "${syntax}"`);
      }
    }
  },
  register(definition) {
    this.validate(definition);
    registry.set(definition.name, definition);
  },
  get(name) {
    return registry.get(name);
  },
  clear() {
    registry.clear();
  }
};

// src/parser-api.ts
var CSSParserValue = class {
};
var CSSParserToken = class extends CSSParserValue {
  value;
  constructor(value) {
    super();
    this.val = value;
    this.value = value;
  }
  val;
  // Keep for internal use if needed, but 'value' is better
  toString() {
    return this.value;
  }
};
var CSSParserBlock = class extends CSSParserValue {
  name;
  body;
  constructor(name, body) {
    super();
    this.name = name;
    this.body = body;
  }
  toString() {
    const start = this.name === "[]" ? "[" : this.name === "{}" ? "{" : "(";
    const end = this.name === "[]" ? "]" : this.name === "{}" ? "}" : ")";
    return `${start}${this.body.map((v) => v.toString()).join("")}${end}`;
  }
};
var CSSParserFunction = class extends CSSParserValue {
  name;
  args;
  constructor(name, args) {
    super();
    this.name = name;
    this.args = args;
  }
  toString() {
    return `${this.name}(${this.args.map((arg) => arg.map((v) => v.toString()).join("")).join(", ")})`;
  }
};
var CSSParserRule = class {
};
var CSSParserAtRule = class extends CSSParserRule {
  name;
  prelude;
  body;
  constructor(name, prelude, body = null) {
    super();
    this.name = name;
    this.prelude = prelude;
    this.body = body;
  }
  toString() {
    const preludeStr = this.prelude.map((t) => t.toString()).join("");
    if (this.body === null) {
      return `@${this.name}${preludeStr};`;
    }
    return `@${this.name}${preludeStr}{${this.body.map((r) => r.toString()).join("")}}`;
  }
};
var CSSParserQualifiedRule = class extends CSSParserRule {
  prelude;
  body;
  constructor(prelude, body) {
    super();
    this.prelude = prelude;
    this.body = body;
  }
  toString() {
    return `${this.prelude.map((t) => t.toString()).join("")}{${this.body.map((r) => r.toString()).join("")}}`;
  }
};
var CSSParserDeclaration = class extends CSSParserRule {
  name;
  body;
  constructor(name, body) {
    super();
    this.name = name;
    this.body = body;
  }
  toString() {
    return `${this.name}: ${this.body.map((v) => v.toString()).join("")};`;
  }
};
function toParserValue(val) {
  if (val.type === "simple-block") {
    const block = val;
    const bracket = block.associatedToken.value;
    const name = bracket === "[" ? "[]" : bracket === "{" ? "{}" : "()";
    return new CSSParserBlock(name, block.value.map((v) => {
      const res = toParserValue(v);
      return typeof res === "string" ? new CSSParserToken(res) : res;
    }));
  }
  if (val.type === "function") {
    const fn = val;
    const args = [[]];
    for (const v of fn.value) {
      if ("type" in v && v.type === "comma") {
        args.push([]);
      } else {
        const res = toParserValue(v);
        args[args.length - 1].push(typeof res === "string" ? new CSSParserToken(res) : res);
      }
    }
    return new CSSParserFunction(fn.name, args);
  }
  return serialize([val]);
}
function toParserToken(val) {
  const res = toParserValue(val);
  if (typeof res === "string") return new CSSParserToken(res);
  return res;
}
function toParserRule(rule) {
  const r = rule;
  if (r.type === "at-rule") {
    const at = r;
    const body = at.childRules ? at.childRules.map(toParserRule) : at.block ? at.block.value.map((v) => {
      const val = v;
      if (val.type === "declaration") return toParserRule(val);
      if (val.type === "at-rule") return toParserRule(val);
      return null;
    }).filter((r2) => r2 !== null) : null;
    return new CSSParserAtRule(
      at.name,
      at.prelude.map(toParserToken),
      body
    );
  }
  if (typeof r.type === "number" && r.type !== 1 && r.type !== 17 && r.type !== 0) {
    const name = r.name || (r.type === 4 ? "media" : r.type === 7 ? "keyframes" : r.type === 3 ? "import" : "unknown");
    return new CSSParserAtRule(
      name,
      r.media ? [new CSSParserToken(r.media.mediaText)] : r.prelude ? [new CSSParserToken(r.prelude)] : [],
      r.cssRules ? Array.from(r.cssRules).map(toParserRule) : null
    );
  }
  if (r.type === "declaration") {
    const decl = r;
    return new CSSParserDeclaration(
      decl.name,
      decl.value.map((v) => {
        const res = toParserValue(v);
        return typeof res === "string" ? new CSSParserToken(res) : res;
      })
    );
  }
  if (r.type === 1 || r.type === "style-rule" || typeof r === "object" && r !== null && "selectorText" in r) {
    const qr = r;
    return new CSSParserQualifiedRule(
      [new CSSParserToken(qr.selectorText || serialize(qr.prelude || []))],
      qr.cssRules ? Array.from(qr.cssRules).map(toParserRule) : qr.style ? Array.from(qr.style).map((name) => {
        return new CSSParserDeclaration(name, [new CSSParserToken(qr.style.getPropertyValue(name))]);
      }) : []
    );
  }
  return new CSSParserRawRule(serialize(Array.isArray(r) ? r : [r]));
}
var CSSParserRawRule = class extends CSSParserRule {
  val;
  constructor(val) {
    super();
    this.val = val;
  }
  toString() {
    return this.val;
  }
};
async function sourceToString(source) {
  if (typeof source === "string") return source;
  const reader = source.getReader();
  const decoder = new TextDecoder();
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  result += decoder.decode();
  return result;
}
function parseStylesheetSync(css, options = {}) {
  const tokens = tokenize(css);
  const parser = new Parser(tokens, options);
  const rules = parser.consumeListOfRules(true);
  return rules.map(toParserRule);
}
async function parseStylesheet(css, options = {}) {
  const source = await sourceToString(css);
  return parseStylesheetSync(source, options);
}
function parseRuleListSync(css, options = {}) {
  const tokens = tokenize(css);
  const parser = new Parser(tokens, options);
  const rules = parser.consumeListOfRules(false);
  return rules.map(toParserRule);
}
async function parseRuleList(css, options = {}) {
  const source = await sourceToString(css);
  return parseRuleListSync(source, options);
}
function parseRuleSync(css, options = {}) {
  const tokens = tokenize(css);
  const parser = new Parser(tokens, options);
  const rule = parser.consumeRule();
  return rule ? toParserRule(rule) : null;
}
function parseRule(css, options = {}) {
  return parseRuleSync(css, options);
}
function parseDeclarationListSync(css, options = {}) {
  const tokens = tokenize(css);
  const parser = new Parser(tokens, options);
  const values = parser.parseComponentValues();
  const declarations = parser.consumeDeclarationsFromBlockContents(values);
  return declarations.map(toParserRule);
}
function parseDeclarationList(css, options = {}) {
  return parseDeclarationListSync(css, options);
}
function parseDeclarationSync(css, _options = {}) {
  const list = parseDeclarationListSync(css, _options);
  return list.length > 0 ? list[0] : null;
}
function parseValueSync(css) {
  const tokens = tokenize(css);
  const parser = new Parser(tokens);
  const value = parser.consumeComponentValue();
  return toParserToken(value);
}
function parseValueListSync(css) {
  const tokens = tokenize(css);
  const parser = new Parser(tokens);
  const values = parser.parseComponentValues();
  return values.map(toParserToken);
}
function parseCommaValueListSync(css) {
  const tokens = tokenize(css);
  const parser = new Parser(tokens);
  const values = parser.parseComponentValues();
  const result = [[]];
  for (const v of values) {
    if (v.type === "comma") {
      result.push([]);
    } else {
      result[result.length - 1].push(toParserToken(v));
    }
  }
  return result.map((list) => {
    let start = 0;
    while (start < list.length && list[start] instanceof CSSParserToken && list[start].toString().trim() === "") start++;
    let end = list.length - 1;
    while (end >= start && list[end] instanceof CSSParserToken && list[end].toString().trim() === "") end--;
    return list.slice(start, end + 1);
  });
}
var CSS = {
  // Typed OM Factories
  number: (v) => new CSSUnitValue(v, "number"),
  percent: (v) => new CSSUnitValue(v, "percent"),
  px: (v) => new CSSUnitValue(v, "px"),
  em: (v) => new CSSUnitValue(v, "em"),
  ex: (v) => new CSSUnitValue(v, "ex"),
  ch: (v) => new CSSUnitValue(v, "ch"),
  rem: (v) => new CSSUnitValue(v, "rem"),
  vw: (v) => new CSSUnitValue(v, "vw"),
  vh: (v) => new CSSUnitValue(v, "vh"),
  vmin: (v) => new CSSUnitValue(v, "vmin"),
  vmax: (v) => new CSSUnitValue(v, "vmax"),
  deg: (v) => new CSSUnitValue(v, "deg"),
  grad: (v) => new CSSUnitValue(v, "grad"),
  rad: (v) => new CSSUnitValue(v * 180 / Math.PI, "deg"),
  turn: (v) => new CSSUnitValue(v * 360, "deg"),
  s: (v) => new CSSUnitValue(v, "s"),
  ms: (v) => new CSSUnitValue(v, "ms"),
  fr: (v) => new CSSUnitValue(v, "fr"),
  // Parser API
  parseStylesheet,
  parseRuleList,
  parseRule,
  parseDeclarationList,
  parseDeclaration: parseDeclarationSync,
  parseValue: parseValueSync,
  parseValueList: parseValueListSync,
  parseCommaValueList: parseCommaValueListSync,
  registerProperty: (definition) => PropertyRegistry.register(definition)
};

// src/typed-om.ts
var CSSStyleValue = class {
  static parseAll(property, css) {
    const tokens = tokenize(css);
    const componentValues = ParseHooks.parseComponentValues(tokens);
    const results = [];
    for (const v of componentValues) {
      if (v.type === "whitespace" || v.type === "comma") continue;
      const sv = createCSSStyleValue(v);
      if (sv) results.push(sv);
      else {
        results.push(new CSSUnparsedValue([serialize([v]).trim()]));
      }
    }
    return results;
  }
  static parse(property, css) {
    const all = this.parseAll(property, css);
    return all.length > 0 ? all[0] : null;
  }
};
var CSSKeywordValue = class extends CSSStyleValue {
  value;
  constructor(value) {
    super();
    this.value = value;
  }
  toString() {
    return this.value;
  }
  serialize() {
    return this.toString();
  }
};
var CSSImageValue = class extends CSSStyleValue {
};
var CSSColorValue = class extends CSSStyleValue {
};
var CSSRGB = class extends CSSColorValue {
  r;
  g;
  b;
  alpha;
  constructor(r, g, b, alpha = new CSSUnitValue(1, "number")) {
    super();
    this.r = r;
    this.g = g;
    this.b = b;
    this.alpha = alpha;
  }
  toString() {
    return `rgb(${this.r} ${this.g} ${this.b} / ${this.alpha})`;
  }
};
var CSSHSL = class extends CSSColorValue {
  h;
  s;
  l;
  alpha;
  constructor(h, s, l, alpha = new CSSUnitValue(1, "number")) {
    super();
    this.h = h;
    this.s = s;
    this.l = l;
    this.alpha = alpha;
  }
  toString() {
    return `hsl(${this.h} ${this.s} ${this.l} / ${this.alpha})`;
  }
};
function addTypes(a, b) {
  const result = { ...a };
  const res = result;
  for (const [key, value] of Object.entries(b)) {
    if (key === "percentHint") {
      if (result.percentHint && result.percentHint !== value) throw new Error("Percent hint mismatch");
      res.percentHint = value;
    } else {
      const current = res[key];
      res[key] = (current || 0) + value;
    }
  }
  return result;
}
var CSSNumericValue2 = class _CSSNumericValue extends CSSStyleValue {
  to(unit) {
    const sum = createSumValue(this);
    if (!sum || sum.length > 1) {
      throw new TypeError(`Cannot convert ${this.serialize()} to ${unit}`);
    }
    const item = createCSSUnitValueFromSumValueItem(sum[0]);
    if (!item) throw new TypeError(`Cannot convert ${this.serialize()} to ${unit}`);
    return item.to(unit);
  }
  toSum(...units) {
    for (const unit of units) {
      if (!unitToBase[unit]) throw new SyntaxError(`Invalid unit: ${unit}`);
    }
    const sum = createSumValue(this);
    if (!sum) {
      throw new TypeError(`Cannot create sum value from ${this.serialize()}`);
    }
    const values = sum.map((item) => createCSSUnitValueFromSumValueItem(item));
    if (values.some((v) => v === null)) throw new TypeError(`Cannot create sum value from ${this.serialize()}`);
    let unitValues = values;
    if (units.length === 0) {
      unitValues.sort((a, b) => a.unit.localeCompare(b.unit));
      return new CSSMathSum(...unitValues);
    }
    const result = [];
    const remaining = [...unitValues];
    for (const unit of units) {
      const temp = new CSSUnitValue(0, unit);
      for (let i = 0; i < remaining.length; i++) {
        const value = remaining[i];
        if (isCompatible(value.unit, unit)) {
          const converted = value.to(unit);
          temp.value += converted.value;
          remaining.splice(i, 1);
          i--;
        }
      }
      result.push(temp);
    }
    if (remaining.length > 0) {
      throw new TypeError(`Remaining units: ${remaining.map((v) => v.unit).join(", ")}`);
    }
    return new CSSMathSum(...result);
  }
  simplify() {
    if (this instanceof CSSUnitValue) return this;
    return simplify(this);
  }
  static parse(css) {
    const tokens = tokenize(css);
    const componentValues = ParseHooks.parseComponentValues(tokens).filter((v2) => v2.type !== "whitespace" && v2.type !== "comment");
    if (componentValues.length === 0) return null;
    const v = componentValues[0];
    if (v.type === "number" || v.type === "percentage" || v.type === "dimension") {
      const sv = createCSSStyleValue(v);
      return sv instanceof _CSSNumericValue ? sv : null;
    }
    if (v.type === "function") {
      return parseMathFunction(v.name, v.value);
    }
    return null;
  }
  add(...values) {
    return new CSSMathSum(this, ...values);
  }
  sub(...values) {
    return new CSSMathSum(this, ...values.map((v) => {
      if (typeof v === "number") return -v;
      return new CSSMathNegate(v);
    }));
  }
  mul(...values) {
    return new CSSMathProduct(this, ...values);
  }
  div(...values) {
    return new CSSMathProduct(this, ...values.map((v) => new CSSMathInvert(v)));
  }
  min(...values) {
    return new CSSMathMin(this, ...values);
  }
  max(...values) {
    return new CSSMathMax(this, ...values);
  }
  equals(...values) {
    if (values.length === 0) return true;
    for (const v of values) {
      if (!this._equals(v)) return false;
    }
    return true;
  }
  _equals(other) {
    if (typeof other === "number") {
      return this instanceof CSSUnitValue && this.value === other && this.unit === "number";
    }
    if (this === other) return true;
    if (this.constructor !== other.constructor) return false;
    if (this instanceof CSSUnitValue && other instanceof CSSUnitValue) {
      return this.value === other.value && this.unit === other.unit;
    }
    if (this instanceof CSSNumericNode && other instanceof CSSNumericNode) {
      return this.value === other.value && this.unit === other.unit;
    }
    if (this instanceof CSSMathSum && other instanceof CSSMathSum) {
      return this.values.length === other.values.length && this.values.every((v, i) => v.equals(other.values.item(i)));
    }
    if (this instanceof CSSMathProduct && other instanceof CSSMathProduct) {
      return this.values.length === other.values.length && this.values.every((v, i) => v.equals(other.values.item(i)));
    }
    if (this instanceof CSSMathMin && other instanceof CSSMathMin) {
      return this.values.length === other.values.length && this.values.every((v, i) => v.equals(other.values.item(i)));
    }
    if (this instanceof CSSMathMax && other instanceof CSSMathMax) {
      return this.values.length === other.values.length && this.values.every((v, i) => v.equals(other.values.item(i)));
    }
    if (this instanceof CSSMathClamp && other instanceof CSSMathClamp) {
      return this.min.equals(other.min) && this.val.equals(other.val) && this.max.equals(other.max);
    }
    if (this instanceof CSSMathNegate && other instanceof CSSMathNegate) {
      return this.value.equals(other.value);
    }
    if (this instanceof CSSMathInvert && other instanceof CSSMathInvert) {
      return this.value.equals(other.value);
    }
    return false;
  }
};
var CSSNumericArray = class {
  _values;
  constructor(values) {
    this._values = values;
  }
  get length() {
    return this._values.length;
  }
  [Symbol.iterator]() {
    return this._values[Symbol.iterator]();
  }
  entries() {
    return this._values.entries();
  }
  keys() {
    return this._values.keys();
  }
  values() {
    return this._values.values();
  }
  forEach(callback, thisArg) {
    this._values.forEach(callback, thisArg);
  }
  item(index) {
    return this._values[index];
  }
  map(callback) {
    return this._values.map(callback);
  }
  push(...items) {
    return this._values.push(...items);
  }
  every(callback) {
    return this._values.every(callback);
  }
};
var CSSUnitValue = class _CSSUnitValue extends CSSNumericValue2 {
  value;
  unit;
  constructor(value, unit) {
    super();
    this.value = value;
    this.unit = unit;
  }
  toString() {
    if (this.unit === "number") {
      return this.value.toString();
    }
    if (this.unit === "percent") {
      return `${this.value}%`;
    }
    return `${this.value}${this.unit}`;
  }
  serialize() {
    return this.toString();
  }
  type() {
    const t = {};
    const base = unitToBase[this.unit];
    if (!base || base === "number") return t;
    if (base === "percent") {
      t.percent = 1;
    } else {
      t[base] = 1;
    }
    return t;
  }
  to(unit) {
    if (this.unit === unit) return this;
    const base = unitToBase[this.unit];
    const targetBase = unitToBase[unit];
    if (!base || base !== targetBase || base === "number" || base === "percent") {
      throw new TypeError(`Cannot convert ${this.unit} to ${unit}`);
    }
    let canonical;
    let targetFactor;
    if (base === "length") {
      if (!unitToPixels[this.unit] || !unitToPixels[unit]) throw new TypeError("Unsupported length conversion");
      canonical = this.value * unitToPixels[this.unit];
      targetFactor = unitToPixels[unit];
    } else if (base === "angle") {
      canonical = this.value * unitToRadians[this.unit];
      targetFactor = unitToRadians[unit];
    } else if (base === "time") {
      canonical = this.value * unitToSeconds[this.unit];
      targetFactor = unitToSeconds[unit];
    } else {
      throw new TypeError(`Unsupported conversion for ${base}`);
    }
    return new _CSSUnitValue(canonical / targetFactor, unit);
  }
};
function createCSSStyleValue(v) {
  if (v.type === "function") {
    const fn = v;
    const nameLower = fn.name.toLowerCase();
    if (["calc", "min", "max", "clamp"].includes(nameLower)) {
      const mathNode = parseMathFunction(fn.name, fn.value);
      if (mathNode) {
        if (mathNode instanceof CSSNumericNode) {
          return new CSSUnitValue(mathNode.value, mathNode.unit);
        }
        return mathNode;
      }
    }
    if (nameLower === "var") {
      const args = fn.value.filter((t) => t.type !== "whitespace" && t.type !== "comment");
      if (args.length === 0 || args[0].type !== "ident" || !args[0].value.startsWith("--")) {
        return new CSSUnparsedValue([serialize([v]).trim()]);
      }
      const varName = args[0].value;
      let fallback = null;
      let commaIdx = -1;
      for (let i = 0; i < fn.value.length; i++) {
        if (fn.value[i].type === "comma") {
          commaIdx = i;
          break;
        }
      }
      if (commaIdx !== -1) {
        const fallbackTokens = fn.value.slice(commaIdx + 1);
        fallback = new CSSUnparsedValue([serialize(fallbackTokens).trim()]);
      }
      return new CSSUnparsedValue([new CSSVariableReferenceValue(varName, fallback)]);
    }
    if (nameLower === "url") {
      return new class extends CSSImageValue {
        toString() {
          return `url(${serialize(fn.value).trim()})`;
        }
      }();
    }
  }
  if (isToken(v)) {
    switch (v.type) {
      case "ident":
        return new CSSKeywordValue(v.value);
      case "number":
        return new CSSUnitValue(parseFloat(v.value), "number");
      case "percentage":
        return new CSSUnitValue(parseFloat(v.value), "percent");
      case "dimension":
        return new CSSUnitValue(parseFloat(v.value), v.unit || "");
      case "url":
        return new class extends CSSImageValue {
          toString() {
            return `url("${v.value}")`;
          }
        }();
      default:
        return null;
    }
  }
  return null;
}
function isToken(val) {
  return typeof val.value === "string";
}
var CSSVariableReferenceValue = class {
  variable;
  fallback;
  constructor(variable, fallback = null) {
    this.variable = variable;
    this.fallback = fallback;
  }
  toString() {
    if (this.fallback) {
      return `var(${this.variable},${this.fallback.toString()})`;
    }
    return `var(${this.variable})`;
  }
};
var CSSUnparsedValue = class extends CSSStyleValue {
  _values;
  constructor(values) {
    super();
    this._values = values;
  }
  get length() {
    return this._values.length;
  }
  [Symbol.iterator]() {
    return this._values[Symbol.iterator]();
  }
  entries() {
    return this._values.entries();
  }
  keys() {
    return this._values.keys();
  }
  values() {
    return this._values.values();
  }
  forEach(callback, thisArg) {
    this._values.forEach(callback, thisArg);
  }
  item(index) {
    return this._values[index];
  }
  toString() {
    let s = "";
    for (let i = 0; i < this._values.length; i++) {
      const current = this._values[i];
      const prev = i > 0 ? this._values[i - 1] : null;
      if (typeof current === "string" && typeof prev === "string") {
        if (!prev.endsWith(" ") && !current.startsWith(" ")) {
          s += "/**/";
        }
      }
      s += current.toString();
    }
    return s;
  }
  serialize() {
    return this.toString();
  }
  type() {
    if (this._values.length === 0) return {};
    const first = this._values[0];
    if (typeof first === "string") return {};
    return first.type();
  }
};
var CSSMathValue = class extends CSSNumericValue2 {
  toString() {
    const s = this.serialize();
    if (this.operator === "number") return s;
    if (["min", "max", "clamp"].includes(this.operator)) return s;
    return `calc(${stripOuterParens(s)})`;
  }
};
var CSSNumericNode = class extends CSSMathValue {
  value;
  unit;
  constructor(value, unit) {
    super();
    this.value = value;
    this.unit = unit;
  }
  get operator() {
    return "number";
  }
  serialize() {
    if (this.value === Infinity) {
      return this.unit === "number" ? "infinity" : `calc(infinity * 1${this.unit})`;
    }
    if (this.value === -Infinity) {
      return this.unit === "number" ? "-infinity" : `calc(-infinity * 1${this.unit})`;
    }
    if (Number.isNaN(this.value)) {
      return this.unit === "number" ? "nan" : `calc(nan * 1${this.unit})`;
    }
    if (this.unit === "number") return this.value.toString();
    if (this.unit === "percent") return `${this.value}%`;
    return `${this.value}${this.unit}`;
  }
  type() {
    const t = {};
    const base = unitToBase[this.unit];
    if (!base || base === "number") return t;
    if (base === "percent") {
      t.percent = 1;
    } else {
      t[base] = 1;
    }
    return t;
  }
};
function ensureNumeric(v) {
  if (typeof v === "number") return new CSSNumericNode(v, "number");
  return v;
}
function stripOuterParens(s) {
  if (!s.startsWith("(") || !s.endsWith(")")) return s;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") depth--;
    if (depth === 0 && i < s.length - 1) return s;
  }
  return s.substring(1, s.length - 1);
}
var CSSMathNegate = class extends CSSMathValue {
  value;
  constructor(child) {
    super();
    this.value = ensureNumeric(child);
  }
  get operator() {
    return "negate";
  }
  serialize() {
    return `(-${this.value.serialize()})`;
  }
  toString() {
    return `calc(-${stripOuterParens(this.value.serialize())})`;
  }
  type() {
    return this.value.type();
  }
};
var CSSMathInvert = class extends CSSMathValue {
  value;
  constructor(child) {
    super();
    this.value = ensureNumeric(child);
  }
  get operator() {
    return "invert";
  }
  serialize() {
    if (this.value instanceof CSSNumericNode && this.value.unit === "number") {
      return `(1 / ${this.value.serialize()})`;
    }
    return `(1 / ${this.value.serialize()})`;
  }
  toString() {
    return `calc(1 / ${stripOuterParens(this.value.serialize())})`;
  }
  type() {
    const t = this.value.type();
    const result = {};
    const res = result;
    for (const [key, value] of Object.entries(t)) {
      if (key !== "percentHint") {
        res[key] = -value;
      }
    }
    return result;
  }
};
var CSSMathSum = class extends CSSMathValue {
  values;
  constructor(...args) {
    super();
    this.values = new CSSNumericArray(args.map(ensureNumeric));
  }
  get operator() {
    return "sum";
  }
  serialize() {
    const sortedChildren = sortSumChildren([...this.values]);
    let s = "(";
    s += sortedChildren[0].serialize();
    for (let i = 1; i < sortedChildren.length; i++) {
      const child = sortedChildren[i];
      if (child instanceof CSSMathNegate) {
        s += ` - ${stripOuterParens(child.value.serialize())}`;
      } else {
        s += ` + ${child.serialize()}`;
      }
    }
    s += ")";
    return s;
  }
  type() {
    if (this.values.length === 0) return {};
    return this.values.item(0).type();
  }
};
var CSSMathProduct = class extends CSSMathValue {
  values;
  constructor(...args) {
    super();
    this.values = new CSSNumericArray(args.map(ensureNumeric));
  }
  get operator() {
    return "product";
  }
  serialize() {
    const sortedChildren = sortProductChildren([...this.values]);
    let s = "(";
    s += sortedChildren[0].serialize();
    for (let i = 1; i < sortedChildren.length; i++) {
      const child = sortedChildren[i];
      if (child instanceof CSSMathInvert) {
        const val = child.value;
        if (!(val.value === 0)) {
          s += ` / ${stripOuterParens(child.value.serialize())}`;
          continue;
        }
      }
      s += ` * ${child.serialize()}`;
    }
    s += ")";
    return s;
  }
  type() {
    let result = {};
    this.values.forEach((child) => {
      result = addTypes(result, child.type());
    });
    return result;
  }
};
var CSSMathMin = class extends CSSMathValue {
  values;
  constructor(...args) {
    super();
    this.values = new CSSNumericArray(args.map(ensureNumeric));
  }
  get operator() {
    return "min";
  }
  serialize() {
    return `min(${this.values.map((c) => stripOuterParens(c.serialize())).join(", ")})`;
  }
  type() {
    if (this.values.length === 0) return {};
    return this.values.item(0).type();
  }
};
var CSSMathMax = class extends CSSMathValue {
  values;
  constructor(...args) {
    super();
    this.values = new CSSNumericArray(args.map(ensureNumeric));
  }
  get operator() {
    return "max";
  }
  serialize() {
    return `max(${this.values.map((c) => stripOuterParens(c.serialize())).join(", ")})`;
  }
  type() {
    if (this.values.length === 0) return {};
    return this.values.item(0).type();
  }
};
var CSSMathClamp = class extends CSSMathValue {
  // @ts-expect-error - Collides with CSSNumericValue.min() method
  min;
  val;
  // @ts-expect-error - Collides with CSSNumericValue.max() method
  max;
  constructor(min, val, max) {
    super();
    this.min = ensureNumeric(min);
    this.val = ensureNumeric(val);
    this.max = ensureNumeric(max);
  }
  get operator() {
    return "clamp";
  }
  serialize() {
    return `clamp(${stripOuterParens(this.min.serialize())}, ${stripOuterParens(this.val.serialize())}, ${stripOuterParens(this.max.serialize())})`;
  }
  type() {
    return this.val.type();
  }
};
var CSSMathFunction = class extends CSSMathValue {
  values;
  name;
  constructor(name, ...args) {
    super();
    this.name = name;
    this.values = new CSSNumericArray(args.map(ensureNumeric));
  }
  get operator() {
    return this.name;
  }
  serialize() {
    const argsStr = this.values.map((c) => {
      let s = c.serialize();
      if (s.startsWith("(") && s.endsWith(")")) {
        s = s.slice(1, -1);
      }
      return s;
    }).join(", ");
    if (this.name === "calc") {
      return `calc(${argsStr})`;
    }
    return `${this.name}(${argsStr})`;
  }
  toString() {
    return this.serialize();
  }
  type() {
    if (this.values.length === 0) return {};
    if (["sin", "cos", "tan", "asin", "acos", "atan", "atan2", "abs", "sign"].includes(this.name)) {
      return {};
    }
    return this.values.item(0).type();
  }
};
function sortSumChildren(nodes) {
  const allSimple = nodes.every((n) => n instanceof CSSNumericNode || n instanceof CSSUnitValue);
  if (!allSimple) return nodes;
  const getUnit = (n) => n.unit;
  const getValue = (n) => n.value;
  const percents = nodes.filter((n) => getUnit(n) === "percent").sort((a, b) => getValue(a) - getValue(b));
  const dimensions = nodes.filter((n) => getUnit(n) !== "number" && getUnit(n) !== "percent").sort((a, b) => getUnit(a).localeCompare(getUnit(b)));
  const numbers = nodes.filter((n) => getUnit(n) === "number").sort((a, b) => getValue(a) - getValue(b));
  return [...percents, ...dimensions, ...numbers];
}
function sortProductChildren(nodes) {
  const allSimple = nodes.every((n) => n instanceof CSSNumericNode || n instanceof CSSUnitValue);
  if (!allSimple) return nodes;
  const getUnit = (n) => n.unit;
  const getValue = (n) => n.value;
  const numbers = nodes.filter((n) => getUnit(n) === "number").sort((a, b) => getValue(a) - getValue(b));
  const percents = nodes.filter((n) => getUnit(n) === "percent").sort((a, b) => getValue(a) - getValue(b));
  const dimensions = nodes.filter((n) => getUnit(n) !== "number" && getUnit(n) !== "percent").sort((a, b) => getUnit(a).localeCompare(getUnit(b)));
  return [...numbers, ...percents, ...dimensions];
}
var CSSTransformComponent = class {
  is2D = true;
};
var CSSTranslate = class extends CSSTransformComponent {
  x;
  y;
  z;
  constructor(x, y, z) {
    super();
    this.x = x;
    this.y = y;
    this.z = z;
    this.is2D = !z;
  }
  toString() {
    if (this.is2D) return `translate(${this.x}, ${this.y})`;
    return `translate3d(${this.x}, ${this.y}, ${this.z})`;
  }
};
var CSSScale = class extends CSSTransformComponent {
  x;
  y;
  z;
  constructor(x, y, z) {
    super();
    this.x = x;
    this.y = y;
    this.z = z;
    this.is2D = !z;
  }
  toString() {
    if (this.is2D) return `scale(${this.x}, ${this.y})`;
    return `scale3d(${this.x}, ${this.y}, ${this.z})`;
  }
};
var CSSRotate = class extends CSSTransformComponent {
  x;
  y;
  z;
  angle;
  constructor(xOrAngle, y, z, angle) {
    super();
    if (y === void 0) {
      this.angle = xOrAngle;
      this.is2D = true;
    } else {
      this.x = xOrAngle;
      this.y = y;
      this.z = z;
      this.angle = angle;
      this.is2D = false;
    }
  }
  toString() {
    if (this.is2D) return `rotate(${this.angle})`;
    return `rotate3d(${this.x}, ${this.y}, ${this.z}, ${this.angle})`;
  }
};
var CSSSkew = class extends CSSTransformComponent {
  ax;
  ay;
  constructor(ax, ay) {
    super();
    this.ax = ax;
    this.ay = ay;
    this.is2D = true;
  }
  toString() {
    if (this.ay instanceof CSSUnitValue && this.ay.value === 0) return `skew(${this.ax})`;
    if (this.ay instanceof CSSNumericNode && this.ay.value === 0) return `skew(${this.ax})`;
    return `skew(${this.ax}, ${this.ay})`;
  }
};
var CSSSkewX = class extends CSSTransformComponent {
  ax;
  constructor(ax) {
    super();
    this.ax = ax;
    this.is2D = true;
  }
  toString() {
    return `skewX(${this.ax})`;
  }
};
var CSSSkewY = class extends CSSTransformComponent {
  ay;
  constructor(ay) {
    super();
    this.ay = ay;
    this.is2D = true;
  }
  toString() {
    return `skewY(${this.ay})`;
  }
};
var CSSPerspective = class extends CSSTransformComponent {
  length;
  constructor(length) {
    super();
    this.length = length;
    this.is2D = false;
  }
  toString() {
    if (typeof this.length === "string") return `perspective(${this.length})`;
    if (this.length instanceof CSSKeywordValue) return `perspective(${this.length})`;
    if (this.length instanceof CSSUnitValue && this.length.value < 0) {
      return `perspective(calc(${this.length}))`;
    }
    return `perspective(${this.length})`;
  }
};
var CSSMatrixComponent = class extends CSSTransformComponent {
  matrix;
  constructor(matrix) {
    super();
    this.matrix = matrix;
    this.is2D = matrix.is2D;
  }
  toString() {
    if (this.is2D) {
      return `matrix(${this.matrix.a}, ${this.matrix.b}, ${this.matrix.c}, ${this.matrix.d}, ${this.matrix.e}, ${this.matrix.f})`;
    }
    return `matrix3d(${this.matrix.m11}, ${this.matrix.m12}, ${this.matrix.m13}, ${this.matrix.m14}, ${this.matrix.m21}, ${this.matrix.m22}, ${this.matrix.m23}, ${this.matrix.m24}, ${this.matrix.m31}, ${this.matrix.m32}, ${this.matrix.m33}, ${this.matrix.m34}, ${this.matrix.m41}, ${this.matrix.m42}, ${this.matrix.m43}, ${this.matrix.m44})`;
  }
};
var CSSTransformValue = class _CSSTransformValue extends CSSStyleValue {
  components;
  constructor(components) {
    super();
    this.components = components;
  }
  get length() {
    return this.components.length;
  }
  [Symbol.iterator]() {
    return this.components[Symbol.iterator]();
  }
  entries() {
    return this.components.entries();
  }
  keys() {
    return this.components.keys();
  }
  values() {
    return this.components.values();
  }
  forEach(callback, thisArg) {
    this.components.forEach(callback, thisArg);
  }
  item(index) {
    return this.components[index];
  }
  get is2D() {
    return this.components.every((c) => c.is2D);
  }
  toString() {
    return this.components.map((c) => c.toString()).join(" ");
  }
  static parse(css) {
    const tokens = tokenize(css);
    const componentValues = ParseHooks.parseComponentValues(tokens);
    const components = [];
    for (const v of componentValues) {
      if (v.type === "whitespace" || v.type === "comma") continue;
      if (v.type === "function") {
        const fn = v;
        const name = fn.name.toLowerCase();
        const args = fn.value.filter((v2) => v2.type !== "whitespace" && v2.type !== "comma");
        if (name === "translate" || name === "translatex" || name === "translatey" || name === "translatez" || name === "translate3d") {
          components.push(parseTranslate(name, args));
        } else if (name === "scale" || name === "scalex" || name === "scaley" || name === "scalez" || name === "scale3d") {
          components.push(parseScale(name, args));
        } else if (name === "rotate" || name === "rotatex" || name === "rotatey" || name === "rotatez" || name === "rotate3d") {
          components.push(parseRotate(name, args));
        } else if (name === "skew" || name === "skewx" || name === "skewy") {
          components.push(parseSkew(name, args));
        } else if (name === "perspective") {
          components.push(parsePerspective(args));
        } else if (name === "matrix" || name === "matrix3d") {
          components.push(parseMatrix(name, args));
        }
      }
    }
    return new _CSSTransformValue(components);
  }
};
function parseTranslate(name, args) {
  const x = parseNumeric(args[0]);
  let y = new CSSUnitValue(0, "px");
  let z = void 0;
  if (name === "translate" || name === "translate3d") {
    if (args.length > 1) y = parseNumeric(args[1]);
    if (args.length > 2) z = parseNumeric(args[2]);
  } else if (name === "translatex") {
  } else if (name === "translatey") {
    return new CSSTranslate(new CSSUnitValue(0, "px"), x);
  } else if (name === "translatez") {
    return new CSSTranslate(new CSSUnitValue(0, "px"), new CSSUnitValue(0, "px"), x);
  }
  return new CSSTranslate(x, y, z);
}
function parseScale(name, args) {
  const x = parseNumeric(args[0]);
  let y = x;
  let z = void 0;
  if (name === "scale" || name === "scale3d") {
    if (args.length > 1) y = parseNumeric(args[1]);
    if (args.length > 2) z = parseNumeric(args[2]);
  } else if (name === "scalex") {
    y = new CSSUnitValue(1, "number");
  } else if (name === "scaley") {
    return new CSSScale(new CSSUnitValue(1, "number"), x);
  } else if (name === "scalez") {
    return new CSSScale(new CSSUnitValue(1, "number"), new CSSUnitValue(1, "number"), x);
  }
  return new CSSScale(x, y, z);
}
function parseRotate(name, args) {
  if (name === "rotatex") {
    return new CSSRotate(new CSSUnitValue(1, "number"), new CSSUnitValue(0, "number"), new CSSUnitValue(0, "number"), parseNumeric(args[0]));
  }
  if (name === "rotatey") {
    return new CSSRotate(new CSSUnitValue(0, "number"), new CSSUnitValue(1, "number"), new CSSUnitValue(0, "number"), parseNumeric(args[0]));
  }
  if (name === "rotatez") {
    return new CSSRotate(new CSSUnitValue(0, "number"), new CSSUnitValue(0, "number"), new CSSUnitValue(1, "number"), parseNumeric(args[0]));
  }
  if (name === "rotate") {
    if (args.length === 1) return new CSSRotate(parseNumeric(args[0]));
    return new CSSRotate(new CSSUnitValue(0, "number"), new CSSUnitValue(0, "number"), new CSSUnitValue(1, "number"), parseNumeric(args[args.length - 1]));
  }
  if (name === "rotate3d") {
    return new CSSRotate(parseNumeric(args[0]), parseNumeric(args[1]), parseNumeric(args[2]), parseNumeric(args[3]));
  }
  return new CSSRotate(parseNumeric(args[0]));
}
function parseSkew(name, args) {
  if (name === "skewx") return new CSSSkewX(parseNumeric(args[0]));
  if (name === "skewy") return new CSSSkewY(parseNumeric(args[0]));
  const ax = parseNumeric(args[0]);
  const ay = args.length > 1 ? parseNumeric(args[1]) : new CSSUnitValue(0, "deg");
  return new CSSSkew(ax, ay);
}
function parsePerspective(args) {
  const arg = args[0];
  if (arg.type === "ident" && arg.value.toLowerCase() === "none") {
    return new CSSPerspective(new CSSKeywordValue("none"));
  }
  return new CSSPerspective(parseNumeric(arg));
}
function parseMatrix(name, args) {
  const vals = args.map((a) => {
    if (a.type === "number") return parseFloat(a.value);
    return 0;
  });
  return new CSSMatrixComponent(new globalThis.DOMMatrixReadOnly(vals));
}
function parseNumeric(v) {
  if (v.type === "number" || v.type === "percentage" || v.type === "dimension") {
    const sv = createCSSStyleValue(v);
    if (sv instanceof CSSNumericValue2) return sv;
  }
  if (v.type === "function") {
    const mathNode = parseMathFunction(v.name, v.value);
    if (mathNode instanceof CSSNumericValue2) return mathNode;
  }
  return new CSSUnitValue(0, "number");
}
var StylePropertyMapReadOnly = class {
  declarations;
  constructor(declarations) {
    this.declarations = declarations;
  }
  get(property) {
    const shorthand = SHORTHANDS[property];
    if (shorthand) {
      const longhandValues = {};
      let allSet = true;
      for (const lh of shorthand.longhands) {
        const decl2 = this.declarations.find((d) => d.name === lh);
        if (!decl2) {
          allSet = false;
          break;
        }
        longhandValues[lh] = decl2.value;
      }
      if (allSet) {
        const contracted = shorthand.contract(longhandValues);
        if (contracted !== null) {
          return new CSSUnparsedValue([contracted]);
        }
      }
    }
    const decl = this.declarations.find((d) => d.name === property);
    if (!decl) return null;
    return this._getForDecl(decl);
  }
  _getForDecl(decl) {
    let nonWsVal = null;
    let count = 0;
    for (const v of decl.value) {
      if (v.type !== "whitespace") {
        nonWsVal = v;
        count++;
        if (count > 1) break;
      }
    }
    if (count === 1 && nonWsVal) {
      if (isToken(nonWsVal)) {
        const styleValue = createCSSStyleValue(nonWsVal);
        if (styleValue) return styleValue;
      } else if (nonWsVal.type === "function") {
        if (["calc", "min", "max", "clamp"].includes(nonWsVal.name.toLowerCase())) {
          const mathNode = parseMathFunction(nonWsVal.name, nonWsVal.value);
          if (mathNode) {
            if (mathNode instanceof CSSNumericNode) {
              return new CSSUnitValue(mathNode.value, mathNode.unit);
            }
            const nameLower = nonWsVal.name.toLowerCase();
            if (["min", "max", "clamp"].includes(nameLower)) {
              return mathNode;
            }
            return new CSSMathFunction(nameLower, mathNode);
          }
        }
      }
    }
    return new CSSUnparsedValue([serialize(decl.value).trim()]);
  }
  has(property) {
    const shorthand = SHORTHANDS[property];
    if (shorthand) {
      return shorthand.longhands.every((lh) => this.declarations.some((d) => d.name === lh));
    }
    return this.declarations.some((d) => d.name === property);
  }
  getAll(property) {
    const decl = this.declarations.find((d) => d.name === property);
    if (!decl) return [];
    const results = [];
    for (const v of decl.value) {
      if (v.type === "whitespace" || v.type === "comma") continue;
      const sv = createCSSStyleValue(v);
      if (sv) results.push(sv);
      else results.push(new CSSUnparsedValue([serialize([v]).trim()]));
    }
    return results;
  }
};
var StylePropertyMap = class extends StylePropertyMapReadOnly {
  _style;
  constructor(style) {
    super([]);
    this._style = style;
  }
  get(property) {
    const value = this._style.getPropertyValue(property);
    if (!value) return null;
    if (SHORTHANDS[property]) {
      return new CSSUnparsedValue([value.trim()]);
    }
    const tokens = tokenize(value);
    const componentValues = ParseHooks.parseComponentValues(tokens);
    if (componentValues.length === 0) return null;
    if (componentValues.length === 1) {
      return createCSSStyleValue(componentValues[0]);
    }
    return new CSSUnparsedValue([value.trim()]);
  }
  getAll(property) {
    const value = this._style.getPropertyValue(property);
    if (!value) return [];
    const tokens = tokenize(value);
    const componentValues = ParseHooks.parseComponentValues(tokens);
    const results = [];
    for (const v of componentValues) {
      if (v.type === "whitespace" || v.type === "comma") continue;
      const sv = createCSSStyleValue(v);
      if (sv) results.push(sv);
      else results.push(new CSSUnparsedValue([serialize([v]).trim()]));
    }
    return results;
  }
  has(property) {
    return this._style.getPropertyValue(property) !== "";
  }
  set(property, ...values) {
    const serialized = values.map((v) => v.toString()).join(" ");
    this._style.setProperty(property, serialized);
  }
  append(property, ...values) {
    const current = this._style.getPropertyValue(property);
    const serialized = values.map((v) => v.toString()).join(" ");
    const newValue = current ? `${current}, ${serialized}` : serialized;
    this._style.setProperty(property, newValue);
  }
  delete(property) {
    this._style.removeProperty(property);
  }
  clear() {
    const props = [];
    for (let i = 0; i < this._style.length; i++) {
      props.push(this._style.item(i));
    }
    for (const p of props) {
      this._style.removeProperty(p);
    }
  }
};
function areUnitMapsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const [unit, power] of a) {
    if (b.get(unit) !== power) return false;
  }
  return true;
}
function isCompatible(u1, u2) {
  if (u1 === u2) return true;
  const b1 = unitToBase[u1];
  const b2 = unitToBase[u2];
  if (!b1 || !b2 || b1 === "number" || b1 === "percent") return false;
  if (b1 !== b2) return false;
  const abs = ["px", "cm", "mm", "in", "pt", "pc", "q", "deg", "grad", "rad", "turn", "s", "ms", "hz", "khz", "dpi", "dpcm", "dppx"];
  return abs.includes(u1) && abs.includes(u2);
}
function createCSSUnitValueFromSumValueItem(item) {
  if (item.unitMap.size > 1) return null;
  if (item.unitMap.size === 0) return new CSSUnitValue(item.value, "number");
  const entry = item.unitMap.entries().next().value;
  if (!entry) return new CSSUnitValue(item.value, "number");
  const [unit, power] = entry;
  if (power !== 1) return null;
  return new CSSUnitValue(item.value, unit);
}
function createSumValue(node) {
  if (node instanceof CSSUnitValue || node instanceof CSSNumericNode) {
    let unit = node.unit;
    let value = node.value;
    if (unitToBase[unit] === "length" && unitToPixels[unit]) {
      value *= unitToPixels[unit];
      unit = "px";
    } else if (unitToBase[unit] === "angle" && unitToRadians[unit]) {
      value *= unitToRadians[unit] / unitToRadians["deg"];
      unit = "deg";
    } else if (unitToBase[unit] === "time" && unitToSeconds[unit]) {
      value *= unitToSeconds[unit];
      unit = "s";
    } else if (unit === "khz") {
      value *= 1e3;
      unit = "hz";
    } else if (unit === "dpi") {
      value /= 96;
      unit = "dppx";
    } else if (unit === "dpcm") {
      value /= 96 / 2.54;
      unit = "dppx";
    }
    const unitMap = /* @__PURE__ */ new Map();
    if (unit !== "number") unitMap.set(unit, 1);
    return [{ value, unitMap }];
  }
  if (node instanceof CSSMathSum) {
    const values = [];
    for (const item of node.values) {
      const itemSum = createSumValue(item);
      if (!itemSum) return null;
      for (const sub of itemSum) {
        const existing = values.find((v) => areUnitMapsEqual(v.unitMap, sub.unitMap));
        if (existing) {
          existing.value += sub.value;
        } else {
          values.push({ value: sub.value, unitMap: new Map(sub.unitMap) });
        }
      }
    }
    return values;
  }
  if (node instanceof CSSMathNegate) {
    const sum = createSumValue(node.value);
    if (!sum) return null;
    return sum.map((v) => ({ value: -v.value, unitMap: v.unitMap }));
  }
  if (node instanceof CSSMathInvert) {
    const sum = createSumValue(node.value);
    if (!sum || sum.length > 1) return null;
    const item = sum[0];
    const newUnitMap = /* @__PURE__ */ new Map();
    for (const [u, p] of item.unitMap) newUnitMap.set(u, -p);
    return [{ value: 1 / item.value, unitMap: newUnitMap }];
  }
  if (node instanceof CSSMathProduct) {
    let values = [{ value: 1, unitMap: /* @__PURE__ */ new Map() }];
    for (const item of node.values) {
      const nextSum = createSumValue(item);
      if (!nextSum) return null;
      const temp = [];
      for (const i1 of values) {
        for (const i2 of nextSum) {
          const newUnitMap = new Map(i1.unitMap);
          for (const [u, p] of i2.unitMap) {
            newUnitMap.set(u, (newUnitMap.get(u) || 0) + p);
            if (newUnitMap.get(u) === 0) newUnitMap.delete(u);
          }
          temp.push({ value: i1.value * i2.value, unitMap: newUnitMap });
        }
      }
      values = temp;
    }
    return values;
  }
  if (node instanceof CSSMathMin || node instanceof CSSMathMax) {
    const args = node.values.map((v) => createSumValue(v));
    if (args.some((a) => !a || a.length > 1)) return null;
    const firstMap = args[0][0].unitMap;
    if (args.some((a) => !areUnitMapsEqual(a[0].unitMap, firstMap))) return null;
    const numericValues = args.map((a) => a[0].value);
    const finalValue = node instanceof CSSMathMin ? Math.min(...numericValues) : Math.max(...numericValues);
    return [{ value: finalValue, unitMap: firstMap }];
  }
  return null;
}

// src/MediaParser.ts
var MediaParser = class _MediaParser {
  /**
   * Parse a media query list string into an array of normalized media queries.
   * Invalid queries are replaced with 'not all'.
   */
  static parse(mediaText) {
    if (!mediaText || mediaText.trim() === "") {
      return [];
    }
    const tokens = tokenize(mediaText);
    const parser = new Parser(tokens);
    const values = parser.parseComponentValues();
    const queries = [];
    let currentQuery = [];
    for (const val of values) {
      if (val.type === "comma") {
        queries.push(this.normalizeAndValidate(currentQuery));
        currentQuery = [];
      } else if (val.type === "whitespace" && currentQuery.length === 0) {
      } else {
        currentQuery.push(val);
      }
    }
    if (currentQuery.length > 0) {
      queries.push(this.normalizeAndValidate(currentQuery));
    }
    return queries;
  }
  static normalizeAndValidate(values) {
    const canonical = this.canonicalSerialize(values);
    const tokens = tokenize(canonical);
    const parser = new Parser(tokens);
    const canonicalValues = parser.parseComponentValues();
    const validator = new MediaQueryValidator(canonicalValues);
    if (!validator.validate()) {
      return "not all";
    }
    return canonical;
  }
  static canonicalSerialize(values) {
    let result = "";
    let lastType = null;
    const filtered = values.filter((v) => v.type !== "whitespace" && v.type !== "comment");
    for (let i = 0; i < filtered.length; i++) {
      const v = filtered[i];
      let serialized = "";
      if (v.type === "simple-block") {
        const start = v.associatedToken.value;
        const end = getMirrorToken(start);
        serialized = start + this.canonicalSerialize(v.value) + end;
      } else if (v.type === "function") {
        const fn = v;
        serialized = fn.name.toLowerCase() + "(" + this.canonicalSerialize(fn.value) + ")";
      } else if (v.type === "ident") {
        serialized = v.value.toLowerCase();
      } else if (v.type === "at-keyword") {
        serialized = "@" + v.value.toLowerCase();
      } else {
        serialized = serialize([v]).trim();
      }
      const isOperator = v.type === "delim" && (v.value === ">" || v.value === "<" || v.value === "=");
      const lastWasOperator = lastType === "delim" && (result.endsWith(">") || result.endsWith("<") || result.endsWith("="));
      if (lastType === "ident" && (v.type === "ident" || v.type === "number" || v.type === "dimension" || v.type === "delim" || v.type === "simple-block")) {
        result += " ";
      } else if (lastType === "simple-block" && v.type === "ident") {
        result += " ";
      } else if (lastType === "delim" && v.type === "ident") {
        if (!result.endsWith(" ")) result += " ";
      } else if (lastType === "colon") {
        result += " ";
      } else if (isOperator && !lastWasOperator) {
        if (!result.endsWith(" ") && result.length > 0 && !result.endsWith("(")) result += " ";
      }
      result += serialized;
      if (isOperator) {
        const next = filtered[i + 1];
        const nextIsOperator = next && next.type === "delim" && (next.value === ">" || next.value === "<" || next.value === "=");
        if (!nextIsOperator) {
          result += " ";
        }
      }
      lastType = v.type;
    }
    return result.trim();
  }
  static lowercaseIdents(values) {
    for (const val of values) {
      if (val.type === "ident") {
        val.value = val.value.toLowerCase();
      } else if (val.type === "simple-block" || val.type === "function") {
        _MediaParser.lowercaseIdents(val.value);
      }
    }
  }
};
var TruthValue = {
  TRUE: "TRUE",
  FALSE: "FALSE",
  UNKNOWN: "UNKNOWN",
  MAYBE: "MAYBE"
};
var MediaQueryValidator = class _MediaQueryValidator {
  stream;
  pos;
  static KNOWN_FEATURES = /* @__PURE__ */ new Set([
    "width",
    "min-width",
    "max-width",
    "height",
    "min-height",
    "max-height",
    "aspect-ratio",
    "min-aspect-ratio",
    "max-aspect-ratio",
    "device-width",
    "min-device-width",
    "max-device-width",
    "device-height",
    "min-device-height",
    "max-device-height",
    "device-aspect-ratio",
    "min-device-aspect-ratio",
    "max-device-aspect-ratio",
    "orientation",
    "resolution",
    "min-resolution",
    "max-resolution",
    "scan",
    "grid",
    "update",
    "overflow-block",
    "overflow-inline",
    "color",
    "min-color",
    "max-color",
    "color-index",
    "min-color-index",
    "max-color-index",
    "monochrome",
    "min-monochrome",
    "max-monochrome",
    "color-gamut",
    "pointer",
    "hover",
    "any-pointer",
    "any-hover",
    "prefers-color-scheme",
    "prefers-reduced-motion",
    "prefers-contrast",
    "forced-colors",
    "dynamic-range"
  ]);
  static FEATURE_VALUE_TYPES = {
    "width": ["length"],
    "min-width": ["length"],
    "max-width": ["length"],
    "height": ["length"],
    "min-height": ["length"],
    "max-height": ["length"],
    "device-width": ["length"],
    "min-device-width": ["length"],
    "max-device-width": ["length"],
    "device-height": ["length"],
    "min-device-height": ["length"],
    "max-device-height": ["length"],
    "aspect-ratio": ["ratio"],
    "min-aspect-ratio": ["ratio"],
    "max-aspect-ratio": ["ratio"],
    "device-aspect-ratio": ["ratio"],
    "min-device-aspect-ratio": ["ratio"],
    "max-device-aspect-ratio": ["ratio"],
    "resolution": ["resolution"],
    "min-resolution": ["resolution"],
    "max-resolution": ["resolution"],
    "orientation": ["ident"],
    "scan": ["ident"],
    "grid": ["integer"],
    "update": ["ident"],
    "overflow-block": ["ident"],
    "overflow-inline": ["ident"],
    "color": ["integer"],
    "min-color": ["integer"],
    "max-color": ["integer"],
    "color-index": ["integer"],
    "min-color-index": ["integer"],
    "max-color-index": ["integer"],
    "monochrome": ["integer"],
    "min-monochrome": ["integer"],
    "max-monochrome": ["integer"],
    "color-gamut": ["ident"],
    "pointer": ["ident"],
    "hover": ["ident"],
    "any-pointer": ["ident"],
    "any-hover": ["ident"],
    "prefers-color-scheme": ["ident"],
    "prefers-reduced-motion": ["ident"],
    "prefers-contrast": ["ident"],
    "forced-colors": ["ident"],
    "dynamic-range": ["ident"]
  };
  static FEATURE_ALLOWED_IDENTS = {
    "orientation": ["portrait", "landscape"],
    "scan": ["interlace", "progressive"],
    "update": ["none", "slow", "fast"],
    "overflow-block": ["none", "scroll", "optional-paged", "paged"],
    "overflow-inline": ["none", "scroll"],
    "color-gamut": ["srgb", "p3", "rec2020"],
    "pointer": ["none", "coarse", "fine"],
    "hover": ["none", "hover"],
    "any-pointer": ["none", "coarse", "fine"],
    "any-hover": ["none", "hover"],
    "prefers-color-scheme": ["light", "dark"],
    "prefers-reduced-motion": ["no-preference", "reduce"],
    "prefers-contrast": ["no-preference", "less", "more", "custom"],
    "forced-colors": ["none", "active"],
    "dynamic-range": ["standard", "high"]
  };
  static NON_NEGATIVE_FEATURES = /* @__PURE__ */ new Set([
    "width",
    "min-width",
    "max-width",
    "height",
    "min-height",
    "max-height",
    "device-width",
    "min-device-width",
    "max-device-width",
    "device-height",
    "min-device-height",
    "max-device-height",
    "resolution",
    "min-resolution",
    "max-resolution",
    "color",
    "min-color",
    "max-color",
    "color-index",
    "min-color-index",
    "max-color-index",
    "monochrome",
    "min-monochrome",
    "max-monochrome"
  ]);
  constructor(stream) {
    this.stream = stream.filter((t) => t.type !== "whitespace" && t.type !== "comment");
    this.pos = 0;
  }
  peek() {
    return this.stream[this.pos];
  }
  consume() {
    return this.stream[this.pos++];
  }
  eof() {
    return this.pos >= this.stream.length;
  }
  isIdent(val) {
    const t = this.peek();
    if (!t || t.type !== "ident") return false;
    return val ? t.value.toLowerCase() === val.toLowerCase() : true;
  }
  isSimpleBlock(blockType) {
    const t = this.peek();
    return !!t && t.type === "simple-block" && t.associatedToken.value === blockType;
  }
  validate() {
    if (this.stream.length === 0) return false;
    const startPos = this.pos;
    let result = this.parseMediaCondition();
    if (result !== null && this.eof()) {
      return result !== TruthValue.UNKNOWN;
    }
    this.pos = startPos;
    let isNot = false;
    if (this.isIdent("not")) {
      this.consume();
      isNot = true;
    } else if (this.isIdent("only")) {
      this.consume();
    }
    const mediaTypeResult = this.parseMediaType();
    if (mediaTypeResult !== null) {
      let finalResult = mediaTypeResult;
      if (isNot) {
        finalResult = this.evalNot(finalResult);
      }
      if (this.isIdent("and")) {
        this.consume();
        const condResult = this.parseMediaConditionWithoutOr();
        if (condResult === null) return false;
        finalResult = this.evalAnd(finalResult, condResult);
      }
      if (this.eof()) {
        return finalResult !== TruthValue.UNKNOWN;
      }
    }
    return false;
  }
  // mediaqueries-4 #evaluating
  evalNot(val) {
    if (val === TruthValue.TRUE) return TruthValue.FALSE;
    if (val === TruthValue.FALSE) return TruthValue.TRUE;
    if (val === TruthValue.UNKNOWN) return TruthValue.UNKNOWN;
    return TruthValue.MAYBE;
  }
  // mediaqueries-4 #evaluating
  evalAnd(a, b) {
    if (a === TruthValue.FALSE || b === TruthValue.FALSE) return TruthValue.FALSE;
    if (a === TruthValue.TRUE && b === TruthValue.TRUE) return TruthValue.TRUE;
    if (a === TruthValue.MAYBE || b === TruthValue.MAYBE) {
      if (a === TruthValue.UNKNOWN || b === TruthValue.UNKNOWN) return TruthValue.UNKNOWN;
      return TruthValue.MAYBE;
    }
    return TruthValue.UNKNOWN;
  }
  // mediaqueries-4 #evaluating
  evalOr(a, b) {
    if (a === TruthValue.TRUE || b === TruthValue.TRUE) return TruthValue.TRUE;
    if (a === TruthValue.FALSE && b === TruthValue.FALSE) return TruthValue.FALSE;
    if (a === TruthValue.MAYBE || b === TruthValue.MAYBE) return TruthValue.MAYBE;
    return TruthValue.UNKNOWN;
  }
  parseMediaType() {
    const t = this.peek();
    if (!t || t.type !== "ident") return null;
    const v = t.value.toLowerCase();
    if (v === "not" || v === "only" || v === "and" || v === "or" || v === "layer") {
      return null;
    }
    this.consume();
    if (v === "all") return TruthValue.TRUE;
    if (v === "screen" || v === "print" || v === "speech") return TruthValue.MAYBE;
    return TruthValue.FALSE;
  }
  parseMediaCondition() {
    const startPos = this.pos;
    if (this.isIdent("not")) {
      this.consume();
      const res2 = this.parseMediaInParens();
      if (res2 !== null) return this.evalNot(res2);
      this.pos = startPos;
      return null;
    }
    let res = this.parseMediaInParens();
    if (res === null) return null;
    if (this.isIdent("and")) {
      while (this.isIdent("and")) {
        this.consume();
        const next = this.parseMediaInParens();
        if (next === null) return null;
        res = this.evalAnd(res, next);
      }
    } else if (this.isIdent("or")) {
      while (this.isIdent("or")) {
        this.consume();
        const next = this.parseMediaInParens();
        if (next === null) return null;
        res = this.evalOr(res, next);
      }
    }
    return res;
  }
  parseMediaConditionWithoutOr() {
    const startPos = this.pos;
    if (this.isIdent("not")) {
      this.consume();
      const res2 = this.parseMediaInParens();
      if (res2 !== null) return this.evalNot(res2);
      this.pos = startPos;
      return null;
    }
    let res = this.parseMediaInParens();
    if (res === null) return null;
    while (this.isIdent("and")) {
      this.consume();
      const next = this.parseMediaInParens();
      if (next === null) return null;
      res = this.evalAnd(res, next);
    }
    return res;
  }
  parseMediaInParens() {
    const t = this.peek();
    if (!t) return null;
    if (t.type === "simple-block" && t.associatedToken.value === "(") {
      this.consume();
      const tokens = t.value.filter((v) => v.type !== "whitespace" && v.type !== "comment");
      return this.validateMediaInParens(tokens);
    }
    if (t.type === "function" && Array.isArray(t.value)) {
      this.consume();
      return TruthValue.UNKNOWN;
    }
    if (t.type === "simple-block" && t.associatedToken.value === "(") {
    }
    return null;
  }
  isValidMfValue(tokens) {
    if (tokens.length === 0) return false;
    for (const t of tokens) {
      if (t.type === "delim" && (t.value === "<" || t.value === ">" || t.value === "=")) {
        return false;
      }
      if (t.type === "comma") {
        return false;
      }
    }
    return true;
  }
  isNegative(tokens) {
    for (const t of tokens) {
      if (t.type === "number" || t.type === "dimension" || t.type === "percentage") {
        if (parseFloat(t.value) < 0) return true;
      }
    }
    return false;
  }
  matchesType(tokens, types, featureName) {
    if (tokens.length === 0) return false;
    const t = tokens[0];
    if (types.includes("length")) {
      if (t.type === "dimension") {
        const unit = t.unit?.toLowerCase();
        if (unit && unitToBase[unit] === "length") return true;
      }
      if (t.type === "number" && parseFloat(t.value) === 0) return true;
    }
    if (types.includes("resolution")) {
      if (t.type === "dimension") {
        const unit = t.unit?.toLowerCase();
        if (unit && (unitToBase[unit] === "resolution" || unit === "x")) return true;
      }
    }
    if (types.includes("ident")) {
      if (t.type === "ident") {
        const allowed = _MediaQueryValidator.FEATURE_ALLOWED_IDENTS[featureName];
        if (allowed) {
          return allowed.includes(t.value.toLowerCase());
        }
        return true;
      }
    }
    if (types.includes("integer")) {
      if (t.type === "number" && t.numberType === "integer") return true;
    }
    if (types.includes("ratio")) {
      if (t.type === "number") {
        if (tokens.length === 1) return true;
        if (tokens.length === 3 && tokens[1].type === "delim" && tokens[1].value === "/" && tokens[2].type === "number") return true;
      }
    }
    return false;
  }
  validateMediaInParens(tokens) {
    if (tokens.length === 0) return TruthValue.UNKNOWN;
    const validator = new _MediaQueryValidator(tokens);
    const condResult = validator.parseMediaCondition();
    if (condResult !== null && validator.eof()) {
      return condResult;
    }
    if (tokens.length >= 3 && tokens[0].type === "ident" && tokens[1].type === "colon") {
      const featureName = tokens[0].value.toLowerCase();
      if (_MediaQueryValidator.KNOWN_FEATURES.has(featureName)) {
        const valueTokens = tokens.slice(2);
        if (this.isValidMfValue(valueTokens)) {
          if (_MediaQueryValidator.NON_NEGATIVE_FEATURES.has(featureName)) {
            if (this.isNegative(valueTokens)) return TruthValue.UNKNOWN;
          }
          const expectedTypes = _MediaQueryValidator.FEATURE_VALUE_TYPES[featureName];
          if (expectedTypes && !this.matchesType(valueTokens, expectedTypes, featureName)) {
            return TruthValue.UNKNOWN;
          }
          return TruthValue.MAYBE;
        }
      } else {
        return TruthValue.UNKNOWN;
      }
    }
    if (tokens.length === 1 && tokens[0].type === "ident") {
      const featureName = tokens[0].value.toLowerCase();
      if (_MediaQueryValidator.KNOWN_FEATURES.has(featureName)) {
        return TruthValue.MAYBE;
      } else {
        return TruthValue.UNKNOWN;
      }
    }
    const rangeResult = this.parseRangeContext(tokens);
    if (rangeResult !== null) {
      return rangeResult;
    }
    return TruthValue.UNKNOWN;
  }
  parseRangeContext(tokens) {
    const ops = [];
    let pos = 0;
    while (pos < tokens.length) {
      const opInfo = this.parseOperator(tokens, pos);
      if (opInfo) {
        ops.push({ op: opInfo.op, start: pos, end: opInfo.nextPos });
        pos = opInfo.nextPos;
      } else {
        pos++;
      }
    }
    if (ops.length === 1) {
      const left = tokens.slice(0, ops[0].start);
      const right = tokens.slice(ops[0].end);
      if (left.length === 0 || right.length === 0) return null;
      if (!this.isValidMfValue(left) || !this.isValidMfValue(right)) return null;
      const leftIsIdent = left.length === 1 && left[0].type === "ident";
      const rightIsIdent = right.length === 1 && right[0].type === "ident";
      let featureName = null;
      if (leftIsIdent) {
        featureName = left[0].value.toString().toLowerCase();
      } else if (rightIsIdent) {
        featureName = right[0].value.toString().toLowerCase();
      }
      if (featureName && _MediaQueryValidator.KNOWN_FEATURES.has(featureName)) {
        if (_MediaQueryValidator.NON_NEGATIVE_FEATURES.has(featureName)) {
          if (this.isNegative(leftIsIdent ? right : left)) return TruthValue.UNKNOWN;
        }
        return TruthValue.MAYBE;
      }
      return null;
    } else if (ops.length === 2) {
      const left = tokens.slice(0, ops[0].start);
      const middle = tokens.slice(ops[0].end, ops[1].start);
      const right = tokens.slice(ops[1].end);
      if (left.length === 0 || middle.length === 0 || right.length === 0) return null;
      const op1 = ops[0].op;
      const op2 = ops[1].op;
      const isLessThanOp = (op) => op === "<" || op === "<=";
      const isGreaterThanOp = (op) => op === ">" || op === ">=";
      if (op1 === "=" || op2 === "=") return null;
      if (isLessThanOp(op1) && !isLessThanOp(op2)) return null;
      if (isGreaterThanOp(op1) && !isGreaterThanOp(op2)) return null;
      if (!this.isValidMfValue(left) || !this.isValidMfValue(middle) || !this.isValidMfValue(right)) return null;
      if (middle.length === 1 && middle[0].type === "ident") {
        const featureName = middle[0].value.toString().toLowerCase();
        if (_MediaQueryValidator.KNOWN_FEATURES.has(featureName)) {
          if (_MediaQueryValidator.NON_NEGATIVE_FEATURES.has(featureName)) {
            if (this.isNegative(left) || this.isNegative(right)) return TruthValue.UNKNOWN;
          }
          return TruthValue.MAYBE;
        }
        return TruthValue.UNKNOWN;
      }
      return null;
    }
    return null;
  }
  parseOperator(tokens, pos) {
    if (pos >= tokens.length) return null;
    const t1 = tokens[pos];
    if (t1.type !== "delim") return null;
    if (t1.value === "=") return { op: "=", nextPos: pos + 1 };
    if (t1.value === "<" || t1.value === ">") {
      if (pos + 1 < tokens.length && tokens[pos + 1].type === "delim" && tokens[pos + 1].value === "=") {
        return { op: t1.value + "=", nextPos: pos + 2 };
      }
      return { op: t1.value, nextPos: pos + 1 };
    }
    return null;
  }
};

// src/CSSOM.ts
function camelToDashed(str) {
  return str.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()).replace(/^ms-/, "-ms-");
}
function createStyleProxy(target) {
  return new Proxy(target, {
    get(t, prop, receiver) {
      if (typeof prop === "string") {
        if (!isNaN(Number(prop))) {
          const index = Number(prop);
          const decl = t.declarations[index];
          return decl ? decl.name : void 0;
        }
        if (!(prop in t)) {
          const isCustomProp = prop.startsWith("--");
          let cssProp = prop;
          if (!isCustomProp) {
            cssProp = camelToDashed(prop);
          }
          return t.getPropertyValue(cssProp);
        }
      }
      return Reflect.get(t, prop, receiver);
    },
    set(t, prop, value, receiver) {
      if (typeof prop === "string") {
        if (!isNaN(Number(prop))) {
          return false;
        }
        if (!(prop in t)) {
          const isCustomProp = prop.startsWith("--");
          let cssProp = prop;
          if (!isCustomProp) {
            cssProp = camelToDashed(prop);
          }
          t.setProperty(cssProp, value);
          return true;
        }
      }
      return Reflect.set(t, prop, value, receiver);
    }
  });
}
function createIndexedProxy(target, getArray, mapValue = (v) => v) {
  return new Proxy(target, {
    get(t, prop) {
      if (typeof prop === "string" && !isNaN(Number(prop))) {
        const index = Number(prop);
        const arr = getArray(t);
        const val = arr[index];
        return val !== void 0 ? mapValue(val) : void 0;
      }
      return t[prop];
    }
  });
}
function deleteRuleFromArray(rules, index) {
  if (index < 0 || index >= rules.length) {
    throw new DOMException("Index size error", "IndexSizeError");
  }
  rules.splice(index, 1);
}
var CSSStyleDeclaration = class {
  _declarations;
  _declMap;
  parentRule = null;
  constructor(declarations = []) {
    this._declarations = [];
    this._declMap = /* @__PURE__ */ new Map();
    for (const d of declarations) {
      const shorthand = SHORTHANDS[d.name];
      if (shorthand) {
        const expanded = shorthand.expand(d.value);
        if (expanded) {
          for (const [lh, val] of Object.entries(expanded)) {
            const lhDecl = {
              type: "declaration",
              name: lh,
              value: val,
              important: d.important
            };
            this._addDeclaration(lhDecl);
          }
          continue;
        }
      }
      this._addDeclaration(d);
    }
    return createStyleProxy(this);
  }
  _addDeclaration(d) {
    if (this._declMap.has(d.name)) {
      const existing = this._declMap.get(d.name);
      existing.value = d.value;
      existing.important = d.important;
    } else {
      this._declarations.push(d);
      this._declMap.set(d.name, d);
    }
  }
  get declarations() {
    return this._declarations;
  }
  get length() {
    return this._declarations.length;
  }
  item(index) {
    return this._declarations[index]?.name || "";
  }
  getPropertyValue(property) {
    if (!property.startsWith("--")) property = property.toLowerCase();
    const shorthand = SHORTHANDS[property];
    if (shorthand) {
      const longhandValues = {};
      let anySet = false;
      let important = null;
      let consistentImportant = true;
      for (const lh of shorthand.longhands) {
        const val = this.getPropertyValue(lh);
        if (val) {
          anySet = true;
          longhandValues[lh] = tokenize(val);
          const prio = this.getPropertyPriority(lh);
          if (important === null) important = prio === "important";
          else if (important !== (prio === "important")) {
            consistentImportant = false;
          }
        }
      }
      if (anySet && consistentImportant) {
        return shorthand.contract(longhandValues) || "";
      }
      return "";
    }
    const winner = this._getWinningDeclaration(property);
    if (winner) {
      if (winner.name === "all") {
        return serialize(winner.value);
      }
      const isCustom = winner.name.startsWith("--");
      if (isCustom && winner.value.length === 0) {
        return " ";
      }
      return serialize(winner.value, isCustom);
    }
    return "";
  }
  _getWinningDeclaration(property) {
    if (!property.startsWith("--")) property = property.toLowerCase();
    const aliases = this._getPropertyAliases(property);
    const isCustom = property.startsWith("--");
    const isCoveredByAll = !isCustom && property !== "direction" && property !== "unicode-bidi" && property !== "all";
    let winner = null;
    for (let i = this._declarations.length - 1; i >= 0; i--) {
      const d = this._declarations[i];
      const isMatch = d.name === property || aliases.includes(d.name);
      const isAll = d.name === "all" && isCoveredByAll;
      if (isMatch || isAll) {
        if (!winner || d.important && !winner.important) {
          winner = d;
        } else if (d.important === winner.important) {
          const isWinnerLogical = !!LOGICAL_MAPPING[winner.name];
          const isCurrentLogical = !!LOGICAL_MAPPING[d.name];
          if (!isCurrentLogical && isWinnerLogical) {
            winner = d;
          }
        }
      }
    }
    return winner;
  }
  getPropertyPriority(property) {
    if (!property.startsWith("--")) property = property.toLowerCase();
    const shorthand = SHORTHANDS[property];
    if (shorthand) {
      const longhandValues = {};
      let importantCount = 0;
      let presentCount = 0;
      for (const lh of shorthand.longhands) {
        const val = this.getPropertyValue(lh);
        if (val) {
          presentCount++;
          longhandValues[lh] = tokenize(val);
          if (this.getPropertyPriority(lh) === "important") importantCount++;
        }
      }
      if (presentCount > 0 && importantCount === presentCount) {
        if (shorthand.contract(longhandValues)) {
          return "important";
        }
      }
      return "";
    }
    const winner = this._getWinningDeclaration(property);
    return winner && winner.important ? "important" : "";
  }
  _getPropertyAliases(property) {
    const aliases = [];
    const physical = LOGICAL_MAPPING[property];
    if (physical) {
      aliases.push(physical);
    } else {
      const logicals = PHYSICAL_TO_LOGICAL[property];
      if (logicals) {
        aliases.push(...logicals);
      }
    }
    return aliases;
  }
  setProperty(property, value, priority = "") {
    if (!property.startsWith("--")) property = property.toLowerCase();
    if (priority !== "" && priority.toLowerCase() !== "important") {
      return;
    }
    if (value === null || value === "") {
      this.removeProperty(property);
      return;
    }
    const shorthand = SHORTHANDS[property];
    if (shorthand) {
      const tokens2 = tokenize(value);
      const expanded = shorthand.expand(tokens2);
      if (expanded) {
        for (const [lh, val] of Object.entries(expanded)) {
          this.setProperty(lh, serialize(val), priority);
        }
        return;
      }
    }
    const existing = this._declMap.get(property);
    const tokens = tokenize(value);
    if (existing) {
      const idx = this._declarations.indexOf(existing);
      if (idx !== -1) {
        this._declarations.splice(idx, 1);
        this._declarations.push(existing);
      }
      existing.value = tokens;
      existing.important = priority === "important";
    } else {
      const decl = {
        type: "declaration",
        name: property,
        value: tokens,
        important: priority === "important"
      };
      this._declarations.push(decl);
      this._declMap.set(property, decl);
    }
  }
  removeProperty(property) {
    if (!property.startsWith("--")) property = property.toLowerCase();
    const shorthand = SHORTHANDS[property];
    if (shorthand) {
      const value = this.getPropertyValue(property);
      for (const lh of shorthand.longhands) {
        this.removeProperty(lh);
      }
      return value;
    }
    if (property === "all") {
      for (let i = this._declarations.length - 1; i >= 0; i--) {
        const d = this._declarations[i];
        if (d.name !== "direction" && d.name !== "unicode-bidi" && !d.name.startsWith("--")) {
          this._declarations.splice(i, 1);
          this._declMap.delete(d.name);
        }
      }
      return "";
    }
    const index = this._declarations.findIndex((d) => d.name === property);
    if (index !== -1) {
      const decl = this._declarations[index];
      this._declarations.splice(index, 1);
      this._declMap.delete(property);
      let val = serialize(decl.value, property.startsWith("--"));
      if (property.startsWith("--") && decl.value.length === 0) {
        val = " ";
      }
      return val;
    }
    return "";
  }
  get cssText() {
    if (this._declarations.length === 0) return "";
    return serializeDeclarations(this._declarations);
  }
  set cssText(value) {
    this._declarations.length = 0;
    this._declMap.clear();
    const tokens = tokenize(value);
    const newStyle = ParseHooks.parseStyleAttribute(tokens);
    for (const d of newStyle.declarations) {
      if (this._declMap.has(d.name)) {
        const existing = this._declMap.get(d.name);
        existing.value = d.value;
        existing.important = d.important;
      } else {
        this._declarations.push(d);
        this._declMap.set(d.name, d);
      }
    }
  }
  get cssFloat() {
    return this.getPropertyValue("float");
  }
  set cssFloat(value) {
    this.setProperty("float", value);
  }
};
var StyleSheetList = class {
  _sheets;
  constructor(sheets) {
    this._sheets = sheets;
    return createIndexedProxy(this, (t) => t._sheets);
  }
  get length() {
    return this._sheets.length;
  }
  item(index) {
    return this._sheets[index] || null;
  }
};
var MediaList = class {
  _mediaQueries = [];
  constructor(mediaText = "") {
    this.mediaText = mediaText;
    return createIndexedProxy(this, (t) => t._mediaQueries);
  }
  get mediaText() {
    return this._mediaQueries.join(", ");
  }
  set mediaText(value) {
    if (!value) {
      this._mediaQueries = [];
      return;
    }
    this._mediaQueries = MediaParser.parse(value);
  }
  get length() {
    return this._mediaQueries.length;
  }
  item(index) {
    return this._mediaQueries[index] || null;
  }
  appendMedium(medium) {
    const parsed = MediaParser.parse(medium);
    if (parsed.length !== 1) {
      return;
    }
    const m = parsed[0];
    if (this._mediaQueries.includes(m)) {
      return;
    }
    this._mediaQueries.push(m);
  }
  deleteMedium(medium) {
    const parsed = MediaParser.parse(medium);
    if (parsed.length !== 1) {
      return;
    }
    const m = parsed[0];
    const index = this._mediaQueries.indexOf(m);
    if (index !== -1) {
      this._mediaQueries.splice(index, 1);
    } else {
      throw new DOMException(`The medium '${medium}' does not exist in the MediaList.`, "NotFoundError");
    }
  }
};
var CSSStyleSheet = class {
  type = "text/css";
  href = null;
  ownerNode = null;
  parentStyleSheet = null;
  title = null;
  media;
  _disabledFlag = false;
  ownerRule = null;
  cssRules;
  _rules;
  _parseRule;
  // Internal flags (cssom-1 #the-cssstylesheet-interface)
  _alternateFlag = false;
  _originCleanFlag = true;
  _constructedFlag = false;
  _disallowModificationFlag = false;
  _constructorDocument = null;
  _baseURL = null;
  constructor(rulesOrOptions, parseRuleOrNothing) {
    if (Array.isArray(rulesOrOptions)) {
      this._rules = rulesOrOptions;
      this._parseRule = parseRuleOrNothing;
      this.media = new MediaList();
    } else {
      const options = rulesOrOptions || {};
      this._rules = [];
      this._constructedFlag = true;
      this._originCleanFlag = true;
      if (options.media instanceof MediaList) {
        this.media = options.media;
      } else {
        this.media = new MediaList(options.media || "");
      }
      this._disabledFlag = !!options.disabled;
      this._baseURL = options.baseURL || null;
      this._parseRule = (text) => {
        const tokens = tokenize(text);
        return ParseHooks.consumeRule(tokens);
      };
    }
    this.cssRules = new CSSRuleList(this._rules);
  }
  get disabled() {
    return this._disabledFlag;
  }
  set disabled(value) {
    this._disabledFlag = value;
  }
  // 6.3 The CSSStyleSheet Interface
  // Konstruktable Stylesheets methods
  replace(text) {
    if (!this._constructedFlag) {
      return Promise.reject(new DOMException("Not allowed on non-constructed stylesheets", "NotAllowedError"));
    }
    try {
      this.replaceSync(text);
      return Promise.resolve(this);
    } catch (e) {
      return Promise.reject(e);
    }
  }
  replaceSync(text) {
    if (!this._constructedFlag) {
      throw new DOMException("Not allowed on non-constructed stylesheets", "NotAllowedError");
    }
    const tokens = tokenize(text);
    const rules = ParseHooks.consumeListOfRules(tokens, true);
    const filteredRules = rules.filter((rule) => {
      if (isImportRule(rule)) {
        console.warn("CSS Parse Error: @import rules are not allowed in constructed stylesheets and were removed.");
        return false;
      }
      return true;
    });
    this._rules.splice(0, this._rules.length, ...filteredRules);
  }
  insertRule(rule, index = 0) {
    if (this._disallowModificationFlag) {
      throw new DOMException("Modification is disallowed", "NotAllowedError");
    }
    if (!this._originCleanFlag) {
      throw new DOMException("The style sheet is not origin-clean.", "SecurityError");
    }
    const parsedRule = this._parseRule(rule);
    if (!parsedRule) {
      throw new DOMException("Syntax error", "SyntaxError");
    }
    if (index < 0 || index > this._rules.length) {
      throw new DOMException("Index size error", "IndexSizeError");
    }
    const isImport = isImportRule(parsedRule);
    const isNamespace = isNamespaceRule(parsedRule);
    if (isImport && this._constructedFlag) {
      throw new DOMException("HierarchyRequestError: @import rules are not allowed in constructed stylesheets", "SyntaxError");
    }
    if (isImport) {
      if (this._rules.some((r) => isRegularRule(r))) {
        throw new DOMException("HierarchyRequestError: @import rules must precede all other rules", "HierarchyRequestError");
      }
      for (let i = 0; i < index; i++) {
        if (!isImportRule(this._rules[i])) {
          throw new DOMException("HierarchyRequestError: @import rules must precede all other rules", "HierarchyRequestError");
        }
      }
    } else if (isNamespace) {
      if (this._rules.some((r) => isRegularRule(r))) {
        throw new DOMException("InvalidStateError: @namespace rules must precede all regular rules", "InvalidStateError");
      }
      for (let i = index; i < this._rules.length; i++) {
        if (isImportRule(this._rules[i])) {
          throw new DOMException("HierarchyRequestError: @namespace rules must follow all @import rules", "HierarchyRequestError");
        }
      }
    } else {
      for (let i = index; i < this._rules.length; i++) {
        if (isImportRule(this._rules[i]) || isNamespaceRule(this._rules[i])) {
          throw new DOMException("HierarchyRequestError: Regular rules must follow all @import and @namespace rules", "HierarchyRequestError");
        }
      }
    }
    this._rules.splice(index, 0, parsedRule);
    return index;
  }
  deleteRule(index) {
    if (this._disallowModificationFlag) {
      throw new DOMException("Modification is disallowed", "NotAllowedError");
    }
    if (!this._originCleanFlag) {
      throw new DOMException("The style sheet is not origin-clean.", "SecurityError");
    }
    deleteRuleFromArray(this._rules, index);
  }
};
function isImportRule(r) {
  if (typeof r.type === "number") {
    return r.type === CSSRule.IMPORT_RULE;
  }
  return r.type === "at-rule" && r.name === "import";
}
function isNamespaceRule(r) {
  if (typeof r.type === "number") {
    return r.type === CSSRule.NAMESPACE_RULE;
  }
  return r.type === "at-rule" && r.name === "namespace";
}
function isRegularRule(r) {
  return !isImportRule(r) && !isNamespaceRule(r);
}
function serializeGroupingRule(atKeyword, condition, rules) {
  const cond = condition ? " " + condition : "";
  if (rules.length === 0) {
    return `@${atKeyword}${cond} { }`;
  }
  const body = rules.map((r) => r.cssText).join("\n");
  const indentedBody = body.split("\n").map((line) => "  " + line).join("\n");
  return `@${atKeyword}${cond} {
${indentedBody}
}`;
}
var CSSRule = class _CSSRule {
  parentRule = null;
  parentStyleSheet = null;
  static STYLE_RULE = 1;
  static CHARSET_RULE = 2;
  static IMPORT_RULE = 3;
  static MEDIA_RULE = 4;
  static FONT_FACE_RULE = 5;
  static PAGE_RULE = 6;
  static KEYFRAMES_RULE = 7;
  static KEYFRAME_RULE = 8;
  static MARGIN_RULE = 9;
  static NAMESPACE_RULE = 10;
  static COUNTER_STYLE_RULE = 11;
  static SUPPORTS_RULE = 12;
  static DOCUMENT_RULE = 13;
  static FONT_FEATURE_VALUES_RULE = 14;
  static VIEWPORT_RULE = 15;
  static REGION_STYLE_RULE = 16;
  static NESTED_DECLARATIONS_RULE = 17;
  static PROPERTY_RULE = 18;
  static CONTAINER_RULE = 19;
  get STYLE_RULE() {
    return _CSSRule.STYLE_RULE;
  }
  get CHARSET_RULE() {
    return _CSSRule.CHARSET_RULE;
  }
  get IMPORT_RULE() {
    return _CSSRule.IMPORT_RULE;
  }
  get MEDIA_RULE() {
    return _CSSRule.MEDIA_RULE;
  }
  get FONT_FACE_RULE() {
    return _CSSRule.FONT_FACE_RULE;
  }
  get PAGE_RULE() {
    return _CSSRule.PAGE_RULE;
  }
  get KEYFRAMES_RULE() {
    return _CSSRule.KEYFRAMES_RULE;
  }
  get KEYFRAME_RULE() {
    return _CSSRule.KEYFRAME_RULE;
  }
  get MARGIN_RULE() {
    return _CSSRule.MARGIN_RULE;
  }
  get NAMESPACE_RULE() {
    return _CSSRule.NAMESPACE_RULE;
  }
  get COUNTER_STYLE_RULE() {
    return _CSSRule.COUNTER_STYLE_RULE;
  }
  get SUPPORTS_RULE() {
    return _CSSRule.SUPPORTS_RULE;
  }
  get DOCUMENT_RULE() {
    return _CSSRule.DOCUMENT_RULE;
  }
  get FONT_FEATURE_VALUES_RULE() {
    return _CSSRule.FONT_FEATURE_VALUES_RULE;
  }
  get VIEWPORT_RULE() {
    return _CSSRule.VIEWPORT_RULE;
  }
  get REGION_STYLE_RULE() {
    return _CSSRule.REGION_STYLE_RULE;
  }
  get NESTED_DECLARATIONS_RULE() {
    return _CSSRule.NESTED_DECLARATIONS_RULE;
  }
  get PROPERTY_RULE() {
    return _CSSRule.PROPERTY_RULE;
  }
  get CONTAINER_RULE() {
    return _CSSRule.CONTAINER_RULE;
  }
  get type() {
    throw new Error("Not implemented");
  }
  // 6.13 The CSSRule Interface
  get cssText() {
    throw new Error("Not implemented");
  }
  set cssText(value) {
  }
};
var CSSRuleList = class {
  _rules;
  constructor(rules) {
    this._rules = rules;
    return createIndexedProxy(this, (t) => t._rules, (v) => v);
  }
  get length() {
    return this._rules.length;
  }
  item(index) {
    return this._rules[index] || null;
  }
};
var CSSGroupingRule = class extends CSSRule {
  cssRules;
  _rules;
  _parseRuleInBlock;
  constructor(rules, parseRuleInBlock2) {
    super();
    this._rules = rules;
    this.cssRules = new CSSRuleList(rules);
    this._parseRuleInBlock = parseRuleInBlock2;
  }
  // 6.16 The CSSGroupingRule Interface
  insertRule(rule, index = 0) {
    const parsedRule = this._parseRuleInBlock(rule);
    if (!parsedRule) {
      throw new DOMException("Syntax error", "SyntaxError");
    }
    if (index < 0 || index > this._rules.length) {
      throw new DOMException("Index size error", "IndexSizeError");
    }
    this._rules.splice(index, 0, parsedRule);
    return index;
  }
  deleteRule(index) {
    deleteRuleFromArray(this._rules, index);
  }
};
var CSSStyleRule = class extends CSSGroupingRule {
  _selectorText;
  _selectorAST = null;
  _style;
  styleMap;
  constructor(selectorText, styleDeclarations, rules, parseRuleInBlock2, selectorAST = null) {
    super(rules, parseRuleInBlock2);
    this._selectorText = selectorText;
    this._selectorAST = selectorAST;
    this._style = new CSSStyleDeclaration(styleDeclarations);
    this._style.parentRule = this;
    this.styleMap = new StylePropertyMapReadOnly(styleDeclarations);
  }
  get style() {
    return this._style;
  }
  set style(value) {
    this._style.cssText = value;
  }
  get selectorText() {
    return this._selectorText;
  }
  set selectorText(value) {
    const selector = ParseHooks.parseSelector(value);
    if (selector !== null) {
      this._selectorText = selector;
      this._selectorAST = ParseHooks.parseSelectorAST(value);
    }
  }
  get selectorAST() {
    return this._selectorAST;
  }
  get type() {
    return 1;
  }
  // 6.14 The CSSStyleRule Interface
  get cssText() {
    const declsStr = serializeDeclarations(this.style.declarations);
    const rulesStr = this._rules.map((r) => r.cssText).join(" ");
    let body = declsStr;
    if (rulesStr) {
      body += (body ? " " : "") + rulesStr.trim();
    }
    const bodyText = body.trim();
    return `${this.selectorText} {${bodyText ? " " + bodyText + " " : ""}}`;
  }
  set cssText(_value) {
  }
};
var CSSMediaRule = class extends CSSGroupingRule {
  media;
  constructor(mediaText, rules, parseRuleInBlock2) {
    super(rules, parseRuleInBlock2);
    this.media = new MediaList(mediaText);
  }
  get type() {
    return 4;
  }
  // 6.17 The CSSMediaRule Interface
  get cssText() {
    return serializeGroupingRule("media", this.media.mediaText, this._rules);
  }
  set cssText(_value) {
  }
};
var CSSSupportsRule = class extends CSSGroupingRule {
  conditionText;
  constructor(conditionText, rules, parseRuleInBlock2) {
    super(rules, parseRuleInBlock2);
    this.conditionText = conditionText;
  }
  get type() {
    return 12;
  }
  get cssText() {
    return serializeGroupingRule("supports", this.conditionText, this._rules);
  }
  set cssText(_value) {
  }
};
var CSSContainerRule = class extends CSSGroupingRule {
  containerQuery;
  constructor(containerQuery, rules, parseRuleInBlock2) {
    super(rules, parseRuleInBlock2);
    this.containerQuery = containerQuery;
  }
  get type() {
    return CSSRule.CONTAINER_RULE;
  }
  get cssText() {
    return serializeGroupingRule("container", this.containerQuery, this._rules);
  }
  set cssText(_value) {
  }
};
var CSSLayerBlockRule = class extends CSSGroupingRule {
  name;
  constructor(name, rules, parseRuleInBlock2) {
    super(rules, parseRuleInBlock2);
    this.name = name;
  }
  get type() {
    return 0;
  }
  get cssText() {
    return serializeGroupingRule("layer", this.name, this._rules);
  }
  set cssText(_value) {
  }
};
var CSSLayerStatementRule = class extends CSSRule {
  nameList;
  constructor(nameList) {
    super();
    this.nameList = nameList;
  }
  get type() {
    return 0;
  }
  get cssText() {
    return `@layer ${this.nameList.join(", ")};`;
  }
  set cssText(_value) {
  }
};
var CSSStartingStyleRule = class extends CSSGroupingRule {
  constructor(_prelude, rules, parseRuleInBlock2) {
    super(rules, parseRuleInBlock2);
  }
  get type() {
    return 0;
  }
  get cssText() {
    return serializeGroupingRule("starting-style", "", this._rules);
  }
  set cssText(_value) {
  }
};
var CSSViewTransitionRule = class extends CSSRule {
  navigation = "none";
  constructor(declarations) {
    super();
    for (const decl of declarations) {
      if (decl.name === "navigation") {
        this.navigation = serialize(decl.value).trim();
      }
    }
  }
  get type() {
    return 0;
  }
  get cssText() {
    return `@view-transition { navigation: ${this.navigation}; }`;
  }
  set cssText(_value) {
  }
};
var CSSKeyframesRule = class extends CSSRule {
  name;
  cssRules;
  _rules;
  constructor(name, rules) {
    super();
    this.name = name;
    this._rules = rules;
    this.cssRules = new CSSRuleList(rules);
  }
  get type() {
    return 7;
  }
  // The CSSKeyframesRule Interface
  get cssText() {
    return serializeGroupingRule("keyframes", this.name, this._rules);
  }
  set cssText(_value) {
  }
};
var CSSKeyframeRule = class extends CSSRule {
  keyText;
  style;
  constructor(keyText, styleDeclarations) {
    super();
    this.keyText = keyText;
    this.style = new CSSStyleDeclaration(styleDeclarations);
    this.style.parentRule = this;
  }
  get type() {
    return 8;
  }
  // The CSSKeyframeRule Interface
  get cssText() {
    const body = this.style.cssText.trim();
    return `${this.keyText} {${body ? " " + body + " " : ""}}`;
  }
  set cssText(_value) {
  }
};
var CSSNestedDeclarations = class extends CSSRule {
  style;
  constructor(styleDeclarations) {
    super();
    this.style = new CSSStyleDeclaration(styleDeclarations);
    this.style.parentRule = this;
  }
  get type() {
    return 17;
  }
  // The CSSNestedDeclarations Interface
  get cssText() {
    return this.style.cssText;
  }
  set cssText(_value) {
  }
};
var CSSFontFaceRule = class extends CSSRule {
  style;
  constructor(styleDeclarations) {
    super();
    this.style = new CSSStyleDeclaration(styleDeclarations);
    this.style.parentRule = this;
  }
  get type() {
    return 5;
  }
  get cssText() {
    const body = this.style.cssText.trim();
    return `@font-face {${body ? " " + body + " " : ""}}`;
  }
  set cssText(_value) {
  }
};
var CSSPageDescriptors = class extends CSSStyleDeclaration {
};
var CSSMarginDescriptors = class extends CSSStyleDeclaration {
};
var CSSMarginRule = class extends CSSRule {
  name;
  style;
  constructor(name, declarations) {
    super();
    this.name = name;
    this.style = new CSSMarginDescriptors(declarations);
    this.style.parentRule = this;
  }
  get type() {
    return 9;
  }
  // CSSRule.MARGIN_RULE
  get cssText() {
    const body = this.style.cssText.trim();
    return `@${this.name} {${body ? " " + body + " " : ""}}`;
  }
  set cssText(_value) {
  }
};
var CSSImportRule = class extends CSSRule {
  href;
  media;
  styleSheet = null;
  layerName = null;
  supportsText = null;
  constructor(href, mediaText = "", layerName = null, supportsText = null) {
    super();
    this.href = href;
    this.media = new MediaList(mediaText);
    this.layerName = layerName;
    this.supportsText = supportsText;
  }
  get type() {
    return 3;
  }
  // CSSRule.IMPORT_RULE
  get cssText() {
    let text = `@import url("${this.href}")`;
    if (this.layerName !== null) {
      text += this.layerName ? ` layer(${this.layerName})` : ` layer`;
    }
    if (this.supportsText !== null) {
      text += ` supports(${this.supportsText})`;
    }
    const mediaStr = this.media.mediaText;
    if (mediaStr) {
      text += ` ${mediaStr}`;
    }
    return text + `;`;
  }
  set cssText(_value) {
  }
};
var CSSNamespaceRule = class extends CSSRule {
  namespaceURI;
  prefix;
  constructor(prefix, namespaceURI) {
    super();
    this.prefix = prefix;
    this.namespaceURI = namespaceURI;
  }
  get type() {
    return 10;
  }
  // CSSRule.NAMESPACE_RULE
  get cssText() {
    if (this.prefix) {
      return `@namespace ${this.prefix} url("${this.namespaceURI}");`;
    }
    return `@namespace url("${this.namespaceURI}");`;
  }
  set cssText(_value) {
  }
};
var CSSPageRule = class extends CSSGroupingRule {
  selectorText;
  style;
  constructor(selectorText, declarations, rules, parseRuleInBlock2) {
    super(rules, parseRuleInBlock2);
    this.selectorText = selectorText;
    this.style = new CSSPageDescriptors(declarations);
    this.style.parentRule = this;
  }
  get type() {
    return 6;
  }
  get cssText() {
    const sel = this.selectorText ? this.selectorText + " " : "";
    const declsStr = this.style.cssText.trim();
    const rulesStr = this._rules.map((r) => r.cssText).join("\n").trim();
    let bodyText = "";
    if (declsStr && rulesStr) {
      bodyText = declsStr + "\n" + rulesStr;
    } else {
      bodyText = declsStr || rulesStr;
    }
    if (!bodyText) return `@page ${sel}{ }`;
    const indentedBody = bodyText.split("\n").map((line) => "  " + line).join("\n");
    return `@page ${sel}{
${indentedBody}
}`;
  }
  set cssText(_value) {
  }
};
var CSSPropertyRule = class extends CSSRule {
  name;
  syntax;
  inherits;
  initialValue;
  constructor(name, syntax, inherits, initialValue) {
    super();
    this.name = name;
    this.syntax = syntax;
    this.inherits = inherits;
    this.initialValue = initialValue;
  }
  get type() {
    return 18;
  }
  get cssText() {
    let body = `syntax: ${serializeString(this.syntax)}; inherits: ${this.inherits};`;
    if (this.initialValue !== null) {
      body += ` initial-value: ${this.initialValue};`;
    }
    return `@property ${this.name} { ${body} }`;
  }
  set cssText(_value) {
  }
};
var CSSAtRule = class extends CSSRule {
  name;
  prelude;
  // ComponentValue[] is handled dynamically
  block;
  // SimpleBlock
  childRules;
  constructor(name, prelude, block, childRules) {
    super();
    this.name = name;
    this.prelude = prelude;
    this.block = block;
    this.childRules = childRules;
  }
  get type() {
    switch (this.name) {
      case "import":
        return CSSRule.IMPORT_RULE;
      case "charset":
        return CSSRule.CHARSET_RULE;
      case "namespace":
        return CSSRule.NAMESPACE_RULE;
      case "page":
        return CSSRule.PAGE_RULE;
      case "font-face":
        return CSSRule.FONT_FACE_RULE;
      case "supports":
        return CSSRule.SUPPORTS_RULE;
      case "layer":
        return 0;
      // Not strictly defined in old CSSOM
      default:
        return 0;
    }
  }
  get cssText() {
    const cond = this.prelude.length > 0 ? " " + serialize(this.prelude).trim() : "";
    if (!this.block) return `@${this.name}${cond};`;
    const childRules = this.childRules || [];
    if (childRules.length > 0) {
      return serializeGroupingRule(this.name, cond.trim(), childRules);
    }
    const blockContentText = serialize(this.block.value).trim();
    if (!blockContentText) return `@${this.name}${cond} { }`;
    const indentedBody = blockContentText.split("\n").map((line) => "  " + line).join("\n");
    return `@${this.name}${cond} {
${indentedBody}
}`;
  }
};

// src/TokenStream.ts
var ArrayTokenStream = class {
  tokens;
  index = 0;
  constructor(tokens) {
    this.tokens = tokens;
  }
  next() {
    const token = this.peek();
    if (token.type !== "EOF") {
      this.index++;
    }
    return token;
  }
  peek() {
    return this.tokens[this.index] || { type: "EOF", value: "" };
  }
};
var ArrayComponentValueStream = class {
  values;
  index = 0;
  constructor(values) {
    this.values = values;
  }
  next() {
    const val = this.peek();
    if (val.type !== "EOF") {
      this.index++;
    }
    return val;
  }
  peek() {
    return this.values[this.index] || { type: "EOF", value: "" };
  }
  get position() {
    return this.index;
  }
  set position(pos) {
    this.index = pos;
  }
};

// src/SelectorParser.ts
var SelectorParser = class _SelectorParser {
  values;
  i = 0;
  constructor(values) {
    this.values = values;
  }
  get next() {
    return this.values[this.i];
  }
  consume() {
    return this.values[this.i++] || { type: "EOF", value: "" };
  }
  parse() {
    const selectors = [];
    while (this.i < this.values.length) {
      this.skipWhitespace();
      if (this.i >= this.values.length) break;
      selectors.push(this.consumeComplexSelector());
      this.skipWhitespace();
      if (this.next?.type === "comma") {
        this.consume();
      } else if (this.i < this.values.length) {
        break;
      }
    }
    return { type: "selector-list", selectors };
  }
  skipWhitespace() {
    while (this.next?.type === "whitespace") {
      this.i++;
    }
  }
  consumeComplexSelector() {
    const items = [];
    const start = this.i;
    while (this.i < this.values.length) {
      this.skipWhitespace();
      if (this.i >= this.values.length || this.next?.type === "comma") break;
      const combinator = this.tryConsumeCombinator();
      if (combinator) {
        items.push(combinator);
        continue;
      }
      const compound = this.consumeCompoundSelector();
      if (compound.selectors.length > 0) {
        if (items.length > 0 && items[items.length - 1].type === "compound-selector") {
          items.push({ type: "combinator", value: " " });
        }
        items.push(compound);
      } else {
        break;
      }
    }
    const end = this.i;
    const tokens = this.values.slice(start, end);
    return { type: "complex-selector", items, tokens };
  }
  tryConsumeCombinator() {
    const token = this.next;
    if (!token) return null;
    if (token.type === "delim") {
      const val = token.value;
      if (val === ">" || val === "+" || val === "~") {
        this.consume();
        return { type: "combinator", value: val };
      }
      if (val === "|" && this.values[this.i + 1]?.type === "delim" && this.values[this.i + 1].value === "|") {
        this.consume();
        this.consume();
        return { type: "combinator", value: "||" };
      }
    }
    return null;
  }
  isUserActionPseudoClass(name) {
    const lower = name.toLowerCase();
    return ["hover", "active", "focus", "focus-visible", "focus-within"].includes(lower);
  }
  consumeCompoundSelector() {
    const selectors = [];
    let hasPseudoElement = false;
    while (this.i < this.values.length) {
      const token = this.next;
      if (!token || token.type === "whitespace" || token.type === "comma") break;
      if (token.type === "delim") {
        const val = token.value;
        if (val === ">" || val === "+" || val === "~") break;
        if (val === "|") {
          if (hasPseudoElement) break;
          if (this.values[this.i + 1]?.type === "delim" && this.values[this.i + 1].value === "|") {
            break;
          }
          selectors.push(this.consumeTypeOrUniversalSelector());
          continue;
        }
        if (val === "*") {
          if (hasPseudoElement) break;
          selectors.push(this.consumeTypeOrUniversalSelector());
          continue;
        }
        if (val === ".") {
          if (hasPseudoElement) break;
          selectors.push(this.consumeClassSelector());
          continue;
        }
        if (val === "&") {
          if (hasPseudoElement) break;
          this.consume();
          selectors.push({ type: "nesting-selector" });
          continue;
        }
      }
      if (token.type === "hash") {
        if (hasPseudoElement) break;
        selectors.push({ type: "id-selector", name: token.value });
        this.consume();
        continue;
      }
      if (token.type === "ident") {
        if (hasPseudoElement) break;
        selectors.push(this.consumeTypeOrUniversalSelector());
        continue;
      }
      if (token.type === "simple-block" && token.associatedToken.type === "[") {
        if (hasPseudoElement) break;
        selectors.push(this.consumeAttributeSelector());
        continue;
      }
      if (token.type === "colon") {
        const selector = this.consumePseudoSelector();
        if (hasPseudoElement) {
          if (selector.type === "pseudo-element-selector" || selector.type !== "pseudo-class-selector" || !this.isUserActionPseudoClass(selector.name)) {
            break;
          }
        }
        if (selector.type === "pseudo-element-selector") {
          hasPseudoElement = true;
        }
        selectors.push(selector);
        continue;
      }
      break;
    }
    return { type: "compound-selector", selectors };
  }
  consumeTypeOrUniversalSelector() {
    let namespace = void 0;
    const token = this.next;
    if (token.type === "ident" && this.values[this.i + 1]?.type === "delim" && this.values[this.i + 1].value === "|") {
      namespace = token.value;
      this.i += 2;
    } else if (token.type === "delim" && token.value === "*" && this.values[this.i + 1]?.type === "delim" && this.values[this.i + 1].value === "|") {
      namespace = "*";
      this.i += 2;
    } else if (token.type === "delim" && token.value === "|") {
      namespace = "";
      this.i += 1;
    }
    const next = this.consume();
    if (next.type === "delim" && next.value === "*") {
      return { type: "universal-selector", namespace };
    }
    return { type: "type-selector", name: next.value, namespace };
  }
  consumeClassSelector() {
    this.consume();
    const ident = this.consume();
    if (ident.type !== "ident") return { type: "class-selector", name: "" };
    return { type: "class-selector", name: ident.value };
  }
  consumeAttributeSelector() {
    const block = this.consume();
    const vals = block.value;
    let name = "";
    let namespace = void 0;
    let operator = "";
    let value = "";
    let flags = "";
    let j = 0;
    while (j < vals.length && vals[j].type === "whitespace") j++;
    if (j < vals.length) {
      if (vals[j].type === "ident" && vals[j + 1]?.type === "delim" && vals[j + 1].value === "|") {
        namespace = vals[j++].value;
        j++;
      } else if (vals[j].type === "delim" && vals[j].value === "*" && vals[j + 1]?.type === "delim" && vals[j + 1].value === "|") {
        namespace = "*";
        j += 2;
      } else if (vals[j].type === "delim" && vals[j].value === "|") {
        namespace = "";
        j++;
      }
    }
    if (j < vals.length && vals[j].type === "ident") {
      name = vals[j++].value;
    }
    while (j < vals.length && vals[j].type === "whitespace") j++;
    if (j < vals.length && vals[j].type === "delim") {
      operator = vals[j++].value;
      if (j < vals.length && vals[j].type === "delim" && vals[j].value === "=") {
        operator += vals[j++].value;
      }
    }
    while (j < vals.length && vals[j].type === "whitespace") j++;
    if (j < vals.length && (vals[j].type === "string" || vals[j].type === "ident")) {
      value = vals[j++].value;
    }
    while (j < vals.length && vals[j].type === "whitespace") j++;
    if (j < vals.length && vals[j].type === "ident") {
      flags = vals[j++].value;
    }
    return { type: "attribute-selector", name, namespace, operator, value, flags };
  }
  consumePseudoSelector() {
    this.consume();
    let isPseudoElement = false;
    if (this.next?.type === "colon") {
      this.consume();
      isPseudoElement = true;
    }
    const token = this.consume();
    if (!token) return { type: "pseudo-class-selector", name: "" };
    if (token.type === "ident") {
      const name = token.value;
      if (isPseudoElement) {
        return { type: "pseudo-element-selector", name };
      }
      if (["before", "after", "first-line", "first-letter"].includes(name.toLowerCase())) {
        return { type: "pseudo-element-selector", name };
      }
      return { type: "pseudo-class-selector", name };
    } else if (token.type === "function") {
      const func = token;
      const name = func.name;
      if (isPseudoElement) {
        return { type: "pseudo-element-selector", name, argument: func.value };
      }
      if (["is", "not", "has", "where"].includes(name.toLowerCase())) {
        const subParser = new _SelectorParser(func.value);
        return { type: "pseudo-class-selector", name, argument: subParser.parse() };
      }
      if (["nth-child", "nth-last-child"].includes(name.toLowerCase())) {
        let ofIdx = -1;
        for (let k = 0; k < func.value.length; k++) {
          const v = func.value[k];
          if (v.type === "ident" && v.value.toLowerCase() === "of") {
            ofIdx = k;
            break;
          }
        }
        if (ofIdx !== -1) {
          const nth = func.value.slice(0, ofIdx);
          const subParserOf = new _SelectorParser(func.value.slice(ofIdx + 1));
          return { type: "pseudo-class-selector", name, argument: subParserOf.parse(), nth };
        }
      }
      return { type: "pseudo-class-selector", name, argument: func.value };
    }
    return { type: "pseudo-class-selector", name: "" };
  }
};

// src/specificity.ts
function calculateSpecificity(selector, parentSpecificity) {
  let list;
  if (typeof selector === "string") {
    const tokens = tokenize(selector);
    const parser = new Parser(tokens);
    const componentValues = parser.parseComponentValues();
    const selectorParser = new SelectorParser(componentValues);
    list = selectorParser.parse();
  } else {
    list = selector;
  }
  if (list.selectors.length === 1) {
    return calculateComplexSelectorSpecificity(list.selectors[0], parentSpecificity);
  }
  return list.selectors.map((complex) => calculateComplexSelectorSpecificity(complex, parentSpecificity));
}
function calculateSelectorListSpecificity(list, parentSpecificity) {
  let max = [0, 0, 0];
  for (const complex of list.selectors) {
    const current = calculateComplexSelectorSpecificity(complex, parentSpecificity);
    if (compareSpecificity(current, max) > 0) {
      max = current;
    }
  }
  return max;
}
function calculateComplexSelectorSpecificity(complex, parentSpecificity) {
  const result = [0, 0, 0];
  for (const item of complex.items) {
    if (item.type === "compound-selector") {
      const compound = calculateCompoundSelectorSpecificity(item, parentSpecificity);
      result[0] += compound[0];
      result[1] += compound[1];
      result[2] += compound[2];
    }
  }
  return result;
}
function calculateCompoundSelectorSpecificity(compound, parentSpecificity) {
  const result = [0, 0, 0];
  for (const simple of compound.selectors) {
    const s = calculateSimpleSelectorSpecificity(simple, parentSpecificity);
    result[0] += s[0];
    result[1] += s[1];
    result[2] += s[2];
  }
  return result;
}
function calculateSimpleSelectorSpecificity(simple, parentSpecificity) {
  switch (simple.type) {
    case "id-selector":
      return [1, 0, 0];
    case "class-selector":
    case "attribute-selector":
      return [0, 1, 0];
    case "type-selector":
    case "pseudo-element-selector":
      return [0, 0, 1];
    case "universal-selector":
      return [0, 0, 0];
    case "nesting-selector":
      return parentSpecificity || [0, 0, 0];
    case "pseudo-class-selector":
      return calculatePseudoClassSpecificity(simple, parentSpecificity);
    default:
      return [0, 0, 0];
  }
}
function calculatePseudoClassSpecificity(pseudo, parentSpecificity) {
  const name = pseudo.name.toLowerCase();
  if (name === "where") {
    return [0, 0, 0];
  }
  if (["is", "not", "has", "matches"].includes(name)) {
    if (pseudo.argument && typeof pseudo.argument === "object" && "type" in pseudo.argument && pseudo.argument.type === "selector-list") {
      return calculateSelectorListSpecificity(pseudo.argument, parentSpecificity);
    }
    return [0, 0, 0];
  }
  if (["nth-child", "nth-last-child"].includes(name)) {
    let argSpec = [0, 0, 0];
    if (pseudo.argument && typeof pseudo.argument === "object" && "type" in pseudo.argument && pseudo.argument.type === "selector-list") {
      argSpec = calculateSelectorListSpecificity(pseudo.argument, parentSpecificity);
    }
    return [argSpec[0], argSpec[1] + 1, argSpec[2]];
  }
  return [0, 1, 0];
}
function compareSpecificity(a, b) {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  return a[2] - b[2];
}

// src/cascade.ts
function getCascadedStyle(element, rules) {
  const matchedRules = [];
  let order = 0;
  const walkRules = (ruleList, parentSelector = "") => {
    for (let i = 0; i < ruleList.length; i++) {
      const rule = ruleList[i];
      if (rule.type === CSSRule.STYLE_RULE) {
        const styleRule = rule;
        const resolvedSelector = resolveNestedSelector(styleRule.selectorText, parentSelector);
        const matchingSpecificity = getMatchingSpecificity(element, resolvedSelector);
        if (matchingSpecificity) {
          matchedRules.push({ rule: styleRule, specificity: matchingSpecificity, order: order++ });
        }
        if (styleRule.cssRules && styleRule.cssRules.length > 0) {
          walkRules(styleRule.cssRules, resolvedSelector);
        }
      } else if (rule.type === CSSRule.MEDIA_RULE || rule.type === CSSRule.SUPPORTS_RULE || rule.type === CSSRule.CONTAINER_RULE) {
        walkRules(rule.cssRules, parentSelector);
      }
    }
  };
  walkRules(rules);
  matchedRules.sort((a, b) => {
    const specDiff = compareSpecificity(a.specificity, b.specificity);
    if (specDiff !== 0) return specDiff;
    return a.order - b.order;
  });
  const declarations = /* @__PURE__ */ new Map();
  for (const { rule } of matchedRules) {
    const style = rule.style;
    for (let i = 0; i < style.length; i++) {
      const name = style.item(i);
      const value = style.getPropertyValue(name);
      const priority = style.getPropertyPriority(name);
      const isImportant = priority === "important";
      const existing = declarations.get(name);
      if (!existing || isImportant || !existing.important) {
        declarations.set(name, { value, important: isImportant });
      }
    }
  }
  const result = {};
  for (const [name, { value }] of declarations) {
    result[name] = value;
  }
  return result;
}
function resolveNestedSelector(selector, parentSelector) {
  if (!parentSelector) return selector;
  const tokens = tokenize(selector);
  const parser = new Parser(tokens);
  const componentValues = parser.parseComponentValues();
  const selectorParser = new SelectorParser(componentValues);
  const list = selectorParser.parse();
  for (const complex of list.selectors) {
    for (const item of complex.items) {
      if (item.type === "compound-selector") {
        for (let i = 0; i < item.selectors.length; i++) {
          const simple = item.selectors[i];
          if (simple.type === "nesting-selector") {
            const parentTokens = tokenize(parentSelector);
            const parentParser = new Parser(parentTokens);
            const parentComp = parentParser.parseComponentValues();
            const parentSelectorParser = new SelectorParser(parentComp);
            const parentList = parentSelectorParser.parse();
            const pseudo = {
              type: "pseudo-class-selector",
              name: "is",
              argument: parentList
            };
            item.selectors[i] = pseudo;
          }
        }
      }
    }
  }
  return serializeSelectorList(list);
}
function serializeSelectorList(list) {
  return list.selectors.map((s) => serializeComplexSelector(s)).join(", ");
}
function serializeComplexSelector(complex) {
  return complex.items.map((item) => {
    if (item.type === "combinator") return item.value === " " ? " " : ` ${item.value} `;
    return item.selectors.map((s) => serializeSimpleSelector(s)).join("");
  }).join("");
}
function serializeSimpleSelector(simple) {
  switch (simple.type) {
    case "type-selector":
      return simple.name;
    case "universal-selector":
      return "*";
    case "id-selector":
      return `#${simple.name}`;
    case "class-selector":
      return `.${simple.name}`;
    case "attribute-selector":
      let attr = `[${simple.name}`;
      if (simple.operator) attr += `${simple.operator}${simple.value}`;
      if (simple.flags) attr += ` ${simple.flags}`;
      return attr + "]";
    case "pseudo-class-selector":
      let pc = `:${simple.name}`;
      if (simple.argument) {
        if ("type" in simple.argument && simple.argument.type === "selector-list") {
          pc += `(${serializeSelectorList(simple.argument)})`;
        } else {
          pc += `(${serialize(simple.argument)})`;
        }
      }
      return pc;
    case "pseudo-element-selector":
      let pe = `::${simple.name}`;
      if (simple.argument) pe += `(${serialize(simple.argument)})`;
      return pe;
    case "nesting-selector":
      return "&";
    default:
      return "";
  }
}
function getMatchingSpecificity(element, selectorText) {
  const tokens = tokenize(selectorText);
  const parser = new Parser(tokens);
  const componentValues = parser.parseComponentValues();
  const selectorParser = new SelectorParser(componentValues);
  const list = selectorParser.parse();
  let maxSpec = null;
  for (const complex of list.selectors) {
    const complexSelectorText = serialize(complex.tokens).trim();
    if (isMatchable(element) && element.matches(complexSelectorText)) {
      const spec = calculateSpecificity({ type: "selector-list", selectors: [complex] });
      const singleSpec = Array.isArray(spec[0]) ? spec[0] : spec;
      if (!maxSpec || compareSpecificity(singleSpec, maxSpec) > 0) {
        maxSpec = singleSpec;
      }
    }
  }
  return maxSpec;
}
function isMatchable(element) {
  return typeof element === "object" && element !== null && "matches" in element && typeof element.matches === "function";
}

// src/parser.ts
var Parser = class _Parser {
  tokens;
  static #customPropertyAstCache = /* @__PURE__ */ new Map();
  static #MAX_CACHE_SIZE = 1e3;
  static MARGIN_RULE_NAMES = /* @__PURE__ */ new Set([
    "top-left-corner",
    "top-left",
    "top-center",
    "top-right",
    "top-right-corner",
    "bottom-left-corner",
    "bottom-left",
    "bottom-center",
    "bottom-right",
    "bottom-right-corner",
    "left-top",
    "left-middle",
    "left-bottom",
    "right-top",
    "right-middle",
    "right-bottom"
  ]);
  static AT_RULE_HANDLERS = {
    media: (parser, rule, block, nested) => parser.handleMediaRule(rule, block, nested || false),
    "font-face": (parser, rule, block) => parser.handleFontFaceRule(rule, block),
    page: (parser, rule, block) => parser.handlePageRule(rule, block),
    property: (parser, rule, block) => parser.handlePropertyRule(rule, block),
    supports: (parser, rule, block, nested) => parser.handleGroupingAtRule(rule, block, nested || false, CSSSupportsRule),
    container: (parser, rule, block, nested) => parser.handleGroupingAtRule(rule, block, nested || false, CSSContainerRule),
    layer: (parser, rule, block, nested) => parser.handleLayerRule(rule, block, nested || false),
    "starting-style": (parser, rule, block, nested) => parser.handleGroupingAtRule(rule, block, nested || false, CSSStartingStyleRule),
    "view-transition": (parser, rule, block) => parser.handleViewTransitionRule(rule, block),
    import: (parser, rule) => parser.handleImportRule(rule),
    namespace: (parser, rule) => parser.handleNamespaceRule(rule)
  };
  getAtRuleHandler(name) {
    if (_Parser.MARGIN_RULE_NAMES.has(name)) {
      return (parser, rule, block) => parser.handleMarginRule(rule, block);
    }
    if (name === "keyframes" || name.endsWith("-keyframes")) {
      return (parser, rule, block) => parser.handleKeyframesRule(rule, block);
    }
    return _Parser.AT_RULE_HANDLERS[name];
  }
  isSupportedAtRule(name) {
    if (name === "mediaall") return false;
    if (name.startsWith("--")) return false;
    return true;
  }
  options;
  constructor(tokens, options = {}) {
    this.options = options;
    if (Array.isArray(tokens)) {
      this.tokens = new ArrayTokenStream(tokens);
    } else {
      this.tokens = tokens;
    }
  }
  get nextToken() {
    return this.tokens.peek();
  }
  consumeToken() {
    return this.tokens.next();
  }
  discardToken() {
    this.tokens.next();
  }
  /**
   * Parse a list of component values.
   * @see https://drafts.csswg.org/css-syntax-3/#parse-a-list-of-component-values
   */
  // 5.4.9 Parse a list of component values https://drafts.csswg.org/css-syntax/#parse-list-of-component-values
  parseComponentValues() {
    const values = [];
    while (this.nextToken.type !== "EOF") {
      values.push(this.consumeComponentValue());
    }
    return values;
  }
  /**
   * Parse a stylesheet.
   * @see https://drafts.csswg.org/css-syntax-3/#parse-a-stylesheet
   */
  // 5.4.3 Parse a stylesheet https://drafts.csswg.org/css-syntax/#parse-stylesheet
  parseStyleSheet() {
    const rules = this.consumeListOfRules(true);
    return new CSSStyleSheet(rules, parseRule2);
  }
  parseRule(ruleString) {
    const tokens = tokenize(ruleString);
    const parser = new _Parser(tokens);
    return parser.consumeRule();
  }
  /**
   * Parse a list of declarations (style attribute value).
   * @see https://drafts.csswg.org/css-syntax-3/#parse-a-list-of-declarations
   */
  // 5.4.5 Parse a list of declarations https://drafts.csswg.org/css-syntax/#parse-block-contents
  parseStyleAttribute() {
    const componentValues = this.parseComponentValues();
    const declarations = this.consumeDeclarationsFromBlockContents(componentValues);
    return new CSSStyleDeclaration(declarations);
  }
  /**
   * Consume a list of rules.
   * @see https://drafts.csswg.org/css-syntax-3/#consume-list-of-rules
   */
  // 5.5.1 Consume a stylesheet's contents https://drafts.csswg.org/css-syntax/#consume-stylesheet-contents
  consumeListOfRules(topLevel) {
    const rules = [];
    while (true) {
      const token = this.nextToken;
      if (token.type === "whitespace") {
        this.discardToken();
      } else if (token.type === "EOF") {
        return rules;
      } else if (token.type === "CDO" || token.type === "CDC") {
        if (topLevel) {
          this.discardToken();
        } else {
          this.consumeComponentValue();
        }
      } else {
        const rule = this.consumeRule();
        if (rule) rules.push(rule);
      }
    }
  }
  /**
   * Consume a rule.
   * @see https://drafts.csswg.org/css-syntax-3/#consume-rule
   * // 5.4.6 https://drafts.csswg.org/css-syntax/#parse-rule
   */
  consumeRule(nested = false) {
    if (this.nextToken.type === "at-keyword") {
      return this.consumeAtRule(nested);
    } else {
      return this.consumeQualifiedRule(nested);
    }
  }
  /**
   * Consume an at-rule.
   * @see https://drafts.csswg.org/css-syntax-3/#consume-at-rule
   */
  // 5.5.2 Consume an at-rule https://drafts.csswg.org/css-syntax/#consume-at-rule
  consumeAtRule(nested = false) {
    const token = this.consumeToken();
    const atRuleName = token.value;
    const rule = {
      type: "at-rule",
      name: token.value,
      prelude: [],
      childRules: []
    };
    while (true) {
      const next = this.nextToken;
      if (next.type === "semicolon" || next.type === "EOF") {
        this.discardToken();
        if (!this.isSupportedAtRule(atRuleName)) return null;
        const handler = this.getAtRuleHandler(atRuleName);
        if (handler) {
          return handler(this, rule);
        }
        return new CSSAtRule(rule.name, rule.prelude);
      } else if (next.type === "}") {
        if (nested) return null;
        this.consumeToken();
        rule.prelude.push(next);
      } else if (next.type === "{") {
        const block = this.consumeBlock(this.consumeToken());
        if (!this.isSupportedAtRule(atRuleName)) return null;
        const handler = this.getAtRuleHandler(atRuleName);
        if (handler) {
          return handler(this, rule, block, nested);
        }
        if (this.options?.atRules?.[atRuleName]) {
          const type = this.options.atRules[atRuleName];
          if (type === "declaration") {
            const decls = this.consumeDeclarationsFromBlockContents(block.value);
            rule.childRules = decls;
            return rule;
          } else if (type === "rule") {
            const rules = this.consumeListOfRulesFromValues(new ArrayComponentValueStream(block.value), true);
            rule.childRules = rules;
            return rule;
          }
        }
        return new CSSAtRule(rule.name, rule.prelude, block);
      } else {
        rule.prelude.push(this.consumeComponentValue());
      }
    }
  }
  consumeListOfRulesFromValues(stream, nested = false) {
    const rules = [];
    while (true) {
      const val = stream.peek();
      if (val.type === "whitespace" || val.type === "CDO" || val.type === "CDC") {
        stream.next();
      } else if (val.type === "EOF") {
        break;
      } else if (val.type === "at-keyword") {
        const pos = stream.position;
        const atRule = this.consumeAtRuleFromStream(stream, nested);
        if (atRule) {
          rules.push(atRule);
        } else {
          stream.position = pos;
          this.skipToNextSemicolonOrBlock(stream);
        }
      } else {
        const pos = stream.position;
        const rule = this.consumeNestedQualifiedRuleFromStream(stream, nested);
        if (rule) {
          rules.push(rule);
        } else {
          stream.position = pos;
          this.skipToNextSemicolonOrBlock(stream);
        }
      }
    }
    return rules;
  }
  consumeNestedRules(block, nested) {
    return this.consumeBlockContents(new ArrayComponentValueStream(block.value), nested);
  }
  handleMediaRule(rule, block, nested) {
    return this.handleGroupingAtRule(rule, block, nested, CSSMediaRule);
  }
  handleGroupingAtRule(rule, block, nested, ctor) {
    if (!block) return null;
    const childRules = this.consumeNestedRules(block, nested);
    return new ctor(serialize(rule.prelude).trim(), childRules, parseRuleInBlock);
  }
  handleLayerRule(rule, block, nested = false) {
    if (block) {
      return this.handleGroupingAtRule(rule, block, nested, CSSLayerBlockRule);
    }
    const nameList = serialize(rule.prelude).trim().split(",").map((s) => s.trim()).filter((s) => s.length > 0);
    return new CSSLayerStatementRule(nameList);
  }
  handleViewTransitionRule(rule, block) {
    const declarations = this.consumeDeclarationsFromBlockContents(block.value);
    return new CSSViewTransitionRule(declarations);
  }
  handleKeyframesRule(rule, block) {
    const childRules = this.consumeNestedRules(block, false);
    const keyframeRules = childRules.map((childRule) => {
      if (typeof childRule.type === "number" && childRule.type === CSSRule.STYLE_RULE) {
        const styleRule = childRule;
        return new CSSKeyframeRule(styleRule.selectorText, styleRule.style.declarations);
      }
      return null;
    }).filter((r) => r !== null);
    return new CSSKeyframesRule(serialize(rule.prelude).trim(), keyframeRules);
  }
  handleFontFaceRule(rule, block) {
    const declarations = this.consumeDeclarationsFromBlockContents(block.value);
    return new CSSFontFaceRule(declarations);
  }
  handlePageRule(rule, block) {
    const blockContents = this.consumeBlockContents(new ArrayComponentValueStream(block.value), true);
    const declarations = [];
    const nestedRules = [];
    let isFirst = true;
    for (const item of blockContents) {
      if (isFirst && item.type === CSSRule.NESTED_DECLARATIONS_RULE) {
        declarations.push(...item.style.declarations);
      } else {
        nestedRules.push(item);
      }
      isFirst = false;
    }
    return new CSSPageRule(serialize(rule.prelude).trim(), declarations, nestedRules, parseRule2);
  }
  handleMarginRule(rule, block) {
    const declarations = this.consumeDeclarationsFromBlockContents(block.value);
    return new CSSMarginRule(rule.name, declarations);
  }
  handlePropertyRule(rule, block) {
    const prelude = rule.prelude;
    let name = "";
    for (const v of prelude) {
      if (v.type === "whitespace") continue;
      if (v.type === "ident" && v.value.startsWith("--")) {
        name = v.value;
        break;
      }
    }
    if (!name) return null;
    const declarations = this.consumeDeclarationsFromBlockContents(block.value);
    let syntax = null;
    let inherits = null;
    let initialValue = null;
    for (const d of declarations) {
      const val = serialize(d.value).trim();
      if (d.name === "syntax") {
        if (d.value.length > 0) {
          const first = d.value.find((v) => v.type !== "whitespace");
          if (first && first.type === "string") {
            syntax = first.value;
          } else {
            syntax = val;
          }
        }
      } else if (d.name === "inherits") {
        if (val === "true") inherits = true;
        else if (val === "false") inherits = false;
      } else if (d.name === "initial-value") {
        initialValue = val;
      }
    }
    if (syntax === null || inherits === null) return null;
    try {
      PropertyRegistry.validate({
        name,
        syntax,
        inherits,
        initialValue: initialValue ?? void 0
      });
    } catch (e) {
      return null;
    }
    return new CSSPropertyRule(name, syntax, inherits, initialValue);
  }
  handleImportRule(rule) {
    let href = "";
    let mediaText = "";
    let layerName = null;
    let supportsText = null;
    const prelude = rule.prelude;
    let i = 0;
    while (i < prelude.length && prelude[i].type === "whitespace") i++;
    if (i < prelude.length) {
      const first = prelude[i];
      if (first.type === "string") {
        href = first.value;
        i++;
      } else if (first.type === "function" && first.name === "url") {
        const urlArg = first.value.find((v) => v.type === "string");
        if (urlArg) href = urlArg.value;
        else {
          const raw = first.value.map((v) => serialize([v])).join("");
          href = raw.trim();
        }
        i++;
      }
    }
    let remaining = "";
    while (i < prelude.length) {
      remaining += serialize([prelude[i]]);
      i++;
    }
    mediaText = remaining.trim();
    return new CSSImportRule(href, mediaText, layerName, supportsText);
  }
  handleNamespaceRule(rule) {
    let prefix = "";
    let namespaceURI = "";
    const prelude = rule.prelude;
    let i = 0;
    while (i < prelude.length && prelude[i].type === "whitespace") i++;
    if (i < prelude.length && prelude[i].type === "ident") {
      prefix = prelude[i].value;
      i++;
    }
    while (i < prelude.length && prelude[i].type === "whitespace") i++;
    if (i < prelude.length) {
      const val = prelude[i];
      if (val.type === "string") {
        namespaceURI = val.value;
      } else if (val.type === "function" && val.name === "url") {
        const urlArg = val.value.find((v) => v.type === "string");
        if (urlArg) namespaceURI = urlArg.value;
        else {
          const raw = val.value.map((v) => serialize([v])).join("");
          namespaceURI = raw.trim();
        }
      }
    }
    return new CSSNamespaceRule(prefix, namespaceURI);
  }
  /**
   * Consume a qualified rule.
   * @see https://drafts.csswg.org/css-syntax-3/#consume-qualified-rule
   */
  // 5.5.3 Consume a qualified rule https://drafts.csswg.org/css-syntax/#consume-qualified-rule
  consumeQualifiedRule(nested = false) {
    const prelude = [];
    while (true) {
      const next = this.nextToken;
      if (next.type === "EOF") {
        return null;
      } else if (next.type === "}") {
        if (nested) return null;
        this.consumeToken();
        prelude.push(next);
      } else if (next.type === "{") {
        let firstNonWs;
        let secondNonWs;
        let idx = 0;
        while (idx < prelude.length && prelude[idx].type === "whitespace") idx++;
        if (idx < prelude.length) firstNonWs = prelude[idx++];
        while (idx < prelude.length && prelude[idx].type === "whitespace") idx++;
        if (idx < prelude.length) secondNonWs = prelude[idx++];
        if (firstNonWs && firstNonWs.type === "ident" && firstNonWs.value.startsWith("--") && secondNonWs && secondNonWs.type === "colon") {
          this.consumeBlock(this.consumeToken());
          return null;
        }
        const block = this.consumeBlock(this.consumeToken());
        return this.createStyleRule(prelude, block.value);
      } else {
        prelude.push(this.consumeComponentValue());
      }
    }
  }
  /**
   * Consume a list of declarations.
   * @see https://drafts.csswg.org/css-syntax-3/#consume-list-of-declarations
   */
  // 5.5.5 Consume a block's contents https://drafts.csswg.org/css-syntax/#consume-block-contents
  consumeDeclarationsFromBlockContents(values) {
    const rules = this.consumeBlockContents(new ArrayComponentValueStream(values), true);
    const declarations = [];
    for (const rule of rules) {
      if (rule.type === CSSRule.NESTED_DECLARATIONS_RULE) {
        declarations.push(...rule.style.declarations);
      }
    }
    return declarations;
  }
  consumeBlockContents(stream, nested = false) {
    const rules = [];
    let decls = [];
    const flushDecls = () => {
      if (decls.length > 0) {
        rules.push(new CSSNestedDeclarations(decls));
        decls = [];
      }
    };
    while (true) {
      const val = stream.peek();
      if (val.type === "whitespace" || val.type === "semicolon" || val.type === "CDO" || val.type === "CDC") {
        stream.next();
      } else if (val.type === "EOF") {
        break;
      } else if (val.type === "at-keyword") {
        flushDecls();
        const pos = stream.position;
        const atRule = this.consumeAtRuleFromStream(stream, nested);
        if (atRule) {
          rules.push(atRule);
        } else {
          stream.position = pos;
          this.skipToNextSemicolonOrBlock(stream);
        }
      } else {
        const pos = stream.position;
        const decl = this.consumeDeclarationFromStream(stream);
        if (decl) {
          decls.push(decl);
        } else {
          stream.position = pos;
          flushDecls();
          const rule = this.consumeNestedQualifiedRuleFromStream(stream, nested);
          if (rule) {
            rules.push(rule);
          } else {
            stream.position = pos;
            this.skipToNextSemicolonOrBlock(stream);
          }
        }
      }
    }
    flushDecls();
    return rules;
  }
  consumeDeclarationFromStream(stream) {
    const firstValue = stream.peek();
    if (firstValue.type !== "ident") return null;
    stream.next();
    const name = firstValue.value;
    while (stream.peek().type === "whitespace") {
      stream.next();
    }
    if (stream.peek().type !== "colon") {
      return null;
    }
    stream.next();
    while (stream.peek().type === "whitespace") {
      stream.next();
    }
    const declValue = [];
    while (true) {
      const val = stream.peek();
      if (val.type === "EOF" || val.type === "semicolon") {
        break;
      }
      declValue.push(stream.next());
    }
    if (!name.startsWith("--")) {
      const hasCurlyBlock = declValue.some((v) => v.type === "simple-block" && v.associatedToken.value === "{");
      if (hasCurlyBlock) {
        return null;
      }
    }
    let important = false;
    let lastIndex = declValue.length - 1;
    const lastNonWsIndex = (end) => {
      let j = end;
      while (j >= 0 && declValue[j].type === "whitespace") {
        j--;
      }
      return j;
    };
    const i1 = lastNonWsIndex(lastIndex);
    if (i1 >= 0 && declValue[i1].type === "ident" && declValue[i1].value.toLowerCase() === "important") {
      const i2 = lastNonWsIndex(i1 - 1);
      if (i2 >= 0 && declValue[i2].type === "delim" && declValue[i2].value === "!") {
        important = true;
        let removeStart = i2;
        while (removeStart > 0 && declValue[removeStart - 1].type === "whitespace") {
          removeStart--;
        }
        declValue.splice(removeStart);
      }
    }
    if (name.startsWith("--")) {
      if (!this.validateCustomPropertyValue(declValue)) {
        return null;
      }
    } else if (name.toLowerCase() === "unicode-range") {
      const text = getOriginalText(declValue);
      const reTokens = tokenize(text, true);
      const reParser = new _Parser(reTokens);
      const reParsed = reParser.parseComponentValues();
      declValue.splice(0, declValue.length, ...reParsed);
    }
    return {
      type: "declaration",
      name,
      value: declValue,
      important
    };
  }
  validateCustomPropertyValue(values, topLevel = true) {
    for (const v of values) {
      if (v.type === "bad-string" || v.type === "bad-url") return false;
      if (v.type === ")" || v.type === "]" || v.type === "}") return false;
      if (topLevel && v.type === "delim" && v.value === "!") return false;
      if (v.type === "simple-block") {
        if (!this.validateCustomPropertyValue(v.value, false)) return false;
      } else if (v.type === "function") {
        const func = v;
        if (!this.validateCustomPropertyValue(func.value, false)) return false;
        if (func.name.toLowerCase() === "var") {
          const firstArg = func.value.find((val) => val.type !== "whitespace");
          if (!firstArg || firstArg.type !== "ident" || !firstArg.value.startsWith("--")) {
            return false;
          }
        }
      }
    }
    return true;
  }
  consumeNestedQualifiedRuleFromStream(stream, nested = true) {
    const prelude = [];
    while (true) {
      const val = stream.peek();
      if (val.type === "EOF" || val.type === "}") {
        return null;
      }
      if (val.type === "simple-block" && val.associatedToken.type === "{") {
        stream.next();
        let firstNonWs;
        let secondNonWs;
        let idx = 0;
        while (idx < prelude.length && prelude[idx].type === "whitespace") idx++;
        if (idx < prelude.length) firstNonWs = prelude[idx++];
        while (idx < prelude.length && prelude[idx].type === "whitespace") idx++;
        if (idx < prelude.length) secondNonWs = prelude[idx++];
        if (firstNonWs && firstNonWs.type === "ident" && firstNonWs.value.startsWith("--") && secondNonWs && secondNonWs.type === "colon") {
          return null;
        }
        const block = val;
        const rule = this.createStyleRule(prelude, block.value, nested);
        if (!rule) return null;
        return rule;
      } else {
        prelude.push(stream.next());
      }
    }
  }
  consumeAtRuleFromStream(stream, nested = false) {
    const token = stream.next();
    if (token.type !== "at-keyword") return null;
    const atRuleName = token.value;
    const rule = {
      type: "at-rule",
      name: atRuleName,
      prelude: [],
      childRules: []
    };
    while (true) {
      const val = stream.peek();
      if (val.type === "semicolon") {
        stream.next();
        if (!this.isSupportedAtRule(atRuleName)) return null;
        const handler = this.getAtRuleHandler(atRuleName);
        if (handler) {
          const handledRule = handler(this, rule);
          if (!handledRule) return null;
          return handledRule;
        }
        return new CSSAtRule(rule.name, rule.prelude);
      } else if (val.type === "EOF" || val.type === "}") {
        return null;
      } else if (val.type === "simple-block" && val.associatedToken.type === "{") {
        stream.next();
        const block = val;
        if (!this.isSupportedAtRule(atRuleName)) return null;
        const handler = this.getAtRuleHandler(atRuleName);
        if (handler) {
          const handledRule = handler(this, rule, block, nested);
          if (!handledRule) return null;
          return handledRule;
        }
        rule.childRules = this.consumeBlockContents(new ArrayComponentValueStream(block.value), nested);
        const cssRules = rule.childRules.map((r) => r);
        return new CSSAtRule(rule.name, rule.prelude, block, cssRules);
      } else {
        rule.prelude.push(stream.next());
      }
    }
    if (!this.isSupportedAtRule(atRuleName)) return null;
    return new CSSAtRule(rule.name, rule.prelude);
  }
  skipToNextSemicolonOrBlock(stream) {
    while (true) {
      const val = stream.next();
      if (val.type === "EOF" || val.type === "semicolon" || val.type === "simple-block" && val.associatedToken.type === "{") {
        break;
      }
    }
  }
  isValidSelector(prelude) {
    let start = 0;
    let end = prelude.length - 1;
    while (start <= end && prelude[start].type === "whitespace") start++;
    while (end >= start && prelude[end].type === "whitespace") end--;
    if (start > end) return false;
    for (let i = start; i <= end; i++) {
      const val = prelude[i];
      if (val.type === "number" || val.type === "dimension") {
        return false;
      }
    }
    const lastToken = prelude[end];
    if (lastToken.type === "delim" && (lastToken.value === "." || lastToken.value === "#")) {
      return false;
    }
    if (lastToken.type === "colon") {
      return false;
    }
    for (let i = start; i <= end; i++) {
      const val = prelude[i];
      if (val.type === "delim" && val.value === ".") {
        let next = i + 1;
        if (next > end || prelude[next].type !== "ident") {
          return false;
        }
      }
      if (val.type === "delim" && val.value === "#") {
        return false;
      }
      if (val.type === "colon") {
        let next = i + 1;
        if (next <= end) {
          const nextVal = prelude[next];
          if (nextVal.type !== "ident" && nextVal.type !== "function" && nextVal.type !== "colon") {
            return false;
          }
        }
      }
    }
    return true;
  }
  createStyleRule(prelude, blockValue, isNested = false) {
    const blockContents = this.consumeBlockContents(new ArrayComponentValueStream(blockValue), true);
    const declarations = [];
    const nestedRules = [];
    let isFirst = true;
    for (const item of blockContents) {
      if (isFirst && item.type === CSSRule.NESTED_DECLARATIONS_RULE) {
        declarations.push(...item.style.declarations);
      } else {
        nestedRules.push(item);
      }
      isFirst = false;
    }
    let selectorText = "";
    let selectorAST = null;
    if (isNested) {
      selectorText = this.normalizeNestedSelector(prelude);
      if (selectorText === "") return null;
      selectorAST = _Parser.parseSelectorAST(selectorText);
    } else {
      if (!this.isValidSelector(prelude)) return null;
      selectorAST = new SelectorParser(prelude).parse();
      selectorText = serialize(prelude).trim();
    }
    return new CSSStyleRule(selectorText, declarations, nestedRules, parseRuleInBlock, selectorAST);
  }
  // ... (normalizeNestedSelector, consumeBlock, etc.)
  static parseSelectorAST(text) {
    const tokens = tokenize(text);
    const parser = new _Parser(tokens);
    const prelude = [];
    while (true) {
      const next = parser.nextToken;
      if (next.type === "EOF") {
        break;
      } else if (next.type === "{" || next.type === "}" || next.type === "at-keyword") {
        return null;
      } else {
        prelude.push(parser.consumeComponentValue());
      }
    }
    return new SelectorParser(prelude).parse();
  }
  normalizeNestedSelector(prelude) {
    const segments = [];
    let currentSegment = [];
    for (const val of prelude) {
      if (val.type === "delim" && val.value === ",") {
        segments.push(currentSegment);
        currentSegment = [];
      } else {
        currentSegment.push(val);
      }
    }
    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }
    const normalizedSegments = segments.map((segment) => {
      let start = 0;
      while (start < segment.length && segment[start].type === "whitespace") {
        start++;
      }
      let end = segment.length - 1;
      while (end >= start && segment[end].type === "whitespace") {
        end--;
      }
      const trimmed = segment.slice(start, end + 1);
      if (trimmed.length === 0) return null;
      for (let j = 0; j < trimmed.length - 1; j++) {
        if (trimmed[j].type === "delim" && trimmed[j].value === "&" && trimmed[j + 1].type === "ident") {
          return null;
        }
      }
      const containsAmpersand = trimmed.some((val) => val.type === "delim" && val.value === "&");
      const startsWithCombinator = trimmed.length > 0 && (trimmed[0].type === "delim" && [">", "+", "~"].includes(trimmed[0].value) || trimmed[0].type === "delim" && trimmed[0].value === "|" && trimmed[1]?.type === "delim" && trimmed[1].value === "|");
      if (startsWithCombinator) {
        return "& " + serialize(trimmed);
      } else if (!containsAmpersand) {
        return "& " + serialize(trimmed);
      } else {
        return serialize(trimmed);
      }
    });
    if (normalizedSegments.some((s) => s === null)) return "";
    return normalizedSegments.join(", ");
  }
  /**
   * Consume a simple block.
   * @see https://drafts.csswg.org/css-syntax-3/#consume-block
   */
  // 5.5.9 Consume a simple block https://drafts.csswg.org/css-syntax/#consume-simple-block
  consumeBlock(startToken) {
    const block = {
      type: "simple-block",
      associatedToken: startToken,
      value: []
    };
    const mirror = this.getMirrorToken(startToken.type);
    while (true) {
      const next = this.nextToken;
      if (next.type === mirror) {
        this.discardToken();
        return block;
      } else if (next.type === "EOF") {
        return block;
      } else {
        block.value.push(this.consumeComponentValue());
      }
    }
  }
  /**
   * Consume a function.
   * @see https://drafts.csswg.org/css-syntax-3/#consume-function
   */
  // 5.5.10 Consume a function https://drafts.csswg.org/css-syntax/#consume-function
  consumeFunction(nameToken) {
    const func = {
      type: "function",
      name: nameToken.value,
      value: []
    };
    while (true) {
      const next = this.nextToken;
      if (next.type === ")") {
        this.discardToken();
        return func;
      } else if (next.type === "EOF") {
        return func;
      } else {
        func.value.push(this.consumeComponentValue());
      }
    }
  }
  getMirrorToken(type) {
    if (type === "{") return "}";
    if (type === "[") return "]";
    if (type === "(") return ")";
    return "";
  }
  /**
   * Consume a component value.
   * @see https://drafts.csswg.org/css-syntax-3/#consume-component-value
   */
  // 5.5.8 Consume a component value https://drafts.csswg.org/css-syntax/#consume-component-value
  consumeComponentValue() {
    const token = this.consumeToken();
    if (token.type === "{" || token.type === "[" || token.type === "(") {
      return this.consumeBlock(token);
    } else if (token.type === "function") {
      return this.consumeFunction(token);
    } else {
      return token;
    }
  }
  static parseSelector(text) {
    const tokens = tokenize(text);
    const parser = new _Parser(tokens);
    const prelude = [];
    while (true) {
      const next = parser.nextToken;
      if (next.type === "EOF") {
        break;
      } else if (next.type === "{" || next.type === "}" || next.type === "at-keyword") {
        return null;
      } else {
        prelude.push(parser.consumeComponentValue());
      }
    }
    const filteredPrelude = prelude;
    const selector = serialize(filteredPrelude).trim();
    return selector || null;
  }
  static parseRuleText(text) {
    const tokens = tokenize(text);
    const parser = new _Parser(tokens);
    const rule = parser.consumeRule();
    if (!rule) throw new DOMException("Syntax error", "SyntaxError");
    while (parser.nextToken.type === "whitespace") {
      parser.discardToken();
    }
    if (parser.nextToken.type !== "EOF") {
      throw new DOMException("Syntax error", "SyntaxError");
    }
    return rule;
  }
  static parseStyleSheetText(text) {
    const tokens = tokenize(text);
    const parser = new _Parser(tokens);
    return parser.consumeListOfRules(true);
  }
  static parseRuleInBlockText(text) {
    const wrapped = `{ ${text} }`;
    const tokens = tokenize(wrapped);
    const parser = new _Parser(tokens);
    const block = parser.consumeBlock(parser.consumeToken());
    const contents = parser.consumeBlockContents(new ArrayComponentValueStream(block.value));
    if (contents.length !== 1) {
      throw new DOMException("Syntax error", "SyntaxError");
    }
    return contents[0];
  }
  static calculateSpecificity(selector) {
    return calculateSpecificity(selector);
  }
  static getCascadedStyle(element, rules) {
    return getCascadedStyle(element, rules);
  }
  /**
   * Resolves a CSS value string by expanding var() functions using the provided style declaration.
   * @see https://drafts.csswg.org/css-variables-1/#using-variables
   */
  static resolveVariables(style, property, envMap) {
    const value = style.getPropertyValue(property);
    if (!value) return "";
    return _Parser.#resolveVariablesInString(style, value, /* @__PURE__ */ new Set(), envMap);
  }
  static #resolveVariablesInString(style, value, seen, envMap) {
    const tokens = tokenize(value);
    const parser = new _Parser(tokens);
    const componentValues = parser.parseComponentValues();
    const resolved = _Parser.#resolveVariablesInComponentValues(style, componentValues, seen, envMap);
    return serialize(resolved);
  }
  static #resolveVariablesInComponentValues(style, values, seen, envMap) {
    const result = [];
    for (const v of values) {
      result.push(..._Parser.#resolveOneVariable(style, v, seen, envMap));
    }
    return result;
  }
  static #resolveOneVariable(style, v, seen, envMap) {
    if (v.type === "function" && v.name === "var") {
      return _Parser.#resolveVarFunction(style, v, seen, envMap);
    }
    if (v.type === "function" && v.name === "env") {
      return _Parser.#resolveEnvFunction(style, v, seen, envMap);
    }
    if (v.type === "function") {
      const fn = v;
      return [{
        ...fn,
        value: _Parser.#resolveVariablesInComponentValues(style, fn.value, seen, envMap)
      }];
    }
    if (v.type === "simple-block") {
      const block = v;
      return [{
        ...block,
        value: _Parser.#resolveVariablesInComponentValues(style, block.value, seen, envMap)
      }];
    }
    return [v];
  }
  /**
   * @see https://drafts.csswg.org/css-variables-1/#replace-a-var
   */
  static #resolveVarFunction(style, fn, seen, envMap) {
    const args = fn.value.filter((v) => v.type !== "whitespace" && v.type !== "comment");
    if (args.length === 0 || args[0].type !== "ident" || !args[0].value.startsWith("--")) {
      return [];
    }
    const varName = args[0].value;
    if (seen.has(varName)) return [];
    const commaIdx = fn.value.findIndex((v) => v.type === "comma");
    const fallback = commaIdx !== -1 ? fn.value.slice(commaIdx + 1) : [];
    const rawValue = style.getPropertyValue(varName);
    if (rawValue && rawValue.trim() !== "") {
      seen.add(varName);
      let componentValues = _Parser.#customPropertyAstCache.get(rawValue);
      if (!componentValues) {
        const tokens = tokenize(rawValue);
        const parser = new _Parser(tokens);
        componentValues = parser.parseComponentValues();
        if (_Parser.#customPropertyAstCache.size >= _Parser.#MAX_CACHE_SIZE) {
          const firstKey = _Parser.#customPropertyAstCache.keys().next().value;
          if (firstKey !== void 0) {
            _Parser.#customPropertyAstCache.delete(firstKey);
          }
        }
        _Parser.#customPropertyAstCache.set(rawValue, componentValues);
      }
      const resolved = _Parser.#resolveVariablesInComponentValues(style, componentValues, seen, envMap);
      seen.delete(varName);
      return resolved;
    }
    if (fallback.length > 0) {
      return _Parser.#resolveVariablesInComponentValues(style, fallback, seen, envMap);
    }
    return [];
  }
  /**
   * @see https://drafts.csswg.org/css-env-1/#env-function
   */
  static #resolveEnvFunction(style, fn, seen, envMap) {
    const identIdx = fn.value.findIndex((v) => v.type === "ident");
    if (identIdx === -1) return [fn];
    const envName = fn.value[identIdx].value;
    const indices = [];
    for (let i = identIdx + 1; i < fn.value.length; i++) {
      const v = fn.value[i];
      if (v.type === "comma") break;
      if (v.type === "number") {
        indices.push(v.value.toString());
      }
    }
    const fullKey = indices.length > 0 ? `${envName} ${indices.join(" ")}` : envName;
    const rawValue = envMap?.[fullKey];
    const commaIdx = fn.value.findIndex((v) => v.type === "comma");
    const fallback = commaIdx !== -1 ? fn.value.slice(commaIdx + 1) : [];
    if (rawValue !== void 0) {
      const tokens = tokenize(rawValue);
      const parser = new _Parser(tokens);
      const componentValues = parser.parseComponentValues();
      return _Parser.#resolveVariablesInComponentValues(style, componentValues, seen, envMap);
    }
    if (fallback.length > 0) {
      return _Parser.#resolveVariablesInComponentValues(style, fallback, seen, envMap);
    }
    return [];
  }
};
function parseRule2(text) {
  return Parser.parseRuleText(text);
}
function parseRuleInBlock(text) {
  return Parser.parseRuleInBlockText(text);
}
ParseHooks.parseStyleAttribute = (tokens) => new Parser(tokens).parseStyleAttribute();
ParseHooks.consumeRule = (tokens) => new Parser(tokens).consumeRule();
ParseHooks.consumeListOfRules = (tokens, topLevel) => new Parser(tokens).consumeListOfRules(topLevel);
ParseHooks.parseComponentValues = (tokens) => new Parser(tokens).parseComponentValues();
ParseHooks.parseSelector = (text) => Parser.parseSelector(text);
ParseHooks.parseSelectorAST = (text) => Parser.parseSelectorAST(text);

// src/streaming-tokenizer.ts
var NeedMoreDataError = class extends Error {
  constructor() {
    super("Need more data");
    this.name = "NeedMoreDataError";
  }
};
var StreamingTokenizer = class extends AbstractTokenizer {
  codePoints = [];
  pos = 0;
  isEOF = false;
  tokens = [];
  remnant = "";
  constructor() {
    super();
  }
  appendChunk(chunk) {
    const text = this.preprocessChunk(chunk, false);
    if (text.length > 0) {
      const newCodePoints = Array.from(text).map((c) => {
        const cp = c.codePointAt(0);
        if (cp === void 0) {
          throw new Error("Unexpected undefined code point");
        }
        return cp;
      });
      this.codePoints.push(...newCodePoints);
    }
    this.tokenizeLoop();
  }
  close() {
    this.isEOF = true;
    const text = this.preprocessChunk("", true);
    if (text.length > 0) {
      const newCodePoints = Array.from(text).map((c) => {
        const cp = c.codePointAt(0);
        if (cp === void 0) {
          throw new Error("Unexpected undefined code point");
        }
        return cp;
      });
      this.codePoints.push(...newCodePoints);
    }
    this.tokenizeLoop();
  }
  getTokens() {
    const result = [...this.tokens];
    this.tokens = [];
    if (this.pos > 0) {
      this.codePoints = this.codePoints.slice(this.pos);
      this.pos = 0;
    }
    return result;
  }
  preprocessChunk(chunk, isLast) {
    let text = this.remnant + chunk;
    this.remnant = "";
    if (!isLast && text.endsWith("\r")) {
      this.remnant = "\r";
      text = text.slice(0, -1);
    }
    return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\f/g, "\n").replace(/\u0000/g, "\uFFFD");
  }
  tokenizeLoop() {
    while (true) {
      const startPos = this.pos;
      try {
        const token = this.consumeToken();
        token.startIndex = startPos;
        token.endIndex = this.pos;
        token.originalText = String.fromCodePoint(...this.codePoints.slice(startPos, token.endIndex));
        this.tokens.push(token);
        if (token.type === "EOF") {
          break;
        }
      } catch (e) {
        if (e instanceof NeedMoreDataError) {
          this.pos = startPos;
          break;
        }
        throw e;
      }
    }
  }
  get cp() {
    if (this.pos >= this.codePoints.length) {
      if (this.isEOF) return -1;
      throw new NeedMoreDataError();
    }
    return this.codePoints[this.pos];
  }
  peek(offset) {
    const index = this.pos + offset;
    if (index >= this.codePoints.length) {
      if (this.isEOF) return -1;
      throw new NeedMoreDataError();
    }
    return this.codePoints[index];
  }
  consume() {
    const cp = this.cp;
    if (cp !== -1) {
      this.pos++;
    }
    return cp;
  }
  reconsume() {
    if (this.pos > 0) {
      this.pos--;
    }
  }
  slice(start, end) {
    return String.fromCodePoint(...this.codePoints.slice(start, end));
  }
  getPosition() {
    return this.pos;
  }
};
export {
  CSS,
  CSSAtRule,
  CSSColorValue,
  CSSContainerRule,
  CSSFontFaceRule,
  CSSGroupingRule,
  CSSHSL,
  CSSImageValue,
  CSSImportRule,
  CSSKeyframeRule,
  CSSKeyframesRule,
  CSSKeywordValue,
  CSSLayerBlockRule,
  CSSLayerStatementRule,
  CSSMarginDescriptors,
  CSSMarginRule,
  CSSMathClamp,
  CSSMathFunction,
  CSSMathInvert,
  CSSMathMax,
  CSSMathMin,
  CSSMathNegate,
  CSSMathProduct,
  CSSMathSum,
  CSSMathValue,
  CSSMatrixComponent,
  CSSMediaRule,
  CSSNamespaceRule,
  CSSNestedDeclarations,
  CSSNumericArray,
  CSSNumericNode,
  CSSNumericValue2 as CSSNumericValue,
  CSSPageDescriptors,
  CSSPageRule,
  CSSParserAtRule,
  CSSParserBlock,
  CSSParserDeclaration,
  CSSParserFunction,
  CSSParserQualifiedRule,
  CSSParserRule,
  CSSParserToken,
  CSSParserValue,
  CSSPerspective,
  CSSPropertyRule,
  CSSRGB,
  CSSRotate,
  CSSRule,
  CSSRuleList,
  CSSScale,
  CSSSkew,
  CSSSkewX,
  CSSSkewY,
  CSSStartingStyleRule,
  CSSStyleDeclaration,
  CSSStyleRule,
  CSSStyleSheet,
  CSSStyleValue,
  CSSSupportsRule,
  CSSTransformComponent,
  CSSTransformValue,
  CSSTranslate,
  CSSUnitValue,
  CSSUnparsedValue,
  CSSVariableReferenceValue,
  CSSViewTransitionRule,
  MediaList,
  Parser,
  StreamingTokenizer,
  StylePropertyMap,
  StylePropertyMapReadOnly,
  StyleSheetList,
  createCSSStyleValue,
  parseCommaValueListSync,
  parseDeclarationList,
  parseDeclarationListSync,
  parseDeclarationSync,
  parseRule,
  parseRuleList,
  parseRuleListSync,
  parseRuleSync,
  parseStylesheet,
  parseStylesheetSync,
  parseValueListSync,
  parseValueSync,
  serialize,
  tokenize
};
