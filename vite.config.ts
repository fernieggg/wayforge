import { defineConfig } from 'vite';

// Bundles the browser runtime into one IIFE. The CLI inlines it into each built page.
export default defineConfig({
  build: {
    outDir: 'dist-runtime',
    emptyOutDir: true,
    target: 'es2019',
    lib: {
      entry: 'src/runtime/main.ts',
      formats: ['iife'],
      name: 'Wayforge',
      fileName: () => 'runtime.js',
    },
  },
});
