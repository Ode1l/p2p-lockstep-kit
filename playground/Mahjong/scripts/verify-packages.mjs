import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const multiui = resolve(root, "../p2p-lockstep-kit-multiui");
const multisession = resolve(root, "../p2p-lockstep-kit-multisession");
const temporary = mkdtempSync(join(tmpdir(), "p2p-mahjong-consumer-"));
const packages = join(temporary, "packages");
const consumer = join(temporary, "consumer");

const run = (command, args, cwd) =>
  execFileSync(command, args, { cwd, stdio: "inherit" });

try {
  mkdirSync(packages);
  run("pnpm", ["build"], multisession);
  run("npm", ["pack", "--ignore-scripts", "--pack-destination", packages], multisession);
  run("pnpm", ["build"], multiui);
  run("npm", ["pack", "--ignore-scripts", "--pack-destination", packages], multiui);

  const tarballs = readdirSync(packages).filter((name) => name.endsWith(".tgz"));
  const multisessionTarball = tarballs.find((name) =>
    name.startsWith("p2p-lockstep-kit-multisession-"),
  );
  const multiuiTarball = tarballs.find((name) =>
    name.startsWith("p2p-lockstep-kit-multiui-"),
  );
  if (!multisessionTarball || !multiuiTarball) {
    throw new Error("both package tarballs are required");
  }

  mkdirSync(consumer);
  for (const path of ["src", "index.html", "tsconfig.json", "vite.config.ts"]) {
    cpSync(join(root, path), join(consumer, path), { recursive: true });
  }
  const sourceManifest = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8"),
  );
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify(
      {
        name: "mahjong-package-consumer",
        private: true,
        type: "module",
        dependencies: {
          "p2p-lockstep-kit-multisession": `file:${join(packages, multisessionTarball)}`,
          "p2p-lockstep-kit-multiui": `file:${join(packages, multiuiTarball)}`,
        },
        devDependencies: sourceManifest.devDependencies,
      },
      null,
      2,
    ),
  );

  run("pnpm", ["install", "--ignore-scripts"], consumer);
  run(join(consumer, "node_modules", ".bin", "tsc"), ["-p", "tsconfig.json", "--noEmit"], consumer);
  run(join(consumer, "node_modules", ".bin", "vite"), ["build"], consumer);
  console.log("packed multisession + multiui Mahjong consumer passed");
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
