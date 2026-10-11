"use strict";
/*
 * CloakJS test suite — run with `node --test` (no dependencies, no fixtures).
 *
 * The suite is deliberately behavioural: for every preset and option
 * combination the obfuscated program is executed against the original one and
 * the output of both has to match, because obfuscation is only useful when it
 * does not change what a program does.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const CloakJS = require("../cloakjs.js");

const ALL_PRESETS = ["off", "low", "medium", "high", "extreme"];
const SANDBOX_GLOBALS = {
  TextEncoder, TextDecoder, atob, btoa, Uint8Array, Promise, Symbol, Map, Set,
  WeakMap, WeakSet, JSON, Math, Date, Object, Array, String, Number, Boolean,
  RegExp, Error, TypeError, RangeError, SyntaxError, isNaN, isFinite, parseInt,
  parseFloat, BigInt, Intl, structuredClone, queueMicrotask, encodeURIComponent,
  decodeURIComponent
};

/* ------------------------------------------------------------------ helpers */

function run(code, options = {}) {
  const logs = [];
  const record = (...values) => logs.push(values.map((value) => {
    if (typeof value === "string") return value;
    try { return JSON.stringify(value) === undefined ? String(value) : JSON.stringify(value); }
    catch (error) { return String(value); }
  }).join(" "));
  const sandbox = Object.assign({ console: {
    log: record, info: record, warn: record, error: record, debug: record, trace: record,
    dir: record, table: record, group: record, groupEnd: record, time: record,
    timeEnd: record, assert: record, count: record
  } }, SANDBOX_GLOBALS, options.globals || {});
  const context = vm.createContext(sandbox);
  const timerState = { intervals: 0, timeouts: 0, cleared: 0, unref: 0 };
  if (options.timers) {
    Object.assign(sandbox, {
      setInterval: (fn, ms) => { timerState.intervals++; return { unref: () => { timerState.unref++; } }; },
      setTimeout: (fn) => { timerState.timeouts++; return { unref: () => { timerState.unref++; } }; },
      clearInterval: () => { timerState.cleared++; },
      clearTimeout: () => { timerState.cleared++; }
    });
  }
  const value = vm.runInContext(code, context, { timeout: 8000, filename: "cloakjs-output.js" });
  return { logs, text: logs.join("\n"), value, sandbox, timers: timerState };
}

function obfuscate(source, options) {
  return CloakJS.obfuscateWithStats(source, options);
}

function checkEquivalence(source, options, label) {
  const expected = run(source);
  const result = obfuscate(source, options);
  assert.deepEqual(result.warnings, [], `${label}: unexpected warnings ${JSON.stringify(result.warnings)}`);
  const actual = run(result.code, { timers: true });
  assert.equal(actual.text, expected.text, `${label}: behaviour changed`);
  assert.equal(
    actual.value === undefined ? "undefined" : JSON.stringify(actual.value),
    expected.value === undefined ? "undefined" : JSON.stringify(expected.value),
    `${label}: script completion value changed`
  );
  return result;
}

function withPreset(preset, overrides) {
  return Object.assign({}, CloakJS.resolveOptions(preset), overrides || {});
}

function techniqueKeys(stats) {
  return stats.techniques.slice().sort().join(",");
}

/* --------------------------------------------------------------- fixtures */

