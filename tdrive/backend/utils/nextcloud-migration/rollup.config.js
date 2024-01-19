import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

export default {
  input: './src/express_server.ts',
  output: {
    format: 'es',
    dir: 'dist',
    entryFileNames: '[name].js',
    sourcemap: true
  },
  plugins: [
   commonjs(),
   json(),
   nodeResolve({preferBuiltins: true}),
   typescript(),
   terser(),
  ]
}
