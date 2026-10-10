// Deterministic demo of the receipt collision in rolldown's JS plugin adapter: `custom` options of one in-flight
// this.resolve() are served to another plugin call. No module federation involved.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slow = {
  name: 'slow-first',
  enforce: 'pre',
  async resolveId(source) {
    // A finishes first and frees its receipt slot; C is issued and takes the same slot while B is still in flight;
    // B's later hooks then read C's options from that slot.
    if (source === 'demo:a') await sleep(50);
    if (source === 'demo:b') await sleep(100);
    if (source === 'demo:c') await sleep(200);
  },
};
const witness = {
  name: 'witness',
  enforce: 'pre',
  resolveId(source, importer, options) {
    if (source.startsWith('demo:')) console.log(`[witness] ${source} arrived with custom=${JSON.stringify(options?.custom)}`);
    if (source.startsWith('demo:')) return '\0' + source;
  },
  load(id) { if (id.startsWith('\0demo:')) return 'export default 1'; },
};
const issuer = {
  name: 'issuer',
  enforce: 'pre',
  async buildStart() {
    const a = this.resolve('demo:a', '/importer-a', { custom: { tag: 'A' } });
    const b = this.resolve('demo:b', '/importer-b', { custom: { tag: 'B' } });
    await a;                                                     // A's receipt is released
    const c = this.resolve('demo:c', '/importer-c', { custom: { tag: 'C' } }); // takes the released slot while B is in flight
    await Promise.all([b, c]);
  },
};
export default { plugins: [slow, witness, issuer], build: { minify: false, rollupOptions: { input: 'src/main.jsx' } }, logLevel: 'warn' };
