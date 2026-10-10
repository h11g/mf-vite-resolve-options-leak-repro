// Builds N times and counts (a) builds where the share proxy saw a marked lookup of react/jsx-runtime coming from an
// application file, i.e. another call's custom options were delivered to that resolve, and (b) builds where an
// application chunk ended up bundling a local copy of a shared package.
import { spawnSync } from 'node:child_process';
const N = Number(process.env.RUNS ?? 10);
let leaked = 0, bypassed = 0, bundled = 0;
for (let i = 1; i <= N; i++) {
  const build = spawnSync('npx', ['vite', 'build'], { encoding: 'utf8', env: process.env });
  const witness = build.stdout.split('\n').filter((l) => l.includes('[probe-witness]'));
  const bypass = build.stdout.split('\n').filter((l) => l.includes('[bypass-witness]'));
  const check = spawnSync('node', ['scripts/check.mjs'], { encoding: 'utf8' });
  leaked += witness.length > 0; bypassed += bypass.length > 0; bundled += check.status !== 0;
  console.log(`build ${i}: ${witness.length} leaked marker(s), ${bypass.length} proxy bypass(es)${witness.length ? ' (' + witness[0].replace('[probe-witness] ', '') + ')' : ''}; ${check.status === 0 ? 'no local copy bundled' : check.stdout.trim().split('\n')[1]}`);
}
console.log(`${leaked}/${N} builds had the marker leak onto an application import; ${bypassed}/${N} had the share proxy stand aside for one; ${bundled}/${N} bundled a local copy`);
