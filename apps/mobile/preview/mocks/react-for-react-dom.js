/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose: react-dom require()s it. */
/**
 * `react` as react-dom sees it in the preview. The workspace pins react 19.3.0 (root `overrides`) while the installed
 * react-dom is 19.3.1, and react-dom refuses any React whose version string differs (minified React error #527). This
 * reports react-dom's own version and is otherwise the same module object, internals included. Web preview only
 * (preview/metro.cjs); it becomes a no-op once react-dom is pinned to the same version as react.
 */
const React = require('react');

module.exports = { ...React, version: require('react-dom/package.json').version };
