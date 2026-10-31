import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  package: resolve(root, "package.json"),
  tauri: resolve(root, "src-tauri/tauri.conf.json"),
  cargo: resolve(root, "src-tauri/Cargo.toml"),
  lock: resolve(root, "src-tauri/Cargo.lock"),
};

function read(file) {
  return readFileSync(file, "utf8");
}

function packageVersion() {
  return JSON.parse(read(files.package)).version;
}

function tauriVersion() {
  return JSON.parse(read(files.tauri)).version;
}

function cargoVersion() {
  const match = read(files.cargo).match(
    /^name = "tauri-notes"\r?\nversion = "([^"]+)"$/m,
  );
  if (!match) {
    throw new Error("could not find tauri-notes version in Cargo.toml");
  }
  return match[1];
}

function lockVersion() {
  const match = read(files.lock).match(
    /\[\[package\]\]\r?\nname = "tauri-notes"\r?\nversion = "([^"]+)"/,
  );
  if (!match) {
    throw new Error("could not find tauri-notes version in Cargo.lock");
  }
  return match[1];
}

function versions() {
  return {
    package: packageVersion(),
    tauri: tauriVersion(),
    cargo: cargoVersion(),
    lock: lockVersion(),
  };
}

function check() {
  const found = versions();
  const expected = found.package;
  const mismatches = Object.entries(found).filter(
    ([, value]) => value !== expected,
  );
  if (mismatches.length > 0) {
    for (const [source, value] of mismatches) {
      console.error(
        `version mismatch: package.json=${expected}, ${source}=${value}`,
      );
    }
    process.exitCode = 1;
    return;
  }
  console.log(`version check passed: ${expected}`);
}

function set(next) {
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(next)) {
    throw new Error(`invalid semver: ${next}`);
  }

  const packageJson = JSON.parse(read(files.package));
  packageJson.version = next;
  writeFileSync(files.package, `${JSON.stringify(packageJson, null, 2)}\n`);

  const tauri = JSON.parse(read(files.tauri));
  tauri.version = next;
  writeFileSync(files.tauri, `${JSON.stringify(tauri, null, 2)}\n`);

  let cargo = read(files.cargo);
  cargo = cargo.replace(
    /^(name = "tauri-notes"\r?\nversion = ")[^"]+(")/m,
    `$1${next}$2`,
  );
  writeFileSync(files.cargo, cargo);

  let lock = read(files.lock);
  lock = lock.replace(
    /(\[\[package\]\]\r?\nname = "tauri-notes"\r?\nversion = ")[^"]+(")/,
    `$1${next}$2`,
  );
  writeFileSync(files.lock, lock);

  console.log(`version set to ${next}`);
}

const command = process.argv[2] ?? "check";
if (command === "check") {
  check();
} else if (command === "set") {
  set(process.argv[3]);
} else {
  console.error("usage: node scripts/version.mjs [check|set <semver>]");
  process.exitCode = 1;
}