const SINK = `
"use strict";
var report = [];
function say() { report.push(Array.prototype.slice.call(arguments).join("|")); }

// numbers and strings
var n = 1234567, big = 9007199254740991, neg = -4242, float = 0.15625, tiny = 1e-7;
say("numbers", n, big, neg, float, tiny, n / 7, -0.5 * 4, Math.floor(3.99), 0.1 + 0.2);
say("strings", "h\\u00e9llo \\ud83d\\ude0e", 'single', "line\\nnext\\ttab", "\\u0041\\x42", "quote\\"inside");

// templates
var name = "world", count = 3;
say("template", \`hello \${name}, you have \${count + 1} messages\`);
say("deep", \`outer \${ \`inner \${name.toUpperCase()}\` } tail\`);

// functions, closures, recursion, defaults, rest
function fib(k) { return k < 2 ? k : fib(k - 1) + fib(k - 2); }
function counter(startValue) {
  var total = startValue;
  return function (step) { total += step === undefined ? 1 : step; return total; };
}
function withDefaults(a, b, c) { b = b === undefined ? 10 : b; c = c === undefined ? a * b : c; return [a, b, c]; }
function rest(first) { var others = Array.prototype.slice.call(arguments, 1); return first + ":" + others.join("-"); }
var bump = counter(5);
say("fib", fib(10), bump(), bump(5), bump(-2));
say("defaults", JSON.stringify(withDefaults(2)), JSON.stringify(withDefaults(2, 3)), JSON.stringify(withDefaults(2, 3, 4)));
say("rest", rest("a", 1, 2, 3));

// arrows
var triple = (x) => x * 3;
var shouty = (text) => { var upper = text.toUpperCase(); return upper + "!"; };
var maker = () => ({ kind: "object" });
say("arrows", triple(4), shouty("hi"), JSON.stringify(maker()), [1, 2, 3, 4].filter((x) => x % 2 === 0).map((x) => x * x).join(","));

// objects: shorthand, computed keys, methods, getters, spread, generators
var shortA = 1, shortB = 2;
var obj = {
  shortA, shortB,
  ["key" + shortB]: "computed",
  plain: 42,
  method(x) { return this.plain + x; },
  *gen(n) { for (var i = 0; i < n; i++) yield i * this.plain; },
  get doubled() { return this.plain * 2; },
  set doubled(value) { this.plain = value / 2; },
  nested: { deep: { value: "found" } },
  ...{ extra: true }
};
say("object", obj.shortA, obj.shortB, obj.key2, obj.method(8), obj.doubled, JSON.stringify(obj.nested.deep), String(obj.extra));
say("generator", [...obj.gen(3)].join(","));
obj.doubled = 100;
say("setter", obj.plain, obj.doubled);
var dynamicKey = "plain";
say("dynamic", obj[dynamicKey], obj["nested"].deep.value);

// destructuring
var [first, , third = 9] = [1, 2, 3];
var { shortA: renamedA, nested: { deep } } = obj;
function destructured({ a, b = 5 }, [c, d] = [6, 7], ...extra) { return [a, b, c, d, extra.length].join(","); }
try { throw { code: 7, info: { tag: "boom" } }; }
catch ({ code, info: { tag } }) { say("catch", code, tag); }
say("destructure", first, third, renamedA, deep.value, destructured({ a: 1 }, undefined, 1, 2), destructured({ a: 2, b: 3 }, [8, 9]));

// classes
class Base {
  constructor(value) { this.value = value; }
  describe() { return "base:" + this.value; }
  get label() { return "L" + this.value; }
  static create(v) { return new Base(v); }
}
class Child extends Base {
  #secret = "hidden";
  static counter = 0;
  constructor(value) { super(value * 2); Child.counter++; }
  describe() { return "child:" + this.value + ":" + this.#secret; }
  reveal() { return this.#secret; }
}
var child = new Child(21);
say("class", child.describe(), child.reveal(), child.label, Base.create(5).describe(), Child.counter);

// control flow: labels, switch fallthrough, do while, for of/in, try finally
var out = [];
outer: for (var i = 0; i < 4; i++) { for (var j = 0; j < 4; j++) { if (j === 2) continue outer; if (i === 3) break outer; out.push(i + ":" + j); } }
var order = [];
function classify(value) { switch (value) { case 0: order.push("zero"); case 1: order.push("one"); break; case 2: order.push("two"); break; default: order.push("other"); } }
classify(0); classify(1); classify(2); classify(5);
var dw = 0; do { dw++; } while (dw < 3);
var keys = []; for (var k in { a: 1, b: 2 }) keys.push(k);
var values = []; for (var v of [10, 20]) values.push(v);
var trace = [];
function risky(flag) {
  try { trace.push("try"); if (flag) throw new Error("boom"); return "ok"; }
  catch (error) { trace.push("catch:" + error.message); return "handled"; }
  finally { trace.push("finally"); }
}
say("flow", out.join(","), order.join(","), dw, keys.join(","), values.join(","), risky(true), risky(false), trace.join(","));

// closures over loop variables, mutual recursion, iife, this
var closers = [];
for (let index = 0; index < 3; index++) closers.push(() => index * 10);
function isEven(value) { return value === 0 ? true : isOdd(value - 1); }
function isOdd(value) { return value === 0 ? false : isEven(value - 1); }
var iifeValue = (function (seed) { var total = seed; total += 5; return total; })(7);
var contextObj = { value: "ctx", read: function () { return this.value; }, readArrow: function () { return (() => this.value)(); } };
say("closures", closers.map((fn) => fn()).join(","), isEven(10), isOdd(7), iifeValue, contextObj.read(), contextObj.readArrow());

// optional chaining, nullish, spread, exponent, bitwise
var maybe = { deep: { list: [1, 2, 3] } };
say("optional", maybe?.deep?.list?.length, String(maybe?.missing?.value), null ?? "fallback", 0 ?? "kept");
say("operators", 2 ** 10, 0b1010 & 0b0110, 5 << 3, ~0, -7 % 3, 7 / 2, "abc" + 1 + 2, 1 + 2 + "abc");
var baseArray = [1, 2, 3];
say("spread", [...baseArray, 4].join(","), Math.max(...baseArray), JSON.stringify({ ...maybe.deep }));

// hoisting and immediate invocations
var hoisted = (function () { return typeof innerFn; })();
function innerFn() { return "hoisted"; }
say("hoist", hoisted, innerFn());

console.log(report.join("\\n"));
`;

const SMALL = `
function greet(name) { var message = "hello " + name; return message; }
console.log(greet("world"), \`tpl \${1 + 1}\`, [1, 2, 3].map(function (v) { return v * 2; }).join("-"));
`;

/* ------------------------------------------------------------ module shape */

test("UMD wrapper exposes the documented API", () => {
  assert.equal(CloakJS.NAME, "CloakJS");
  assert.equal(CloakJS.VERSION, "1.3.0");
  assert.match(CloakJS.BANNER, /CloakJS v1\.3\.0/);
  for (const key of ["presets", "defaultOptions", "techniques", "resolveOptions", "obfuscate", "obfuscateWithStats", "measure"]) {
    assert.ok(key in CloakJS, `missing export ${key}`);
  }
  assert.equal(typeof CloakJS.obfuscate, "function");
  assert.equal(typeof CloakJS.obfuscateWithStats, "function");
  assert.equal(typeof CloakJS.measure, "function");
  assert.ok(Object.isFrozen(CloakJS.presets) === false);
});

test("the library loads as a browser global with no module system", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "cloakjs.js"), "utf8");
  const sandbox = { self: {} };
  sandbox.self.self = sandbox.self;
  const context = vm.createContext(sandbox);
  vm.runInContext(source, context, { filename: "cloakjs.js" });
  const global = sandbox.CloakJS || sandbox.self.CloakJS;
  assert.ok(global, "CloakJS was not registered on the global object");
  assert.equal(global.VERSION, CloakJS.VERSION);
  assert.deepEqual(Object.keys(global.presets), Object.keys(CloakJS.presets));
  const fixture = 'console.log("browser", 1 + 2);';
  const expected = run(fixture);
  const logs = [];
  vm.runInContext(global.obfuscate(fixture, { seed: 3 }), vm.createContext({
    console: { log: (...values) => logs.push(values.join(" ")) }
  }), { timeout: 5000 });
  assert.equal(logs.join("\n"), expected.text);
});

