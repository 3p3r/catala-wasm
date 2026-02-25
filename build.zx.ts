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
const DIST_DIR = join(process.cwd(), "dist");

const LANGS = ["en", "fr", "pl"];
const VARIANTS = ["catala", "catala_code", "catala_expr"];

const PLAYGROUND_LANGS = ["catala_en", "catala_fr", "catala_pl"];
const PLAYGROUND_LABELS: Record<string, string> = {
  catala_en: "Catala (en)",
  catala_fr: "Catala (fr)",
  catala_pl: "Catala (pl)",
};

async function main() {
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
  const buildRoot = join(process.cwd(), ".build");
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
    .replace(/LANGUAGE_BASE_URL = "[^"]*";/, 'LANGUAGE_BASE_URL = "";');
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
  writeFileSync(join(DIST_DIR, "index.html"), indexHtml);
  echo("  Wrote index.html -> dist/");

  echo(
    "Done. Output is in dist/ (deploy dist/ to any static host for the demo).",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
