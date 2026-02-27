#!/usr/bin/env zx
/// <reference types="zx/globals" />
/**
 * Build script: shallow-clones tree-sitter-catala, builds WASM parsers,
 * copies output to /dist, and adds tree-sitter playground static files for demo.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  cpSync,
  rmSync,
} from "fs";
import { join } from "path";

const REPO_URL = "https://github.com/CatalaLang/tree-sitter-catala";
const TREE_SITTER_REPO = "https://github.com/tree-sitter/tree-sitter";
const BUILD_DIR = join(process.cwd(), ".build", "tree-sitter-catala");
const TREE_SITTER_BUILD = join(process.cwd(), ".build", "tree-sitter");
const CATALA_REPO = "https://github.com/CatalaLang/catala";
const CATALA_BUILD = join(process.cwd(), ".build", "catala");
const DIST_DIR = join(process.cwd(), "dist");

const LANGS = ["en", "fr", "pl"];
const VARIANTS = ["catala", "catala_code", "catala_expr"];

const PLAYGROUND_LANGS = ["catala_en", "catala_fr", "catala_pl"];
const PLAYGROUND_LABELS: Record<string, string> = {
  catala_en: "Catala (en)",
  catala_fr: "Catala (fr)",
  catala_pl: "Catala (pl)",
};

async function buildParsers() {
  echo("Building Catala tree-sitter WASM parsers…");

  if (existsSync(BUILD_DIR)) {
    echo("Removing existing build dir…");
    rmSync(BUILD_DIR, { recursive: true });
  }
  mkdirSync(join(process.cwd(), ".build"), { recursive: true });

  echo("Shallow cloning tree-sitter-catala…");
  await $`git clone --depth 1 ${REPO_URL} ${BUILD_DIR}`;

  cd(BUILD_DIR);

  const cargoTomlIn = readFileSync("Cargo.toml.in", "utf8");

  for (const variant of VARIANTS) {
    for (const lang of LANGS) {
      const subdir = `${variant}_${lang}`;
      echo(`Generating and building ${subdir}…`);

      mkdirSync(subdir, { recursive: true });

      const cargoToml = cargoTomlIn
        .replace(/\$\{TREESITTER_CATALA_VARIANT\}/g, variant)
        .replace(/\$\{TREESITTER_CATALA_LANG\}/g, lang);
      writeFileSync(join(BUILD_DIR, subdir, "Cargo.toml"), cargoToml);
      cpSync("grammar.js", join(subdir, "grammar.js"));

      cd(subdir);
      const prevLang = process.env.TREESITTER_CATALA_LANG;
      const prevVariant = process.env.TREESITTER_CATALA_VARIANT;
      process.env.TREESITTER_CATALA_LANG = lang;
      process.env.TREESITTER_CATALA_VARIANT = variant;
      try {
        await $`npx tree-sitter generate --abi=14`;
        await $`npx tree-sitter build`;
        await $`npx tree-sitter build --wasm`;
      } finally {
        if (prevLang !== undefined)
          process.env.TREESITTER_CATALA_LANG = prevLang;
        else delete process.env.TREESITTER_CATALA_LANG;
        if (prevVariant !== undefined)
          process.env.TREESITTER_CATALA_VARIANT = prevVariant;
        else delete process.env.TREESITTER_CATALA_VARIANT;
        cd(BUILD_DIR);
      }
    }
  }

  mkdirSync(DIST_DIR, { recursive: true });

  for (const variant of VARIANTS) {
    for (const lang of LANGS) {
      const subdir = `${variant}_${lang}`;
      const subdirPath = join(BUILD_DIR, subdir);
      if (!existsSync(subdirPath)) continue;

      const files = readdirSync(subdirPath);
      const wasmFiles = files.filter((f) => f.endsWith(".wasm"));
      for (const f of wasmFiles) {
        const src = join(subdirPath, f);
        const dest = join(DIST_DIR, f);
        cpSync(src, dest);
        echo(`  Copied ${f} -> dist/`);
      }
    }
  }

  const rootQueries = join(BUILD_DIR, "queries");
  if (existsSync(rootQueries)) {
    const distQueries = join(DIST_DIR, "queries");
    mkdirSync(distQueries, { recursive: true });
    cpSync(rootQueries, distQueries, { recursive: true });
    echo("Copied queries/ -> dist/queries/");
  }

  echo("Adding tree-sitter playground static files…");
  if (!existsSync(TREE_SITTER_BUILD)) {
    await $`git clone --depth 1 ${TREE_SITTER_REPO} ${TREE_SITTER_BUILD}`;
  }
  const playgroundHtmlPath = join(
    TREE_SITTER_BUILD,
    "crates",
    "cli",
    "src",
    "playground.html",
  );
  const playgroundJsPath = join(
    TREE_SITTER_BUILD,
    "docs",
    "src",
    "assets",
    "js",
    "playground.js",
  );
  if (!existsSync(playgroundHtmlPath) || !existsSync(playgroundJsPath)) {
    throw new Error("Playground files not found in tree-sitter clone");
  }
  cpSync(playgroundJsPath, join(DIST_DIR, "playground.js"));
  echo("  Copied playground.js -> dist/");

  const baseUrl = "https://tree-sitter.github.io";
  await $`curl -sL -o ${join(DIST_DIR, "web-tree-sitter.js")} ${baseUrl}/web-tree-sitter.js`;
  await $`curl -sL -o ${join(DIST_DIR, "web-tree-sitter.wasm")} ${baseUrl}/web-tree-sitter.wasm`;
  echo("  Downloaded web-tree-sitter.js and web-tree-sitter.wasm -> dist/");

  let indexHtml = readFileSync(playgroundHtmlPath, "utf8")
    .replace(/THE_LANGUAGE_NAME/g, "Catala")
    .replace(
      /LANGUAGE_BASE_URL = "[^"]*";/,
      'LANGUAGE_BASE_URL = (function(){ var p = window.location.pathname; if (/\\/catala-wasm(\\/|$)/.test(p)) return "/catala-wasm"; return ""; })();',
    );
  const selectOptionMatch = indexHtml.match(
    /<select id="language-select"[^>]*>[\s\S]*?<\/select>/,
  );
  if (selectOptionMatch) {
    const options = PLAYGROUND_LANGS.map(
      (v) => `<option value="${v}">${PLAYGROUND_LABELS[v] ?? v}</option>`,
    ).join("\n          ");
    const newSelect = `<select id="language-select">\n          ${options}\n        </select>`;
    indexHtml = indexHtml.replace(
      /<select id="language-select"[^>]*>[\s\S]*?<\/select>/,
      newSelect,
    );
  }
  indexHtml = indexHtml.replace(
    /<span class="language-name">Language: Catala<\/span>/,
    '<span class="language-name">Language: Catala</span> <a href="./compiler.html">Compiler</a>',
  );
  writeFileSync(join(DIST_DIR, "index.html"), indexHtml);
  echo("  Wrote index.html -> dist/");

  echo(
    "Done. Output is in dist/ (deploy dist/ to any static host for the demo).",
  );
}

async function buildCatalaJsoo() {
  echo("Building Catala js_of_ocaml web interpreter…");

  mkdirSync(join(process.cwd(), ".build"), { recursive: true });

  if (!existsSync(CATALA_BUILD)) {
    echo("Shallow cloning catala…");
    await $`git clone --depth 1 ${CATALA_REPO} ${CATALA_BUILD}`;
  } else {
    echo("Refreshing catala checkout…");
    cd(CATALA_BUILD);
    await $`git fetch --depth 1 origin`;
    await $`git reset --hard origin/master`;
  }

  cd(CATALA_BUILD);
  echo("Installing OCaml dependencies (make dependencies-js)…");
  await $`OPAMYES=1 make dependencies-js`;
  echo("Building and testing web interpreter (make web-interpreter-tests)…");
  await $`OPAMYES=1 make web-interpreter-tests`;

  const builtInterpreter = join(
    CATALA_BUILD,
    "_build",
    "default",
    "compiler",
    "web",
    "catala_web_interpreter.bc.js",
  );

  if (!existsSync(builtInterpreter)) {
    throw new Error("catala_web_interpreter.bc.js was not produced by dune");
  }

  mkdirSync(DIST_DIR, { recursive: true });
  cpSync(builtInterpreter, join(DIST_DIR, "catala_web_interpreter.bc.js"));
  echo("  Copied catala_web_interpreter.bc.js -> dist/");

  writeCompilerHtml();
}

function writeCompilerHtml() {
  const defaultCode = [
    "```catala",
    "declaration scope Test:",
    "  output result content integer",
    "",
    "scope Test:",
    "  definition result equals 42",
    "```",
  ].join("\n");

  const compilerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Catala Compiler</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/6.65.7/codemirror.min.css">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, sans-serif; background: #1e1e1e; color: #d4d4d4; height: 100vh; display: flex; flex-direction: column; }
    header { padding: 12px 16px; border-bottom: 1px solid #333; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; background: #252526; }
    header a { color: #79c0ff; text-decoration: none; }
    header a:hover { text-decoration: underline; }
    .row { display: flex; align-items: center; gap: 8px; }
    label { font-size: 14px; }
    select, input[type="text"] { padding: 6px 10px; border: 1px solid #555; border-radius: 4px; background: #3c3c3c; color: #d4d4d4; font-size: 14px; }
    button { padding: 8px 16px; border: 1px solid #555; border-radius: 4px; background: #0e639c; color: #fff; cursor: pointer; font-size: 14px; }
    button:hover { background: #1177bb; }
    main { flex: 1; display: flex; min-height: 0; }
    #editor-wrap { flex: 1; display: flex; flex-direction: column; border-right: 1px solid #333; min-width: 0; }
    #editor { flex: 1; min-height: 200px; }
    .CodeMirror { height: 100% !important; background: #1e1e1e !important; }
    #output-wrap { width: 50%; display: flex; flex-direction: column; min-width: 0; background: #252526; }
    #output-header { padding: 8px 16px; border-bottom: 1px solid #333; font-weight: 600; }
    #output { flex: 1; overflow: auto; padding: 16px; font-family: ui-monospace, monospace; font-size: 13px; line-height: 1.5; white-space: pre-wrap; }
    #output.success { color: #7ee787; }
    #output.error { color: #f85149; }
    .diag { margin: 8px 0; padding: 8px; border-radius: 4px; font-size: 13px; }
    .diag.error { background: rgba(248,81,73,0.15); color: #f85149; }
    .diag.warning { background: rgba(210,153,34,0.15); color: #d99a22; }
  </style>
</head>
<body>
  <header>
    <a href="./index.html">Parser playground</a>
    <span style="color:#555">|</span>
    <span>Catala compiler</span>
    <div class="row">
      <label for="lang">Language</label>
      <select id="lang"><option value="en">English</option><option value="fr">Français</option><option value="pl">Polski</option></select>
    </div>
    <div class="row">
      <label for="scope">Scope</label>
      <input type="text" id="scope" placeholder="e.g. Test" value="Test" size="12">
    </div>
    <button id="btn-typecheck">Typecheck</button>
    <button id="btn-interpret">Interpret</button>
  </header>
  <main>
    <div id="editor-wrap">
      <div id="output-header">Source</div>
      <div id="editor"></div>
    </div>
    <div id="output-wrap">
      <div id="output-header">Output</div>
      <pre id="output">Load the page and enter Catala code, then run Typecheck or Interpret.</pre>
      <div id="diagnostics"></div>
    </div>
  </main>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/6.65.7/codemirror.min.js"></script>
  <script>
    const defaultCode = ${JSON.stringify(defaultCode)};
    const editorEl = document.getElementById('editor');
    const editor = CodeMirror(editorEl, { value: defaultCode, lineNumbers: true, lineWrapping: true });
    const outputEl = document.getElementById('output');
    const diagEl = document.getElementById('diagnostics');
    const scopeInput = document.getElementById('scope');
    const langSelect = document.getElementById('lang');
    const runtime = window;

    function getFilename() {
      return 'main.catala_' + langSelect.value;
    }

    function run(interpret) {
      if (typeof runtime.typecheck !== 'function' || typeof runtime.interpret !== 'function') {
        outputEl.textContent = 'Interpreter not loaded yet. Wait for the script to load.';
        outputEl.className = 'error';
        return;
      }
      const code = editor.getValue();
      const lang = langSelect.value;
      const scope = scopeInput.value.trim();
      const files = { [getFilename()]: code };
      diagEl.innerHTML = '';
      outputEl.className = '';

      try {
        const result = interpret
          ? runtime.interpret({ files: files, scope: scope, language: lang })
          : runtime.typecheck({ files: files, language: lang });
        outputEl.textContent = result.output || (result.success ? 'OK' : '');
        outputEl.className = result.success ? 'success' : 'error';
        (result.diagnostics || []).forEach(function(d) {
          const div = document.createElement('div');
          div.className = 'diag ' + (d.level === 'error' ? 'error' : 'warning');
          div.textContent = d.message;
          diagEl.appendChild(div);
        });
      } catch (e) {
        outputEl.textContent = e.message || String(e);
        outputEl.className = 'error';
      }
    }

    document.getElementById('btn-typecheck').onclick = function() { run(false); };
    document.getElementById('btn-interpret').onclick = function() { run(true); };
  </script>
  <script src="./catala_web_interpreter.bc.js"></script>
</body>
</html>
`;
  writeFileSync(join(DIST_DIR, "compiler.html"), compilerHtml);
  echo("  Wrote compiler.html -> dist/");
}

async function run() {
  await buildParsers();
  await buildCatalaJsoo();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
