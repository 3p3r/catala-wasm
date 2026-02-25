# catala-wasm

[Catala](https://catala-lang.org) language parser in WebAssembly, built with [tree-sitter](https://tree-sitter.github.io) and [tree-sitter-catala](https://github.com/CatalaLang/tree-sitter-catala).

## Build

Requires Node.js, npm, and [Rust](https://rustup.rs) (for the tree-sitter CLI).

```bash
npm install
npm run build
```

The script shallow-clones `tree-sitter-catala`, builds WASM parsers for the three language variants (en, fr, pl), copies them and the tree-sitter **playground** static files into `dist/`.

## Demo

Serve `dist/` locally:

```bash
npm run serve
```

Then open the URL shown (e.g. http://localhost:8080). Use the language dropdown to switch between **Catala (en)**, **Catala (fr)**, and **Catala (pl)**.

## Deploy

Deploy the contents of `dist/` to any static host (GitHub Pages, Netlify, etc.). No server-side logic required.
