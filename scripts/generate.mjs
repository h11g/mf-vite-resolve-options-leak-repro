// Generates N JSX modules that import each other, so the build has enough concurrent resolutions to race.
import { mkdirSync, writeFileSync } from 'node:fs';
const N = Number(process.env.MODULES ?? 400);
mkdirSync('src', { recursive: true });
for (let i = 0; i < N; i++) {
  const deps = [1, 7, 31].map((d) => (i + d) % N).filter((j) => j !== i);
  writeFileSync(`src/mod_${i}.jsx`, [
    "import { useState } from 'react';",
    ...deps.map((j) => `import Mod${j} from './mod_${j}.jsx';`),
    `export default function Mod${i}() {`,
    '  const [n] = useState(0);',
    `  return <div data-mod="${i}">{n}${deps.map((j) => `<Mod${j} />`).join('')}</div>;`,
    '}',
    '',
  ].join('\n'));
}
writeFileSync('src/main.jsx', [
  "import { createRoot } from 'react-dom/client';",
  "import Mod0 from './mod_0.jsx';",
  "createRoot(document.getElementById('root')).render(<Mod0 />);",
  '',
].join('\n'));
writeFileSync('index.html', '<!doctype html><div id="root"></div><script type="module" src="/src/main.jsx"></script>\n');
console.log(`generated ${N} modules`);