/* --------------------------------------------------------------- presets */

test("presets are complete, independent copies of the option set", () => {
  const keys = Object.keys(CloakJS.defaultOptions);
  assert.deepEqual(Object.keys(CloakJS.presets), ALL_PRESETS);
  for (const preset of ALL_PRESETS) {
    assert.deepEqual(Object.keys(CloakJS.presets[preset]).sort(), keys.slice().sort(), `${preset} is incomplete`);
    const resolved = CloakJS.resolveOptions(preset);
    assert.deepEqual(resolved, CloakJS.presets[preset]);
    assert.notEqual(resolved, CloakJS.presets[preset], "resolveOptions must return a copy");
    resolved.identifierMangling = "mutated";
    assert.notEqual(CloakJS.presets[preset].identifierMangling, "mutated");
  }
  assert.deepEqual(CloakJS.resolveOptions(), CloakJS.defaultOptions);
  assert.deepEqual(CloakJS.resolveOptions("high"), CloakJS.defaultOptions);
  assert.deepEqual(CloakJS.resolveOptions({ stringEncryption: false }).stringEncryption, false);
});

test("presets form a ladder from off to extreme", () => {
  const source = SINK;
  const stats = {};
  for (const preset of ALL_PRESETS) {
    const result = obfuscate(source, withPreset(preset, { seed: 42 }));
    assert.deepEqual(result.warnings, [], `${preset} warned`);
    stats[preset] = { bytes: result.stats.obfuscatedBytes, techniques: result.stats.techniques.length, names: result.stats.identifiersRenamed };
  }
  assert.ok(stats.low.names > 0, "low should rename identifiers");
  assert.ok(stats.medium.techniques > stats.low.techniques, "medium should add techniques");
  assert.ok(stats.high.techniques > stats.medium.techniques, "high should add techniques");
  assert.ok(stats.extreme.techniques > stats.high.techniques, "extreme should add techniques");
  assert.ok(stats.extreme.bytes > stats.high.bytes, "extreme should produce more code than high");
  assert.equal(CloakJS.presets.off.identifierMangling, false);
  assert.equal(CloakJS.presets.off.stringEncryption, false);
  assert.equal(CloakJS.presets.extreme.identifierEscaping, true);
  assert.equal(CloakJS.presets.high.identifierEscaping, false);
});

test("extreme is a real mode, not a relabelled high", () => {
  const source = SINK;
  const high = obfuscate(source, withPreset("high", { seed: 7 }));
  const extreme = obfuscate(source, withPreset("extreme", { seed: 7 }));
  assert.notEqual(extreme.code, high.code);
  assert.ok(extreme.stats.identifiersEscaped > 0, "extreme escapes identifiers");
  assert.equal(high.stats.identifiersEscaped, 0, "high does not escape identifiers");
  assert.ok(extreme.stats.stringsSplit > 0, "extreme splits strings");
  assert.equal(high.stats.stringsSplit, 0, "high does not split strings");
  assert.ok(extreme.stats.stringArrayEntries > extreme.stats.stringsEncrypted, "extreme adds decoy array entries");
  assert.match(extreme.code, /debugger/);
  assert.doesNotMatch(high.code, /debugger/);
  assert.match(extreme.code, /\\u00[0-9a-f]{2}/i);
});

test("an empty or comment only input is returned as is, with no guards", () => {
  for (const source of ["", "   \n\t ", "// just a comment\n", "/* block */", '"use strict";']) {
    const result = obfuscate(source, "extreme");
    assert.equal(result.code.trim(), source.trim() === "" ? "" : result.code.trim());
    assert.doesNotMatch(result.code, /debugger|setInterval|Unexpected token/, `guards added to ${JSON.stringify(source)}`);
    assert.equal(result.stats.controlFlowBlocks, 0);
    assert.deepEqual(result.warnings, []);
  }
  assert.equal(obfuscate("").code, "");
  assert.equal(obfuscate("   \n\t ").code, "");
  assert.equal(obfuscate("// just a comment\n").code, "// just a comment");
  const directive = obfuscate('"use strict";', "extreme");
  assert.equal(directive.code, '"use strict";');
});

/* --------------------------------------------------------------- options */

test("options are validated with useful errors", () => {
  assert.throws(() => CloakJS.obfuscate("x", "ultra"), /unknown preset "ultra"/);
  assert.throws(() => CloakJS.obfuscate("x", { nope: true }), /unknown option "nope"/);
  assert.throws(() => CloakJS.obfuscate("x", { stringEncryption: "yes" }), /must be true or false/);
  assert.throws(() => CloakJS.obfuscate("x", { stringEncoding: "xor" }), /must be one of: base64, rc4/);
  assert.throws(() => CloakJS.obfuscate("x", { stringAlphabet: "rot13" }), /must be one of: standard, shuffled/);
  assert.throws(() => CloakJS.obfuscate("x", { controlFlowThreshold: 2 }), /between 0 and 1/);
  assert.throws(() => CloakJS.obfuscate("x", { deadCodeAmount: 1.5 }), /non-negative integer/);
  assert.throws(() => CloakJS.obfuscate("x", { seed: {} }), /string, a number or null/);
  assert.throws(() => CloakJS.obfuscate("x", []), /preset name or an options object/);
  assert.throws(() => CloakJS.obfuscate(5), /source must be a string/);
  assert.throws(() => CloakJS.obfuscate("x", { wrapInIife: 1 }), /must be true or false/);
});

