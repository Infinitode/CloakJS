/*!
 * CloakJS v1.2.0 — JavaScript Obfuscator
 * https://github.com/Infinitode/CloakJS
 *
 * A single-file, dependency-free JavaScript obfuscator for browsers and Node.
 * Load with a <script> tag to register global CloakJS, or require() in Node.
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

  var VERSION = "1.2.0";
  var NAME = "CloakJS";
  var BANNER = NAME + " v" + VERSION + " — JavaScript obfuscator · MIT License";
  var HEX = "0123456789abcdef";

  var RESERVED = [
    "__RESULT__", "__done",
    "break", "case", "catch", "class", "const", "continue", "debugger",
    "default", "delete", "do", "else", "enum", "export", "extends", "false",
    "finally", "for", "function", "if", "import", "in", "instanceof", "new",
    "null", "return", "super", "switch", "this", "throw", "true", "try",
    "typeof", "var", "void", "while", "with", "yield", "let", "static",
    "await", "async", "of", "as", "from",
    "window", "document", "console", "globalThis", "Math", "Object", "Array",
    "String", "Number", "Boolean", "JSON", "Date", "RegExp", "Error",
    "Promise", "Map", "Set", "WeakMap", "WeakSet", "Symbol", "Reflect",
    "Proxy", "Function", "arguments", "undefined", "Infinity", "NaN",
    "parseInt", "parseFloat", "isNaN", "isFinite", "encodeURIComponent",
    "decodeURIComponent", "encodeURI", "decodeURI", "eval", "setTimeout",
    "setInterval", "clearTimeout", "clearInterval", "require", "module",
    "exports", "__dirname", "__filename", "process"
  ];
  var RESERVED_SET = Object.create(null);
  for (var _ri = 0; _ri < RESERVED.length; _ri++) RESERVED_SET[RESERVED[_ri]] = true;

  var INTERNAL = [
    "_0xa", "_0xdc", "_0xord", "_0xst", "_0xbt", "_0xba", "_0xbi", "_0xb1",
    "_0xbn", "_0xbs", "_0xh", "_0xs", "_0xo", "_0xr", "_0xj", "_0xii",
    "_0xl", "_0xk", "_0xt", "_0xv", "_0xpi", "_0xd", "_0xsd", "_0xf",
    "_0xi", "_0xd1", "_0xd2", "_0xd4", "_0xd5", "_0xd6", "_0x9a", "_0xb", "_0xe"
  ];
  var INTERNAL_SET = Object.create(null);
  for (var _ii = 0; _ii < INTERNAL.length; _ii++) INTERNAL_SET[INTERNAL[_ii]] = true;

  var defaultOptions = {
    identifierMangling: true,
    stringEncryption: true,
    numberEncoding: true,
    controlFlowFlattening: true,
    deadCodeInjection: true,
    selfDefending: true,
    compactOutput: true
  };
  var presets = {
    off: { identifierMangling: false, stringEncryption: false, numberEncoding: false, controlFlowFlattening: false, deadCodeInjection: false, selfDefending: false, compactOutput: true },
    low: { identifierMangling: true, stringEncryption: false, numberEncoding: false, controlFlowFlattening: false, deadCodeInjection: false, selfDefending: false, compactOutput: true },
    medium: { identifierMangling: true, stringEncryption: true, numberEncoding: true, controlFlowFlattening: false, deadCodeInjection: false, selfDefending: false, compactOutput: true },
    high: { identifierMangling: true, stringEncryption: true, numberEncoding: true, controlFlowFlattening: true, deadCodeInjection: true, selfDefending: true, compactOutput: true },
    extreme: { identifierMangling: true, stringEncryption: true, numberEncoding: true, controlFlowFlattening: true, deadCodeInjection: true, selfDefending: true, compactOutput: true }
  };

  function randInt(max) { return Math.floor(Math.random() * max); }
  function randomHexName(len) {
    var s = "_0x";
    for (var i = 0; i < len; i++) s += HEX[randInt(16)];
    return s;
  }
  function randomUnicodeName(len) {
    var s = "_";
    for (var i = 0; i < len; i++) s += String.fromCharCode(0x4e00 + randInt(0x9fff - 0x4e00));
    return s;
  }
  function pickName(pool, existing, len) {
    len = len || 8;
    var name, tries = 0;
    do {
      name = randInt(2) === 0 ? randomHexName(len) : randomUnicodeName(len);
      if (++tries > 64) { len++; tries = 0; }
    } while (pool[name] || RESERVED_SET[name] || existing[name] || INTERNAL_SET[name]);
    pool[name] = true;
    return name;
  }
  function byteLength(s) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(s).length;
    // UTF-8 length without relying on Node's Buffer.
    return unescape(encodeURIComponent(s)).length;
  }
  function toBase64(s) {
    var hex = "";
    for (var i = 0; i < s.length; i++) hex += ("0" + s.charCodeAt(i).toString(16)).slice(-2);
    return base64Encode(hex);
  }
  // Works in browsers and in older Node versions without btoa.
  function base64Encode(s) {
    if (typeof btoa === "function") return btoa(s);
    if (typeof Buffer !== "undefined") return Buffer.from(s, "latin1").toString("base64");
    throw new Error("CloakJS: Base64 encoding is unavailable");
  }
  function rc4(key, data) {
    var s = new Uint8Array(256), i, j, k;
    for (i = 0; i < 256; i++) s[i] = i;
    j = 0;
    for (i = 0; i < 256; i++) {
      j = (j + s[i] + key.charCodeAt(i % key.length)) & 0xff;
      k = s[i]; s[i] = s[j]; s[j] = k;
    }
    i = 0; j = 0;
    var out = [];
    for (var n = 0; n < data.length; n++) {
      i = (i + 1) & 0xff; j = (j + s[i]) & 0xff;
      k = s[i]; s[i] = s[j]; s[j] = k;
      out.push(data.charCodeAt(n) ^ s[(s[i] + s[j]) & 0xff]);
    }
    var result = "";
    for (var start = 0; start < out.length; start += 8192) {
      result += String.fromCharCode.apply(null, out.slice(start, start + 8192));
    }
    return result;
  }

  // A small lexer: preserve strings, templates, regexes and comments as opaque
  // spans. This is deliberately not a full JavaScript parser.
  function tokenize(code) {
    var out = [], i = 0, last = null;
    function emit(type, start, end) {
      var token = { type: type, raw: code.slice(start, end), start: start, end: end };
      out.push(token);
      if (type !== "space" && type !== "comment") last = token;
    }
    function regexAllowed() {
      if (!last) return true;
      if (last.type === "word") return /^(return|throw|case|delete|void|typeof|instanceof|in|of|yield|await|else|do)$/.test(last.raw);
      return last.type === "punct" && /^(=|\(|\[|\{|,|;|:|!|&|\||\?|\+|-|\*|~|\^|%|<|>)$/.test(last.raw);
    }
    while (i < code.length) {
      var start = i, c = code[i];
      if (/\s/.test(c)) {
        while (i < code.length && /\s/.test(code[i])) i++;
        emit("space", start, i);
      } else if (c === "/" && code[i + 1] === "/") {
        i = code.indexOf("\n", i + 2);
        if (i < 0) i = code.length;
        emit("comment", start, i);
      } else if (c === "/" && code[i + 1] === "*") {
        var end = code.indexOf("*/", i + 2);
        i = end < 0 ? code.length : end + 2;
        emit("comment", start, i);
      } else if (c === "'" || c === '"' || c === "`") {
        i++;
        while (i < code.length) {
          if (code[i] === "\\") { i += 2; continue; }
          if (code[i++] === c) break;
        }
        emit(c === "`" ? "template" : "string", start, i);
      } else if (c === "/" && regexAllowed()) {
        i++;
        var inClass = false;
        while (i < code.length) {
          if (code[i] === "\\") { i += 2; continue; }
          if (code[i] === "[") inClass = true;
          else if (code[i] === "]") inClass = false;
          else if (code[i] === "/" && !inClass) { i++; break; }
          i++;
        }
        while (i < code.length && /[a-z]/i.test(code[i])) i++;
        emit("regex", start, i);
      } else if (/[A-Za-z_$]/.test(c)) {
        i++;
        while (i < code.length && /[A-Za-z0-9_$]/.test(code[i])) i++;
        emit("word", start, i);
      } else if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(code[i + 1] || ""))) {
        var match = /^(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.[\d_]+)(?:[eE][+-]?[\d_]+)?)(n?)/.exec(code.slice(i));
        i += match ? match[0].length : 1;
        emit("number", start, i);
      } else {
        i++;
        emit("punct", start, i);
      }
    }
    return out;
  }
  function joinTokens(tokens) {
    return tokens.map(function (t) { return t.raw; }).join("");
  }
  function significant(tokens, index, direction) {
    for (var i = index + direction; i >= 0 && i < tokens.length; i += direction) {
      if (tokens[i].type !== "space" && tokens[i].type !== "comment") return tokens[i];
    }
    return null;
  }

  // Only rename declared bindings with no member/property use anywhere in the
  // input. A plain-text global replacement is not safe for JavaScript.
  function mangleIdentifiers(code, opts) {
    if (!opts.identifierMangling) return { code: code, map: {} };
    var tokens = tokenize(code), bindings = Object.create(null), existing = Object.create(null);
    var i, t, prev, next;
    for (i = 0; i < tokens.length; i++) {
      t = tokens[i];
      if (t.type === "word") existing[t.raw] = true;
    }
    for (i = 0; i < tokens.length; i++) {
      t = tokens[i];
      if (t.type !== "word" || RESERVED_SET[t.raw] || INTERNAL_SET[t.raw] || t.raw.length === 1) continue;
      prev = significant(tokens, i, -1);
      if (prev && /^(var|let|const|function)$/.test(prev.raw)) bindings[t.raw] = true;
    }
    // If the spelling appears as a property, object key, shorthand, or is used
    // by eval, don't rename it. This sacrifices coverage for safer output.
    if (/\beval\s*\(|\bwith\s*\(/.test(code) || tokens.some(function (t) {
      return t.type === "template" && t.raw.indexOf("${") !== -1;
    })) bindings = Object.create(null);
    for (i = 0; i < tokens.length; i++) {
      t = tokens[i];
      if (!bindings[t.raw]) continue;
      prev = significant(tokens, i, -1);
      next = significant(tokens, i, 1);
      if ((prev && (prev.raw === "." || prev.raw === "?" && significant(tokens, i - 1, -1) && significant(tokens, i - 1, -1).raw === ".")) ||
          (next && next.raw === ":") ||
          (prev && (prev.raw === "{" || prev.raw === ",") && next &&
           (next.raw === "," || next.raw === "}" || next.raw === "("))) {
        delete bindings[t.raw];
      }
    }
    var pool = Object.create(null), map = Object.create(null);
    for (i = 0; i < INTERNAL.length; i++) pool[INTERNAL[i]] = true;
    for (var id in bindings) map[id] = pickName(pool, existing, 8);
    for (i = 0; i < tokens.length; i++) {
      t = tokens[i];
      if (t.type === "word" && map[t.raw]) t.raw = map[t.raw];
    }
    return { code: joinTokens(tokens), map: map };
  }

  function buildDecoder(key) {
    return (
      'var _0xdc=function(_0xpi){var _0xv=_0xa[_0xpi];' +
      'if(_0xv===undefined)return _0xv;' +
      'var _0xh=atob(_0xv),_0xs=new Uint8Array(_0xh.length>>1);' +
      'for(var _0xbi=0;_0xbi<_0xs.length;_0xbi++)_0xs[_0xbi]=parseInt(_0xh.substr(_0xbi<<1,2),16);' +
      'var _0xk="' + key + '",_0xr=new Uint8Array(256);' +
      'for(var _0xi=0;_0xi<256;_0xi++)_0xr[_0xi]=_0xi;' +
      'var _0xj=0;for(var _0xi=0;_0xi<256;_0xi++){' +
      '_0xj=(_0xj+_0xr[_0xi]+_0xk.charCodeAt(_0xi%_0xk.length))&255;' +
      'var _0xt=_0xr[_0xi];_0xr[_0xi]=_0xr[_0xj];_0xr[_0xj]=_0xt;}' +
      'var _0xii=0;_0xj=0;var _0xo=new Uint8Array(_0xs.length);' +
      'for(var _0xl=0;_0xl<_0xs.length;_0xl++){' +
      '_0xii=(_0xii+1)&255;_0xj=(_0xj+_0xr[_0xii])&255;' +
      'var _0xt=_0xr[_0xii];_0xr[_0xii]=_0xr[_0xj];_0xr[_0xj]=_0xt;' +
      '_0xo[_0xl]=_0xs[_0xl]^_0xr[(_0xr[_0xii]+_0xr[_0xj])&255];}' +
      'var _0xsd=new TextDecoder().decode(_0xo);return _0xsd;};'
    );
  }
  function utf8Bytes(value) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(value);
    var binary = unescape(encodeURIComponent(value)), bytes = [];
    for (var i = 0; i < binary.length; i++) bytes.push(binary.charCodeAt(i));
    return bytes;
  }
  function encryptStrings(code, opts) {
    if (!opts.stringEncryption) return { code: code, count: 0 };
    var tokens = tokenize(code), key = randomHexName(10), encrypted = [];
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t.type !== "string") continue;
      // Do not turn directive prologues or property keys into expressions.
      var prev = significant(tokens, i, -1), next = significant(tokens, i, 1);
      if ((next && next.raw === ":") ||
          (next && next.raw === "(" && prev &&
           (prev.raw === "{" || prev.raw === "," || prev.raw === "get" || prev.raw === "set")) ||
          ((!prev || prev.raw === "{" || prev.raw === ";") &&
          (t.raw === '"use strict"' || t.raw === "'use strict'" ||
           t.raw === '"use asm"' || t.raw === "'use asm'")) ||
          (prev && (prev.raw === "from" || prev.raw === "import" || prev.raw === "export"))) continue;
      var value;
      try { value = Function('"use strict";return (' + t.raw + ')')(); } catch (e) { continue; }
      if (!value) continue;
      var bytes = utf8Bytes(value), binary = "";
      for (var j = 0; j < bytes.length; j++) binary += String.fromCharCode(bytes[j]);
      encrypted.push(toBase64(rc4(key, binary)));
      t.raw = "_0xdc(" + (encrypted.length - 1) + ")";
    }
    if (!encrypted.length) return { code: code, count: 0 };
    var arrayDecl = "var _0xa=[" + encrypted.map(function (e) { return '"' + e + '"'; }).join(",") + "];";
    return { code: arrayDecl + buildDecoder(key) + joinTokens(tokens), count: encrypted.length };
  }

  function encodeNumberExpr(n) {
    if (Number.isSafeInteger(n)) {
      var mode = randInt(3);
      var hex = n < 0 ? "-0x" + (-n).toString(16) : "0x" + n.toString(16);
      if (mode === 0) return hex;
      if (Math.abs(n) < 4096) {
        if (mode === 1) { var a = randInt(64) + 1; return a + "+" + (n - a); }
        var b = randInt(32) + 2, q = Math.round(n / b);
        return b + "*" + q + "+" + (n - b * q);
      }
      return hex;
    }
    return String(n);
  }
  function encodeNumbers(code, opts) {
    if (!opts.numberEncoding) return { code: code, count: 0 };
    var tokens = tokenize(code), count = 0;
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t.type !== "number" || t.raw.length <= 1 || /n$/.test(t.raw)) continue;
      var prev = significant(tokens, i, -1), next = significant(tokens, i, 1);
      // Avoid property names, object keys, optional chaining and numeric method calls.
      if ((next && (next.raw === ":" || next.raw === "." ||
          next.raw === "(" && prev && (prev.raw === "{" || prev.raw === ","))) ||
          (prev && prev.raw === ".")) continue;
      var num = Number(t.raw);
      if (!isFinite(num)) continue;
      t.raw = "(" + encodeNumberExpr(num) + ")";
      count++;
    }
    return { code: joinTokens(tokens), count: count };
  }

  var DECOYS = [
    "if(false){void 1}",
    "if(false){void 2}",
    "if(false){void 3}"
  ];
  function makeDeadCodeStatements(realCount) {
    var want = Math.min(DECOYS.length, Math.max(1, Math.ceil(realCount / 3)));
    return DECOYS.slice(0, want);
  }

  // Split only at top-level semicolons. A newline is not necessarily a
  // statement boundary (e.g. a multi-line expression or return value).
  function splitTopLevel(code) {
    var tokens = tokenize(code), out = [], start = 0, depth = 0;
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t.type !== "punct") continue;
      if (t.raw === "{" || t.raw === "(" || t.raw === "[") depth++;
      if (t.raw === "}" || t.raw === ")" || t.raw === "]") depth--;
      if (t.raw === ";" && depth === 0) {
        var part = code.slice(start, t.end).trim();
        if (part) out.push(part);
        start = t.end;
      }
    }
    var tail = code.slice(start).trim();
    if (tail) out.push(tail);
    return out;
  }
  function flattenControlFlow(code, opts) {
    // A dispatcher changes lexical scope, hoisting, directive prologues and
    // completion values. Only use it for self-contained expression statements.
    var stmts = splitTopLevel(code), deadCount = 0;
    var safe = stmts.length > 1 && stmts.every(function (s) {
      return /^(?:[A-Za-z_$][\w$]*\.)*[A-Za-z_$][\w$]*\s*\(/.test(s) &&
        !/\b(?:return|throw|break|continue|await|yield|var|let|const|function|class|import|export)\b/.test(s);
    });
    if (!safe || !opts.controlFlowFlattening) {
      if (opts.deadCodeInjection && stmts.length) {
        var extras = makeDeadCodeStatements(stmts.length);
        deadCount = extras.length;
        return { code: code + "\n;" + extras.join(";"), deadCount: deadCount, flattened: false };
      }
      return { code: code, deadCount: 0, flattened: false };
    }
    if (opts.deadCodeInjection) {
      var decoys = makeDeadCodeStatements(stmts.length);
      deadCount = decoys.length;
      stmts = stmts.concat(decoys);
    }
    // Scramble case layout, not execution order: side effects must stay ordered.
    var indices = stmts.map(function (_, i) { return i; });
    for (var i = indices.length - 1; i > 0; i--) {
      var j = randInt(i + 1), tmp = indices[i]; indices[i] = indices[j]; indices[j] = tmp;
    }
    var cases = indices.map(function (k) {
      return "case " + k + ":{" + stmts[k] + "}break;";
    });
    return {
      code: "var _0xord=[" + stmts.map(function (_, k) { return k; }).join(",") + "];" +
        "for(var _0xst=0;_0xst<_0xord.length;_0xst++){switch(_0xord[_0xst]){" + cases.join("") + "}}",
      deadCount: deadCount,
      flattened: true
    };
  }
  function selfDefend(opts) {
    // A harmless, isolated prelude. Freezing Object.prototype (as in the
    // original sketch) mutates the host application and is intentionally avoided.
    if (!opts.selfDefending) return "";
    return '(function(){"use strict";void 0;})();';
  }

  function resolveOptions(options) {
    if (options === undefined || options === null) return Object.assign({}, defaultOptions);
    if (typeof options === "string") {
      if (!Object.prototype.hasOwnProperty.call(presets, options)) {
        throw new Error(NAME + ': unknown preset "' + options + '". Valid presets: ' + Object.keys(presets).join(", "));
      }
      return Object.assign({}, presets[options]);
    }
    if (typeof options !== "object" || Array.isArray(options)) throw new TypeError("CloakJS: options must be a preset name or an object");
    return Object.assign({}, defaultOptions, options);
  }
  function obfuscateWithStats(source, options) {
    if (typeof source !== "string") throw new TypeError("CloakJS: source must be a string");
    var opts = resolveOptions(options), warnings = [];
    // The injected decoder/dispatcher uses fixed helper names. Never shadow a
    // user binding of the same spelling with those helpers.
    if (tokenize(source).some(function (t) { return t.type === "word" && INTERNAL_SET[t.raw]; })) {
      opts.stringEncryption = false;
      opts.controlFlowFlattening = false;
      opts.deadCodeInjection = false;
      warnings.push("Generated helpers skipped because the source uses a reserved helper name.");
    }
    var stats = {
      identifiersRenamed: 0, stringsEncrypted: 0, numbersEncoded: 0,
      deadCodeBlocks: 0, originalBytes: byteLength(source), obfuscatedBytes: 0, ratio: 1
    };
    // Keep a top-level strict directive before all generated helpers/preludes.
    var strict = /^(\s*(['"])use strict\2\s*;?)/.exec(source);
    var code = strict ? source.slice(strict[0].length) : source;
    var mangled = mangleIdentifiers(code, opts);
    code = mangled.code;
    stats.identifiersRenamed = Object.keys(mangled.map).length;
    var flat = flattenControlFlow(code, opts);
    code = flat.code;
    stats.deadCodeBlocks = flat.deadCount;
    if (opts.controlFlowFlattening && !flat.flattened && splitTopLevel(source).length > 1) {
      warnings.push("Control-flow flattening skipped for statements that may change scope or behavior.");
    }
    var enc = encryptStrings(code, opts);
    code = enc.code;
    stats.stringsEncrypted = enc.count;
    var nums = encodeNumbers(code, opts);
    code = nums.code;
    stats.numbersEncoded = nums.count;
    code = (strict ? strict[0].trim().replace(/;?$/, ";") + "\n" : "") +
      selfDefend(opts) + (opts.selfDefending ? "\n" : "") + code;
    if (opts.compactOutput) code = code.replace(/\n\s*\n/g, "\n").trim();
    try { new Function(code); } catch (e) {
      warnings.push("Output failed to parse: " + (e && e.message ? e.message : String(e)));
    }
    stats.obfuscatedBytes = byteLength(code);
    stats.ratio = stats.originalBytes > 0 ? stats.obfuscatedBytes / stats.originalBytes : 1;
    return { code: code, stats: stats, warnings: warnings };
  }
  function obfuscate(source, options) { return obfuscateWithStats(source, options).code; }
  function measure(source, options) {
    var res = obfuscateWithStats(source, options);
    return { originalBytes: res.stats.originalBytes, obfuscatedBytes: res.stats.obfuscatedBytes, ratio: res.stats.ratio };
  }
  return {
    NAME: NAME, VERSION: VERSION, BANNER: BANNER, presets: presets,
    defaultOptions: defaultOptions, resolveOptions: resolveOptions,
    obfuscate: obfuscate, obfuscateWithStats: obfuscateWithStats, measure: measure
  };
});
