import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/bundle.js',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  sourcemap: true,
});

console.log('Build complete');