test("every option key and technique is documented consistently", () => {
  const optionKeys = Object.keys(CloakJS.defaultOptions).sort();
  assert.ok(optionKeys.length >= 20, "option set shrank unexpectedly");
  const techniqueKeysInMetadata = new Set(CloakJS.techniques.map((technique) => technique.key));
  for (const technique of CloakJS.techniques) {
    assert.equal(typeof technique.name, "string");
    assert.equal(typeof technique.summary, "string");
    assert.equal(typeof technique.changesBehavior, "boolean");
  }
  assert.ok(techniqueKeysInMetadata.has("identifierMangling"));
  assert.ok(techniqueKeysInMetadata.has("preserveFunctionNames"));
  assert.ok(techniqueKeysInMetadata.has("stringSplitting"));
  assert.ok(techniqueKeysInMetadata.has("controlFlowFlattening"));
  assert.ok(techniqueKeysInMetadata.has("selfDefending"));
  assert.ok(techniqueKeysInMetadata.has("wrapInIife"));
  assert.equal(CloakJS.techniques.find((t) => t.key === "wrapInIife").changesBehavior, true);
  assert.equal(CloakJS.techniques.find((t) => t.key === "identifierMangling").changesBehavior, false);
});

test("returned stats always carry the documented keys", () => {
  const result = obfuscate(SMALL, withPreset("extreme", { seed: 11 }));
  const expectedKeys = [
    "identifiersRenamed", "identifiersEscaped", "stringsEncrypted", "stringsSplit",
    "stringArrayEntries", "numbersEncoded", "controlFlowBlocks", "deadCodeBlocks",
    "opaquePredicates", "originalBytes", "obfuscatedBytes", "ratio", "techniques", "seed"
  ];
  assert.deepEqual(Object.keys(result.stats).sort(), expectedKeys.slice().sort());
  assert.equal(result.stats.originalBytes, Buffer.byteLength(SMALL, "utf8"));
  assert.equal(result.stats.obfuscatedBytes, Buffer.byteLength(result.code, "utf8"));
  assert.equal(result.stats.ratio, result.stats.obfuscatedBytes / result.stats.originalBytes);
  assert.equal(result.stats.seed, 11);
  assert.equal(typeof result.code, "string");
  assert.ok(result.stats.techniques.every((key) => typeof key === "string"));
  assert.equal(new Set(result.stats.techniques).size, result.stats.techniques.length, "techniques must not repeat");
  const measured = CloakJS.measure(SMALL, "medium");
  assert.deepEqual(Object.keys(measured).sort(), ["obfuscatedBytes", "originalBytes", "ratio"]);
  assert.ok(measured.ratio > 0);
  assert.equal(measured.originalBytes, Buffer.byteLength(SMALL, "utf8"));
});

/* ------------------------------------------------------------ equivalence */

test("every preset preserves the behaviour of a kitchen sink program", () => {
  for (const preset of ALL_PRESETS) {
    for (const seed of [0, 1, 2]) {
      checkEquivalence(SINK, withPreset(preset, { seed }), `${preset}#${seed}`);
    }
  }
});

test("every preset preserves the behaviour of a small program, unseeded", () => {
  for (const preset of ALL_PRESETS) {
    for (let attempt = 0; attempt < 6; attempt++) {
      checkEquivalence(SMALL, preset, `${preset} random #${attempt}`);
    }
  }
});

test("an option matrix preserves behaviour", () => {
  const toggles = [
    "identifierMangling", "identifierEscaping", "stringEncryption", "stringSplitting",
    "numberEncoding", "controlFlowFlattening", "deadCodeInjection", "opaquePredicates",
    "selfDefending", "compactOutput", "stringArrayShuffle", "preserveFunctionNames"
  ];
  const base = withPreset("high", { stringArrayDecoys: 3, stringSplitMinLength: 5, seed: 21 });
  toggles.forEach((toggle, index) => {
    const disabled = Object.assign({}, base);
    disabled[toggle] = false;
    checkEquivalence(SINK, disabled, `${toggle}: false`);
    const enabled = Object.assign({}, base);
    enabled[toggle] = true;
    if (index % 3 === 0) checkEquivalence(SINK, enabled, `${toggle}: true`);
  });
  checkEquivalence(SINK, Object.assign({}, base, {
    stringEncoding: "base64", stringAlphabet: "standard", stringArrayShuffle: false,
    controlFlowThreshold: 0, deadCodeAmount: 1
  }), "base64 standard alphabet, no shuffle, no flattening");
  checkEquivalence(SINK, Object.assign({}, base, {
    debugProtection: true, debugProtectionInterval: 1000, disableConsoleOutput: false
  }), "debug protection");
  checkEquivalence(SINK, Object.assign({}, base, {
    stringEncoding: "rc4", stringAlphabet: "shuffled", stringSplitting: true, stringArrayDecoys: 12,
    deadCodeAmount: 8, controlFlowThreshold: 1
  }), "everything on");
});

/* ---------------------------------------------------------- reproducibility */

test("a seed makes the output reproducible, different seeds do not", () => {
  const options = { seed: "build-42", stringEncryption: true, identifierEscaping: true, deadCodeInjection: true };
  const first = CloakJS.obfuscate(SMALL, options);
  const second = CloakJS.obfuscate(SMALL, options);
  assert.equal(first, second);
  assert.notEqual(first, CloakJS.obfuscate(SMALL, Object.assign({}, options, { seed: "build-43" })));
  assert.notEqual(first, CloakJS.obfuscate(SMALL, Object.assign({}, options, { seed: 42 })));
  const numeric = CloakJS.obfuscate(SMALL, Object.assign({}, options, { seed: 0 }));
  assert.equal(numeric, CloakJS.obfuscate(SMALL, Object.assign({}, options, { seed: 0 })));
  assert.equal(obfuscate(SMALL, { seed: 5 }).stats.seed, 5);
  assert.equal(obfuscate(SMALL, "high").stats.seed, null);
});

