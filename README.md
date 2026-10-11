# CloakJS 1.3.0

[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/Infinitode/CloakJS.svg)](https://github.com/Infinitode/CloakJS/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/Infinitode/CloakJS.svg)](https://github.com/Infinitode/CloakJS/issues)
[![jsDelivr monthly downloads](https://data.jsdelivr.com/v1/package/gh/Infinitode/CloakJS/badge?style=rounded)](https://www.jsdelivr.com/package/gh/Infinitode/CloakJS)

CloakJS is a single-file, dependency-free JavaScript obfuscator for the browser and Node.js. It renames bindings, hides strings behind a generated decoder, rewrites numeric literals, flattens control flow inside function bodies, injects opaque predicates and unreachable decoy code, escapes identifiers, and can add runtime guards. It returns JavaScript source **as a string** — it never executes the code for you.

```html
<script src="https://cdn.jsdelivr.net/gh/Infinitode/CloakJS@main/cloakjs.min.js"></script>
<script>
  const code = CloakJS.obfuscate('console.log("Hello from CloakJS!")', "extreme");
  console.log(CloakJS.obfuscateWithStats("var n = 21; console.log(n * 2);", "high").stats);
</script>
```

> [!IMPORTANT]
> **CloakJS is not distributed through npm.** There *is* a package named `cloakjs` on the npm registry, but it is an unrelated AOP/Proxy wrapper library maintained by someone else — it is not this project and it does not contain this obfuscator. Do not install that package expecting CloakJS. Grab [`cloakjs.js`](cloakjs.js) or [`cloakjs.min.js`](cloakjs.min.js) from this repository (or from jsDelivr) instead; the library has no dependencies and no package manifest, so there is nothing to resolve and nothing to build.

> [!WARNING]
> Obfuscation makes source **harder to read, not secure**. It cannot protect secrets, credentials, licence keys or security-critical checks that ship to the client, and it does not resist an analyst who can instrument the running page. Everything CloakJS does is reversible by hand or by tooling. Treat it as a speed bump and a deterrent — never as a security boundary.

## What is new in 1.3.0

- **`extreme` is a real mode now.** It no longer just repeats `high`: it adds identifier escaping, string splitting, decoy string-array entries, maximum flattening and decoy amounts, and a recurring `debugger` trap.
- **Control-flow flattening reaches inside function bodies**, not just the top level, and can flatten `var`, `if`, `for`, `try`, `switch`, `return` and `throw` statements — not only bare calls.
- **A self-contained decoder.** Obfuscated output no longer requires `atob`, `Uint8Array` or `TextDecoder`; it implements Base64, a custom alphabet, RC4 and UTF-8 decoding itself, using `TextDecoder` only as a fast path when the host provides one.
- **Template literals are first class.** Identifiers inside `` `${…}` `` are analysed and renamed, while static templates are encrypted like ordinary strings.
- **Much broader mangling.** Parameters (including defaults and rest), `catch` bindings, class names, named function expressions and template substitutions are renamed — but only when every occurrence of a spelling provably stays inside a scope that declares it.
- **New options:** `stringSplitting`, `stringArrayDecoys`, `stringArrayShuffle`, `stringAlphabet`, `stringEncoding`, `identifierEscaping`, `preserveFunctionNames`, `controlFlowThreshold`, `deadCodeAmount`, `debugProtection`(+`Interval`), `wrapInIife`, `disableConsoleOutput`, `seed`.
- **Typed, validated options.** Unknown names and wrong types throw with a clear message instead of being silently ignored.
- **Reproducible builds** with `seed`, richer `stats` (including which `techniques` actually ran) and clearer `warnings`.

## Getting started

Download [`cloakjs.js`](cloakjs.js) (readable) or [`cloakjs.min.js`](cloakjs.min.js) (minified), or load either from [jsDelivr](https://www.jsdelivr.com/package/gh/Infinitode/CloakJS):

```html
<!-- Minified build -->
<script src="https://cdn.jsdelivr.net/gh/Infinitode/CloakJS@main/cloakjs.min.js"></script>
<!-- Development: use .../cloakjs.js instead -->
```

For reproducible deployments, replace `@main` with a tag or commit hash from this repository. The minified file is generated from `cloakjs.js` with Terser; there is no npm release. The badge above shows jsDelivr's live download information rather than a hard-coded count.

In Node.js (any modern Node, no extra packages):

```js
const CloakJS = require("./cloakjs.js");

const result = CloakJS.obfuscateWithStats('const who = "world"; console.log(`hi ${who}`);', "extreme");
console.log(result.code);      // obfuscated source, as a string
console.log(result.stats);     // what the pipeline actually applied
console.log(result.warnings);  // anything it refused to do — check these

// reproducible output while you are building a pipeline
const first = CloakJS.obfuscate("var a = 1; console.log(a);", { seed: "build-42" });
```

The file is UMD: it works as the global `CloakJS` in a `<script>` tag, as an AMD module, and as a CommonJS module. The **obfuscated** script it produces is self-contained — the generated decoder implements its own Base64, alphabet substitution, RC4 and UTF-8 handling, so no globals, polyfills or helper files are required.

## API

| Method / property | Description |
| --- | --- |
| `CloakJS.obfuscate(source, options?)` | Return the obfuscated JavaScript **string**. |
| `CloakJS.obfuscateWithStats(source, options?)` | Return `{ code, stats, warnings }`. Check `warnings` before shipping. |
| `CloakJS.measure(source, options?)` | Return `{ originalBytes, obfuscatedBytes, ratio }` for a fresh randomized output. |
| `CloakJS.resolveOptions(options?)` | Return a validated copy of a preset or of the defaults merged with your options. |
| `CloakJS.presets`, `CloakJS.defaultOptions` | Available presets and default settings (every preset defines every key). |
| `CloakJS.techniques` | Metadata for every transform: `key`, `name`, `summary`, `changesBehavior`. |
| `CloakJS.NAME`, `CloakJS.VERSION`, `CloakJS.BANNER` | Metadata. |

`source` must be a string. `options` may be a preset name (`'off'`, `'low'`, `'medium'`, `'high'`, `'extreme'`), an options object, or omitted (defaults to the `high` settings). Unknown preset names, unknown option names and wrong option types throw, so a typo like `stringEncrypton` fails loudly instead of silently doing nothing.

Output is randomized and differs between calls; pass a `seed` when you need reproducible builds. `measure` generates its own random sample, so it does not necessarily describe a previous `obfuscate` result.

### `stats`

| Field | Meaning |
| --- | --- |
| `identifiersRenamed` | Distinct spellings that were renamed. |
| `identifiersEscaped` | Identifier occurrences rewritten with `\uXXXX` escapes. |
| `stringsEncrypted` | String literals (and static template literals) moved into the encoded array. |
| `stringsSplit` | Strings that were split into concatenated chunks. |
| `stringArrayEntries` | Entries in the emitted string array, including decoys. |
| `numbersEncoded` | Numeric literals that were rewritten as expressions. |
| `controlFlowBlocks` | `switch` dispatchers that were generated. |
| `deadCodeBlocks` | Unreachable decoy blocks that were inserted. |
| `opaquePredicates` | Opaque conditions that were generated. |
| `originalBytes`, `obfuscatedBytes`, `ratio` | UTF-8 byte counts; `ratio` is output ÷ input, so anything above 1 means the output grew. |
| `techniques` | The technique keys that were actually applied to this input. |
| `seed` | The seed that was used, or `null`. |

`warnings` reports things CloakJS deliberately skipped: `eval()`/`with()` (dynamic scope makes renaming unsafe), `new Function("…")` built from a string, module syntax, or an output that failed the internal parse check. It never guarantees behavioural equivalence — test the generated code yourself.

## Presets

| Preset | Identifier mangling | Identifier escaping | String array | String splitting / decoys | Number encoding | Control flow flattening | Dead code + opaque predicates | Self-defending | Debug protection | Console silencing | IIFE wrapper |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `off` | – | – | – | – | – | – | – | – | – | – | – |
| `low` | yes | – | – | – | – | – | – | – | – | – | – |
| `medium` | yes | – | Base64, ordered | – | yes | – | – | – | – | – | – |
| `high` | yes | – | RC4 + shuffled alphabet | – | yes | yes | yes | yes | – | – | – |
| `extreme` | yes | yes | RC4 + shuffled alphabet | yes | yes | yes (maximum) | yes (maximum) | yes | yes | – | – |

`extreme` is a genuine mode, not a relabelled `high`: compared to `high` it turns on identifier escaping, string splitting (down to 6-character chunks, up to 5 parts), six decoy entries per string array, six decoy statements per dead-code block, and a recurring anti-debugging timer. `disableConsoleOutput` and `wrapInIife` change observable behaviour, so they are options that no preset enables.

Every preset enables `compactOutput`. A partial options object overrides only the keys you supply:

```js
const result = CloakJS.obfuscateWithStats(
  'var message = "hi"; for (var i = 0; i < 2; i++) { console.log(message, i); }',
  { identifierMangling: false, controlFlowFlattening: false, stringArrayDecoys: 12 }
);
if (result.warnings.length) console.warn(result.warnings);
console.log(result.code, result.stats.techniques);
```

## Options

| Option | Type | Default (`high`) | What it does |
| --- | --- | --- | --- |
| `identifierMangling` | boolean | `true` | Renames declared bindings whose occurrences provably stay inside a scope that declares them. |
| `identifierEscaping` | boolean | `false` (`true` in `extreme`) | Rewrites identifiers with `\uXXXX` escapes, e.g. `_0x1a2b` becomes `_\u0030\u0078\u0031\u0061\u0032\u0062`. |
| `preserveFunctionNames` | boolean | `false` | Keeps function and class names, so `Function#name` and `constructor.name` stay readable. |
| `stringEncryption` | boolean | `true` | Moves strings into an encoded array read through a generated decoder. |
| `stringEncoding` | `"base64"` \| `"rc4"` | `"rc4"` | Cipher applied to each payload. |
| `stringAlphabet` | `"standard"` \| `"shuffled"` | `"shuffled"` | Base64 alphabet substitution for the array, with optional reversal of each entry. |
| `stringArrayShuffle` | boolean | `true` | Shuffles array entries and adds an index map, so positions leak nothing. |
| `stringArrayDecoys` | count | `0` (`6` in `extreme`) | Adds unused, well-formed entries to the string array. |
| `stringSplitting` | boolean | `false` (`true` in `extreme`) | Splits strings into codepoint-safe chunks that are decoded separately and concatenated. |
| `stringSplitMinLength` | count | `8` (`6` in `extreme`) | Shortest string that may be split. |
| `stringSplitMaxParts` | count | `4` (`5` in `extreme`) | Upper bound on chunks per string. |
| `numberEncoding` | boolean | `true` | Rewrites numeric literals as hex, binary, octal, bitwise, arithmetic or scaled expressions. |
| `controlFlowFlattening` | boolean | `true` | Moves statement runs into a shuffled `switch` dispatcher, inside function bodies as well as at the top level. |
| `controlFlowThreshold` | ratio | `1` | Probability of flattening each eligible run (`0` disables it, `1` flattens all of them). |
| `deadCodeInjection` | boolean | `true` | Inserts unreachable decoy blocks, including dispatcher cases that can never be selected. |
| `deadCodeAmount` | count | `3` (`6` in `extreme`) | Rough number of decoy statements per inserted block. |
| `opaquePredicates` | boolean | `true` | Generates conditions whose value is computed at obfuscation time and used as guards. |
| `selfDefending` | boolean | `true` | Adds a prelude that hashes generated functions and throws if they were patched. |
| `debugProtection` | boolean | `false` (`true` in `extreme`) | Installs a recurring `debugger` trap through a guarded `setInterval`. |
| `debugProtectionInterval` | count (ms) | `4000` (`2500` in `extreme`) | Timer period for the trap. |
| `disableConsoleOutput` | boolean | `false` | Replaces `console.log` and friends with no-ops before the payload runs. |
| `wrapInIife` | boolean | `false` | Wraps the program in `(function(){ … })();` so top-level declarations stay private. |
| `compactOutput` | boolean | `true` | Collapses blank lines and indentation. Token-aware, so string and template bodies are never touched. Not a minifier. |
| `seed` | string \| number \| null | `null` | Seeds the generator for reproducible output. |

## Techniques

- **Identifier mangling** collects bindings from `var`/`let`/`const`, function declarations, named function expressions, parameter lists (including defaults and rest parameters), `catch (…)` clauses and class names. It renames a spelling only when *every* occurrence lies inside a scope that declares it, which keeps references to globals defined by other scripts working. Property names, object keys, shorthand properties, method and field names, labels, destructuring patterns, module bindings and anything reachable dynamically (`eval`, `with`, string keys such as `obj["name"]`) are left alone. Template substitutions *are* analysed, so `` `${count}` `` is renamed with the rest of the code.
- **Identifier escaping** writes identifiers with unicode escapes. Escapes normalise to the same name, so behaviour is unchanged, but the source stops matching grep patterns.
- **String encryption** evaluates each eligible literal, encodes its UTF-8 bytes (RC4 with a random per-run key, then Base64), optionally substitutes a shuffled Base64 alphabet and reverses the entry, and stores it in an array that the generated decoder reads through a shuffled index map. Call sites look like `_0x1f3(0x2,41)`, sometimes with decoy arguments. Static template literals are treated like ordinary strings, not touching tagged templates. Directive prologues, object keys, `case` labels, method names and `import`/`export` specifiers are skipped.
- **String splitting** breaks long strings into codepoint-safe chunks (never inside an emoji or surrogate pair). With encryption on, each chunk becomes its own array entry and the call site becomes a concatenation, so no array entry holds a complete string.
- **Number encoding** rewrites literals as hex, binary, octal, XOR/OR masks, shifts, `~`, sums, products with remainder, or exact power-of-two scaling. Single-digit literals, BigInts and `Infinity`/`NaN` are left as they are, and floats are only scaled by powers of two so their values stay bit-exact.
- **Control flow flattening** splits each region (a function body or the top level) into statements and moves runs of statements that provably cannot change hoisting or scoping into `switch` clauses with random labels. Case clauses are emitted in a shuffled layout while a sequence array preserves execution order, and decoy cases are never selected. `let`/`const` declarations, function/class declarations, `do…while` statements, `else`/`catch`/`finally` continuation statements and jumps that would start targeting the generated loop all stay outside the dispatcher. Nested function bodies are flattened before their enclosing bodies.
- **Opaque predicates** are expressions whose value is evaluated at obfuscation time and verified with `Function`, so a guard that should be true always is. They wrap statements, dispatchers and dead branches.
- **Dead code injection** adds unreachable blocks that reference real runtime pieces (loops, local helper functions, decoy decoder lookups, array operations) so they cannot be dismissed by pattern alone. Injection points are only chosen after a `;` whose neighbours are not `else`/`while`/`catch`/`finally`, never after `return`/`throw`/`break`/`continue`, and never in a position that would change the script's completion value.
- **Self-defending prelude** hashes the source text of generated functions through `Function.prototype.toString()` and throws `Error("Unexpected token")` when the text no longer matches — including when a patched `toString` returns `[native code]`. Whitespace is ignored by the hash, so re-indenting the output still runs, but renaming or patching a generated function does not. It covers the generated decoder and its own probe function; it does **not** detect an attacker who disables the check itself.
- **Debug protection** installs `setInterval(function(){ … debugger … }, interval)`, guarded by `typeof setInterval`, and calls `.unref()` when the handle supports it so Node.js processes can still exit.
- **Console silencing** and **IIFE wrapping** are opt-in behaviour changes, described in the tables above.

## Behaviour changes and limitations

Read this section before shipping obfuscated output.

| Situation | What happens |
| --- | --- |
| Code reads `someFunction.name` or `this.constructor.name` | Mangling renames functions and classes, so those strings change. Set `preserveFunctionNames: true` to keep them. |
| Bindings that are part of a public API | Mangling renames top-level declarations too. Disable `identifierMangling` (or use `low` and check) when other scripts refer to them by name. |
| Property access through strings, e.g. `obj["count"]` | Every spelling that appears as a property name, object key or string key is left untouched, so such code keeps working. |
| `eval()`, `with()`, `new Function("… " + localName)` | Mangling and escaping are skipped automatically and a warning is added; the other transforms still run. |
| `import` / `export` | Module syntax is detected and mangling is skipped with a warning, because `new Function` (the internal parse check) only accepts scripts. Strings in `from` clauses are left untouched. |
| Output is minified after obfuscation | `selfDefending` throws, because a minifier renames or rewrites generated functions. Re-indenting only (whitespace) is tolerated. Disable `selfDefending` if the output goes through Terser/esbuild/webpack again, or obfuscate *after* minifying. |
| `debugProtection` in Node.js | A repeating timer is installed. It is unref'ed when possible so the process can still exit, but code that observes timers will see it. |
| `disableConsoleOutput` | All common `console` methods become no-ops for the whole page/process, not just for your code. |
| `wrapInIife` | Top-level `var`/`function` declarations and top-level `this` stop leaking to the global object, and the script's completion value becomes `undefined`. |
| Strict mode | A leading `"use strict";` directive is kept in front of all generated code, and inside the IIFE when `wrapInIife` is used. |
| Script completion value | The final top-level statement is never moved, wrapped or followed by decoy code, so the value a script evaluates to is preserved (unless `wrapInIife` is on). |
| Heavily minified input | CloakJS is a lexer, not a parser. It preserves anything it does not explicitly rewrite and skips statements it cannot prove safe, but always test the generated code. |
| Size | Dead code, decoys, flattening and the decoder all add bytes. On a multi-kilobyte file expect roughly 1.0× (`low`), 1.2× (`medium`), 2–4× (`high`) and 4–8× (`extreme`). Small snippets grow much more, because the generated decoder is a fixed cost that does not shrink with the input. |

CloakJS uses a conservative lexer rather than a full JavaScript parser: it understands strings, template literals (including nested substitutions), regular expressions, comments, ASI-sensitive statement splitting, destructuring, classes including private fields, generators and async functions well enough to avoid touching what it cannot reason about. It does not support JSX, TypeScript, decorators or stage-3 syntax, which may end up only partially obfuscated. Every generated output is checked with `new Function`, and a syntax error is reported through `warnings` instead of being hidden. If you need production-grade semantic guarantees, use a parser-based tool and review its output too.

### What this does *not* do

- It does not encrypt anything with a key the client does not have. The RC4 key, the alphabet and the decoder all ship with the output.
- It does not stop runtime inspection: patching the decoder, dumping the string array or attaching a debugger all still work.
- It does not protect secrets. If a value must stay secret, it must not be sent to the client.

## Testing and contributing

Run the dependency-free Node test suite (no fixtures, no network):

```sh
node --test
```

The suite compares the behaviour of the original and the obfuscated program for every preset and for a matrix of option combinations, so a change that alters program semantics fails the run.

To regenerate the minified file locally, fetch Terser as a temporary build tool (the library itself has no dependencies and needs no manifest):

```sh
npm exec --yes --package=terser@5.44.0 -- terser cloakjs.js --compress --mangle --comments '/^!/' --output cloakjs.min.js
```

On pushes that change `cloakjs.js` or the test suite, [the Ubuntu GitHub Actions workflow](.github/workflows/minify.yml) runs the tests, regenerates `cloakjs.min.js`, verifies that the minified build reproduces the readable build's output for the same seed, and commits the file back to **the same branch** only if it changed. The workflow needs Actions to have permission to write repository contents; branch protection rules may prevent an automated push.

Contributions and bug reports are welcome via [GitHub issues](https://github.com/Infinitode/CloakJS/issues) and pull requests. When reporting a transform bug, include the input snippet, the preset/options, the warning list and the observed output — that is usually enough to reproduce it.

## License

CloakJS is released under the [MIT License](LICENSE). Copyright (c) 2026 Infinitode.
