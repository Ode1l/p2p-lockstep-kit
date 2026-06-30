#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const appDir = resolve(process.argv[2] ?? process.cwd());
const errors = [];
const warnings = [];
const at = (...parts) => resolve(appDir, ...parts);
const requireFile = (file, reason) => {
  if (!existsSync(at(file))) errors.push(`${file}: ${reason}`);
};

requireFile("package.json", "missing application manifest");
requireFile("index.html", "missing Vite HTML entry");
requireFile("src/main.ts", "missing TypeScript application entry");

let pkg;
if (existsSync(at("package.json"))) {
  try {
    pkg = JSON.parse(readFileSync(at("package.json"), "utf8"));
  } catch (error) {
    errors.push(`package.json: invalid JSON (${error.message})`);
  }
}

if (pkg) {
  if (pkg.private !== true) errors.push("package.json: set private: true");
  if (pkg.type !== "module") warnings.push('package.json: expected type: "module"');
  for (const script of ["build", "typecheck", "test"]) {
    if (!pkg.scripts?.[script]) errors.push(`package.json: missing ${script} script`);
  }
  if (!pkg.dependencies?.["p2p-lockstep-kit-ui"]) {
    errors.push("package.json: UI package must be a runtime dependency");
  }
}

const vite = ["vite.config.ts", "vite.config.js", "vite.config.mjs"].find((f) => existsSync(at(f)));
if (!vite) errors.push("missing Vite config");
else if (/\blib\s*:/.test(readFileSync(at(vite), "utf8"))) {
  errors.push(`${vite}: library mode is invalid for a deployable game app`);
}

if (!existsSync(at("pnpm-lock.yaml"))) warnings.push("commit pnpm-lock.yaml with package.json");
if (existsSync(at("dist")) && !existsSync(at("dist/index.html"))) {
  errors.push("dist exists but dist/index.html is missing");
}

for (const warning of warnings) console.warn(`WARN ${warning}`);
for (const error of errors) console.error(`ERROR ${error}`);
if (errors.length) process.exit(1);
console.log(`OK ${appDir} has the expected p2p-lockstep-kit app shape.`);