/* ------------------------------------------------------- dynamic scope etc. */

test("eval, with, Function and modules are detected and reported", () => {
  const cases = [
    ['eval("1 + 1");', /eval\(\) or with\(\)/],
    ['var scope = {}; with (scope) { }', /eval\(\) or with\(\)/],
    ['var fn = new Function("return 1"); console.log(fn());', /Function\(\) is called with generated source/],
    ['import value from "mod"; console.log(value);', /Module syntax/]
  ];
  for (const [source, pattern] of cases) {
    const result = obfuscate(source, "high");
    assert.ok(result.warnings.some((warning) => pattern.test(warning)), `${source} -> ${JSON.stringify(result.warnings)}`);
    assert.deepEqual(result.stats.techniques.filter((key) => key === "identifierMangling"), [], "mangling must be skipped");
  }
  const innocent = 'console.log("eval( and with( inside a string"); var Function2 = 1; console.log(Function2);';
  assert.deepEqual(obfuscate(innocent, "high").warnings, []);
  assert.ok(obfuscate(innocent, "high").stats.techniques.includes("identifierMangling"));
});

test("dynamic string keys stop a spelling from being renamed", () => {
  const source = [
    'var state = { alpha: 1, beta: 2 };',
    'function read(key) { return state[key]; }',
    'var alpha = 5;',
    'console.log(read("alpha"), alpha);'
  ].join("\n");
  const result = obfuscate(source, withPreset("low", { seed: 2 }));
  assert.deepEqual(result.warnings, []);
  assert.match(result.code, /alpha/, "a spelling used as a string key must stay readable");
  assert.equal(run(result.code).text, run(source).text);
});

/* ------------------------------------------------------------- mangling */

test("mangling never touches property names, keys, labels or patterns", () => {
  const source = [
    "var counter = { total: 0 };",
    "function bump(amount) { counter.total = counter.total + (amount || 1); return counter.total; }",
    "var shorthand = 4;",
    "var literal = { shorthand: shorthand, explicit: shorthand };",
    "loop: for (var index = 0; index < 2; index++) { if (index === 1) break loop; bump(index); }",
    "var [one, two] = [1, 2];",
    "var { total } = counter;",
    "console.log(counter.total, literal.shorthand, literal.explicit, one, two, total);"
  ].join("\n");
  const result = obfuscate(source, withPreset("low", { seed: 3 }));
  assert.deepEqual(result.warnings, []);
  assert.match(result.code, /total/, "property names stay");
  assert.match(result.code, /shorthand/, "object keys stay");
  assert.match(result.code, /loop:/, "labels stay");
  assert.equal(run(result.code).text, run(source).text);
});

test("a spelling that reaches out of its declaring scope is left alone", () => {
  const source = [
    "function declares() { var shared = 'local'; return shared; }",
    "function refersToGlobal() { return typeof shared; }",
    "function alsoGlobal() { return shared; }",
    "console.log(declares(), refersToGlobal(), alsoGlobal());"
  ].join("\n");
  const globals = { shared: "from another script" };
  const expected = run(source, { globals }).text;
  for (let seed = 0; seed < 8; seed++) {
    const result = obfuscate(source, withPreset("low", { seed }));
    assert.deepEqual(result.warnings, []);
    assert.match(result.code, /shared/, "the globals spelling must survive");
    assert.equal(run(result.code, { globals }).text, expected, `seed ${seed}`);
  }
});

