# rolldown resolve-option receipts leak `custom` between concurrent `this.resolve()` calls

Two things are shown here, on Vite 8.2.2 (rolldown 1.2.8) and `@module-federation/vite` 1.23.3.

## 1. The rolldown adapter bug (deterministic)

`PluginContextData.saveResolveOptions` in rolldown's JS plugin adapter hands out `resolveOptionsMap.size` as the receipt
for a `this.resolve(source, importer, options)` call. When an earlier call finishes and deletes its entry, the next call
gets the same number and overwrites the entry of a call that is still in flight. `resolveId` hooks then read the wrong
`custom` options for that call (or `undefined` once the other call has finished).

```sh
npm install
npm run generate      # writes src/ (400 JSX modules importing each other) and index.html
npm run demo:receipt
```

Three `this.resolve()` calls are issued from `buildStart` with `custom.tag` A, B, C; a `resolveId` hook logs what arrives.
Expected: each specifier arrives with its own tag. Actual:

```text
[witness] demo:a arrived with custom={"tag":"A"}
[witness] demo:b arrived with custom={"tag":"C"}
[witness] demo:c arrived with custom=undefined
```

## 2. What it does to module federation (nondeterministic, frequent)

`@module-federation/vite` marks its own internal lookups with `custom.__mfSharedEntryLookup` and its share proxy
(`proxyPreBuildShared:resolve-shared-loadShare`) stands aside for any resolve that carries the marker. With the leak,
a resolve of a shared specifier issued by another plugin through `this.resolve()` (here `path-resolver`, standing in for
tsconfig-paths style resolvers and framework plugins that resolve imports themselves and return the result) can arrive
with the marker. The proxy then stands aside, the import resolves to the local file, and the module ends up calling the
local CommonJS copy of `react/jsx-runtime` instead of going through the `__loadShare__` wrapper. In a larger app the same
thing hit `react`, `react-dom/client` and `i18next`, i.e. a second React instance on the page.

```sh
npm run repeat        # RUNS=10 by default
```

Three witnesses, one line per build:

- `probe-witness` (before `federation()`): a resolve of `react/jsx-runtime` from an application file arrived with the
  marker;
- `bypass-witness` (after `federation()`): the share proxy returned nothing for such a resolve;
- `scripts/check.mjs`: an application module in the output calls `require_jsx_runtime()` (the local copy) instead of the
  wrapper export.

On this machine, 8 runs: 6 had the marker leak onto an application import, 7 had the proxy stand aside for one, 7 bundled
a local copy, e.g.

```text
build 5: 14 leaked marker(s), 12 proxy bypass(es) (marked lookup of "react/jsx-runtime" from mod_279.jsx);   src/mod_220.jsx uses the local copy (require_jsx_runtime) instead of the share wrapper
```

`NO_RESOLVER=1 npm run repeat` removes the resolver plugin; the module graph's own resolutions carry no receipt, so the
leak needs some plugin to resolve the shared specifier through `this.resolve()` and use the result.
