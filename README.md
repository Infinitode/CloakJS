# CloakJS 1.2.0

[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/Infinitode/CloakJS.svg)](https://github.com/Infinitode/CloakJS/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/Infinitode/CloakJS.svg)](https://github.com/Infinitode/CloakJS/issues)
[![jsDelivr monthly downloads](https://data.jsdelivr.com/v1/package/gh/Infinitode/CloakJS/badge?style=rounded)](https://www.jsdelivr.com/package/gh/Infinitode/CloakJS)

CloakJS is a single-file, dependency-free JavaScript obfuscator for the browser and Node.js. It can rename some identifiers, encode strings and numbers, and optionally add a dispatcher and decoy statements. It returns JavaScript source code; it does **not** run the code for you.

> [!IMPORTANT]
> Obfuscation makes source less readable, **not secure**. Never put secrets, credentials or security-critical checks in client-side JavaScript. CloakJS uses a small lexer rather than a full JavaScript parser; test transformed output in the environment where it will run. It is intended for classic scripts, not ES modules, JSX or TypeScript.

## Getting started

Download [`cloakjs.js`](cloakjs.js) (readable) or [`cloakjs.min.js`](cloakjs.min.js) (minified), or load either from [jsDelivr](https://www.jsdelivr.com/package/gh/Infinitode/CloakJS) after the files are available on the repository's `main` branch:

```html
<!-- Production: minified version -->
<script src="https://cdn.jsdelivr.net/gh/Infinitode/CloakJS@main/cloakjs.min.js"></script>
<!-- For development, use https://cdn.jsdelivr.net/gh/Infinitode/CloakJS@main/cloakjs.js instead. -->
<script>
  const code = CloakJS.obfuscate('console.log("Hello from CloakJS!")', 'medium');
  console.log(code); // JavaScript source as a string
</script>
```

For reproducible deployments, replace `@main` with a published tag or commit hash (once available). The minified file is generated from `cloakjs.js` with Terser; there is no npm release to install. The badge above displays jsDelivr's live download information rather than a hard-coded count and may not show data until the files have been published on `main`.

In Node.js (modern Node with `atob`, `TextEncoder` and `TextDecoder`):

```js
const CloakJS = require('./cloakjs.js');
const result = CloakJS.obfuscateWithStats('console.log("hello")', 'high');
console.log(result.code);
console.log(result.stats, result.warnings);
```

The file is UMD: it also works as an AMD module, or as the global `CloakJS` in a normal `<script>` tag. The **generated** script needs `atob`, `Uint8Array` and `TextDecoder` when string encryption is enabled. If those APIs are unavailable, disable `stringEncryption` or provide polyfills.

## API

| Method / property | Description |
| --- | --- |
| `CloakJS.obfuscate(source, options?)` | Return the obfuscated JavaScript **string**. |
| `CloakJS.obfuscateWithStats(source, options?)` | Return `{ code, stats, warnings }`. Check warnings before using the result. |
| `CloakJS.measure(source, options?)` | Return `{ originalBytes, obfuscatedBytes, ratio }` (generates a fresh randomized output). |
| `CloakJS.resolveOptions(options?)` | Return a copy of the chosen preset or defaults merged with your options. |
| `CloakJS.presets`, `CloakJS.defaultOptions` | Available presets and default settings. |
| `CloakJS.NAME`, `CloakJS.VERSION`, `CloakJS.BANNER` | Metadata. |

`source` must be a string. `options` can be a preset name (`'off'`, `'low'`, `'medium'`, `'high'`, `'extreme'`), an options object, or omitted (defaults to the high settings). Unknown preset names throw an error. Output is randomized and may differ from call to call; `measure` will not necessarily describe a previous `obfuscate` result.

The `stats` object contains `identifiersRenamed`, `stringsEncrypted`, `numbersEncoded`, `deadCodeBlocks`, `originalBytes`, `obfuscatedBytes`, and `ratio` (output bytes divided by input bytes). A ratio **greater than 1** means the output grew. The byte counts use UTF-8. `warnings` reports a skipped control-flow pass or a generated-script parse error; it does not guarantee behavioral equivalence.

### Presets

| Preset | Identifier mangling | String encryption | Number encoding | Control flow | Dead code | Self-defending prelude |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| `off` | No | No | No | No | No | No |
| `low` | Yes | No | No | No | No | No |
| `medium` | Yes | Yes | Yes | No | No | No |
| `high` | Yes | Yes | Yes | Yes | Yes | Yes |
| `extreme` | Yes | Yes | Yes | Yes | Yes | Yes |

`high` and `extreme` currently have the **same settings**. Every preset enables `compactOutput`. The default options are the high settings. A custom object overrides only the keys you supply:

```js
const result = CloakJS.obfuscateWithStats(
  'var message = "hi"; console.log(message);',
  { stringEncryption: false, controlFlowFlattening: false }
);
if (result.warnings.length) console.warn(result.warnings);
console.log(result.code);
```

### Options and limitations

- `identifierMangling`: renames selected declared identifiers when the lexer does not find a property/shorthand use. It can change externally visible names; do not use it on code whose bindings are part of a public API.
- `stringEncryption`: stores eligible string literals as RC4-encoded UTF-8 bytes in a Base64 array and injects a runtime decoder. This is **obfuscation, not cryptographic protection**. Templates are left untouched, and some strings (such as object keys and directives) are skipped.
- `numberEncoding`: rewrites some numeric literals as arithmetic or hexadecimal expressions. Small literals, BigInts and non-finite values are not rewritten.
- `controlFlowFlattening`: uses a switch dispatcher only for a limited set of top-level expression statements. It skips statements that might change scope or behavior and reports this in `warnings`.
- `deadCodeInjection`: adds unreachable decoy statements; this increases output size.
- `selfDefending`: inserts an isolated prelude. It does **not** prevent debugging or tampering and does not freeze or alter host objects.
- `compactOutput`: removes empty lines and trims whitespace; this is not a minifier.

The transform is intentionally conservative in some places, but no textual/lexer-based transform can understand all JavaScript grammar, scopes, dynamic access, template expressions, regex/division ambiguity or automatic semicolon insertion. It may reject valid module syntax in the parse check (`new Function` only accepts scripts), or produce code that parses but behaves differently. Always run your own tests against the **generated** code, especially for complex syntax, strict mode, imports, public globals and code that uses `eval`/`with`. If you need production-grade semantic preservation, use a parser-based tool instead.

## Testing and contributing

Run the dependency-free Node test suite with `node --test`. To regenerate the minified file locally (build tool only; the library itself has no dependencies):

```sh
npm exec --yes --package=terser@5.44.0 -- terser cloakjs.js --compress --mangle --comments '/^!/' --output cloakjs.min.js
```

On pushes that change `cloakjs.js`, [the Ubuntu GitHub Actions workflow](.github/workflows/minify.yml) runs the tests, regenerates `cloakjs.min.js`, verifies it, and commits/pushes the file back to **the same branch** only if it changed. The workflow needs Actions to have permission to write repository contents; branch protection rules may prevent an automated push. Its generated-file-only commit does not retrigger the workflow because the trigger is limited to `cloakjs.js`.

Contributions and bug reports are welcome via [GitHub issues](https://github.com/Infinitode/CloakJS/issues) and pull requests; include a small input/output reproduction and runtime details when reporting a transform bug.

## License

CloakJS is released under the [MIT License](LICENSE). Copyright (c) 2026 Infinitode.