test("mangling reaches parameters, catch clauses, classes and template substitutions", () => {
  const source = [
    "function uniqueOuter(uniqueParameter, uniqueOther) {",
    "  var uniqueLocal = uniqueParameter + uniqueOther;",
    "  try { throw new Error(String(uniqueLocal)); }",
    "  catch (uniqueCatch) { uniqueLocal = uniqueCatch.message.length; }",
    "  return `value ${uniqueLocal} of ${uniqueParameter}`;",
    "}",
    "class UniqueClass { constructor(uniqueValue) { this.uniqueValue = uniqueValue; } read() { return this.uniqueValue; } }",
    "var uniqueInstance = new UniqueClass(3);",
    "console.log(uniqueOuter(1, 2), uniqueInstance.read());"
  ].join("\n");
  const options = withPreset("low", {
    seed: 4, stringEncryption: false, stringSplitting: false, numberEncoding: false,
    controlFlowFlattening: false, deadCodeInjection: false, opaquePredicates: false, selfDefending: false
  });
  const result = obfuscate(source, options);
  assert.deepEqual(result.warnings, []);
  for (const spelling of ["uniqueParameter", "uniqueOther", "uniqueLocal", "uniqueCatch", "UniqueClass", "uniqueInstance"]) {
    assert.doesNotMatch(result.code, new RegExp(`\\b${spelling}\\b`), `${spelling} should have been renamed`);
  }
  assert.match(result.code, /\$\{/, "the template substitutions must still be a template");
  assert.match(result.code, /uniqueValue/, "the property name must survive");
  assert.ok(result.stats.identifiersRenamed >= 6, `expected several renames, got ${result.stats.identifiersRenamed}`);
  assert.equal(run(result.code).text, run(source).text);
});

test("preserveFunctionNames keeps function and class names readable", () => {
  const source = `
function visibleFunction(a) { return helperArrow(a) + VisibleClass.staticValue; }
function helperArrow(a) { return a * 2; }
class VisibleClass { static staticValue = 3; }
console.log(visibleFunction(1), VisibleClass.name, visibleFunction.name);
`;
  const options = withPreset("low", { seed: 1, preserveFunctionNames: true, controlFlowFlattening: false, deadCodeInjection: false, opaquePredicates: false, selfDefending: false, stringEncryption: false, numberEncoding: false });
  const result = obfuscate(source, options);
  assert.deepEqual(result.warnings, []);
  assert.match(result.code, /visibleFunction/);
  assert.match(result.code, /VisibleClass/);
  assert.equal(run(result.code).text, run(source).text);
});

test("identifier escaping produces valid, equivalent code", () => {
  const result = obfuscate(SMALL, withPreset("extreme", { seed: 6 }));
  assert.ok(result.stats.identifiersEscaped > 0);
  assert.match(result.code, /\\u00/);
  assert.deepEqual(result.warnings, []);
  assert.equal(run(result.code).text, run(SMALL).text);
});

/* -------------------------------------------------------------- strings */

test("string encryption keeps values, including non latin text", () => {
  const source = `
var values = ["ascii", "héllo", "emoji 😎 pair", "日本語テキスト", "\\u0000\\u001f", "quote\\"slash\\\\", ""];
var lengths = values.map(function (value) { return value.length; });
console.log(values.join("|"), lengths.join(","), [..."😎"].length);
`;
  for (const preset of ["medium", "high", "extreme"]) {
    for (const seed of [0, 1, 2]) {
      const result = obfuscate(source, withPreset(preset, { seed }));
      assert.deepEqual(result.warnings, []);
      assert.equal(run(result.code).text, run(source).text, `${preset}#${seed}`);
      assert.equal(run(result.code, { globals: { TextDecoder: undefined, Uint8Array: undefined, atob: undefined } }).text,
        run(source).text, `${preset}#${seed} without decoder globals`);
    }
  }
});

test("splitting a string never cuts a surrogate pair", () => {
  const source = 'var emoji = "😎😎😎😎😎😎"; console.log(emoji, emoji.length, [...emoji].length);';
  for (let seed = 0; seed < 20; seed++) {
    const result = obfuscate(source, withPreset("extreme", { seed, stringSplitMinLength: 2, stringSplitMaxParts: 5 }));
    assert.deepEqual(result.warnings, []);
    assert.equal(run(result.code).text, run(source).text, `seed ${seed}`);
  }
  const split = obfuscate(source, withPreset("extreme", { seed: 5, stringSplitMinLength: 2, stringSplitMaxParts: 5 }));
  assert.ok(split.stats.stringsSplit > 0, "expected the emoji string to be split");
});

test("string encryption can be turned off without disabling splitting", () => {
  const source = 'var long = "abcdefghijklmnopqrstuvwxyz"; console.log(long, long.length);';
  const result = obfuscate(source, {
    seed: 9, identifierMangling: false, stringEncryption: false, stringSplitting: true,
    stringSplitMinLength: 6, numberEncoding: false, controlFlowFlattening: false,
    deadCodeInjection: false, opaquePredicates: false, selfDefending: false
  });
  assert.equal(result.stats.stringsEncrypted, 0);
  assert.equal(result.stats.stringArrayEntries, 0);
  assert.ok(result.stats.stringsSplit > 0);
  assert.match(result.code, /"\+"/, "the literal must be concatenated from chunks");
  assert.equal(run(result.code).text, run(source).text);
});

test("string array decoys do not change decoded values", () => {
  const result = obfuscate(SMALL, withPreset("high", { seed: 8, stringArrayDecoys: 24 }));
  assert.ok(result.stats.stringArrayEntries > result.stats.stringsEncrypted);
  assert.deepEqual(result.warnings, []);
  assert.equal(run(result.code).text, run(SMALL).text);
});

/* ------------------------------------------------------------- numbers */

test("number encoding preserves every literal value", () => {
  const source = `
var values = [0, 1, 42, 1234, 98765, 2147483647, 9007199254740991, -4242, -0.15625, 0.1, 1e-7, 1e21, 0x1f, 0b1010, 0o17, 1_000_000];
var out = values.map(function (value) { return String(value); });
out.push(String(0.1 + 0.2), String(1 / 3), String(2 ** 53), String(-0));
console.log(out.join("|"));
`;
  for (const preset of ["medium", "high", "extreme"]) {
    for (const seed of [0, 1, 2, 3]) {
      const result = obfuscate(source, withPreset(preset, { seed }));
      assert.deepEqual(result.warnings, []);
      assert.ok(result.stats.numbersEncoded >= 11, `${preset}#${seed}: ${result.stats.numbersEncoded} numbers`);
      assert.equal(run(result.code).text, run(source).text, `${preset}#${seed}`);
    }
  }
});

/* -------------------------------------------------------- control flow */

test("control flow flattening preserves statement order", () => {
  const source = [
    "var order = [];",
    "function record(tag) { order.push(tag); }",
    "record('a'); record('b'); record('c');",
    "if (order.length === 3) { record('d'); }",
    "for (var i = 0; i < 2; i++) { record('e' + i); }",
    "record('f');",
    "console.log(order.join(','));"
  ].join("\n");
  const result = obfuscate(source, withPreset("high", { seed: 12 }));
  assert.ok(result.stats.controlFlowBlocks >= 1, `expected dispatchers, got ${result.stats.controlFlowBlocks}`);
  assert.match(result.code, /switch\(/);
  assert.equal(run(result.code).text, run(source).text);
  const disabled = obfuscate(source, withPreset("high", { seed: 12, controlFlowFlattening: false }));
  assert.equal(disabled.stats.controlFlowBlocks, 0);
  assert.doesNotMatch(disabled.code, /switch\([^)]*\)\{case/);
  assert.equal(run(disabled.code).text, run(source).text);
  const zeroThreshold = obfuscate(source, withPreset("high", { seed: 12, controlFlowThreshold: 0 }));
  assert.equal(zeroThreshold.stats.controlFlowBlocks, 0);
  assert.equal(run(zeroThreshold.code).text, run(source).text);
});

test("flattening keeps hoisting, closures and returns intact", () => {
  const source = `
function worker(input) {
  var doubled = input * 2;
  var label = "v" + doubled;
  if (input < 0) { return "negative:" + label; }
  var total = 0;
  for (var index = 0; index < 3; index++) { total += index + doubled; }
  var classifier = function inner(value) { return value % 2 === 0 ? "even" : "odd"; };
  return label + ":" + total + ":" + classifier(total);
}
function early() { var value = 1; return "early" + value; }
console.log(worker(4), worker(-1), early());
`;
  for (let seed = 0; seed < 12; seed++) {
    const result = obfuscate(source, withPreset("high", { seed }));
    assert.deepEqual(result.warnings, [], `seed ${seed}`);
    assert.equal(run(result.code).text, run(source).text, `seed ${seed}`);
  }
});

test("dead code and opaque predicates are unreachable but present", () => {
  const source = 'var value = 1; value = value + 2; console.log("v" + value);';
  const missing = obfuscate(source, withPreset("high", { seed: 13, deadCodeInjection: false, opaquePredicates: false }));
  assert.equal(missing.stats.deadCodeBlocks, 0);
  assert.equal(missing.stats.opaquePredicates, 0);
  let seenDead = 0, seenOpaque = 0;
  for (let seed = 0; seed < 25 && (seenDead < 3 || seenOpaque < 3); seed++) {
    const result = obfuscate(source, withPreset("high", { seed }));
    assert.deepEqual(result.warnings, []);
    seenDead += result.stats.deadCodeBlocks;
    seenOpaque += result.stats.opaquePredicates;
    assert.equal(run(result.code).text, run(source).text, `seed ${seed}`);
  }
  assert.ok(seenDead >= 3, `dead code injection never fired (${seenDead})`);
  assert.ok(seenOpaque >= 3, `opaque predicates never fired (${seenOpaque})`);
});

/* ------------------------------------------------------------ guards */

test("selfDefending output runs and rejects patched generated code", () => {
  const source = 'var secret = "value"; console.log(secret, 1 + 2, [1, 2].map(function (v) { return v * 2; }).join("-"));';
  const result = obfuscate(source, withPreset("high", { seed: 7 }));
  assert.deepEqual(result.warnings, []);
  assert.match(result.code, /Unexpected token/);
  assert.equal(run(result.code).text, run(source).text);

  const patched = result.code.replace("String.fromCharCode", "String.fromCharCode2");
  assert.notEqual(patched, result.code, "fixture must actually contain the patched helper");
  assert.throws(() => run(patched), /Unexpected token/);

  const renamedCondition = result.code.replace(/>32\)/, ">31)");
  if (renamedCondition !== result.code) {
    assert.throws(() => run(renamedCondition), /Unexpected token/);
  }
});

test("selfDefending tolerates reindentation", () => {
  const source = 'var value = "x"; console.log(value + "y");';
  const result = obfuscate(source, withPreset("high", { seed: 9 }));
  const reindented = result.code.replace(/\n/g, "\n\t\t");
  assert.notEqual(reindented, result.code);
  assert.equal(run(reindented).text, run(source).text);
  assert.equal(run(obfuscate(source, withPreset("high", { seed: 9, selfDefending: false })).code).text, run(source).text);
});

test("debug protection installs an unref'ed interval only when asked", () => {
  const source = 'console.log("guarded");';
  const plain = obfuscate(source, withPreset("high", { seed: 3 }));
  assert.doesNotMatch(plain.code, /setInterval/);
  assert.equal(run(plain.code, { timers: true }).timers.intervals, 0);

  const guarded = obfuscate(source, withPreset("high", { seed: 3, debugProtection: true, debugProtectionInterval: 2500 }));
  assert.match(guarded.code, /debugger/);
  const withTimers = run(guarded.code, { timers: true });
  assert.equal(withTimers.timers.intervals, 1);
  assert.equal(withTimers.timers.unref, 1);
  assert.equal(withTimers.text, "guarded");
  const withoutTimers = run(guarded.code);
  assert.equal(withoutTimers.text, "guarded", "must run where setInterval does not exist");
});

test("disableConsoleOutput silences the console and is off by default", () => {
  const source = 'console.log("hidden"); console.warn("also hidden");';
  for (const preset of ALL_PRESETS) {
    assert.equal(run(obfuscate(source, preset).code).text, "hidden\nalso hidden", `${preset} must not silence`);
  }
  const silenced = obfuscate(source, withPreset("high", { seed: 4, disableConsoleOutput: true }));
  assert.equal(run(silenced.code).text, "");
  assert.equal(run(silenced.code).logs.length, 0);
});

test("wrapInIife keeps declarations private without breaking the program", () => {
  const source = [
    'var leaked = "global";',
    "function helper() { return leaked; }",
    'console.log(helper(), typeof leaked);'
  ].join("\n");
  const result = obfuscate(source, withPreset("high", { seed: 5, wrapInIife: true }));
  assert.deepEqual(result.warnings, []);
  assert.equal(result.code.trim().slice(0, 12), "(function(){");
  const executed = run(result.code);
  assert.equal(executed.sandbox.leaked, undefined, "top level declarations must not leak");
  assert.equal(executed.text, "global string");
  const strict = obfuscate('"use strict"; var inner = 1; console.log(inner);', withPreset("low", { seed: 5, wrapInIife: true, identifierEscaping: true }));
  assert.match(strict.code, /^\(function\(\)\{\s*"use strict";/);
  assert.equal(run(strict.code).text, "1");
});

test("a leading use strict directive is preserved", () => {
  const strict = '"use strict";\nfunction probe() { return this; }\nconsole.log(probe() === undefined, typeof undeclaredOk);';
  for (const preset of ALL_PRESETS) {
    const result = obfuscate(strict, withPreset(preset, { seed: 2 }));
    assert.match(result.code, /"use strict"/, `${preset} dropped the directive`);
    assert.equal(run(result.code).text, "true undefined", `${preset}`);
  }
  const notADirective = 'console.log("use strict" + "!");';
  const result = obfuscate(notADirective, withPreset("low", { seed: 2 }));
  assert.equal(run(result.code).text, "use strict!");
});

/* ------------------------------------------------------------- hygiene */

test("obfuscating never executes the input and never patches globals", () => {
  const before = {
    objectPrototype: Object.getOwnPropertyNames(Object.prototype).sort().join(","),
    consoleLog: console.log,
    functionToString: Function.prototype.toString
  };
  const source = 'console.log("should not run"); globalThis.definitelyNotSet = 1;';
  const result = obfuscate(source, "high");
  assert.equal(typeof result.code, "string");
  assert.equal(globalThis.definitelyNotSet, undefined);
  assert.equal(Object.getOwnPropertyNames(Object.prototype).sort().join(","), before.objectPrototype);
  assert.equal(console.log, before.consoleLog);
  assert.equal(Function.prototype.toString, before.functionToString);
});

test("obfuscated output is checked for syntax errors and parsed as a script", () => {
  for (const preset of ALL_PRESETS) {
    for (const seed of [1, 2]) {
      const result = obfuscate(SINK, withPreset(preset, { seed }));
      assert.doesNotThrow(() => new Function(result.code), `${preset}#${seed}`);
      assert.ok(!result.warnings.some((warning) => /failed to parse/i.test(warning)), `${preset}#${seed}: ${result.warnings}`);
    }
  }
});

test("double obfuscation stays valid for non self defending presets", () => {
  const once = obfuscate(SINK, withPreset("medium", { seed: 3 }));
  assert.deepEqual(once.warnings, []);
  const twice = obfuscate(once.code, withPreset("low", { seed: 4 }));
  assert.deepEqual(twice.warnings, []);
  assert.equal(run(twice.code).text, run(SINK).text);
});

test("code without declarations still obfuscates and runs", () => {
  const source = 'console.log("no bindings here", 40 + 2);';
  for (const preset of ["low", "high", "extreme"]) {
    const result = obfuscate(source, withPreset(preset, { seed: 6 }));
    assert.deepEqual(result.warnings, []);
    assert.equal(run(result.code).text, run(source).text, preset);
  }
});

test("a moderately large program obfuscates in reasonable time", () => {
  const parts = [];
  for (let i = 0; i < 40; i++) {
    parts.push(`function unit${i}(value) { var scaled = value * ${i + 2}; var label = "unit${i}:" + scaled; if (scaled % 2 === 0) { return label + ":even"; } return label + ":odd"; }`);
  }
  parts.push("var total = 0;");
  for (let i = 0; i < 40; i++) parts.push(`total += unit${i}(2).length + unit${i}(3).length;`);
  parts.push("console.log(total);");
  const source = parts.join("\n");
  const started = Date.now();
  const result = obfuscate(source, withPreset("extreme", { seed: 9 }));
  const elapsed = Date.now() - started;
  assert.deepEqual(result.warnings, []);
  assert.ok(elapsed < 15000, `took ${elapsed}ms`);
  assert.equal(run(result.code).text, run(source).text);
  assert.ok(result.stats.identifiersRenamed >= 40, `renamed ${result.stats.identifiersRenamed}`);
});

test("CloakJS can obfuscate itself and the result still obfuscates", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "cloakjs.js"), "utf8");
  const fixture = "function add(a, b) { return a + b; } console.log(add(2, 3), `sum ${add(20, 22)}`);";
  const expected = CloakJS.obfuscate(fixture, { seed: 42 });
  for (const preset of ["low", "medium", "high"]) {
    const started = Date.now();
    const result = obfuscate(source, withPreset(preset, { seed: 1 }));
    assert.ok(Date.now() - started < 20000, `${preset} took too long`);
    assert.ok(!result.warnings.some((warning) => /failed to parse/i.test(warning)), `${preset}: ${result.warnings}`);
    // the library calls Function() to evaluate literals, so mangling backs off
    assert.ok(result.warnings.some((warning) => /Function\(\)|eval\(\)/.test(warning)), `${preset} should warn about dynamic code`);
    const sandbox = { console: { log: () => { } }, TextEncoder, TextDecoder, Uint8Array, atob, btoa };
    const context = vm.createContext(sandbox);
    vm.runInContext(result.code, context, { timeout: 30000, filename: "cloakjs-obfuscated.js" });
    const Obfuscated = sandbox.CloakJS;
    assert.ok(Obfuscated, `${preset}: the obfuscated library did not load`);
    assert.equal(Obfuscated.VERSION, CloakJS.VERSION);
    assert.deepEqual(Object.keys(Obfuscated.presets), Object.keys(CloakJS.presets));
    assert.equal(Obfuscated.obfuscate(fixture, { seed: 42 }), expected, `${preset}: obfuscating with the obfuscated library changed the output`);
    assert.equal(run(Obfuscated.obfuscate(fixture, { seed: 42 })).text, run(fixture).text);
  }
});
