"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const CloakJS = require("../cloakjs.js");

function run(source, options) {
  const logs = [];
  const sandbox = { console: { log: (...values) => logs.push(values) }, TextDecoder, atob };
  const result = CloakJS.obfuscateWithStats(source, options);
  vm.runInNewContext(result.code, sandbox);
  return { logs, result };
}

test("UMD browser global and CommonJS expose the same API", () => {
  const fs = require("node:fs");
  const browser = {};
  vm.runInNewContext(fs.readFileSync(require.resolve("../cloakjs.js"), "utf8"), browser);
  assert.equal(browser.CloakJS.VERSION, "1.2.0");
  assert.equal(CloakJS.NAME, "CloakJS");
  assert.equal(typeof CloakJS.obfuscate, "function");
});

test("every preset preserves the output of a small script", () => {
  const source = 'var greeting = "héllo 😎"; console.log(greeting); console.log("second");';
  for (const preset of Object.keys(CloakJS.presets)) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const { logs, result } = run(source, preset);
      assert.deepEqual(logs, [["héllo 😎"], ["second"]], preset);
      assert.deepEqual(result.warnings.filter(w => /failed to parse/i.test(w)), []);
      assert.equal(result.stats.originalBytes, Buffer.byteLength(source));
      assert.equal(result.stats.obfuscatedBytes, Buffer.byteLength(result.code));
    }
  }
});

test("dispatcher preserves observable statement order", () => {
  const source = 'console.log("first");console.log("second");console.log("third");';
  for (let i = 0; i < 20; i++) {
    const { logs, result } = run(source, "high");
    assert.deepEqual(logs, [["first"], ["second"], ["third"]]);
    assert.match(result.code, /switch\(_0xord\[_0xst\]\)/);
    assert.ok(result.stats.deadCodeBlocks > 0);
  }
});

test("escaped strings, object keys, regexes, templates, numbers and comments", () => {
  const source = [
    'var phrase = "line\\nnext";',
    'var object = { phrase: 12, "named": 99 };',
    'console.log(phrase, object.phrase, object["named"]);',
    'console.log(/[0-9]+/.test("123"), `literal ${object.phrase}`);',
    '// "commented out" 876',
  ].join("\n");
  const expected = [["line\nnext", 12, 99], [true, "literal 12"]];
  for (const preset of Object.keys(CloakJS.presets)) {
    const { logs } = run(source, preset);
    assert.deepEqual(logs, expected, preset);
  }
});

test("strict mode is kept before generated code", () => {
  const source = '"use strict"; function check() { return this === undefined; } console.log(check());';
  for (const preset of Object.keys(CloakJS.presets)) {
    const { logs, result } = run(source, preset);
    assert.deepEqual(logs, [[true]], preset);
    assert.match(result.code, /^"use strict";/);
  }
});

test("options and return types are documented accurately", () => {
  assert.equal(typeof CloakJS.obfuscate('console.log("ok")', "medium"), "string");
  assert.equal(CloakJS.obfuscate("var x=1;", "off"), "var x=1;");
  assert.deepEqual(CloakJS.resolveOptions("low"), CloakJS.presets.low);
  assert.equal(CloakJS.resolveOptions({ stringEncryption: false }).stringEncryption, false);
  assert.throws(() => CloakJS.resolveOptions("__proto__"), /unknown preset/);
  assert.throws(() => CloakJS.obfuscate(5), TypeError);
  const result = CloakJS.obfuscateWithStats('console.log("ok")', "medium");
  assert.equal(typeof result.code, "string");
  assert.equal(typeof result.stats.stringsEncrypted, "number");
  assert.ok(Array.isArray(result.warnings));
  const measured = CloakJS.measure('console.log("ok")', "medium");
  assert.ok(measured.obfuscatedBytes >= measured.originalBytes);
  assert.equal(measured.ratio, measured.obfuscatedBytes / measured.originalBytes);
});

test("object methods and numeric keys are not turned into expressions", () => {
  const source = 'var named = 7; var obj = { named() { return named; }, "other"() { return 8; }, 42() { return 9; } }; console.log(obj.named(), obj.other(), obj[42]());';
  for (const preset of Object.keys(CloakJS.presets)) {
    const { logs, result } = run(source, preset);
    assert.deepEqual(logs, [[7, 8, 9]], preset);
    assert.ok(!result.warnings.some(w => /failed to parse/.test(w)));
  }
});

test("numeric separators and BigInt literals remain intact", () => {
  const source = 'console.log(10_000, 123n, 0xFF_FF);';
  const { logs, result } = run(source, "high");
  assert.deepEqual(logs, [[10000, 123n, 65535]]);
  assert.ok(!result.warnings.some(w => /failed to parse/.test(w)));
});

test("reserved helper bindings never collide with injected declarations", () => {
  const { logs, result } = run('var _0xa = 5; console.log("safe", _0xa);', "high");
  assert.deepEqual(logs, [["safe", 5]]);
  assert.match(result.warnings.join(" "), /helper name/);
  assert.equal(result.stats.stringsEncrypted, 0);
});

test("strict directive without a semicolon remains a directive", () => {
  const source = '"use strict"\nfunction check(){return this === undefined;} console.log(check());';
  const { logs } = run(source, "high");
  assert.deepEqual(logs, [[true]]);
});

test("a generated script does not freeze the host prototype", () => {
  run('console.log("safe")', "high");
  assert.equal(Object.isFrozen(Object.prototype), false);
});
