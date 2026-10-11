import {build} from 'esbuild';
import {copyFileSync, existsSync, mkdirSync} from 'fs';
import {join, dirname} from 'path';

async function buildElectron() {
  const outDir = 'dist-electron';
  
  // Ensure output directory exists
  if (!existsSync(outDir)) {
    mkdirSync(outDir, {recursive: true});
  }

  // Build main.ts
  await build({
    entryPoints: ['electron/main.ts'],
    bundle: true,
    outdir: outDir,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    minify: process.env.NODE_ENV === 'production',
    sourcemap: true,
    external: ['electron', 'electron-updater', 'electron-log']
  });

  // Build preload.ts
  await build({
    entryPoints: ['electron/preload.ts'],
    bundle: true,
    outdir: outDir,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    minify: process.env.NODE_ENV === 'production',
    sourcemap: true,
    external: ['electron']
  });

  // Copy package.json for electron-builder
  copyFileSync('package.json', join(outDir, 'package.json'));

  console.log('[Electron] Build completed successfully');
}

buildElectron().catch((error) => {
  console.error('[Electron] Build failed:', error);
  process.exit(1);
});
