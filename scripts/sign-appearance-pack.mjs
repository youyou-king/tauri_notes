#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import {
  createPrivateKey,
  createPublicKey,
  sign,
} from "node:crypto";

function canonicalize(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const entries = Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
    .join(",")}}`;
}

function base64url(bytes) {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const [, , manifestPath, keyPath, publisher] = process.argv;
if (!manifestPath || !keyPath) {
  console.error(
    "usage: node scripts/sign-appearance-pack.mjs <appearance.json> <private-key.pem> [publisher]",
  );
  process.exit(1);
}

const manifest = JSON.parse(
  readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, ""),
);
if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
  console.error("appearance.json 必须是对象");
  process.exit(1);
}
delete manifest.signature;

const privateKey = createPrivateKey(readFileSync(keyPath, "utf8"));
const spki = createPublicKey(privateKey).export({
  type: "spki",
  format: "der",
});
const signature = sign(
  "sha256",
  Buffer.from(canonicalize(manifest), "utf8"),
  { key: privateKey, dsaEncoding: "ieee-p1363" },
);

manifest.signature = {
  algorithm: "ecdsa-p256-sha256",
  publicKey: base64url(spki),
  signature: base64url(signature),
  ...(publisher ? { publisher } : {}),
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`signed ${manifestPath}`);
