import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = new URL("..", import.meta.url);
const temp = await mkdtemp(join(tmpdir(), "p2p-multiui-pack-"));

try {
  const packed = spawnSync("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", temp], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(packed.status, 0, packed.stderr || packed.stdout);
  const result = JSON.parse(packed.stdout)[0];
  const names = new Set(result.files.map((file) => file.path));
  for (const expected of [
    "dist/index.js",
    "dist/index.d.ts",
    "dist/style.css",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
  ]) {
    assert(names.has(expected), `packed package is missing ${expected}`);
  }
  assert(![...names].some((name) => name.includes("mahjong")), "multiui package must not contain Mahjong source");
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(manifest.peerDependencies["p2p-lockstep-kit-multisession"], "^0.1.0");
  globalThis.HTMLElement = class {};
  globalThis.customElements = {
    get() {
      return undefined;
    },
    define() {},
  };
  const publicApi = await import(new URL("../dist/index.js", import.meta.url));
  assert.equal(typeof publicApi.defineP2PLockstepMultiUi, "function");
  assert.equal(typeof publicApi.LiveTableController, "function");
  console.log(`package smoke passed: ${result.filename}`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
