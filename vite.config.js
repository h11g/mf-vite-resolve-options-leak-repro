import { federation } from '@module-federation/vite';

// Logs every resolveId call for react/jsx-runtime that comes from an application file and carries the internal-lookup
// marker @module-federation/vite reserves for its own lookups. Ordered before federation() so it runs ahead of
// proxyPreBuildShared:resolve-shared-loadShare, which stands aside for any resolve carrying that marker.
const probeWitness = {
  name: 'probe-witness',
  enforce: 'pre',
  resolveId(source, importer, options) {
    if (source === 'react/jsx-runtime' && options?.custom?.__mfSharedEntryLookup && importer?.includes('/src/')) {
      console.log(`[probe-witness] marked lookup of "${source}" from ${importer.split('/src/')[1]}`);
    }
  },
};

// Emulates a resolver plugin (tsconfig paths, custom path mappers, framework resolvers) that resolves an import
// through this.resolve() with options and returns the result as the module's resolution. Each such call gets a
// receipt in rolldown's JS adapter and can be handed another call's custom options. Drop it with NO_RESOLVER=1.
const pathResolver = {
  name: 'path-resolver',
  enforce: 'pre',
  async resolveId(source, importer, options) {
    if (process.env.NO_RESOLVER || source !== 'react/jsx-runtime' || !importer?.includes('/src/')) return;
    return this.resolve(source, importer, { ...options, skipSelf: true });
  },
};

// Placed after federation(): a resolve of react/jsx-runtime from an application file only reaches this hook when
// proxyPreBuildShared:resolve-shared-loadShare returned nothing for it, i.e. the share proxy stood aside.
const bypassWitness = {
  name: 'bypass-witness',
  enforce: 'pre',
  resolveId(source, importer, options) {
    if (source === 'react/jsx-runtime' && importer?.includes('/src/')) {
      console.log(`[bypass-witness] share proxy stood aside for "${source}" from ${importer.split('/src/')[1]} (custom=${JSON.stringify(options?.custom)})`);
    }
  },
};

export default {
  plugins: [
    probeWitness,
    pathResolver,
    federation({
      name: 'host',
      filename: 'remoteEntry.js',
      remotes: {
        remote_app: { type: 'module', name: 'remote_app', entry: 'http://localhost:4174/remoteEntry.js' },
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
        'react/jsx-runtime': { singleton: true },
      },
    }),
    bypassWitness,
  ],
  build: { minify: false, manifest: true },
  logLevel: 'warn',
};
