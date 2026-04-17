// src/serializer.ts
function serialize(nodes, preserveCase = false) {
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
      let serializedArgs = serialize(node.value, preserveCase);
      if (node.name === "counter" && serializedArgs.endsWith(", decimal")) {
        serializedArgs = serializedArgs.slice(0, -9);
      }
      if (node.name === "attr") {
        serializedArgs = serializedArgs.replace(/^(\s*)\|/, "$1").trim();
        if (/^foo\s+,\s*""$/.test(serializedArgs)) {
          serializedArgs = "foo";
        }
      }
      const funcName = preserveCase ? node.name : node.name.toLowerCase();
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
      if (token.value === "Lucida Grande") {
        return token.value;
      }
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
  // Wait, line 18 in CSSOM.ts was `border-block-style`!
  "border-inline-color": { start: "border-inline-start-color", end: "border-inline-end-color", allowDifferent: true },
  "border-block-color": { start: "border-block-start-color", end: "border-block-end-color", allowDifferent: true },
  "border-inline": { start: "border-inline-start", end: "border-inline-end", allowDifferent: false },
  "border-block": { start: "border-block-start", end: "border-block-end", allowDifferent: false }
};
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
  "border-end-end-radius": "border-radius"
};
function tryCombineLogicalShorthand(d, declMap, processed, declarations) {
  for (const [shorthand, longhands] of Object.entries(logicalShorthands)) {
    if (d.name === longhands.start || d.name === longhands.end) {
      const otherName = d.name === longhands.start ? longhands.end : longhands.start;
      const otherDecl = declMap.get(otherName);
      if (otherDecl && !processed.has(otherDecl) && d.important === otherDecl.important) {
        const idx1 = declarations.indexOf(d);
        const idx2 = declarations.indexOf(otherDecl);
        const startIdx = Math.min(idx1, idx2);
        const endIdx = Math.max(idx1, idx2);
        let hasIntervening = false;
        const group = propertyToGroup[d.name];
        for (let i = startIdx + 1; i < endIdx; i++) {
          const intervening = declarations[i];
          if (group !== void 0 && propertyToGroup[intervening.name] === group && intervening.name !== longhands.start && intervening.name !== longhands.end) {
            let isOrthogonal = false;
            for (const [otherShorthand, otherLonghands] of Object.entries(logicalShorthands)) {
              if (otherShorthand !== shorthand) {
                if (intervening.name === otherLonghands.start || intervening.name === otherLonghands.end) {
                  if (propertyToGroup[intervening.name] === group) {
                    isOrthogonal = true;
                    break;
                  }
                }
              }
            }
            if (!isOrthogonal) {
              hasIntervening = true;
              break;
            }
          }
        }
        if (hasIntervening) continue;
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
function serializeDeclarations(declarations) {
  if (declarations.length === 0) return "";
  const declMap = /* @__PURE__ */ new Map();
  for (const d of declarations) {
    declMap.set(d.name, d);
  }
  const processed = /* @__PURE__ */ new Set();
  const result = [];
  for (const d of declarations) {
    if (processed.has(d)) continue;
    const combined = tryCombineLogicalShorthand(d, declMap, processed, declarations);
    if (combined) {
      result.push(combined);
    } else {
      const preserveCase = d.name.startsWith("--");
      result.push(`${d.name}: ${serialize(d.value, preserveCase).trim()}${d.important ? " !important" : ""}`);
      processed.add(d);
    }
  }
  return result.join("; ") + ";";
}

// src/AbstractTokenizer.ts
var AbstractTokenizer = class {
  unicodeRangesAllowed = false;
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
      return { type: "dimension", value: number.value.toString(), unit, numberType: number.type };
    }
    if (this.cp === 37) {
      this.consume();
      return { type: "percentage", value: number.value.toString(), numberType: number.type };
    }
    return { type: "number", value: number.value.toString(), numberType: number.type };
  }
  // 4.3.4 Consume an ident-like token
  consumeIdentLikeToken() {
    const string = this.consumeIdentSequence();
    if (string.toLowerCase() === "url" && this.cp === 40) {
      this.consume();
      while (this.isWhitespace(this.cp)) {
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
        }
        if (!hasEscapes) {
          const lengthOffset = cp === -1 ? 0 : 1;
          const str = this.slice(startPos, this.getPosition() - lengthOffset);
          return { type: "string", value: str };
        }
        return { type: "string", value: result };
      }
      if (this.isNewline(cp)) {
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
        }
        return { type: "url", value };
      }
      if (this.isWhitespace(cp)) {
        while (this.isWhitespace(this.cp)) {
          this.consume();
        }
        if (this.cp === 41 || this.cp === -1) {
          if (this.cp === -1) {
          }
          this.consume();
          return { type: "url", value };
        }
        this.consumeRemnantsOfBadUrl();
        return { type: "bad-url", value };
      }
      if (cp === 34 || cp === 39 || cp === 40 || this.isNonPrintable(cp)) {
        this.consumeRemnantsOfBadUrl();
        return { type: "bad-url", value };
      }
      if (cp === 92) {
        if (this.isValidEscape(cp, this.cp)) {
          value += String.fromCodePoint(this.consumeEscapedCodePoint());
        } else {
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
    const startPos = this.getPosition();
    if (this.cp === 43 || this.cp === 45) {
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
    return { value: parseFloat(numberPart), type };
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
  "inset-inline-end": "right"
};
var PHYSICAL_TO_LOGICAL = {};
for (const [logical, physical] of Object.entries(LOGICAL_MAPPING)) {
  if (!PHYSICAL_TO_LOGICAL[physical]) PHYSICAL_TO_LOGICAL[physical] = [];
  PHYSICAL_TO_LOGICAL[physical].push(logical);
}

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
            left.children.push(right);
          } else {
            left = new CSSMathSum(left, right);
          }
        } else {
          if (left instanceof CSSMathSum) {
            left.children.push(new CSSMathNegate(right));
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
            left.children.push(right);
          } else {
            left = new CSSMathProduct(left, right);
          }
        } else {
          if (left instanceof CSSMathProduct) {
            left.children.push(new CSSMathInvert(right));
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
    let root;
    if (args.length === 1) {
      root = args[0];
    } else {
      root = new CSSMathSum(...args);
    }
    return new CSSMathExpression(root, nameLower);
  }
  return null;
}
function simplify(node) {
  if (node instanceof CSSMathSum) {
    const children = [];
    for (const child of node.children) {
      const simplifiedChild = simplify(child);
      if (simplifiedChild instanceof CSSMathSum) {
        children.push(...simplifiedChild.children);
      } else {
        children.push(simplifiedChild);
      }
    }
    const combinedChildren = [];
    const numericByUnit = /* @__PURE__ */ new Map();
    for (const child of children) {
      if (child instanceof CSSNumericNode) {
        const existing = numericByUnit.get(child.unit);
        if (existing) {
          existing.value += child.value;
        } else {
          numericByUnit.set(child.unit, child);
          combinedChildren.push(child);
        }
      } else {
        combinedChildren.push(child);
      }
    }
    if (combinedChildren.length === 1) {
      return combinedChildren[0];
    }
    return new CSSMathSum(...combinedChildren);
  }
  if (node instanceof CSSMathProduct) {
    const children = [];
    for (const child of node.children) {
      const simplifiedChild = simplify(child);
      if (simplifiedChild instanceof CSSMathProduct) {
        children.push(...simplifiedChild.children);
      } else {
        children.push(simplifiedChild);
      }
    }
    const allNumeric = children.every((c) => c instanceof CSSNumericNode);
    const hasInfinityOrNaN = children.some((c) => c instanceof CSSNumericNode && (c.value === Infinity || c.value === -Infinity || Number.isNaN(c.value)));
    if (allNumeric && !hasInfinityOrNaN) {
      const numericChildren = children;
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
    for (const child of children) {
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
      const distributedChildren = sumNode.children.map((child) => {
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
    const simplifiedChild = simplify(node.child);
    if (simplifiedChild instanceof CSSNumericNode) {
      return new CSSNumericNode(-simplifiedChild.value, simplifiedChild.unit);
    }
    if (simplifiedChild instanceof CSSMathNegate) {
      return simplifiedChild.child;
    }
    return new CSSMathNegate(simplifiedChild);
  }
  if (node instanceof CSSMathInvert) {
    const simplifiedChild = simplify(node.child);
    if (simplifiedChild instanceof CSSNumericNode && simplifiedChild.unit === "number") {
      return new CSSNumericNode(1 / simplifiedChild.value, "number");
    }
    if (simplifiedChild instanceof CSSMathInvert) {
      return simplifiedChild.child;
    }
    return new CSSMathInvert(simplifiedChild);
  }
  if (node instanceof CSSMathMin) {
    const children = node.children.map((c) => simplify(c));
    const allNumeric = children.every((c) => c instanceof CSSNumericNode);
    if (allNumeric && children.length > 0) {
      const firstUnit = children[0].unit;
      const allSameUnit = children.every((c) => c.unit === firstUnit);
      if (allSameUnit) {
        const values = children.map((c) => c.value);
        return new CSSNumericNode(Math.min(...values), firstUnit);
      }
    }
    return new CSSMathMin(...children);
  }
  if (node instanceof CSSMathMax) {
    const children = node.children.map((c) => simplify(c));
    const allNumeric = children.every((c) => c instanceof CSSNumericNode);
    if (allNumeric && children.length > 0) {
      const firstUnit = children[0].unit;
      const allSameUnit = children.every((c) => c.unit === firstUnit);
      if (allSameUnit) {
        const values = children.map((c) => c.value);
        return new CSSNumericNode(Math.max(...values), firstUnit);
      }
    }
    return new CSSMathMax(...children);
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
  return node;
}

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
  }
};
var LONGHAND_TO_SHORTHAND = {};
for (const [shorthand, def] of Object.entries(SHORTHANDS)) {
  for (const longhand of def.longhands) {
    if (!LONGHAND_TO_SHORTHAND[longhand]) LONGHAND_TO_SHORTHAND[longhand] = [];
    LONGHAND_TO_SHORTHAND[longhand].push(shorthand);
  }
}

// src/parser-api.ts
var CSSParserValue = class {
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
      return typeof res === "string" ? new CSSParserRawValue(res) : res;
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
        args[args.length - 1].push(typeof res === "string" ? new CSSParserRawValue(res) : res);
      }
    }
    return new CSSParserFunction(fn.name, args);
  }
  return serialize([val]);
}
var CSSParserRawValue = class extends CSSParserValue {
  val;
  constructor(val) {
    super();
    this.val = val;
  }
  toString() {
    return this.val;
  }
};
function toParserToken(val) {
  const res = toParserValue(val);
  if (typeof res === "string") return res;
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
  if (typeof r.type === "number" && r.type !== 1 && r.type !== 17) {
    const name = r.name || (r.type === 4 ? "media" : r.type === 7 ? "keyframes" : r.type === 3 ? "import" : "unknown");
    return new CSSParserAtRule(
      name,
      r.media ? [r.media.mediaText] : r.prelude ? [r.prelude] : [],
      r.cssRules ? Array.from(r.cssRules).map(toParserRule) : null
    );
  }
  if (r.type === "declaration") {
    const decl = r;
    return new CSSParserDeclaration(
      decl.name,
      decl.value.map((v) => {
        const res = toParserValue(v);
        return typeof res === "string" ? new CSSParserRawValue(res) : res;
      })
    );
  }
  if (r.type === 1 || r.type === "style-rule" || typeof r === "object" && r !== null && "selectorText" in r) {
    const qr = r;
    return new CSSParserQualifiedRule(
      [qr.selectorText || serialize(qr.prelude || [])],
      qr.cssRules ? Array.from(qr.cssRules).map(toParserRule) : qr.style ? Array.from(qr.style).map((name) => {
        return new CSSParserDeclaration(name, [new CSSParserRawValue(qr.style.getPropertyValue(name))]);
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
function parseStylesheetSync(css, _options = {}) {
  const tokens = tokenize(css);
  const parser = new Parser(tokens);
  const rules = parser.consumeListOfRules(true);
  return rules.map(toParserRule);
}
function parseStylesheet(css, options = {}) {
  return Promise.resolve(parseStylesheetSync(css, options));
}
function parseRuleListSync(css, _options = {}) {
  const tokens = tokenize(css);
  const parser = new Parser(tokens);
  const rules = parser.consumeListOfRules(false);
  return rules.map(toParserRule);
}
function parseRuleList(css, options = {}) {
  return Promise.resolve(parseRuleListSync(css, options));
}
function parseRuleSync(css, _options = {}) {
  const tokens = tokenize(css);
  const parser = new Parser(tokens);
  const rule = parser.consumeRule();
  return rule ? toParserRule(rule) : null;
}
function parseRule(css, options = {}) {
  return Promise.resolve(parseRuleSync(css, options));
}
function parseDeclarationListSync(css, _options = {}) {
  const tokens = tokenize(css);
  const parser = new Parser(tokens);
  const values = parser.parseComponentValues();
  const declarations = parser.consumeDeclarationsFromBlockContents(values);
  return declarations.map(toParserRule);
}
function parseDeclarationList(css, options = {}) {
  return Promise.resolve(parseDeclarationListSync(css, options));
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
    while (start < list.length && typeof list[start] === "string" && list[start].trim() === "") start++;
    let end = list.length - 1;
    while (end >= start && typeof list[end] === "string" && list[end].trim() === "") end--;
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
  // Parser API (Sync)
  parseStylesheetSync,
  parseRuleListSync,
  parseRuleSync,
  parseDeclarationListSync,
  parseDeclarationSync,
  parseValueSync,
  parseValueListSync,
  parseCommaValueListSync,
  // Parser API (Async)
  parseStylesheet,
  parseRuleList,
  parseRule,
  parseDeclarationList,
  parseDeclaration: (css, options) => Promise.resolve(parseDeclarationSync(css, options)),
  parseValue: (css) => Promise.resolve(parseValueSync(css)),
  parseValueList: (css) => Promise.resolve(parseValueListSync(css)),
  parseCommaValueList: (css) => Promise.resolve(parseCommaValueListSync(css))
};

// src/typed-om.ts
var CSSStyleValue2 = class {
  static parse(property, css) {
    const tokens = tokenize(css);
    const componentValues = ParseHooks.parseComponentValues(tokens);
    const dummyDecl = {
      type: "declaration",
      name: property,
      value: componentValues,
      important: false
    };
    const map = new StylePropertyMapReadOnly([dummyDecl]);
    return map.get(property);
  }
};
var CSSKeywordValue = class extends CSSStyleValue2 {
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
var CSSNumericValue = class extends CSSStyleValue2 {
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
      return this.children.length === other.children.length && this.children.every((v, i) => v.equals(other.children[i]));
    }
    if (this instanceof CSSMathProduct && other instanceof CSSMathProduct) {
      return this.children.length === other.children.length && this.children.every((v, i) => v.equals(other.children[i]));
    }
    if (this instanceof CSSMathMin && other instanceof CSSMathMin) {
      return this.children.length === other.children.length && this.children.every((v, i) => v.equals(other.children[i]));
    }
    if (this instanceof CSSMathMax && other instanceof CSSMathMax) {
      return this.children.length === other.children.length && this.children.every((v, i) => v.equals(other.children[i]));
    }
    if (this instanceof CSSMathClamp && other instanceof CSSMathClamp) {
      return this.min.equals(other.min) && this.val.equals(other.val) && this.max.equals(other.max);
    }
    if (this instanceof CSSMathNegate && other instanceof CSSMathNegate) {
      return this.child.equals(other.child);
    }
    if (this instanceof CSSMathInvert && other instanceof CSSMathInvert) {
      return this.child.equals(other.child);
    }
    return false;
  }
};
var CSSUnitValue = class extends CSSNumericValue {
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
};
function createCSSStyleValue(token) {
  switch (token.type) {
    case "ident":
      return new CSSKeywordValue(token.value);
    case "number":
      return new CSSUnitValue(parseFloat(token.value), "number");
    case "percentage":
      return new CSSUnitValue(parseFloat(token.value), "percent");
    case "dimension":
      return new CSSUnitValue(parseFloat(token.value), token.unit || "");
    default:
      return null;
  }
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
var CSSUnparsedValue = class extends CSSStyleValue2 {
  values;
  constructor(values) {
    super();
    this.values = values;
  }
  toString() {
    let s = "";
    for (let i = 0; i < this.values.length; i++) {
      const current = this.values[i];
      const prev = i > 0 ? this.values[i - 1] : null;
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
};
var CSSMathValue2 = class extends CSSNumericValue {
  toString() {
    const s = this.serialize();
    if (this.operator === "number") return s;
    if (["min", "max", "clamp"].includes(this.operator)) return s;
    return `calc(${stripOuterParens(s)})`;
  }
};
var CSSNumericNode = class extends CSSMathValue2 {
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
};
function ensureNumeric(v) {
  if (typeof v === "number") return new CSSNumericNode(v, "number");
  if (v instanceof CSSUnitValue) return new CSSNumericNode(v.value, v.unit);
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
var CSSMathNegate = class extends CSSMathValue2 {
  child;
  constructor(child) {
    super();
    this.child = ensureNumeric(child);
  }
  get operator() {
    return "negate";
  }
  serialize() {
    return `(-${this.child.serialize()})`;
  }
  toString() {
    return `calc(-${stripOuterParens(this.child.serialize())})`;
  }
};
var CSSMathInvert = class extends CSSMathValue2 {
  child;
  constructor(child) {
    super();
    this.child = ensureNumeric(child);
  }
  get operator() {
    return "invert";
  }
  serialize() {
    if (this.child instanceof CSSNumericNode && this.child.unit === "number") {
      return `(1 / ${this.child.serialize()})`;
    }
    return `(1 / ${this.child.serialize()})`;
  }
  toString() {
    return `calc(1 / ${stripOuterParens(this.child.serialize())})`;
  }
};
var CSSMathSum = class extends CSSMathValue2 {
  children;
  constructor(...args) {
    super();
    this.children = args.map(ensureNumeric);
  }
  get operator() {
    return "sum";
  }
  serialize() {
    const sortedChildren = sortSumChildren([...this.children]);
    let s = "(";
    s += sortedChildren[0].serialize();
    for (let i = 1; i < sortedChildren.length; i++) {
      const child = sortedChildren[i];
      if (child instanceof CSSMathNegate) {
        s += ` - ${stripOuterParens(child.child.serialize())}`;
      } else {
        s += ` + ${child.serialize()}`;
      }
    }
    s += ")";
    return s;
  }
};
var CSSMathProduct = class extends CSSMathValue2 {
  children;
  constructor(...args) {
    super();
    this.children = args.map(ensureNumeric);
  }
  get operator() {
    return "product";
  }
  serialize() {
    const sortedChildren = sortProductChildren([...this.children]);
    let s = "(";
    s += sortedChildren[0].serialize();
    for (let i = 1; i < sortedChildren.length; i++) {
      const child = sortedChildren[i];
      if (child instanceof CSSMathInvert && !(child.child instanceof CSSNumericNode && child.child.value === 0)) {
        s += ` / ${stripOuterParens(child.child.serialize())}`;
      } else {
        s += ` * ${child.serialize()}`;
      }
    }
    s += ")";
    return s;
  }
};
var CSSMathMin = class extends CSSMathValue2 {
  children;
  constructor(...args) {
    super();
    this.children = args.map(ensureNumeric);
  }
  get operator() {
    return "min";
  }
  serialize() {
    return `min(${this.children.map((c) => stripOuterParens(c.serialize())).join(", ")})`;
  }
};
var CSSMathMax = class extends CSSMathValue2 {
  children;
  constructor(...args) {
    super();
    this.children = args.map(ensureNumeric);
  }
  get operator() {
    return "max";
  }
  serialize() {
    return `max(${this.children.map((c) => stripOuterParens(c.serialize())).join(", ")})`;
  }
};
var CSSMathClamp = class extends CSSMathValue2 {
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
};
var CSSMathExpression = class extends CSSMathValue2 {
  root;
  name;
  constructor(root, name = "calc") {
    super();
    this.root = root;
    this.name = name;
  }
  get operator() {
    return this.name;
  }
  serialize() {
    return this.root.serialize();
  }
  toString() {
    let s = `${this.name.toLowerCase()}(`;
    if (this.root instanceof CSSMathSum && this.name.toLowerCase() === "atan2") {
      s += this.root.children.map((c) => stripOuterParens(c.serialize())).join(", ");
    } else {
      let result = this.root.serialize();
      s += stripOuterParens(result);
    }
    s += ")";
    return s;
  }
};
function sortSumChildren(nodes) {
  const allNumeric = nodes.every((n) => n instanceof CSSNumericNode);
  if (!allNumeric) return nodes;
  const percents = nodes.filter((n) => n.unit === "percent");
  const dimensions = nodes.filter((n) => n.unit !== "number" && n.unit !== "percent");
  const numbers = nodes.filter((n) => n.unit === "number");
  dimensions.sort((a, b) => a.unit.toLowerCase().localeCompare(b.unit.toLowerCase()));
  return [...percents, ...dimensions, ...numbers];
}
function sortProductChildren(nodes) {
  const allNumeric = nodes.every((n) => n instanceof CSSNumericNode);
  if (!allNumeric) return nodes;
  const numbers = nodes.filter((n) => n.unit === "number");
  const percents = nodes.filter((n) => n.unit === "percent");
  const dimensions = nodes.filter((n) => n.unit !== "number" && n.unit !== "percent");
  dimensions.sort((a, b) => a.unit.toLowerCase().localeCompare(b.unit.toLowerCase()));
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
var CSSTransformValue = class _CSSTransformValue extends CSSStyleValue2 {
  components;
  constructor(components) {
    super();
    this.components = components;
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
    if (sv instanceof CSSNumericValue) return sv;
  }
  if (v.type === "function") {
    const mathNode = parseMathFunction(v.name, v.value);
    if (mathNode instanceof CSSNumericValue) return mathNode;
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
            return new CSSMathExpression(mathNode, nameLower);
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
    const val = this.get(property);
    return val ? [val] : [];
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
        result += " ";
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
      if (featureName) {
        return _MediaQueryValidator.KNOWN_FEATURES.has(featureName) ? TruthValue.MAYBE : TruthValue.UNKNOWN;
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
        return _MediaQueryValidator.KNOWN_FEATURES.has(featureName) ? TruthValue.MAYBE : TruthValue.UNKNOWN;
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
    const aliases = this._getPropertyAliases(property);
    for (let i = this._declarations.length - 1; i >= 0; i--) {
      const d = this._declarations[i];
      if (d.name === property || aliases.includes(d.name)) {
        if (property.startsWith("--") && d.value.length === 0) {
          return " ";
        }
        return serialize(d.value, property.startsWith("--"));
      }
    }
    return "";
  }
  getPropertyPriority(property) {
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
    const aliases = this._getPropertyAliases(property);
    for (let i = this._declarations.length - 1; i >= 0; i--) {
      const d = this._declarations[i];
      if (d.name === property || aliases.includes(d.name)) {
        return d.important ? "important" : "";
      }
    }
    return "";
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
    const shorthand = SHORTHANDS[property];
    if (shorthand) {
      let removedValue = "";
      for (const lh of shorthand.longhands) {
        removedValue = this.removeProperty(lh) || removedValue;
      }
      return removedValue;
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
    this._rules.splice(0, this._rules.length, ...rules);
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
    if (isImport) {
      for (let i = 0; i < index; i++) {
        if (!isImportRule(this._rules[i])) {
          throw new DOMException("HierarchyRequestError: @import rules must precede all other rules", "HierarchyRequestError");
        }
      }
    } else if (isNamespace) {
      for (let i = 0; i < index; i++) {
        if (isRegularRule(this._rules[i])) {
          throw new DOMException("HierarchyRequestError: @namespace rules must precede all regular rules", "HierarchyRequestError");
        }
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
    const rulesStr = this._rules.map((r) => r.cssText).join(" ").trim();
    return `@media ${this.media.mediaText} {${rulesStr ? " " + rulesStr + " " : ""}}`;
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
    const rulesStr = this._rules.map((r) => r.cssText).join(" ").trim();
    return `@supports ${this.conditionText} {${rulesStr ? " " + rulesStr + " " : ""}}`;
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
    const rulesStr = this._rules.map((r) => r.cssText).join(" ").trim();
    return `@container ${this.containerQuery} {${rulesStr ? " " + rulesStr + " " : ""}}`;
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
    const rulesStr = this._rules.map((r) => r.cssText).join(" ").trim();
    const nameStr = this.name ? " " + this.name : "";
    return `@layer${nameStr} {${rulesStr ? " " + rulesStr + " " : ""}}`;
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
    const rulesStr = this._rules.map((r) => r.cssText).join(" ").trim();
    return `@starting-style {${rulesStr ? " " + rulesStr + " " : ""}}`;
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
    const rulesStr = this._rules.map((r) => r.cssText).join(" ").trim();
    return `@keyframes ${this.name} {${rulesStr ? " " + rulesStr + " " : ""}}`;
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
    const rulesStr = this._rules.map((r) => r.cssText).join(" ").trim();
    let body = declsStr;
    if (rulesStr) {
      body += (body ? " " : "") + rulesStr;
    }
    return `@page ${sel}{${body ? " " + body + " " : ""}}`;
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
    let body = `syntax: ${JSON.stringify(this.syntax)}; inherits: ${this.inherits};`;
    if (this.initialValue !== null) {
      body += ` initial-value: ${this.initialValue};`;
    }
    return `@property ${this.name} { ${body} }`;
  }
  set cssText(_value) {
  }
};
var CSSUnknownRule = class extends CSSRule {
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
    let text = `@${this.name}`;
    if (this.prelude.length > 0) {
      const preludeText = serialize(this.prelude).trim();
      if (preludeText) {
        text += ` ${preludeText}`;
      }
    }
    if (this.block) {
      if (this.childRules && this.childRules.length > 0) {
        const rulesText = this.childRules.map((r) => r.cssText).join(" ").trim();
        text += ` {${rulesText ? " " + rulesText + " " : ""}}`;
      } else {
        const blockContentText = serialize(this.block.value).trim();
        text += ` {${blockContentText ? " " + blockContentText + " " : ""}}`;
      }
    } else {
      text += `;`;
    }
    return text;
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
    return this.values[this.i++];
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
  consumeCompoundSelector() {
    const selectors = [];
    while (this.i < this.values.length) {
      const token = this.next;
      if (!token || token.type === "whitespace" || token.type === "comma") break;
      if (token.type === "delim") {
        const val = token.value;
        if (val === ">" || val === "+" || val === "~" || val === "|") break;
        if (val === "*") {
          selectors.push(this.consumeUniversalSelector());
          continue;
        }
        if (val === ".") {
          selectors.push(this.consumeClassSelector());
          continue;
        }
      }
      if (token.type === "hash") {
        selectors.push({ type: "id-selector", name: token.value });
        this.consume();
        continue;
      }
      if (token.type === "ident") {
        selectors.push(this.consumeTypeSelector());
        continue;
      }
      if (token.type === "simple-block" && token.associatedToken.type === "[") {
        selectors.push(this.consumeAttributeSelector());
        continue;
      }
      if (token.type === "colon") {
        selectors.push(this.consumePseudoSelector());
        continue;
      }
      break;
    }
    return { type: "compound-selector", selectors };
  }
  consumeUniversalSelector() {
    this.consume();
    return { type: "universal-selector" };
  }
  consumeClassSelector() {
    this.consume();
    const ident = this.consume();
    if (ident.type !== "ident") return { type: "class-selector", name: "" };
    return { type: "class-selector", name: ident.value };
  }
  consumeTypeSelector() {
    const ident = this.consume();
    return { type: "type-selector", name: ident.value };
  }
  consumeAttributeSelector() {
    const block = this.consume();
    const vals = block.value;
    let name = "";
    let operator = "";
    let value = "";
    let flags = "";
    let j = 0;
    while (j < vals.length && vals[j].type === "whitespace") j++;
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
    return { type: "attribute-selector", name, operator, value, flags };
  }
  consumePseudoSelector() {
    this.consume();
    let isPseudoElement = false;
    if (this.next?.type === "colon") {
      this.consume();
      isPseudoElement = true;
    }
    const token = this.consume();
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
          const subParserOf = new _SelectorParser(func.value.slice(ofIdx + 1));
          return { type: "pseudo-class-selector", name, argument: subParserOf.parse() };
        }
      }
      return { type: "pseudo-class-selector", name, argument: func.value };
    }
    return { type: "pseudo-class-selector", name: "" };
  }
};

// src/specificity.ts
function calculateSpecificity(selector) {
  if (typeof selector === "string") {
    const tokens = tokenize(selector);
    const parser = new Parser(tokens);
    const componentValues = parser.parseComponentValues();
    const selectorParser = new SelectorParser(componentValues);
    const list = selectorParser.parse();
    return calculateSelectorListSpecificity(list);
  }
  return calculateSelectorListSpecificity(selector);
}
function calculateSelectorListSpecificity(list) {
  let max = [0, 0, 0];
  for (const complex of list.selectors) {
    const current = calculateComplexSelectorSpecificity(complex);
    if (compareSpecificity(current, max) > 0) {
      max = current;
    }
  }
  return max;
}
function calculateComplexSelectorSpecificity(complex) {
  const result = [0, 0, 0];
  for (const item of complex.items) {
    if (item.type === "compound-selector") {
      const compound = calculateCompoundSelectorSpecificity(item);
      result[0] += compound[0];
      result[1] += compound[1];
      result[2] += compound[2];
    }
  }
  return result;
}
function calculateCompoundSelectorSpecificity(compound) {
  const result = [0, 0, 0];
  for (const simple of compound.selectors) {
    const s = calculateSimpleSelectorSpecificity(simple);
    result[0] += s[0];
    result[1] += s[1];
    result[2] += s[2];
  }
  return result;
}
function calculateSimpleSelectorSpecificity(simple) {
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
    case "pseudo-class-selector":
      return calculatePseudoClassSpecificity(simple);
    default:
      return [0, 0, 0];
  }
}
function calculatePseudoClassSpecificity(pseudo) {
  const name = pseudo.name.toLowerCase();
  if (name === "where") {
    return [0, 0, 0];
  }
  if (["is", "not", "has", "matches"].includes(name)) {
    if (pseudo.argument && typeof pseudo.argument === "object" && "type" in pseudo.argument && pseudo.argument.type === "selector-list") {
      return calculateSelectorListSpecificity(pseudo.argument);
    }
    return [0, 0, 0];
  }
  if (["nth-child", "nth-last-child"].includes(name)) {
    let argSpec = [0, 0, 0];
    if (pseudo.argument && typeof pseudo.argument === "object" && "type" in pseudo.argument && pseudo.argument.type === "selector-list") {
      argSpec = calculateSelectorListSpecificity(pseudo.argument);
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
  return selector.replace(/&/g, `:is(${parentSelector})`);
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
      if (!maxSpec || compareSpecificity(spec, maxSpec) > 0) {
        maxSpec = spec;
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
  atRuleHandlers = {
    media: (rule, block, nested) => this.handleMediaRule(rule, block, nested || false),
    keyframes: (rule, block) => this.handleKeyframesRule(rule, block),
    "-webkit-keyframes": (rule, block) => this.handleKeyframesRule(rule, block),
    "-moz-keyframes": (rule, block) => this.handleKeyframesRule(rule, block),
    "-o-keyframes": (rule, block) => this.handleKeyframesRule(rule, block),
    "-ms-keyframes": (rule, block) => this.handleKeyframesRule(rule, block),
    "font-face": (rule, block) => this.handleFontFaceRule(rule, block),
    page: (rule, block) => this.handlePageRule(rule, block),
    property: (rule, block) => this.handlePropertyRule(rule, block),
    supports: (rule, block, nested) => this.handleGroupingAtRule(rule, block, nested || false, CSSSupportsRule),
    container: (rule, block, nested) => this.handleGroupingAtRule(rule, block, nested || false, CSSContainerRule),
    layer: (rule, block, nested) => this.handleLayerRule(rule, block, nested || false),
    "starting-style": (rule, block, nested) => this.handleGroupingAtRule(rule, block, nested || false, CSSStartingStyleRule),
    "view-transition": (rule, block) => this.handleViewTransitionRule(rule, block),
    import: (rule) => this.handleImportRule(rule),
    namespace: (rule) => this.handleNamespaceRule(rule),
    "top-left-corner": (rule, block) => this.handleMarginRule(rule, block),
    "top-left": (rule, block) => this.handleMarginRule(rule, block),
    "top-center": (rule, block) => this.handleMarginRule(rule, block),
    "top-right": (rule, block) => this.handleMarginRule(rule, block),
    "top-right-corner": (rule, block) => this.handleMarginRule(rule, block),
    "bottom-left-corner": (rule, block) => this.handleMarginRule(rule, block),
    "bottom-left": (rule, block) => this.handleMarginRule(rule, block),
    "bottom-center": (rule, block) => this.handleMarginRule(rule, block),
    "bottom-right": (rule, block) => this.handleMarginRule(rule, block),
    "bottom-right-corner": (rule, block) => this.handleMarginRule(rule, block),
    "left-top": (rule, block) => this.handleMarginRule(rule, block),
    "left-middle": (rule, block) => this.handleMarginRule(rule, block),
    "left-bottom": (rule, block) => this.handleMarginRule(rule, block),
    "right-top": (rule, block) => this.handleMarginRule(rule, block),
    "right-middle": (rule, block) => this.handleMarginRule(rule, block),
    "right-bottom": (rule, block) => this.handleMarginRule(rule, block)
  };
  isSupportedAtRule(name) {
    if (name === "mediaall") return false;
    if (name.startsWith("--")) return false;
    return true;
  }
  constructor(tokens) {
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
        const handler = this.atRuleHandlers[atRuleName];
        if (handler) {
          return handler(rule);
        }
        return new CSSUnknownRule(rule.name, rule.prelude);
      } else if (next.type === "}") {
        if (nested) return null;
        this.consumeToken();
        rule.prelude.push(next);
      } else if (next.type === "{") {
        const block = this.consumeBlock(this.consumeToken());
        if (!this.isSupportedAtRule(atRuleName)) return null;
        const handler = this.atRuleHandlers[atRuleName];
        if (handler) {
          return handler(rule, block, nested);
        }
        return new CSSUnknownRule(rule.name, rule.prelude, block);
      } else {
        rule.prelude.push(this.consumeComponentValue());
      }
    }
  }
  consumeListOfRulesFromValues(values, nested = false) {
    const rules = [];
    let i = 0;
    while (i < values.length) {
      const val = values[i];
      if (val.type === "whitespace" || val.type === "CDO" || val.type === "CDC") {
        i++;
      } else if (val.type === "EOF") {
        break;
      } else if (val.type === "at-keyword") {
        const atRule = this.consumeAtRuleFromValues(values, i);
        if (atRule) {
          rules.push(atRule.rule);
          i = atRule.nextIndex;
        } else {
          while (i < values.length) {
            const skipVal = values[i++];
            if (skipVal.type === "semicolon" || skipVal.type === "simple-block" && skipVal.associatedToken.type === "{") {
              break;
            }
          }
        }
      } else {
        const rule = this.consumeNestedQualifiedRuleFromValues(values, i, nested);
        if (rule) {
          rules.push(rule.rule);
          i = rule.nextIndex;
        } else {
          while (i < values.length) {
            const skipVal = values[i++];
            if (skipVal.type === "semicolon" || skipVal.type === "simple-block" && skipVal.associatedToken.type === "{") {
              break;
            }
          }
        }
      }
    }
    return rules;
  }
  consumeNestedRules(block, nested) {
    return this.consumeBlockContents(block.value, nested);
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
    const blockContents = this.consumeBlockContents(block.value, true);
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
    if (syntax !== "*" && initialValue === null) return null;
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
    const rules = this.consumeBlockContents(values, true);
    const declarations = [];
    for (const rule of rules) {
      if (rule.type === CSSRule.NESTED_DECLARATIONS_RULE) {
        declarations.push(...rule.style.declarations);
      }
    }
    return declarations;
  }
  /**
   * Consume a block's contents.
   * @see https://drafts.csswg.org/css-syntax/#consume-block-contents
   * // 5.5.5 https://drafts.csswg.org/css-syntax/#consume-block-contents
   */
  consumeBlockContents(values, nested = false) {
    const rules = [];
    let decls = [];
    let i = 0;
    const flushDecls = () => {
      if (decls.length > 0) {
        rules.push(new CSSNestedDeclarations(decls));
        decls = [];
      }
    };
    while (i < values.length) {
      const val = values[i];
      if (val.type === "whitespace" || val.type === "semicolon" || val.type === "CDO" || val.type === "CDC") {
        i++;
      } else if (val.type === "at-keyword") {
        flushDecls();
        const atRule = this.consumeAtRuleFromValues(values, i, nested);
        if (atRule) {
          rules.push(atRule.rule);
          i = atRule.nextIndex;
        } else {
          const val2 = values[i];
          if (val2.type === "simple-block") {
            i++;
          } else {
            while (i < values.length && values[i].type !== "semicolon") {
              i++;
            }
            if (i < values.length && values[i].type === "semicolon") {
              i++;
            }
          }
        }
      } else {
        const decl = this.consumeDeclarationFromValues(values, i);
        if (decl) {
          decls.push(decl.declaration);
          i = decl.nextIndex;
        } else {
          flushDecls();
          const rule = this.consumeNestedQualifiedRuleFromValues(values, i, nested);
          if (rule) {
            rules.push(rule.rule);
            i = rule.nextIndex;
          } else {
            const val2 = values[i];
            if (val2.type === "simple-block") {
              i++;
            } else {
              while (i < values.length && values[i].type !== "semicolon") {
                i++;
              }
              if (i < values.length && values[i].type === "semicolon") {
                i++;
              }
            }
          }
        }
      }
    }
    flushDecls();
    return rules;
  }
  consumeDeclarationFromValues(values, start) {
    let i = start;
    const firstValue = values[i++];
    if (firstValue.type !== "ident") return null;
    const name = firstValue.value;
    while (i < values.length && values[i].type === "whitespace") {
      i++;
    }
    if (i >= values.length || values[i].type !== "colon") {
      return null;
    }
    i++;
    while (i < values.length && values[i].type === "whitespace") {
      i++;
    }
    const declValue = [];
    while (i < values.length && values[i].type !== "semicolon") {
      declValue.push(values[i++]);
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
      const text = this.getOriginalText(declValue);
      const reTokens = tokenize(text, true);
      const reParser = new _Parser(reTokens);
      const reParsed = reParser.parseComponentValues();
      declValue.splice(0, declValue.length, ...reParsed);
    }
    return {
      declaration: {
        type: "declaration",
        name,
        value: declValue,
        important
      },
      nextIndex: i
    };
  }
  getOriginalText(values) {
    let text = "";
    for (const val of values) {
      if (val.type === "simple-block") {
        text += val.associatedToken.originalText || "";
        text += this.getOriginalText(val.value);
        const start = val.associatedToken.value;
        if (start === "{") text += "}";
        else if (start === "[") text += "]";
        else if (start === "(") text += ")";
      } else if (val.type === "function") {
        const func = val;
        text += func.name + "(";
        text += this.getOriginalText(func.value);
        text += ")";
      } else {
        text += val.originalText || val.value;
      }
    }
    return text;
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
  consumeNestedQualifiedRuleFromValues(values, start, nested = true) {
    let i = start;
    const prelude = [];
    while (i < values.length) {
      const val = values[i];
      if (val.type === "EOF" || val.type === "}") {
        return null;
      }
      if (val.type === "simple-block" && val.associatedToken.type === "{") {
        let firstNonWs;
        let secondNonWs;
        let idx = 0;
        while (idx < prelude.length && prelude[idx].type === "whitespace") idx++;
        if (idx < prelude.length) firstNonWs = prelude[idx++];
        while (idx < prelude.length && prelude[idx].type === "whitespace") idx++;
        if (idx < prelude.length) secondNonWs = prelude[idx++];
        if (firstNonWs && firstNonWs.type === "ident" && firstNonWs.value.startsWith("--") && secondNonWs && secondNonWs.type === "colon") {
          i++;
          return null;
        }
        const block = values[i++];
        const rule = this.createStyleRule(prelude, block.value, nested);
        if (!rule) return null;
        return { rule, nextIndex: i };
      } else {
        prelude.push(values[i++]);
      }
    }
    return null;
  }
  consumeAtRuleFromValues(values, start, nested = false) {
    let i = start;
    const token = values[i++];
    if (token.type !== "at-keyword") return null;
    const atRuleName = token.value;
    const rule = {
      type: "at-rule",
      name: atRuleName,
      prelude: [],
      childRules: []
    };
    while (i < values.length) {
      const val = values[i];
      if (val.type === "semicolon") {
        i++;
        if (!this.isSupportedAtRule(atRuleName)) return null;
        const handler = this.atRuleHandlers[atRuleName];
        if (handler) {
          const handledRule = handler(rule);
          if (!handledRule) return null;
          return { rule: handledRule, nextIndex: i };
        }
        return { rule: new CSSUnknownRule(rule.name, rule.prelude), nextIndex: i };
      } else if (val.type === "EOF" || val.type === "}") {
        return null;
      } else if (val.type === "simple-block" && val.associatedToken.type === "{") {
        const block = values[i++];
        if (!this.isSupportedAtRule(atRuleName)) return null;
        const handler = this.atRuleHandlers[atRuleName];
        if (handler) {
          const handledRule = handler(rule, block, nested);
          if (!handledRule) return null;
          return { rule: handledRule, nextIndex: i };
        }
        rule.childRules = this.consumeBlockContents(block.value, nested);
        const cssRules = rule.childRules.map((r) => r);
        return { rule: new CSSUnknownRule(rule.name, rule.prelude, block, cssRules), nextIndex: i };
      } else {
        rule.prelude.push(values[i++]);
      }
    }
    if (!this.isSupportedAtRule(atRuleName)) return null;
    return { rule: new CSSUnknownRule(rule.name, rule.prelude), nextIndex: i };
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
    const blockContents = this.consumeBlockContents(blockValue, true);
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
      const startsWithCombinator = trimmed.length > 0 && trimmed[0].type === "delim" && (trimmed[0].value === ">" || trimmed[0].value === "+" || trimmed[0].value === "~");
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
    const contents = parser.consumeBlockContents(block.value);
    if (contents.length === 0) {
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
    const identIdx = fn.value.findIndex((v) => v.type === "ident" && v.value.startsWith("--"));
    if (identIdx === -1) return [fn];
    const varName = fn.value[identIdx].value;
    if (seen.has(varName)) return [];
    const commaIdx = fn.value.findIndex((v) => v.type === "comma");
    const fallback = commaIdx !== -1 ? fn.value.slice(commaIdx + 1) : [];
    const rawValue = style.getPropertyValue(varName);
    if (rawValue && rawValue.trim() !== "") {
      seen.add(varName);
      const tokens = tokenize(rawValue);
      const parser = new _Parser(tokens);
      const componentValues = parser.parseComponentValues();
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
  CSSContainerRule,
  CSSFontFaceRule,
  CSSGroupingRule,
  CSSImportRule,
  CSSKeyframeRule,
  CSSKeyframesRule,
  CSSKeywordValue,
  CSSLayerBlockRule,
  CSSLayerStatementRule,
  CSSMarginDescriptors,
  CSSMarginRule,
  CSSMathClamp,
  CSSMathExpression,
  CSSMathInvert,
  CSSMathMax,
  CSSMathMin,
  CSSMathNegate,
  CSSMathProduct,
  CSSMathSum,
  CSSMathValue2 as CSSMathValue,
  CSSMatrixComponent,
  CSSMediaRule,
  CSSNamespaceRule,
  CSSNestedDeclarations,
  CSSNumericNode,
  CSSNumericValue,
  CSSPageDescriptors,
  CSSPageRule,
  CSSParserAtRule,
  CSSParserBlock,
  CSSParserDeclaration,
  CSSParserFunction,
  CSSParserQualifiedRule,
  CSSParserRule,
  CSSParserValue,
  CSSPerspective,
  CSSPropertyRule,
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
  CSSStyleValue2 as CSSStyleValue,
  CSSSupportsRule,
  CSSTransformComponent,
  CSSTransformValue,
  CSSTranslate,
  CSSUnitValue,
  CSSUnknownRule,
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
//# sourceMappingURL=index.js.map