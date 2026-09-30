import { build } from 'esbuild';
import { cp, mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });
await cp('out', 'dist/client', { recursive: true });
await cp('.openai/hosting.json', 'dist/.openai/hosting.json');
await cp('drizzle', 'dist/.openai/drizzle', { recursive: true });
await cp(require.resolve('@cf-wasm/photon/photon.wasm'), 'dist/server/photon.wasm');
await build({
  entryPoints: ['server/worker.ts'], outfile: 'dist/server/index.js',
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022',
  conditions: ['workerd', 'browser'], define: { 'process.env.NODE_ENV': '"production"' },
  alias: { '@cf-wasm/photon': '@cf-wasm/photon/workerd' },
  external: ['node:*'],
  plugins: [{ name: 'worker-wasm', setup(b) {
    b.onResolve({ filter: /\.wasm$/ }, () => ({ path: './photon.wasm', external: true }));
  } }],
});
const manifest = JSON.parse(await readFile('.openai/hosting.json', 'utf8'));
if (manifest.static) throw new Error('Server build must not use static hosting mode.');
console.log('Worker, assets and migrations prepared.');
