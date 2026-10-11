/*!
 * CloakJS v1.3.0 — JavaScript Obfuscator
 * https://github.com/Infinitode/CloakJS
 *
 * A single-file, dependency-free JavaScript obfuscator for browsers and Node.
 * Load with a <script> tag to register the global CloakJS, or require() it in Node.
 *
 * NOTE: CloakJS is NOT published on npm. There is a package named "cloakjs" on
 * the npm registry, but it is an unrelated AOP/Proxy library maintained by
 * someone else and installing that name does not give you this tool. Copy this
 * file straight from the repository or from jsDelivr — see README.md.
 *
 * MIT License — see LICENSE.
 */
(function (global, factory) {
  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports = factory();
  } else if (typeof define === "function" && define.amd) {
    define([], function () { return factory(); });
  } else {
    global.CloakJS = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* =========================================================================
   * 0. Metadata
   * ====================================================================== */
  var NAME = "CloakJS";
  var VERSION = "1.3.0";
  var BANNER = NAME + " v" + VERSION + " — JavaScript obfuscator · MIT License";
  var HEX = "0123456789abcdef";
  var B64_STANDARD = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  /* =========================================================================
   * 1. Randomness (optionally seeded for reproducible output)
   * ====================================================================== */
  var random = Math.random;

  function seedRandom(seed) {
    if (seed === null || seed === undefined) {
      random = Math.random;
      return;
    }
    var text = String(seed), hash = 2166136261 >>> 0, i;
    for (i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    var state = hash === 0 ? 0x9e3779b9 : hash;
    random = function () {
      state ^= state << 13; state >>>= 0;
      state ^= state >>> 17;
      state ^= state << 5; state >>>= 0;
      return state / 4294967296;
    };
  }

  function randInt(max) { return Math.floor(random() * max); }
  function chance(probability) { return random() < probability; }
  function pick(list) { return list[randInt(list.length)]; }
  function shuffle(list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = randInt(i + 1), tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  /* =========================================================================
   * 2. Identifier vocabulary
   * ====================================================================== */
  var KEYWORDS = [
    "arguments", "as", "async", "await", "break", "case", "catch", "class",
    "const", "continue", "debugger", "default", "delete", "do", "else", "enum",
    "eval", "export", "extends", "false", "finally", "for", "from", "function",
    "get", "if", "implements", "import", "in", "instanceof", "interface", "let",
    "new", "null", "of", "package", "private", "protected", "public", "return",
    "set", "static", "super", "switch", "this", "throw", "true", "try", "typeof",
    "undefined", "var", "void", "while", "with", "yield"
  ];
  var GLOBALS = [
    "window", "document", "console", "globalThis", "self", "global", "module",
    "exports", "require", "process", "__dirname", "__filename", "Math", "Object",
    "Array", "String", "Number", "Boolean", "JSON", "Date", "RegExp", "Error",
    "TypeError", "RangeError", "SyntaxError", "EvalError", "Promise", "Map",
    "Set", "WeakMap", "WeakSet", "Symbol", "Reflect", "Proxy", "Function",
    "Infinity", "NaN", "isNaN", "isFinite", "parseInt", "parseFloat",
    "encodeURIComponent", "decodeURIComponent", "encodeURI", "decodeURI",
    "setTimeout", "setInterval", "clearTimeout", "clearInterval",
    "requestAnimationFrame", "atob", "btoa", "TextEncoder", "TextDecoder",
    "Uint8Array", "Uint16Array", "Uint32Array", "Int8Array", "Int16Array",
    "Int32Array", "Float32Array", "Float64Array", "BigInt", "ArrayBuffer",
    "SharedArrayBuffer", "DataView", "Intl", "navigator", "location", "history",
    "fetch", "XMLHttpRequest", "URL", "Blob", "File", "FileReader", "FormData",
    "Headers", "Request", "Response", "localStorage", "sessionStorage",
    "structuredClone", "queueMicrotask", "performance"
  ];
  // Helper spellings emitted by previous CloakJS releases stay reserved so that
  // output never clashes with code that was obfuscated by an older version.
  var INTERNAL = [
    "_0xa", "_0xdc", "_0xord", "_0xst", "_0xbt", "_0xba", "_0xbi", "_0xb1",
    "_0xbn", "_0xbs", "_0xh", "_0xs", "_0xo", "_0xr", "_0xj", "_0xii",
    "_0xl", "_0xk", "_0xt", "_0xv", "_0xpi", "_0xd", "_0xsd", "_0xf",
    "_0xi", "_0xd1", "_0xd2", "_0xd4", "_0xd5", "_0xd6", "_0x9a", "_0xb", "_0xe"
  ];
  var RESERVED_SET = Object.create(null);
  var INTERNAL_SET = Object.create(null);
  (function () {
    var all = KEYWORDS.concat(GLOBALS).concat(INTERNAL), i;
    for (i = 0; i < all.length; i++) RESERVED_SET[all[i]] = true;
    for (i = 0; i < INTERNAL.length; i++) INTERNAL_SET[INTERNAL[i]] = true;
  })();
  var KEYWORD_SET = Object.create(null);
  for (var _ki = 0; _ki < KEYWORDS.length; _ki++) KEYWORD_SET[KEYWORDS[_ki]] = true;

  function randomHexName(len) {
    var out = randInt(2) === 0 ? "_0x" : "_$_";
    for (var i = 0; i < len; i++) out += HEX[randInt(16)];
    return out;
  }
  function randomUnicodeName(len) {
    var out = "_";
    for (var i = 0; i < len; i++) out += String.fromCharCode(0x4e00 + randInt(0x9fa5 - 0x4e00));
    return out;
  }
  function randomMixedName(len) {
    var out = "_";
    for (var i = 0; i < len; i++) {
      out += randInt(2) === 0 ? HEX[randInt(16)] : String.fromCharCode(0x4e00 + randInt(0x9fa5 - 0x4e00));
    }
    return out;
  }

  // Guarantees that generated names are unique, are not reserved words/globals
  // and never collide with anything that already appears in the input.
  function NamePool() { this.used = Object.create(null); }
  NamePool.prototype.add = function (name) {
    if (typeof name === "string" && name) this.used[name] = true;
    return name;
  };
  NamePool.prototype.name = function (len) {
    len = len || 8;
    var name, tries = 0, style;
    do {
      style = randInt(3);
      name = style === 0 ? randomHexName(len)
        : style === 1 ? randomUnicodeName(Math.max(2, len - 4))
          : randomMixedName(len);
      if (++tries > 64) { len++; tries = 0; }
    } while (this.used[name] || RESERVED_SET[name]);
    this.used[name] = true;
    return name;
  };

  /* =========================================================================
   * 3. Options, presets and validation
   * ====================================================================== */
  var optionSchema = {
    identifierMangling: "boolean",
    identifierEscaping: "boolean",
    preserveFunctionNames: "boolean",
    stringEncryption: "boolean",
    stringEncoding: ["base64", "rc4"],
    stringAlphabet: ["standard", "shuffled"],
    stringArrayShuffle: "boolean",
    stringArrayDecoys: "count",
    stringSplitting: "boolean",
    stringSplitMinLength: "count",
    stringSplitMaxParts: "count",
    numberEncoding: "boolean",
    controlFlowFlattening: "boolean",
    controlFlowThreshold: "ratio",
    deadCodeInjection: "boolean",
    deadCodeAmount: "count",
    opaquePredicates: "boolean",
    selfDefending: "boolean",
    debugProtection: "boolean",
    debugProtectionInterval: "count",
    disableConsoleOutput: "boolean",
    wrapInIife: "boolean",
    compactOutput: "boolean",
    seed: "seed"
  };

  function baseOptions() {
    return {
      identifierMangling: true,
      identifierEscaping: false,
      preserveFunctionNames: false,
      stringEncryption: true,
      stringEncoding: "rc4",
      stringAlphabet: "shuffled",
      stringArrayShuffle: true,
      stringArrayDecoys: 0,
      stringSplitting: false,
      stringSplitMinLength: 8,
      stringSplitMaxParts: 4,
      numberEncoding: true,
      controlFlowFlattening: true,
      controlFlowThreshold: 1,
      deadCodeInjection: true,
      deadCodeAmount: 3,
      opaquePredicates: true,
      selfDefending: true,
      debugProtection: false,
      debugProtectionInterval: 4000,
      disableConsoleOutput: false,
      wrapInIife: false,
      compactOutput: true,
      seed: null
    };
  }
  function makePreset(overrides) {
    var options = baseOptions();
    for (var key in overrides) {
      if (Object.prototype.hasOwnProperty.call(overrides, key)) options[key] = overrides[key];
    }
    return options;
  }

  var presets = {
    // The source is returned untouched (only surrounding whitespace is trimmed).
    off: makePreset({
      identifierMangling: false, stringEncryption: false, numberEncoding: false,
      controlFlowFlattening: false, deadCodeInjection: false, opaquePredicates: false,
      selfDefending: false
    }),
    // Renames provably local bindings only. Cheap and very safe.
    low: makePreset({
      stringEncryption: false, numberEncoding: false, controlFlowFlattening: false,
      deadCodeInjection: false, opaquePredicates: false, selfDefending: false
    }),
    // Adds encoded numbers and a Base64 string array with a runtime decoder.
    medium: makePreset({
      stringEncoding: "base64", stringAlphabet: "standard", stringArrayShuffle: false,
      controlFlowFlattening: false, deadCodeInjection: false, opaquePredicates: false,
      selfDefending: false
    }),
    // Everything that does not change observable behaviour, at default strength.
    high: makePreset({}),
    // Maximum strength: escaped identifiers, split strings, decoy array entries,
    // RC4 + shuffled alphabet, maximum flattening/decoys and a debugger trap.
    extreme: makePreset({
      identifierEscaping: true,
      stringSplitting: true,
      stringSplitMinLength: 6,
      stringSplitMaxParts: 5,
      stringArrayDecoys: 6,
      controlFlowThreshold: 1,
      deadCodeAmount: 6,
      debugProtection: true,
      debugProtectionInterval: 2500
    })
  };

  var defaultOptions = makePreset({});

  function describeOption(key) {
    var type = optionSchema[key];
    if (type === "boolean") return "must be true or false";
    if (type === "count") return "must be a non-negative integer";
    if (type === "ratio") return "must be a number between 0 and 1";
    if (type === "seed") return "must be a string, a number or null";
    if (Array.isArray(type)) return "must be one of: " + type.join(", ");
    return "is not a known option";
  }
  function checkOption(key, value) {
    var type = optionSchema[key];
    if (type === undefined) throw new TypeError(NAME + ": unknown option \"" + key + "\"");
    if (type === "boolean") {
      if (typeof value !== "boolean") throw new TypeError(NAME + ": option \"" + key + "\" " + describeOption(key));
      return;
    }
    if (type === "count") {
      if (typeof value !== "number" || !isFinite(value) || value < 0 || Math.floor(value) !== value) {
        throw new TypeError(NAME + ": option \"" + key + "\" " + describeOption(key));
      }
      return;
    }
    if (type === "ratio") {
      if (typeof value !== "number" || !isFinite(value) || value < 0 || value > 1) {
        throw new TypeError(NAME + ": option \"" + key + "\" " + describeOption(key));
      }
      return;
    }
    if (type === "seed") {
      if (value !== null && typeof value !== "string" && typeof value !== "number") {
        throw new TypeError(NAME + ": option \"" + key + "\" " + describeOption(key));
      }
      return;
    }
    if (Array.isArray(type) && type.indexOf(value) === -1) {
      throw new TypeError(NAME + ": option \"" + key + "\" " + describeOption(key));
    }
  }

  // Every preset defines every key, so resolveOptions("low") deep-equals
  // CloakJS.presets.low while still being an independent copy.
  function resolveOptions(options) {
    if (options === undefined || options === null) return Object.assign({}, defaultOptions);
    if (typeof options === "string") {
      if (!Object.prototype.hasOwnProperty.call(presets, options)) {
        throw new Error(NAME + ": unknown preset \"" + options + "\". Valid presets: " + Object.keys(presets).join(", "));
      }
      return Object.assign({}, presets[options]);
    }
    if (typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError(NAME + ": options must be a preset name or an options object");
    }
    var resolved = Object.assign({}, defaultOptions);
    for (var key in options) {
      if (!Object.prototype.hasOwnProperty.call(options, key)) continue;
      checkOption(key, options[key]);
      resolved[key] = options[key];
    }
    return resolved;
  }

  /* =========================================================================
   * 4. Encoder-side byte helpers
   * ====================================================================== */
  function byteLength(text) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text).length;
    return unescape(encodeURIComponent(text)).length; // eslint-disable-line no-restricted-globals
  }
  function utf8Bytes(value) {
    if (typeof TextEncoder !== "undefined") {
      return Array.prototype.slice.call(new TextEncoder().encode(value));
    }
    var binary = unescape(encodeURIComponent(value)), bytes = []; // eslint-disable-line no-restricted-globals
    for (var i = 0; i < binary.length; i++) bytes.push(binary.charCodeAt(i));
    return bytes;
  }
  function base64FromBytes(bytes) {
    var binary = "", i;
    for (i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    if (typeof btoa === "function") return btoa(binary);
    if (typeof Buffer !== "undefined") return Buffer.from(binary, "latin1").toString("base64");
    var out = "";
    for (i = 0; i < bytes.length; i += 3) {
      var b1 = bytes[i], b2 = bytes[i + 1], b3 = bytes[i + 2];
      out += B64_STANDARD.charAt(b1 >> 2);
      out += B64_STANDARD.charAt(((b1 & 3) << 4) | ((b2 === undefined ? 0 : b2) >> 4));
      out += b2 === undefined ? "=" : B64_STANDARD.charAt(((b2 & 15) << 2) | ((b3 === undefined ? 0 : b3) >> 6));
      out += b3 === undefined ? "=" : B64_STANDARD.charAt(b3 & 63);
    }
    return out;
  }
  function rc4Bytes(key, bytes) {
    var s = new Array(256), i, j = 0, swap;
    for (i = 0; i < 256; i++) s[i] = i;
    for (i = 0; i < 256; i++) {
      j = (j + s[i] + key.charCodeAt(i % key.length)) & 0xff;
      swap = s[i]; s[i] = s[j]; s[j] = swap;
    }
    var out = new Array(bytes.length);
    i = 0; j = 0;
    for (var n = 0; n < bytes.length; n++) {
      i = (i + 1) & 0xff;
      j = (j + s[i]) & 0xff;
      swap = s[i]; s[i] = s[j]; s[j] = swap;
      out[n] = bytes[n] ^ s[(s[i] + s[j]) & 0xff];
    }
    return out;
  }
  function applyAlphabet(text, alphabet) {
    var out = "";
    for (var i = 0; i < text.length; i++) {
      var index = B64_STANDARD.indexOf(text.charAt(i));
      out += index === -1 ? text.charAt(i) : alphabet.charAt(index);
    }
    return out;
  }
  function randomKey(length) {
    var out = "";
    for (var i = 0; i < length; i++) out += String.fromCharCode(33 + randInt(94));
    return out;
  }
  function codePoints(value) {
    var out = [];
    for (var i = 0; i < value.length; i++) {
      var code = value.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
        out.push(value.substr(i, 2));
        i++;
      } else {
        out.push(value.charAt(i));
      }
    }
    return out;
  }
  function quoteString(value) {
    return JSON.stringify(value)
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");
  }
  function literalValue(raw) {
    try {
      return Function('"use strict";return (' + raw + ");")();
    } catch (error) {
      return undefined;
    }
  }

  /* =========================================================================
   * 5. Lexer
   *
   * One pass, no dependencies. Strings, template literals, regexes and
   * comments stay opaque. Template literals are emitted as head/middle/tail
   * chunks so the expressions inside ${} are tokenised like ordinary code,
   * which is what lets identifier mangling work inside template substitutions.
   * This is deliberately not a full parser; every pass re-validates its output
   * with new Function() and reports problems through warnings.
   * ====================================================================== */
  var PUNCTUATORS = [
    ">>>=", "...", "&&=", "||=", "??=", "**=", "<<=", ">>=", "===", "!==", ">>>",
    "=>", "?.", "++", "--", "**", "==", "!=", "<=", ">=", "&&", "||", "??",
    "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<", ">>"
  ];
  var REGEX_AFTER_WORD = /^(?:return|throw|case|delete|void|typeof|instanceof|in|of|yield|await|else|do|new)$/;
  var REGEX_AFTER_PUNCT = Object.create(null);
  (function () {
    var single = "([{,;:!&|?+-*~^%<>=";
    for (var i = 0; i < single.length; i++) REGEX_AFTER_PUNCT[single.charAt(i)] = true;
    var multi = ["=>", "===", "!==", "==", "!=", "<=", ">=", "&&", "||", "??",
      "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "**", "**=", "&&=", "||=",
      "??=", "<<=", ">>=", ">>>=", "..."];
    for (i = 0; i < multi.length; i++) REGEX_AFTER_PUNCT[multi[i]] = true;
  })();
  var OBJECT_LITERAL_PREFIX = Object.create(null);
  (function () {
    var puncts = ["(", "[", ",", ":", "=", "?", "!", "&&", "||", "??", "+", "-",
      "*", "/", "%", "**", "<", ">", "<=", ">=", "===", "!==", "==", "!=", "&",
      "|", "^", "~", "...", "+=", "-=", "*=", "/=", "%=", "**=", "&=", "|=",
      "^=", "&&=", "||=", "??="];
    var words = ["return", "typeof", "in", "of", "instanceof", "case", "delete",
      "void", "yield", "await", "new", "throw", "default"];
    var i;
    for (i = 0; i < puncts.length; i++) OBJECT_LITERAL_PREFIX[puncts[i]] = true;
    for (i = 0; i < words.length; i++) OBJECT_LITERAL_PREFIX[words[i]] = true;
  })();

  function tokenize(code) {
    var out = [], i = 0, last = null, frames = [];

    function emit(type, start, end, extra) {
      var token = { type: type, raw: code.slice(start, end), start: start, end: end };
      if (extra) for (var key in extra) token[key] = extra[key];
      out.push(token);
      if (type !== "space" && type !== "comment") last = token;
      return token;
    }
    function regexAllowed() {
      if (!last) return true;
      if (last.type === "template") return last.tpl === "head" || last.tpl === "middle";
      if (last.type === "word") return REGEX_AFTER_WORD.test(last.raw);
      return last.type === "punct" && REGEX_AFTER_PUNCT[last.raw] === true;
    }
    // Scans one template chunk. `start` points at a backtick (start of a
    // template) or at the "}" that closes a ${...} substitution.
    function scanTemplate(start, resume) {
      var j = start + 1;
      while (j < code.length) {
        var ch = code[j];
        if (ch === "\\") { j += 2; continue; }
        if (ch === "`") {
          j++;
          emit("template", start, j, { tpl: resume ? "tail" : "whole" });
          return { end: j, open: false };
        }
        if (ch === "$" && code[j + 1] === "{") {
          j += 2;
          emit("template", start, j, { tpl: resume ? "middle" : "head" });
          return { end: j, open: true };
        }
        j++;
      }
      emit("template", start, j, { tpl: resume ? "tail" : "whole" });
      return { end: j, open: false };
    }

    while (i < code.length) {
      var start = i, ch = code[i];
      if (/\s/.test(ch)) {
        while (i < code.length && /\s/.test(code[i])) i++;
        emit("space", start, i);
        continue;
      }
      if (ch === "/" && code[i + 1] === "/") {
        var lineEnd = code.indexOf("\n", i + 2);
        i = lineEnd < 0 ? code.length : lineEnd;
        emit("comment", start, i);
        continue;
      }
      if (ch === "/" && code[i + 1] === "*") {
        var blockEnd = code.indexOf("*/", i + 2);
        i = blockEnd < 0 ? code.length : blockEnd + 2;
        emit("comment", start, i);
        continue;
      }
      if (ch === "'" || ch === '"') {
        i++;
        while (i < code.length) {
          if (code[i] === "\\") { i += 2; continue; }
          if (code[i] === ch) { i++; break; }
          if (code[i] === "\n") break;
          i++;
        }
        emit("string", start, i);
        continue;
      }
      if (ch === "`") {
        var chunk = scanTemplate(i, false);
        i = chunk.end;
        if (chunk.open) frames.push(0);
        continue;
      }
      if (ch === "/" && regexAllowed()) {
        i++;
        var inClass = false;
        while (i < code.length) {
          if (code[i] === "\\") { i += 2; continue; }
          if (code[i] === "\n") break;
          if (code[i] === "[") inClass = true;
          else if (code[i] === "]") inClass = false;
          else if (code[i] === "/" && !inClass) { i++; break; }
          i++;
        }
        while (i < code.length && /[a-z]/i.test(code[i])) i++;
        emit("regex", start, i);
        continue;
      }
      if (/[A-Za-z_$]/.test(ch) || ch.charCodeAt(0) > 127) {
        i++;
        while (i < code.length && (/[A-Za-z0-9_$]/.test(code[i]) || code.charCodeAt(i) > 127)) i++;
        emit("word", start, i);
        continue;
      }
      if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(code[i + 1] || ""))) {
        var number = /^(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.[\d_]+)(?:[eE][+-]?[\d_]+)?)(n?)/.exec(code.slice(i));
        i += number ? number[0].length : 1;
        emit("number", start, i);
        continue;
      }
      var punct = null;
      for (var pi = 0; pi < PUNCTUATORS.length; pi++) {
        var candidate = PUNCTUATORS[pi];
        if (code.substr(i, candidate.length) === candidate) {
          if (candidate === "?." && /[0-9]/.test(code[i + 2] || "")) continue;
          punct = candidate;
          break;
        }
      }
      if (punct) {
        i += punct.length;
        if (frames.length) {
          if (punct === "{") frames[frames.length - 1]++;
          else if (punct === "}") frames[frames.length - 1]--;
        }
        emit("punct", start, i);
        continue;
      }
      i++;
      if (ch === "}") {
        if (frames.length && frames[frames.length - 1] === 0) {
          var tail = scanTemplate(start, true);
          i = tail.end;
          if (!tail.open) frames.pop(); else frames[frames.length - 1] = 0;
          continue;
        }
        if (frames.length) frames[frames.length - 1]--;
      } else if (ch === "{" && frames.length) {
        frames[frames.length - 1]++;
      }
      emit("punct", start, i);
    }
    return out;
  }

  function joinTokens(tokens) {
    var out = "";
    for (var i = 0; i < tokens.length; i++) out += tokens[i].raw;
    return out;
  }
  function isSignificant(token) { return token.type !== "space" && token.type !== "comment"; }
  function significantIndex(tokens, index, direction) {
    for (var i = index + direction; i >= 0 && i < tokens.length; i += direction) {
      if (isSignificant(tokens[i])) return i;
    }
    return -1;
  }
  function significant(tokens, index, direction) {
    var found = significantIndex(tokens, index, direction);
    return found === -1 ? null : tokens[found];
  }

  /* =========================================================================
   * 6. Structural analysis helpers
   * ====================================================================== */
  function matchDelimiters(tokens) {
    var stack = [], pairs = new Array(tokens.length);
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      if (token.type !== "punct") continue;
      if (token.raw === "{" || token.raw === "(" || token.raw === "[") stack.push(i);
      else if (token.raw === "}" || token.raw === ")" || token.raw === "]") {
        var open = stack.pop();
        if (open !== undefined) { pairs[open] = i; pairs[i] = open; }
      }
    }
    return pairs;
  }
  // Innermost enclosing "{" for each token index (-1 when there is none).
  function enclosingBraces(tokens, pairs) {
    var stack = [], result = new Array(tokens.length);
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      if (token.type === "punct" && token.raw === "}") {
        if (stack.length && pairs[stack[stack.length - 1]] === i) stack.pop();
      }
      result[i] = stack.length ? stack[stack.length - 1] : -1;
      if (token.type === "punct" && token.raw === "{") stack.push(i);
    }
    return result;
  }
  // Braces that open an object literal, as opposed to a block/body.
  function objectBraces(tokens, pairs) {
    var flags = Object.create(null);
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== "punct" || tokens[i].raw !== "{" || pairs[i] === undefined) continue;
      var prev = significant(tokens, i, -1);
      if (!prev) continue;
      if (prev.type === "punct" && OBJECT_LITERAL_PREFIX[prev.raw]) flags[i] = true;
      else if (prev.type === "template" && (prev.tpl === "head" || prev.tpl === "middle")) flags[i] = true;
      else if (prev.type === "word" && OBJECT_LITERAL_PREFIX[prev.raw]) flags[i] = true;
    }
    return flags;
  }
  // Braces that open a class body.
  function classBraces(tokens, pairs) {
    var flags = Object.create(null);
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== "word" || tokens[i].raw !== "class") continue;
      var cursor = i, depth = 0;
      while (true) {
        cursor = significantIndex(tokens, cursor, 1);
        if (cursor === -1) break;
        var raw = tokens[cursor].raw;
        if (raw === "(" || raw === "[") depth++;
        else if (raw === ")" || raw === "]") depth--;
        else if (raw === "{" && depth === 0) { flags[cursor] = true; break; }
        else if (raw === ";" && depth === 0) break;
      }
    }
    return flags;
  }
  var NOT_A_METHOD_CALL = (function () {
    var words = ["if", "for", "while", "switch", "catch", "with", "function",
      "return", "typeof", "new", "delete", "void", "instanceof", "in", "of",
      "do", "else", "case", "yield", "await", "throw"], map = Object.create(null);
    for (var i = 0; i < words.length; i++) map[words[i]] = true;
    return map;
  })();
  var CONTINUES_EXPRESSION = (function () {
    var puncts = ["(", ")", "[", "]", "{", "}", ".", "?.", ",", ";", "+", "-", "*", "/", "%", "**", "==",
      "===", "!=", "!==", "<", ">", "<=", ">=", "&&", "||", "??", "?", ":", "&",
      "|", "^", "<<", ">>", ">>>", "=", "+=", "-=", "*=", "/=", "%=", "**=",
      "&&=", "||=", "??=", "&=", "|=", "^=", "=>"], map = Object.create(null);
    var words = ["in", "instanceof"], i;
    for (i = 0; i < puncts.length; i++) map[puncts[i]] = true;
    for (i = 0; i < words.length; i++) map[words[i]] = true;
    return map;
  })();

  // Function bodies: declarations, expressions, methods and arrow functions.
  // Methods are only recognised inside object literals and class bodies, which
  // keeps "foo() { ... }" (a call followed by a block) from looking like one.
  function findFunctionRegions(tokens, pairs) {
    var regions = [], objects = objectBraces(tokens, pairs), classes = classBraces(tokens, pairs);
    var enclosing = enclosingBraces(tokens, pairs);
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      if (!isSignificant(token)) continue;
      if (token.type === "word" && token.raw === "function") {
        var cursor = significantIndex(tokens, i, 1);
        if (cursor !== -1 && tokens[cursor].raw === "*") cursor = significantIndex(tokens, cursor, 1);
        var nameIndex = -1;
        if (cursor !== -1 && tokens[cursor].type === "word") {
          nameIndex = cursor;
          cursor = significantIndex(tokens, cursor, 1);
        }
        if (cursor === -1 || tokens[cursor].raw !== "(" || pairs[cursor] === undefined) continue;
        var bodyStart = significantIndex(tokens, pairs[cursor], 1);
        if (bodyStart === -1 || tokens[bodyStart].raw !== "{" || pairs[bodyStart] === undefined) continue;
        regions.push({
          kind: "function", nameIndex: nameIndex, keywordIndex: i,
          paramsOpen: cursor, paramsClose: pairs[cursor],
          bodyOpen: bodyStart, bodyClose: pairs[bodyStart]
        });
        continue;
      }
      if (token.type === "punct" && token.raw === "=>") {
        var arrowBody = significantIndex(tokens, i, 1);
        if (arrowBody === -1 || tokens[arrowBody].raw !== "{" || pairs[arrowBody] === undefined) continue;
        var before = significantIndex(tokens, i, -1);
        var paramsOpen = -1, paramsClose = -1;
        if (before !== -1 && tokens[before].raw === ")") {
          paramsClose = before;
          paramsOpen = pairs[before];
        } else if (before !== -1 && tokens[before].type === "word") {
          paramsOpen = before;
          paramsClose = before;
        }
        regions.push({
          kind: "arrow", nameIndex: -1, paramsOpen: paramsOpen, paramsClose: paramsClose,
          bodyOpen: arrowBody, bodyClose: pairs[arrowBody]
        });
        continue;
      }
      if (token.type === "punct" && token.raw === "(" && pairs[i] !== undefined) {
        var calleeIndex = significantIndex(tokens, i, -1);
        if (calleeIndex === -1 || tokens[calleeIndex].type !== "word") continue;
        if (NOT_A_METHOD_CALL[tokens[calleeIndex].raw]) continue;
        var beforeCallee = significantIndex(tokens, calleeIndex, -1);
        if (beforeCallee !== -1 && (tokens[beforeCallee].raw === "function" || tokens[beforeCallee].raw === ".")) continue;
        var bodyOpen = significantIndex(tokens, pairs[i], 1);
        if (bodyOpen === -1 || tokens[bodyOpen].raw !== "{" || pairs[bodyOpen] === undefined) continue;
        var brace = enclosing[i];
        if (brace === -1 || (!objects[brace] && !classes[brace])) continue;
        regions.push({
          kind: "method", nameIndex: calleeIndex, paramsOpen: i, paramsClose: pairs[i],
          bodyOpen: bodyOpen, bodyClose: pairs[bodyOpen]
        });
      }
    }
    return regions;
  }
  function regionDepth(regions, region) {
    var depth = 1;
    for (var i = 0; i < regions.length; i++) {
      var other = regions[i];
      if (other === region) continue;
      if (other.bodyOpen < region.bodyOpen && other.bodyClose > region.bodyClose) depth++;
    }
    return depth;
  }
  function scopeOf(index, scopes) {
    var best = null;
    for (var i = 0; i < scopes.length; i++) {
      var scope = scopes[i];
      if (index >= scope.start && index <= scope.end) {
        if (!best || (scope.end - scope.start) < (best.end - best.start)) best = scope;
      }
    }
    return best;
  }
  // Destructuring patterns are never rewritten; collect their token indexes.
  function collectPatternTokens(tokens, regions) {
    var pattern = Object.create(null);
    function markRange(from, to) {
      for (var i = from; i <= to && i < tokens.length; i++) pattern[i] = true;
    }
    function markFrom(index) {
      if (index === -1) return;
      var open = tokens[index].raw, close = open === "{" ? "}" : "]", depth = 0;
      for (var i = index; i < tokens.length; i++) {
        if (tokens[i].raw === open) depth++;
        else if (tokens[i].raw === close) {
          depth--;
          if (depth === 0) { markRange(index, i); return; }
        }
      }
      markRange(index, tokens.length - 1);
    }
    function scanDeclarators(fromIndex) {
      var cursor = fromIndex;
      while (true) {
        var next = significantIndex(tokens, cursor, 1);
        if (next === -1) return;
        if (tokens[next].raw === "{" || tokens[next].raw === "[") markFrom(next);
        var depth = 0, j = next, stop = false;
        for (; j < tokens.length; j++) {
          var raw = tokens[j].raw;
          if (tokens[j].type === "punct") {
            if (raw === "(" || raw === "[" || raw === "{") depth++;
            else if (raw === ")" || raw === "]" || raw === "}") {
              if (depth === 0) { stop = true; break; }
              depth--;
            } else if (depth === 0 && (raw === ";" || raw === ",")) break;
          } else if (depth === 0 && tokens[j].type === "word" && (raw === "in" || raw === "of")) { stop = true; break; }
        }
        if (j >= tokens.length || stop) return;
        if (tokens[j].type !== "punct" || (tokens[j].raw !== "," )) return;
        cursor = j;
      }
    }
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      if (token.type !== "word") continue;
      if (token.raw === "var" || token.raw === "let" || token.raw === "const") scanDeclarators(i);
      else if (token.raw === "catch") {
        var open = significantIndex(tokens, i, 1);
        if (open !== -1 && tokens[open].raw === "(" && pairsIndex(tokens, open) !== -1) {
          var first = significantIndex(tokens, open, 1);
          if (first !== -1 && (tokens[first].raw === "{" || tokens[first].raw === "[")) markFrom(first);
        }
      }
    }
    for (i = 0; i < regions.length; i++) {
      var region = regions[i];
      if (region.paramsOpen === -1 || region.paramsClose <= region.paramsOpen) continue;
      var paramDepth = 0;
      for (var k = region.paramsOpen + 1; k < region.paramsClose; k++) {
        var paramToken = tokens[k];
        if (paramToken.type !== "punct") continue;
        if (paramToken.raw === "(" || paramToken.raw === "[" || paramToken.raw === "{") {
          if (paramDepth === 0 && paramToken.raw !== "(") markFrom(k);
          paramDepth++;
        } else if (paramToken.raw === ")" || paramToken.raw === "]" || paramToken.raw === "}") {
          paramDepth--;
        }
      }
    }
    return pattern;
  }
  function pairsIndex(tokens, open) {
    var match = open === "{" ? "}" : open === "(" ? ")" : "]", depth = 0;
    for (var i = open; i < tokens.length; i++) {
      if (tokens[i].raw === open) depth++;
      else if (tokens[i].raw === match) {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  /* =========================================================================
   * 7. Identifier mangling
   *
   * Declared bindings from var/let/const, function and class names, parameter
   * lists, catch clauses and named function expressions are renamed. A spelling
   * is only renamed when every occurrence of it lies inside one of the scopes
   * that declare it; this keeps references to globals defined by other scripts
   * working. Property names, object keys, shorthand properties, method names,
   * labels, destructuring patterns, module bindings and anything reachable
   * dynamically (eval, with, string keys) are left alone.
   * ====================================================================== */
  function mangleIdentifiers(code, ctx) {
    var opts = ctx.opts, tokens = tokenize(code), map = Object.create(null);
    if (opts.skipMangling) return { code: code, map: map };
    var pairs = matchDelimiters(tokens);
    var regions = findFunctionRegions(tokens, pairs);
    var patterns = collectPatternTokens(tokens, regions);
    var objects = objectBraces(tokens, pairs);
    var classes = classBraces(tokens, pairs);
    var enclosing = enclosingBraces(tokens, pairs);
    var existing = Object.create(null), stringValues = Object.create(null);
    var occurrences = Object.create(null);
    var i, token;
    for (i = 0; i < tokens.length; i++) {
      token = tokens[i];
      if (token.type === "word") {
        existing[token.raw] = true;
        if (!occurrences[token.raw]) occurrences[token.raw] = [];
        occurrences[token.raw].push(i);
      } else if (token.type === "string") {
        var value = literalValue(token.raw);
        if (typeof value === "string" && value) stringValues[value] = true;
      }
    }
    var scopes = [{ start: 0, end: tokens.length - 1, top: true }];
    for (i = 0; i < regions.length; i++) {
      scopes.push({
        start: regions[i].paramsOpen === -1 ? regions[i].bodyOpen : regions[i].paramsOpen,
        end: regions[i].bodyClose
      });
    }
    var candidates = Object.create(null);
    function declare(index, scope) {
      if (index === -1 || !scope) return;
      var name = tokens[index].raw;
      if (!name || RESERVED_SET[name] || INTERNAL_SET[name]) return;
      if (!candidates[name]) candidates[name] = [];
      candidates[name].push(scope);
    }
    function declareHere(index) { declare(index, scopeOf(index, scopes)); }
    // var / let / const bindings
    for (i = 0; i < tokens.length; i++) {
      token = tokens[i];
      if (token.type !== "word" || (token.raw !== "var" && token.raw !== "let" && token.raw !== "const")) continue;
      var cursor = i;
      while (true) {
        var nameIndex = significantIndex(tokens, cursor, 1);
        if (nameIndex === -1) break;
        var nameToken = tokens[nameIndex];
        if (nameToken.raw === ")" || nameToken.raw === ";") break;
        if (nameToken.type === "word" && !KEYWORD_SET[nameToken.raw] && !patterns[nameIndex]) declareHere(nameIndex);
        var depth = 0, j = nameIndex, stop = false;
        for (; j < tokens.length; j++) {
          var raw = tokens[j].raw;
          if (tokens[j].type === "punct") {
            if (raw === "(" || raw === "[" || raw === "{") depth++;
            else if (raw === ")" || raw === "]" || raw === "}") {
              if (depth === 0) { stop = true; break; }
              depth--;
            } else if (depth === 0 && (raw === ";" || raw === ",")) break;
          } else if (depth === 0 && tokens[j].type === "word" && (raw === "in" || raw === "of")) { stop = true; break; }
        }
        if (j >= tokens.length || stop || tokens[j].type !== "punct" || tokens[j].raw !== ",") break;
        cursor = j;
      }
    }
    // function names and parameter lists
    for (i = 0; i < regions.length; i++) {
      var region = regions[i];
      if (region.kind === "function" && region.nameIndex !== -1 && !opts.preserveFunctionNames) {
        // A declaration name belongs to the enclosing scope, the name of a named
        // function expression only to the function itself. The keyword before
        // the name tells the two apart, not the token before the name.
        var beforeName = significantIndex(tokens, region.keywordIndex, -1);
        var declarationContext = beforeName === -1 || tokens[beforeName].raw === ";" ||
          tokens[beforeName].raw === "{" || tokens[beforeName].raw === "}" ||
          (tokens[beforeName].type === "word" &&
            (tokens[beforeName].raw === "export" || tokens[beforeName].raw === "default"));
        if (declarationContext) declareHere(region.nameIndex);
        else declare(region.nameIndex, { start: region.nameIndex, end: region.bodyClose });
      }
      if (region.paramsOpen === -1 || region.paramsClose <= region.paramsOpen) continue;
      var paramScope = { start: region.paramsOpen, end: region.bodyClose };
      var parts = [], current = [], depth2 = 0, k;
      for (k = region.paramsOpen + 1; k < region.paramsClose; k++) {
        var param = tokens[k];
        if (param.type === "punct") {
          if (param.raw === "(" || param.raw === "[" || param.raw === "{") depth2++;
          else if (param.raw === ")" || param.raw === "]" || param.raw === "}") depth2--;
          else if (param.raw === "," && depth2 === 0) { parts.push(current); current = []; continue; }
        }
        if (depth2 === 0 && param.type === "word" && (param.raw === "var" || param.raw === "let" || param.raw === "const")) {
          current = [];
          continue;
        }
        current.push(k);
      }
      if (current.length) parts.push(current);
      for (var p = 0; p < parts.length; p++) {
        var part = parts[p], stopAt = part.length;
        for (var q = 0; q < part.length; q++) {
          if (tokens[part[q]].type === "punct" && tokens[part[q]].raw === "=") { stopAt = q; break; }
        }
        for (q = 0; q < stopAt; q++) {
          var index = part[q];
          if (patterns[index]) continue;
          if (tokens[index].type === "word" && !KEYWORD_SET[tokens[index].raw]) {
            declare(index, paramScope);
            break;
          }
        }
      }
    }
    // class names and catch clauses
    for (i = 0; i < tokens.length; i++) {
      token = tokens[i];
      if (token.type !== "word") continue;
      if (token.raw === "class") {
        if (opts.preserveFunctionNames) continue;
        var className = significantIndex(tokens, i, 1);
        if (className === -1) continue;
        if (tokens[className].type !== "word" || tokens[className].raw === "extends" ||
          KEYWORD_SET[tokens[className].raw]) continue;
        var beforeClass = significantIndex(tokens, i, -1);
        var classIsDeclaration = beforeClass === -1 || tokens[beforeClass].raw === ";" ||
          tokens[beforeClass].raw === "{" || tokens[beforeClass].raw === "}" ||
          (tokens[beforeClass].type === "word" &&
            (tokens[beforeClass].raw === "export" || tokens[beforeClass].raw === "default"));
        if (classIsDeclaration) {
          declareHere(className);
        } else {
          var classBody = -1, cursor2 = className;
          while (true) {
            cursor2 = significantIndex(tokens, cursor2, 1);
            if (cursor2 === -1 || tokens[cursor2].raw === ";") break;
            if (tokens[cursor2].raw === "{") { classBody = cursor2; break; }
          }
          if (classBody !== -1 && pairs[classBody] !== undefined) {
            declare(className, { start: classBody, end: pairs[classBody] });
          } else {
            declareHere(className);
          }
        }
      } else if (token.raw === "catch") {
        var openParen = significantIndex(tokens, i, 1);
        if (openParen === -1 || tokens[openParen].raw !== "(" || pairs[openParen] === undefined) continue;
        var catchName = significantIndex(tokens, openParen, 1);
        if (catchName === -1 || catchName >= pairs[openParen]) continue;
        if (tokens[catchName].type !== "word" || KEYWORD_SET[tokens[catchName].raw] || patterns[catchName]) continue;
        declareHere(catchName);
      }
    }
    // Spellings that must never be renamed.
    var blocked = Object.create(null);
    for (i = 0; i < tokens.length; i++) {
      token = tokens[i];
      if (token.type !== "word") continue;
      var name = token.raw;
      if (blocked[name]) continue;
      if (RESERVED_SET[name] || INTERNAL_SET[name] || patterns[i]) { blocked[name] = true; continue; }
      var prev = significant(tokens, i, -1), next = significant(tokens, i, 1);
      if (prev && (prev.raw === "." || prev.raw === "?." || prev.raw === "#")) { blocked[name] = true; continue; }
      if (prev && prev.raw === "...") { blocked[name] = true; continue; }
      if (next && next.raw === ":" && (!prev || (prev.raw !== "case" && prev.raw !== "?"))) {
        blocked[name] = true; continue;
      }
      var brace = enclosing[i];
      if (brace !== -1 && (objects[brace] || classes[brace])) {
        var propertyStart = prev && (prev.raw === "{" || prev.raw === ",");
        if (propertyStart && (!next || next.raw === "," || next.raw === "}" || next.raw === "=" ||
          next.raw === "(" || next.raw === ":")) {
          blocked[name] = true; continue;
        }
      }
      if (stringValues[name]) { blocked[name] = true; }
    }
    // Containment test, then rewrite.
    for (var spelling in candidates) {
      if (blocked[spelling]) continue;
      var declaredScopes = candidates[spelling];
      var seen = occurrences[spelling] || [];
      var inside = seen.length > 0;
      for (i = 0; i < seen.length && inside; i++) {
        var contained = false;
        for (var d = 0; d < declaredScopes.length; d++) {
          var scope = declaredScopes[d];
          if (seen[i] >= scope.start && seen[i] <= scope.end) { contained = true; break; }
        }
        if (!contained) inside = false;
      }
      if (inside) map[spelling] = ctx.pool.name(2 + randInt(4));
    }
    for (i = 0; i < tokens.length; i++) {
      token = tokens[i];
      if (token.type === "word" && map[token.raw]) token.raw = map[token.raw];
    }
    return { code: joinTokens(tokens), map: map };
  }

  /* =========================================================================
   * 8. Identifier escaping
   * ====================================================================== */
  function escapeIdentifier(name) {
    var out = "", changed = 0;
    for (var i = 0; i < name.length; i++) {
      var code = name.charCodeAt(i), char = name.charAt(i);
      if ((/[A-Za-z0-9]/.test(char) || code > 127) && chance(0.75)) {
        var hex = code.toString(16);
        while (hex.length < 4) hex = "0" + hex;
        out += "\\u" + hex;
        changed++;
      } else {
        out += char;
      }
    }
    return changed ? out : name;
  }
  function escapeIdentifiers(code, ctx) {
    if (ctx.opts.skipMangling) return { code: code, count: 0 };
    var tokens = tokenize(code), count = 0;
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      if (token.type !== "word") continue;
      if (RESERVED_SET[token.raw] || INTERNAL_SET[token.raw] || ctx.generatedNames[token.raw]) continue;
      var prev = significant(tokens, i, -1);
      if (prev && prev.raw === "#") continue;
      var escaped = escapeIdentifier(token.raw);
      if (escaped !== token.raw) {
        token.raw = escaped;
        count++;
      }
    }
    return { code: joinTokens(tokens), count: count };
  }

  /* =========================================================================
   * 9. Number encoding
   * ====================================================================== */
  function intExpression(n) {
    var strategy = randInt(9), a, b, k;
    if (strategy === 0) return n < 0 ? "-0x" + (-n).toString(16) : "0x" + n.toString(16);
    if (strategy === 1 && n >= 0) return "0b" + n.toString(2);
    if (strategy === 2 && n >= 0) return "0o" + n.toString(8);
    if (strategy === 3) { k = randInt(60) + 1; return (n - k) + "+" + k; }
    if (strategy === 4 && n !== 0) { b = randInt(6) + 2; return b + "*" + ((n - (n % b)) / b) + "+" + (n % b); }
    if (strategy === 5 && Math.abs(n) < 0x7fffffff) { a = randInt(0xffff); return "(" + a + "^" + (a ^ n) + ")"; }
    if (strategy === 6 && n >= 0 && n < 0x7fffffff) { a = randInt(0xffff); return "(" + (n & a) + "|" + (n & ~a) + ")"; }
    if (strategy === 7 && n > -100000 && n < 100000) { k = 1 << (randInt(4) + 1); return n + "*" + k + "/" + k; }
    if (strategy === 8 && n < 0) return "~" + (~n);
    k = 1 << (randInt(3) + 1);
    return n * k + "/" + k;
  }
  function encodeNumberExpr(value) {
    if (typeof value !== "number" || !isFinite(value)) return String(value);
    if (value === 0) return chance(0.5) ? "0x0" : "0*(" + (randInt(9) + 1) + ")";
    if (Number.isSafeInteger(value) && Math.abs(value) < 0x1fffffffffffff) return intExpression(value);
    // scaling by a power of two is exact in IEEE-754
    var power = 1 << (randInt(3) + 1);
    return value + "*" + power + "/" + power;
  }
  function encodeNumbers(code, ctx) {
    if (!ctx.opts.numberEncoding) return code;
    var tokens = tokenize(code), count = 0;
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      if (token.type !== "number" || token.raw.length <= 1 || /n$/.test(token.raw)) continue;
      var prev = significant(tokens, i, -1), next = significant(tokens, i, 1);
      if (next && (next.raw === ":" || next.raw === "." ||
        (next.raw === "(" && prev && (prev.raw === "{" || prev.raw === ",")))) continue;
      if (prev && (prev.raw === "." || prev.raw === "?." || prev.raw === "#")) continue;
      var value = Number(token.raw.replace(/_/g, ""));
      if (!isFinite(value)) continue;
      token.raw = "(" + encodeNumberExpr(value) + ")";
      count++;
    }
    ctx.stats.numbersEncoded = (ctx.stats.numbersEncoded || 0) + count;
    return joinTokens(tokens);
  }

  /* =========================================================================
   * 10. String handling: splitting, encryption and the generated decoder
   * ====================================================================== */
  function splitString(value, opts) {
    if (!opts.stringSplitting || value.length < opts.stringSplitMinLength) return [value];
    var chars = codePoints(value);
    if (chars.length < 2) return [value];
    var desired = Math.ceil(chars.length / Math.max(2, Math.floor(opts.stringSplitMinLength * 1.5)));
    desired = Math.max(2, Math.min(Math.max(2, opts.stringSplitMaxParts), desired));
    if (chance(0.25)) desired = Math.max(2, desired - 1);
    var parts = [], size = Math.ceil(chars.length / desired), index = 0;
    while (index < chars.length) {
      var take = size + (chance(0.4) ? randInt(3) - 1 : 0);
      if (take < 1) take = 1;
      if (index + take >= chars.length) take = chars.length - index;
      parts.push(chars.slice(index, index + take).join(""));
      index += take;
    }
    return parts.length > 1 ? parts : [value];
  }
  // Builds the decoder body. Everything is ES5 and self-contained: no atob, no
  // Uint8Array and no TextDecoder are required (they are used when present).
  function buildDecoderFunction(ctx, payload) {
    var p = {
      x: ctx.pool.name(4), s: ctx.pool.name(4), t: ctx.pool.name(4), v: ctx.pool.name(4),
      n: ctx.pool.name(3), b: ctx.pool.name(3), o: ctx.pool.name(3), r: ctx.pool.name(3),
      k: ctx.pool.name(3), j: ctx.pool.name(3), c: ctx.pool.name(3), i: ctx.pool.name(3)
    };
    var names = ctx.names, out = "";
    out += "var " + p.s + "=" + names.array + (payload.shuffle ? "[" + names.map + "[" + p.x + "]]" : "[" + p.x + "]") + ";";
    out += "if(" + p.s + "===undefined)return " + p.s + ";";
    if (payload.reversed) out += p.s + "=" + p.s + ".split(\"\").reverse().join(\"\");";
    out += "var " + p.t + "={}," + p.n + "=0," + p.b + "=0," + p.v + "=0," + p.o + "=[]," + p.i + "=0" +
      (payload.encoding === "rc4" ? "," + p.r + "=[]," + p.k + "=\"\"," + p.j + "=0" : "") + ";";
    out += "for(" + p.c + "=0;" + p.c + "<64;" + p.c + "++)" + p.t + "[" + names.alphabet + ".charCodeAt(" + p.c + ")]=" + p.c + ";";
    out += "for(;" + p.v + "<" + p.s + ".length;" + p.v + "++){";
    out += p.c + "=" + p.t + "[" + p.s + ".charCodeAt(" + p.v + ")];";
    out += "if(" + p.c + "===undefined)continue;";
    out += p.b + "=(" + p.b + "<<6)|" + p.c + ";" + p.n + "+=6;";
    out += "if(" + p.n + ">=8){" + p.n + "-=8;" + p.o + ".push((" + p.b + ">>" + p.n + ")&255);" + p.b + "&=(1<<" + p.n + ")-1;}}";
    if (payload.encoding === "rc4") {
      out += "for(" + p.v + "=0;" + p.v + "<" + names.key + ".length;" + p.v + "++)" + p.k + "+=String.fromCharCode(" + names.key + "[" + p.v + "]);";
      out += "for(" + p.v + "=0;" + p.v + "<256;" + p.v + "++)" + p.r + "[" + p.v + "]=" + p.v + ";";
      out += p.j + "=0;";
      out += "for(" + p.v + "=0;" + p.v + "<256;" + p.v + "++){" + p.j + "=(" + p.j + "+" + p.r + "[" + p.v + "]+" +
        p.k + ".charCodeAt(" + p.v + "%" + p.k + ".length))&255;" + p.c + "=" + p.r + "[" + p.v + "];" +
        p.r + "[" + p.v + "]=" + p.r + "[" + p.j + "];" + p.r + "[" + p.j + "]=" + p.c + ";}";
      out += p.v + "=0;" + p.j + "=0;";
      out += "for(" + p.c + "=0;" + p.c + "<" + p.o + ".length;" + p.c + "++){" + p.v + "=(" + p.v + "+1)&255;" +
        p.j + "=(" + p.j + "+" + p.r + "[" + p.v + "])&255;var " + p.n + "=" + p.r + "[" + p.v + "];" +
        p.r + "[" + p.v + "]=" + p.r + "[" + p.j + "];" + p.r + "[" + p.j + "]=" + p.n + ";" +
        p.o + "[" + p.c + "]=" + p.o + "[" + p.c + "]^" + p.r + "[(" + p.r + "[" + p.v + "]+" + p.r + "[" + p.j + "])&255];}";
    }
    out += "if(typeof TextDecoder!==\"undefined\"&&typeof Uint8Array!==\"undefined\"){try{return new TextDecoder().decode(new Uint8Array(" + p.o + "));}catch(" + p.c + "){}}";
    out += "var " + p.c + "=\"\";" + p.i + "=0;";
    out += "while(" + p.i + "<" + p.o + ".length){";
    out += p.v + "=" + p.o + "[" + p.i + "++];";
    out += "if(" + p.v + "<128){" + p.c + "+=String.fromCharCode(" + p.v + ");continue;}";
    out += "if(" + p.v + ">191&&" + p.v + "<224){" + p.n + "=" + p.o + "[" + p.i + "++];" +
      p.c + "+=String.fromCharCode(((" + p.v + "&31)<<6)|(" + p.n + "&63));continue;}";
    out += "if(" + p.v + ">223&&" + p.v + "<240){" + p.n + "=" + p.o + "[" + p.i + "++];" + p.b + "=" + p.o + "[" + p.i + "++];" +
      p.c + "+=String.fromCharCode(((" + p.v + "&15)<<12)|((" + p.n + "&63)<<6)|(" + p.b + "&63));continue;}";
    out += p.n + "=" + p.o + "[" + p.i + "++];" + p.b + "=" + p.o + "[" + p.i + "++];" + p.t + "=" + p.o + "[" + p.i + "++];";
    out += p.n + "=((((" + p.v + "&7)<<18)|((" + p.n + "&63)<<12)|((" + p.b + "&63)<<6)|(" + p.t + "&63))-65536);";
    out += p.c + "+=String.fromCharCode(55296+(" + p.n + ">>10),56320+(" + p.n + "&1023));}";
    out += "return " + p.c + ";";
    var text = "function(" + p.x + "){" + out + "}";
    return { text: text, declaration: "var " + names.decoder + "=" + text + ";" };
  }
  function encodeStrings(code, ctx) {
    var opts = ctx.opts;
    if (!opts.stringEncryption && !opts.stringSplitting) return { code: code, runtime: "", decoderText: "", count: 0, split: 0, entries: 0 };
    var tokens = tokenize(code);
    var key = opts.stringEncryption && opts.stringEncoding === "rc4" ? randomKey(6 + randInt(10)) : null;
    var alphabet = opts.stringEncryption && opts.stringAlphabet === "shuffled"
      ? shuffle(B64_STANDARD.split("")).join("")
      : B64_STANDARD;
    var reversed = opts.stringEncryption && opts.stringAlphabet === "shuffled" ? chance(0.5) : false;
    var items = [], logical = [], count = 0, splitCount = 0;
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      var isTemplate = token.type === "template" && token.tpl === "whole";
      if (token.type !== "string" && !isTemplate) continue;
      var prev = significant(tokens, i, -1), next = significant(tokens, i, 1);
      if (isTemplate && prev && (prev.raw === ")" || prev.raw === "]" || prev.raw === "}" ||
        (prev.type === "word" && !REGEX_AFTER_WORD.test(prev.raw)))) continue;
      if (next && next.raw === ":") continue;
      if (next && next.raw === "(" && prev && (prev.raw === "{" || prev.raw === "," ||
        prev.raw === "get" || prev.raw === "set")) continue;
      if (prev && (prev.raw === "from" || prev.raw === "import" || prev.raw === "export")) continue;
      if ((!prev || prev.raw === "{" || prev.raw === ";" || prev.raw === ":") &&
        /^(['"])use (?:strict|asm)\1$/.test(token.raw)) continue;
      var value = literalValue(token.raw);
      if (typeof value !== "string" || value.length === 0) continue;
      var chunks = splitString(value, opts);
      if (chunks.length > 1) splitCount++;
      var parts = [];
      for (var c = 0; c < chunks.length; c++) {
        var piece = chunks[c];
        if (opts.stringEncryption) {
          var bytes = utf8Bytes(piece);
          if (key) bytes = rc4Bytes(key, bytes);
          var encoded = base64FromBytes(bytes);
          if (alphabet !== B64_STANDARD) encoded = applyAlphabet(encoded, alphabet);
          if (reversed) encoded = encoded.split("").reverse().join("");
          items.push(encoded);
          logical.push(items.length - 1);
          parts.push(null);
        } else {
          parts.push(quoteString(piece));
        }
      }
      if (opts.stringEncryption) {
        var start = logical.length - chunks.length, calls = [];
        for (c = 0; c < chunks.length; c++) {
          var call = ctx.names.runtime + "(" + encodeNumberExpr(logical[start + c]);
          if (chance(0.3)) call += "," + encodeNumberExpr(randInt(64));
          if (chance(0.15)) call += "," + encodeNumberExpr(randInt(64));
          calls.push(call + ")");
        }
        token.raw = calls.length === 1 ? calls[0] : "(" + calls.join("+") + ")";
      } else {
        token.raw = parts.length === 1 ? parts[0] : "(" + parts.join("+") + ")";
      }
      count++;
    }
    var result = joinTokens(tokens);
    if (!count) return { code: result, runtime: "", decoderText: "", count: 0, split: 0, entries: 0 };
    if (!opts.stringEncryption) {
      return { code: result, runtime: "", decoderText: "", count: 0, split: splitCount, entries: 0 };
    }
    // decoy entries: valid Base64 payloads that no call site references
    var decoys = Math.max(0, Math.floor(opts.stringArrayDecoys)), d, j;
    for (d = 0; d < decoys; d++) {
      var junk = "", length = 8 + randInt(40);
      for (j = 0; j < length; j++) junk += B64_STANDARD.charAt(randInt(64));
      while (junk.length % 4 !== 0) junk += "=";
      if (alphabet !== B64_STANDARD) junk = applyAlphabet(junk, alphabet);
      if (reversed) junk = junk.split("").reverse().join("");
      items.push(junk);
    }
    var order = [], index;
    for (index = 0; index < items.length; index++) order.push(index);
    if (opts.stringArrayShuffle) shuffle(order);
    var entries = new Array(items.length), mapArray = new Array(logical.length);
    for (index = 0; index < items.length; index++) entries[order[index]] = items[index];
    for (index = 0; index < logical.length; index++) mapArray[index] = order[logical[index]];
    var names = ctx.names;
    var decoder = buildDecoderFunction(ctx, {
      encoding: key ? "rc4" : "base64", reversed: reversed, shuffle: opts.stringArrayShuffle
    });
    var runtime = "var " + names.runtime + "=(function(){" +
      "var " + names.array + "=[\"" + entries.join("\",\"") + "\"];" +
      (opts.stringArrayShuffle ? "var " + names.map + "=[" + mapArray.join(",") + "];" : "") +
      (key ? "var " + names.key + "=[" + key.split("").map(function (character) {
        return encodeNumberExpr(character.charCodeAt(0));
      }).join(",") + "];" : "") +
      "var " + names.alphabet + "=\"" + alphabet + "\";" +
      decoder.declaration +
      "return " + names.decoder + ";})();";
    return {
      code: result, runtime: runtime, decoderText: decoder.text,
      count: count, split: splitCount, entries: entries.length
    };
  }

  /* =========================================================================
   * 11. Opaque predicates, dead code and control-flow flattening
   * ====================================================================== */
  function opaquePredicate(wantTrue) {
    var shapes = [
      function () {
        var a = randInt(0xffff), b = randInt(0xffff);
        return "(" + encodeNumberExpr(a) + "^" + encodeNumberExpr(b) + ")===(" + encodeNumberExpr(a ^ b) + ")";
      },
      function () {
        var length = randInt(4) + 1;
        return "\"" + randomHexName(length) + "\".length!==" + encodeNumberExpr(randInt(3) + length + 1);
      },
      function () {
        var a = randInt(0xffff), b = randInt(0xffff);
        return "(" + encodeNumberExpr(a) + "|" + encodeNumberExpr(b) + ")%2===" + encodeNumberExpr((a | b) % 2);
      },
      function () {
        var a = randInt(1000) + 2;
        return "(function(){return " + encodeNumberExpr(a) + ";})()===" + encodeNumberExpr(a) + "?!!1:!!0";
      },
      function () {
        var a = randInt(0xff) + 1;
        return "(" + encodeNumberExpr(a) + "&" + encodeNumberExpr((a ^ randInt(0xff)) | 1) + ")!==-1";
      },
      function () {
        var a = randInt(100000);
        return "Number(\"" + a + "\")===" + encodeNumberExpr(a);
      }
    ];
    var value, text, tries = 0;
    do {
      text = pick(shapes)();
      try { value = Function('"use strict";return (' + text + ");")(); } catch (error) { value = undefined; }
      tries++;
    } while (typeof value !== "boolean" && tries < 12);
    if (typeof value !== "boolean") {
      return "1===1";
    }
    if (wantTrue === undefined) return value ? text : "!" + text;
    return value === wantTrue ? text : "!(" + text + ")";
  }
  function deadStatement(ctx) {
    var amount = Math.max(1, Math.floor(ctx.opts.deadCodeAmount));
    var names = [], i;
    for (i = 0; i < 6; i++) names.push(ctx.pool.name(4 + randInt(3)));
    var lines = [], used = 0, flavor = randInt(5);
    if (flavor === 0) {
      lines.push("var " + names[0] + "=" + encodeNumberExpr(randInt(100000)) + "," + names[1] + "=" + encodeNumberExpr(randInt(100000)) + ";");
      lines.push("function " + names[2] + "(" + names[3] + "," + names[4] + "){return " + names[3] + "*" + names[4] + "+" + encodeNumberExpr(randInt(1000)) + ";}");
      lines.push("var " + names[5] + "=" + names[2] + "(" + names[0] + "," + names[1] + ");");
      lines.push("if(" + names[5] + ">" + encodeNumberExpr(randInt(100000)) + "){" + names[0] + "=" + names[5] + ";}");
    } else if (flavor === 1) {
      lines.push("for(var " + names[0] + "=0;" + names[0] + "<" + encodeNumberExpr(randInt(4) + 2) + ";" + names[0] + "++){");
      lines.push(names[1] + "=" + encodeNumberExpr(randInt(1000)) + "*" + names[0] + ";");
      lines.push("if(" + names[1] + "===" + encodeNumberExpr(randInt(1000)) + ")break;}");
      lines.push("var " + names[1] + "=" + encodeNumberExpr(randInt(1000)) + ";");
    } else if (flavor === 2 && ctx.hasRuntime) {
      lines.push("var " + names[0] + "=" + ctx.names.runtime + "(" + encodeNumberExpr(randInt(8)) + ");");
      lines.push("var " + names[1] + "=" + names[0] + ".length+" + encodeNumberExpr(randInt(20)) + ";");
      lines.push("if(" + names[1] + ">" + encodeNumberExpr(randInt(50)) + "){" + names[1] + "=null;}");
    } else if (flavor === 3) {
      lines.push("var " + names[0] + "=[" + encodeNumberExpr(randInt(99)) + "," + encodeNumberExpr(randInt(99)) + "];");
      lines.push(names[0] + ".push(" + encodeNumberExpr(randInt(99)) + ");");
      lines.push("var " + names[1] + "=" + names[0] + ".join(\"" + randomHexName(2) + "\");");
      lines.push("if(" + names[1] + ".length>" + encodeNumberExpr(randInt(50)) + "){" + names[1] + "=null;}");
    } else {
      lines.push("var " + names[0] + "=\"" + randomHexName(6) + "\";");
      lines.push("var " + names[1] + "=" + names[0] + ".split(\"\").reverse().join(\"\");");
      lines.push("if(" + names[1] + "===\"" + randomHexName(5) + "\"){" + names[1] + "=" + names[0] + ";}");
      lines.push("var " + names[2] + "=" + names[1] + ".length*" + encodeNumberExpr(randInt(9) + 1) + ";");
    }
    while (used < amount - 1 && lines.length < 9) {
      // fresh names: a "var" must never collide with a block level "function"
      lines.push("var " + ctx.pool.name(4 + randInt(3)) + "=" + encodeNumberExpr(randInt(100000)) + ";");
      used++;
    }
    return "if(" + opaquePredicate(false) + "){" + lines.join("") + "}";
  }
  // Moves a run of statements into a shuffled switch. Two things are
  // randomised independently: the switch labels and the order the case clauses
  // appear in the source. The sequence array always lists the labels in their
  // original execution order, so observable behaviour cannot change.
  function buildDispatcher(ctx, statements, useGuard) {
    var count = statements.length, index;
    var labelPool = [];
    for (index = 0; index < count * 3 + 3; index++) labelPool.push(index);
    shuffle(labelPool);
    var labels = labelPool.slice(0, count);
    var layout = [];
    for (index = 0; index < count; index++) layout.push(index);
    shuffle(layout);
    var loop = ctx.pool.name(5), sequence = ctx.pool.name(5), cases = [];
    for (index = 0; index < count; index++) {
      var position = layout[index];
      cases.push("case " + labels[position] + ":{" + statements[position] + "}break;");
    }
    var decoys = "";
    if (ctx.opts.deadCodeInjection && chance(0.8)) {
      ctx.stats.deadCodeBlocks++;
      for (index = 0; index < Math.max(1, Math.floor(ctx.opts.deadCodeAmount / 2)); index++) {
        decoys += "case " + (100000 + randInt(900000)) + ":{" + deadStatement(ctx) + "}break;";
      }
    }
    var guardOpen = "", guardClose = "";
    if (useGuard) {
      ctx.stats.opaquePredicates++;
      guardOpen = "if(" + opaquePredicate(true) + "){";
      guardClose = "}";
    }
    var sequenceEntries = [];
    for (index = 0; index < count; index++) sequenceEntries.push(encodeNumberExpr(labels[index]));
    ctx.stats.controlFlowBlocks++;
    return "var " + sequence + "=[" + sequenceEntries.join(",") + "];" + guardOpen +
      "for(var " + loop + "=0;" + loop + "<" + sequence + ".length;" + loop + "++){" +
      "switch(" + sequence + "[" + loop + "]){" + cases.join("") + decoys + "}}" + guardClose;
  }
  function splitStatements(tokens, from, to, functionBodyEnds) {
    var statements = [], depth = 0, start = from, i;
    for (i = from; i < to; i++) {
      var token = tokens[i];
      if (token.type === "punct") {
        if (token.raw === "{" || token.raw === "(" || token.raw === "[") depth++;
        else if (token.raw === "}" || token.raw === ")" || token.raw === "]") depth--;
        if (depth === 0 && token.raw === ";") {
          statements.push({ start: start, end: i + 1 });
          start = i + 1;
          continue;
        }
      }
      if (depth === 0 && functionBodyEnds[i]) {
        var nextIndex = significantIndex(tokens, i, 1);
        var nextToken = nextIndex === -1 ? null : tokens[nextIndex];
        if (nextIndex === -1 || nextIndex >= to ||
          (CONTINUES_EXPRESSION[nextToken.raw] !== true && nextToken.type !== "template")) {
          statements.push({ start: start, end: i + 1 });
          start = i + 1;
        }
      }
    }
    if (start < to) statements.push({ start: start, end: to });
    var filtered = [];
    for (i = 0; i < statements.length; i++) {
      var hasCode = false;
      for (var j = statements[i].start; j < statements[i].end; j++) {
        if (isSignificant(tokens[j])) { hasCode = true; break; }
      }
      if (hasCode) filtered.push(statements[i]);
    }
    return filtered;
  }
  // Statements that may never be relocated into a switch case: block scoped
  // declarations, hoisted declarations, any keyword whose statement is only
  // meaningful next to a neighbour ("else", "while" of a do/while, ...), or a
  // jump that would start targeting the generated loop.
  var STATEMENT_STARTERS = (function () {
    var words = ["let", "const", "function", "class", "import", "export",
      "case", "default", "else", "catch", "finally", "break", "continue",
      "while", "do", "with", "yield", "super"], map = Object.create(null);
    for (var i = 0; i < words.length; i++) map[words[i]] = true;
    return map;
  })();
  function significantTokensOf(tokens, statement) {
    var list = [];
    for (var i = statement.start; i < statement.end; i++) {
      if (isSignificant(tokens[i])) list.push(tokens[i]);
    }
    return list;
  }
  // A statement may be moved into a switch case when doing so cannot change
  // hoisting, scoping or ASI behaviour.
  function statementEligible(tokens, statement) {
    var list = significantTokensOf(tokens, statement);
    if (!list.length) return false;
    var first = list[0];
    if (first.type === "word" && STATEMENT_STARTERS[first.raw]) return false;
    if (first.type === "punct" && (first.raw === "{" || first.raw === ";")) return false;
    if (list.length <= 2 && (first.type === "string" || first.type === "template") &&
      (list.length === 1 || list[1].raw === ";")) return false;
    if (first.type === "word" && list.length > 1 && list[1].raw === ":") return false;
    var depth = 0;
    for (var i = 0; i < list.length; i++) {
      var token = list[i];
      if (token.type === "punct") {
        if (token.raw === "{" || token.raw === "(" || token.raw === "[") depth++;
        else if (token.raw === "}" || token.raw === ")" || token.raw === "]") depth--;
        continue;
      }
      if (token.type !== "word" || depth !== 0) continue;
      // "var" hoists to the enclosing function either way, so it survives being
      // wrapped in a block. "let"/"const" are block scoped and must not move.
      if (token.raw === "let" || token.raw === "const") return false;
      if (token.raw === "function" || token.raw === "class") {
        var previous = i > 0 ? list[i - 1] : null;
        // "async function f() {}", "function f() {}" and friends are real
        // declarations: moving them into a block would drop the binding.
        if (!previous || EXPRESSION_PREFIX[previous.raw] !== true) return false;
      }
    }
    return true;
  }
  // A "function"/"class" keyword at the top level of a statement is only an
  // expression (and therefore safe to relocate) when it follows one of these.
  var EXPRESSION_PREFIX = (function () {
    var puncts = ["=", "(", "[", ",", ":", "?", "!", "+", "-", "*", "/", "%",
      "**", "&", "|", "^", "~", "<", ">", "<=", ">=", "===", "!==", "==", "!=",
      "&&", "||", "??", "...", "=>", "+=", "-=", "*=", "/=", "%=", "**=",
      "&&=", "||=", "??=", "&=", "|=", "^="];
    var words = ["return", "typeof", "void", "delete", "new", "in", "of",
      "instanceof", "case", "throw", "await", "yield", "default"];
    var map = Object.create(null), i;
    for (i = 0; i < puncts.length; i++) map[puncts[i]] = true;
    for (i = 0; i < words.length; i++) map[words[i]] = true;
    return map;
  })();
  var INJECTION_BLOCKERS = (function () {
    var words = ["else", "while", "catch", "finally"], map = Object.create(null);
    for (var i = 0; i < words.length; i++) map[words[i]] = true;
    return map;
  })();
  function codeSlice(code, tokens, statement) {
    return code.slice(tokens[statement.start].start, tokens[statement.end - 1].end);
  }
  function applyStructuralTransforms(code, ctx) {
    var opts = ctx.opts, text = code, pass = 0, maxLevel = -1;
    while (pass < 5) {
      var tokens = tokenize(text), pairs = matchDelimiters(tokens);
      var functions = findFunctionRegions(tokens, pairs);
      var regions = [{ start: 0, end: tokens.length, depth: 0 }], deepest = 0, i;
      for (i = 0; i < functions.length; i++) {
        var depth = regionDepth(functions, functions[i]);
        regions.push({ start: functions[i].bodyOpen + 1, end: functions[i].bodyClose, depth: depth });
        if (depth > deepest) deepest = depth;
      }
      if (maxLevel === -1) maxLevel = deepest;
      var level = maxLevel - pass;
      if (level < 0) break;
      var functionBodyEnds = Object.create(null);
      for (i = 0; i < functions.length; i++) functionBodyEnds[functions[i].bodyClose] = true;
      var edits = [];
      for (i = 0; i < regions.length; i++) {
        var region = regions[i];
        if (region.depth !== level) continue;
        var statements = splitStatements(tokens, region.start, region.end, functionBodyEnds);
        if (!statements.length) continue;
        var eligible = [], s;
        for (s = 0; s < statements.length; s++) eligible[s] = statementEligible(tokens, statements[s]);
        var runs = [], runStart = -1;
        for (s = 0; s <= statements.length; s++) {
          if (s < statements.length && eligible[s]) {
            if (runStart === -1) runStart = s;
            continue;
          }
          if (runStart !== -1) { runs.push({ from: runStart, to: s }); runStart = -1; }
        }
        var moved = Object.create(null);
        for (var r = 0; r < runs.length; r++) {
          var run = runs[r];
          // The completion value of a script is taken from its last value
          // producing statement, and a for/switch wrapper reports undefined.
          // Keeping the final top level statement in place preserves it.
          if (region.depth === 0 && run.to === statements.length) run.to--;
          var length = run.to - run.from;
          var flatten = opts.controlFlowFlattening && length >= 2;
          if (flatten && opts.controlFlowThreshold < 1 && !chance(opts.controlFlowThreshold)) flatten = false;
          if (flatten && run.from > 0) {
            var previousFirst = significantTokensOf(tokens, statements[run.from - 1])[0];
            if (previousFirst && previousFirst.raw === "do") flatten = false;
          }
          if (!flatten) continue;
          var pieces = [];
          for (s = run.from; s < run.to; s++) {
            moved[s] = true;
            var piece = codeSlice(text, tokens, statements[s]);
            if (opts.opaquePredicates && chance(0.2)) {
              ctx.stats.opaquePredicates++;
              piece = "if(" + opaquePredicate(true) + "){" + piece + "}";
            }
            pieces.push(piece);
          }
          edits.push({
            start: tokens[statements[run.from].start].start,
            end: tokens[statements[run.to - 1].end - 1].end,
            text: buildDispatcher(ctx, pieces, opts.opaquePredicates && chance(0.35))
          });
        }
        for (s = 0; s < statements.length; s++) {
          if (moved[s]) continue;
          var statement = statements[s], list = significantTokensOf(tokens, statement);
          var lastToken = tokens[statement.end - 1];
          var nextStatement = s + 1 < statements.length ? statements[s + 1] : null;
          var neighbourBlocks = false;
          if (nextStatement) {
            var nextFirst = significantTokensOf(tokens, nextStatement)[0];
            neighbourBlocks = !!(nextFirst && INJECTION_BLOCKERS[nextFirst.raw]);
          }
          if (list[0] && list[0].raw === "do") neighbourBlocks = true;
          var endsWithSemicolon = lastToken.type === "punct" && lastToken.raw === ";";
          var terminates = !!(list[0] && /^(?:return|throw|break|continue)$/.test(list[0].raw));
          // An injected "if" reports undefined, which would replace the script
          // completion value, so the final top level statement stays untouched.
          var keepsCompletion = region.depth === 0 && s === statements.length - 1;
          if (opts.deadCodeInjection && endsWithSemicolon && !neighbourBlocks && !terminates &&
            !keepsCompletion && (s === statements.length - 1 || chance(0.25))) {
            ctx.stats.deadCodeBlocks++;
            edits.push({ start: lastToken.end, end: lastToken.end, text: deadStatement(ctx) });
          }
          if (opts.opaquePredicates && eligible[s] && !neighbourBlocks && !keepsCompletion && chance(0.18)) {
            ctx.stats.opaquePredicates++;
            edits.push({
              start: tokens[statement.start].start,
              end: lastToken.end,
              text: "if(" + opaquePredicate(true) + "){" + codeSlice(text, tokens, statement) + "}"
            });
          }
        }
      }
      if (!edits.length) { pass++; continue; }
      edits.sort(function (a, b) { return b.start - a.start || b.end - a.end; });
      var lastStart = Infinity, applied = 0;
      for (i = 0; i < edits.length; i++) {
        if (edits[i].end > lastStart) continue;
        text = text.slice(0, edits[i].start) + edits[i].text + text.slice(edits[i].end);
        lastStart = edits[i].start;
        applied++;
      }
      pass++;
      if (!applied) break;
    }
    return text;
  }

  /* =========================================================================
   * 12. Runtime guards
   * ====================================================================== */
  var HASH_SEED = 5381;
  // Whitespace is ignored by the hash, so reformatting the output does not trip
  // the guard while renaming or patching generated functions does.
  function hashText(text) {
    var hash = HASH_SEED;
    for (var i = 0; i < text.length; i++) {
      var code = text.charCodeAt(i);
      if (code <= 32) continue;
      hash = ((hash << 5) + hash + code) >>> 0;
    }
    return hash;
  }
  // A prelude that verifies its own probe function (and the generated decoder
  // when one exists) using Function.prototype.toString(). Any reformatting or
  // patching of the output makes the hashes differ and the script throws.
  function buildSelfDefending(ctx, probeText) {
    var probeName = ctx.pool.name(4), hashName = ctx.pool.name(4);
    var textName = ctx.pool.name(4), hashVar = ctx.pool.name(4), indexVar = ctx.pool.name(3);
    var codeVar = ctx.pool.name(3);
    var expected = hashText(probeText);
    var decoyA = randInt(0xffff), decoyB = randInt(0xffff);
    var probe = "var " + probeName + "=" + probeText + ";";
    var text = ";(function(){" + probe +
      "var " + hashName + "=function(" + textName + "){" +
      "var " + hashVar + "=" + HASH_SEED + ";for(var " + indexVar + "=0;" + indexVar + "<" +
      textName + ".length;" + indexVar + "++){var " + codeVar + "=" + textName + ".charCodeAt(" + indexVar + ");" +
      "if(" + codeVar + ">32)" + hashVar + "=((" + hashVar + "<<5)+" + hashVar + "+" + codeVar + ")>>>0;}" +
      "return " + hashVar + ";};" +
      "if(" + hashName + "(" + probeName + ".toString())!==" + encodeNumberExpr(expected) + "||" +
      "(" + encodeNumberExpr(decoyA) + "^" + encodeNumberExpr(decoyB) + ")!==(" + encodeNumberExpr(decoyA ^ decoyB) + ")){" +
      "throw new Error(\"Unexpected token\");}" +
      (ctx.decoderText
        ? "if(typeof " + ctx.names.runtime + "===\"function\"&&" + hashName + "(" + ctx.names.runtime + ".toString())!==" +
        encodeNumberExpr(hashText(ctx.decoderText)) + "){" +
        "throw new Error(\"Unexpected token\");}"
        : "") +
      "})();";
    return { text: text, probeText: probeText };
  }
  function buildDebugProtection(ctx) {
    var tick = ctx.pool.name(4), timer = ctx.pool.name(4), start = ctx.pool.name(4);
    var interval = Math.max(50, Math.floor(ctx.opts.debugProtectionInterval));
    return ";(function(){" +
      "var " + tick + "=function(){var " + start + "=(new Date()).getTime();debugger;" +
      "return (new Date()).getTime()-" + start + ";};" +
      "if(typeof setInterval===\"function\"){" +
      "var " + timer + "=setInterval(" + tick + "," + interval + ");" +
      "if(" + timer + "&&typeof " + timer + ".unref===\"function\")" + timer + ".unref();" +
      "}})();";
  }
  function buildConsoleSilencer(ctx) {
    var list = ctx.pool.name(4), index = ctx.pool.name(3);
    return ";(function(){" +
      "if(typeof console===\"undefined\")return;" +
      "var " + list + "=[\"log\",\"info\",\"warn\",\"error\",\"debug\",\"trace\",\"dir\",\"table\",\"group\",\"groupEnd\",\"time\",\"timeEnd\",\"assert\",\"count\"];" +
      "for(var " + index + "=0;" + index + "<" + list + ".length;" + index + "++){" +
      "try{console[" + list + "[" + index + "]]=function(){};}catch(e){" + index + "=0;}}" +
      "})();";
  }

  /* =========================================================================
   * 13. Output compaction (token aware: never touches string/template bodies)
   * ====================================================================== */
  function compact(code) {
    var tokens = tokenize(code), from = 0, to = tokens.length, out = "";
    while (from < to && tokens[from].type === "space") from++;
    while (to > from && tokens[to - 1].type === "space") to--;
    for (var i = from; i < to; i++) {
      var token = tokens[i];
      if (token.type === "space") {
        var lineComment = i > from && tokens[i - 1].type === "comment" && tokens[i - 1].raw.slice(0, 2) === "//";
        out += token.raw.indexOf("\n") === -1 && !lineComment ? " " : "\n";
      } else {
        out += token.raw;
      }
    }
    return out;
  }

  /* =========================================================================
   * 14. The pipeline
   * ====================================================================== */
  function obfuscateWithStats(source, options) {
    if (typeof source !== "string") throw new TypeError(NAME + ": source must be a string");
    var opts = resolveOptions(options);
    var stats = {
      identifiersRenamed: 0, identifiersEscaped: 0, stringsEncrypted: 0, stringsSplit: 0,
      stringArrayEntries: 0, numbersEncoded: 0, controlFlowBlocks: 0, deadCodeBlocks: 0,
      opaquePredicates: 0, originalBytes: 0, obfuscatedBytes: 0, ratio: 1,
      techniques: [], seed: opts.seed === null ? null : opts.seed
    };
    var warnings = [];
    stats.originalBytes = byteLength(source);
    seedRandom(opts.seed);

    var ctx = {
      opts: opts, warnings: warnings, stats: stats, pool: new NamePool(),
      generatedNames: Object.create(null), names: {}, hasRuntime: false, decoderText: ""
    };

    var scanTokens = tokenize(source), i, key;
    for (i = 0; i < scanTokens.length; i++) {
      if (scanTokens[i].type === "word") ctx.pool.add(scanTokens[i].raw);
    }
    ctx.names = {
      runtime: ctx.pool.name(6), decoder: ctx.pool.name(5), array: ctx.pool.name(4),
      map: ctx.pool.name(4), key: ctx.pool.name(3), alphabet: ctx.pool.name(4)
    };
    for (key in ctx.names) {
      if (Object.prototype.hasOwnProperty.call(ctx.names, key)) ctx.generatedNames[ctx.names[key]] = true;
    }

    // Renaming is unsafe when the input can reach bindings dynamically. The
    // checks work on tokens, so "eval(" inside a string literal does not count.
    var depth = 0, moduleSyntax = false, dynamicScope = false, dynamicCode = false;
    for (i = 0; i < scanTokens.length; i++) {
      var token = scanTokens[i];
      if (token.type === "punct") {
        if (token.raw === "{" || token.raw === "(" || token.raw === "[") depth++;
        else if (token.raw === "}" || token.raw === ")" || token.raw === "]") depth--;
        continue;
      }
      if (token.type !== "word") continue;
      if (depth === 0 && (token.raw === "import" || token.raw === "export")) moduleSyntax = true;
      var afterWord = significant(scanTokens, i, 1);
      if (afterWord && afterWord.raw === "(") {
        if (token.raw === "eval" || token.raw === "with") dynamicScope = true;
        else if (token.raw === "Function") dynamicCode = true;
      }
    }
    if (moduleSyntax) {
      opts.skipMangling = true;
      warnings.push("Module syntax (import/export) detected: identifier mangling and escaping were skipped.");
    }
    if (dynamicScope) {
      opts.skipMangling = true;
      warnings.push("eval() or with() detected: identifier mangling and escaping were skipped, because dynamic scope cannot be analysed.");
    } else if (dynamicCode) {
      opts.skipMangling = true;
      warnings.push("Function() is called with generated source: identifier mangling and escaping were skipped, because the generated code may reference local names.");
    }

    // A leading "use strict" directive is lifted out and re-emitted in front of
    // every generated statement, so the program keeps its strict semantics.
    var code = source, strictText = "";
    var directive = significantIndex(scanTokens, -1, 1);
    if (directive !== -1 && scanTokens[directive].type === "string" &&
      literalValue(scanTokens[directive].raw) === "use strict") {
      var afterDirective = significantIndex(scanTokens, directive, 1);
      var lineBreakAfter = directive + 1 < scanTokens.length &&
        scanTokens[directive + 1].type === "space" &&
        scanTokens[directive + 1].raw.indexOf("\n") !== -1;
      var isDirective = afterDirective === -1 || scanTokens[afterDirective].raw === ";" || lineBreakAfter;
      if (isDirective) {
        var cut = scanTokens[directive].end;
        if (afterDirective !== -1 && scanTokens[afterDirective].raw === ";") cut = scanTokens[afterDirective].end;
        strictText = "\"use strict\";";
        code = source.slice(cut);
      }
    }

    if (opts.identifierMangling) {
      var mangled = mangleIdentifiers(code, ctx);
      code = mangled.code;
      stats.identifiersRenamed = Object.keys(mangled.map).length;
      if (stats.identifiersRenamed) stats.techniques.push("identifierMangling");
      if (opts.preserveFunctionNames) stats.techniques.push("preserveFunctionNames");
    }
    if (opts.numberEncoding) {
      code = encodeNumbers(code, ctx);
      if (stats.numbersEncoded) stats.techniques.push("numberEncoding");
    }
    ctx.hasRuntime = !!opts.stringEncryption;
    if (opts.controlFlowFlattening || opts.deadCodeInjection || opts.opaquePredicates) {
      stats.controlFlowBlocks = 0;
      stats.deadCodeBlocks = 0;
      stats.opaquePredicates = 0;
      code = applyStructuralTransforms(code, ctx);
      if (stats.controlFlowBlocks) stats.techniques.push("controlFlowFlattening");
      if (stats.deadCodeBlocks) stats.techniques.push("deadCodeInjection");
      if (stats.opaquePredicates) stats.techniques.push("opaquePredicates");
    }
    var strings = encodeStrings(code, ctx);
    code = strings.code;
    stats.stringsEncrypted = strings.count;
    stats.stringsSplit = strings.split;
    stats.stringArrayEntries = strings.entries;
    ctx.decoderText = strings.decoderText;
    ctx.hasRuntime = strings.runtime !== "";
    if (stats.stringsEncrypted) {
      stats.techniques.push("stringEncryption");
      if (opts.stringEncoding === "rc4" || opts.stringAlphabet === "shuffled") stats.techniques.push("stringCipher");
      if (stats.stringArrayEntries > stats.stringsEncrypted) stats.techniques.push("stringArrayDecoys");
    }
    if (stats.stringsSplit) stats.techniques.push("stringSplitting");
    if (opts.identifierEscaping) {
      var escaped = escapeIdentifiers(code, ctx);
      code = escaped.code;
      stats.identifiersEscaped = escaped.count;
      if (stats.identifiersEscaped) stats.techniques.push("identifierEscaping");
    }

    // Guards that must be in place before the payload runs come first, then the
    // generated runtime, then the self-defending check (which hashes it), then
    // the obfuscated program itself. There is nothing to guard when the input
    // carries no code at all (comments or a lone directive).
    var hasCode = false;
    var codeTokens = tokenize(code);
    for (i = 0; i < codeTokens.length; i++) {
      if (isSignificant(codeTokens[i])) { hasCode = true; break; }
    }
    if (!hasCode) {
      opts = Object.assign({}, opts, {
        selfDefending: false, debugProtection: false, disableConsoleOutput: false
      });
    }
    var preludes = "";
    if (opts.disableConsoleOutput) {
      preludes += buildConsoleSilencer(ctx) + "\n";
      stats.techniques.push("disableConsoleOutput");
    }
    if (opts.debugProtection) {
      preludes += buildDebugProtection(ctx) + "\n";
      stats.techniques.push("debugProtection");
    }
    var runtime = ctx.hasRuntime ? strings.runtime + "\n" : "";
    var guards = "";
    if (opts.selfDefending) {
      var probeArgument = ctx.pool.name(3);
      var probe = "function(" + probeArgument + "){return (" + probeArgument + "^" +
        encodeNumberExpr(randInt(0xffff)) + ")>>>0;}";
      guards = buildSelfDefending(ctx, probe).text + "\n";
      stats.techniques.push("selfDefending");
    }
    var body = preludes + runtime + guards + code;
    var preface = strictText;
    var output;
    if (opts.wrapInIife) {
      output = "(function(){" + (preface ? preface + "\n" : "") + body + "\n})();";
      stats.techniques.push("wrapInIife");
    } else {
      output = (preface ? preface + "\n" : "") + body;
    }
    if (opts.compactOutput) output = compact(output);
    try {
      new Function(output);
    } catch (error) {
      warnings.push("Output failed to parse: " + (error && error.message ? error.message : String(error)));
    }
    stats.obfuscatedBytes = byteLength(output);
    stats.ratio = stats.originalBytes > 0 ? stats.obfuscatedBytes / stats.originalBytes : 1;
    return { code: output, stats: stats, warnings: warnings };
  }

  function obfuscate(source, options) { return obfuscateWithStats(source, options).code; }
  function measure(source, options) {
    var result = obfuscateWithStats(source, options);
    return {
      originalBytes: result.stats.originalBytes,
      obfuscatedBytes: result.stats.obfuscatedBytes,
      ratio: result.stats.ratio
    };
  }

  var techniques = [
    { key: "identifierMangling", name: "Identifier mangling", summary: "Renames declared bindings that provably stay inside their own scope.", changesBehavior: false },
    { key: "preserveFunctionNames", name: "Preserve function names", summary: "Keeps function and class names, so Function#name and constructor.name stay readable.", changesBehavior: false },
    { key: "identifierEscaping", name: "Identifier escaping", summary: "Rewrites identifiers with unicode escapes such as \\u005f0x1.", changesBehavior: false },
    { key: "stringEncryption", name: "String encryption", summary: "Moves string literals into an encoded array with a generated decoder.", changesBehavior: false },
    { key: "stringSplitting", name: "String splitting", summary: "Splits long strings into concatenated chunks, optionally as separate array entries.", changesBehavior: false },
    { key: "stringCipher", name: "Alphabet substitution", summary: "Encodes the string array with a shuffled Base64 alphabet and/or RC4.", changesBehavior: false },
    { key: "stringArrayDecoys", name: "String array decoys", summary: "Adds unused entries to the string array.", changesBehavior: false },
    { key: "numberEncoding", name: "Number encoding", summary: "Rewrites numeric literals as arithmetic, hex, binary, octal or bit expressions.", changesBehavior: false },
    { key: "controlFlowFlattening", name: "Control flow flattening", summary: "Moves statement runs into a shuffled switch dispatcher, inside function bodies as well as at top level.", changesBehavior: false },
    { key: "deadCodeInjection", name: "Dead code injection", summary: "Inserts unreachable decoy statements, including never-selected dispatcher cases.", changesBehavior: false },
    { key: "opaquePredicates", name: "Opaque predicates", summary: "Wraps statements in conditions whose value is computed at obfuscation time.", changesBehavior: false },
    { key: "selfDefending", name: "Self-defending prelude", summary: "Hashes generated functions and throws when they have been patched (whitespace-only edits are tolerated).", changesBehavior: true },
    { key: "debugProtection", name: "Debug protection", summary: "Installs a recurring debugger trap through a guarded setInterval.", changesBehavior: true },
    { key: "disableConsoleOutput", name: "Console silencing", summary: "Replaces console methods with no-ops.", changesBehavior: true },
    { key: "wrapInIife", name: "IIFE wrapper", summary: "Wraps the program so top-level declarations stop leaking globals.", changesBehavior: true }
  ];

  return {
    NAME: NAME,
    VERSION: VERSION,
    BANNER: BANNER,
    presets: presets,
    defaultOptions: defaultOptions,
    techniques: techniques,
    resolveOptions: resolveOptions,
    obfuscate: obfuscate,
    obfuscateWithStats: obfuscateWithStats,
    measure: measure
  };
});
