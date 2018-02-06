//processing of json files like package.json
import json from 'rollup-plugin-json';
//allow commonjs style imports/exports
import commonjs from 'rollup-plugin-commonjs';
//rename certain node.js packages to a browser equivalent when bundling
import alias from 'rollup-plugin-alias';
//copy node.js builtins into the bundle so they are available in the browser
import builtins from 'rollup-plugin-node-builtins';
//transform the es6 code to es5
import babel from 'rollup-plugin-babel';
import pkg from './package.json';

export default {
  input: 'index.js',
  output: {
    file: 'dist/ProviderEngine.js',
    format: 'cjs'
  },
  external: [
    ...Object.keys(pkg.dependencies),
    'ethereumjs-tx/fake.js',
    'ethereumjs-vm/lib/hooked',
  ],
  plugins: [
    json(),
    alias({
      "request": "xhr"
    }),
    commonjs({
      include: ["node_modules/**"]
    }),
    babel({
      babelrc: false,
      exclude: 'node_modules/**',
      "presets": [
        [
          "env",
          {
            "modules": false
          }
        ]
      ],
      "plugins": [
        "external-helpers"
      ]
    }),
    builtins(),

  ]
}
