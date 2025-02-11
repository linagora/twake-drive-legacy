import { minify } from 'rollup-plugin-esbuild-minify'
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'files/upload-files.js',
  output: {
    dir: 'dist',
    format: 'es',
    sourcemap: true,
  },
  external: [new RegExp(/^(k6|https?\:\/\/)(\/.*)?/)],
  plugins: [nodeResolve()]
};