# Knowledge

- Do not run `npm run build` in parallel with source-mode test commands like `npm test` or `node --experimental-strip-types ./tests/run-tests.ts`. The build script temporarily rewrites source imports from `.ts` to `.js` during compilation, so overlapping source-mode execution can fail with transient `ERR_MODULE_NOT_FOUND` errors such as missing `src/core/cli-fallback.js`.
