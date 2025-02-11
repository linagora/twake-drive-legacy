import { minify } from 'rollup-plugin-esbuild-minify'
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs  from '@rollup/plugin-commonjs';
import json  from "@rollup/plugin-json"

export default {
  input: 'files/upload-files.js',
  output: {
    dir: 'dist',
    format: 'cjs',
    sourcemap: true,
  },
  preferBuiltins: true,
  external: [new RegExp(/^(k6|https?\:\/\/)(\/.*)?/)],
  plugins: [commonjs(), nodeResolve(), json(), minify({logLevel: "info"})]
};