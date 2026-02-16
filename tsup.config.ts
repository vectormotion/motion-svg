import { defineConfig } from 'tsup';

export default defineConfig([
  // Main entry (framework-agnostic core)
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    treeshake: true,
    external: ['react', 'react-dom'],
  },
  // React bindings — imports core at runtime
  {
    entry: { 'react/index': 'src/react/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    splitting: false,
    treeshake: true,
    external: ['react', 'react-dom'],
    esbuildOptions(options) {
      options.jsx = 'automatic';
    },
  },
  // Vanilla Web Component
  {
    entry: { 'vanilla/index': 'src/vanilla/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    splitting: false,
    treeshake: true,
  },
  // Plugins
  {
    entry: { 'plugins/index': 'src/plugins/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    splitting: false,
    treeshake: true,
  },
]);
