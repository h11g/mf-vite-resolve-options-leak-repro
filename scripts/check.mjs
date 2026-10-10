// Reports application modules that reach a shared package through its local CommonJS copy (`require_<pkg>()`, which
// rolldown emits for the local file) instead of through the __loadShare__ wrapper. The local copy itself legitimately
// lives inside the share wrapper / prebuild chunks; the defect is an application module calling it.
import { readdirSync, readFileSync } from 'node:fs';
const isShareChunk = (f) => /__loadShare__|__prebuild__|localSharedImportMap|hostInit|remoteEntry|mf-entry-bootstrap|pendingShares/.test(f);
const LOCAL_REQUIRE = /__toESM\(require_(jsx_runtime|react|client)\(\)/g;
const hits = [];
for (const f of readdirSync('dist/assets').filter((f) => f.endsWith('.js') && !isShareChunk(f))) {
  const code = readFileSync(`dist/assets/${f}`, 'utf8');
  for (const m of code.matchAll(LOCAL_REQUIRE)) {
    const region = code.lastIndexOf('//#region ', m.index);
    const mod = region === -1 ? '?' : code.slice(region + 10, code.indexOf('\n', region));
    hits.push(`${mod} uses the local copy (require_${m[1]}) instead of the share wrapper`);
  }
}
if (hits.length) {
  console.log(`LOCAL COPY used by ${hits.length} application module(s):`);
  for (const h of hits) console.log('  ' + h);
  process.exitCode = 1;
} else console.log('clean: every application module reaches the shared packages through the share wrapper');
