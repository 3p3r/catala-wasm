# catala-wasm

Catala in the browser: a static web app with a **parser playground** (tree-sitter AST) and a **compiler** (typecheck and interpret), built from [tree-sitter-catala](https://github.com/CatalaLang/tree-sitter-catala) and the [Catala](https://catala-lang.org) compiler.

**Live demo:** [https://3p3r.github.io/catala-wasm/](https://3p3r.github.io/catala-wasm/)

- **Parser playground** ([/](https://3p3r.github.io/catala-wasm/)) — Edit Catala (en/fr/pl) and see the tree-sitter AST. Built with [tree-sitter](https://tree-sitter.github.io) and WASM parsers.
- **Compiler** ([/compiler.html](https://3p3r.github.io/catala-wasm/compiler.html)) — Typecheck and interpret Catala in the browser via the official compiler’s js_of_ocaml web interpreter.

One build produces everything in `dist/`; deploy that folder to any static host.

## Build

Requires Node.js, npm, [Rust](https://rustup.rs) (for the tree-sitter CLI), and [OCaml](https://ocaml.org) with [opam](https://opam.ocaml.org). The build script:

1. Clones [tree-sitter-catala](https://github.com/CatalaLang/tree-sitter-catala), builds WASM parsers for en/fr/pl, and adds the tree-sitter playground UI to `dist/`.
2. Clones the [Catala](https://github.com/CatalaLang/catala) compiler repo, runs `make dependencies-js` and `make web-interpreter-tests`, then copies the web interpreter and writes `dist/compiler.html`.

```bash
npm install
npm run build
```

Output is in `dist/` (parser + compiler, ready to serve or deploy).

## Demo

Serve `dist/` locally:

```bash
npm run serve
```

Open the URL (e.g. http://localhost:8080): use the parser page for the AST view and the **Compiler** link for typecheck/interpret.

## Deploy

Deploy the contents of `dist/` to any static host (e.g. GitHub Pages). No server-side logic required.
