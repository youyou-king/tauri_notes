import { beforeEach, describe, expect, it } from "vitest";
import type { AppearancePackManifest } from "./appearancePack";
import {
  bytesToBase64Url,
  canonicalize,
  isTrustedPublisher,
  signaturePayload,
  trustPublisher,
  verifyPublisherSignature,
} from "./publisher";

const base: AppearancePackManifest = {
  schema: 1,
  id: "signed-pack",
  name: "Signed",
  version: "1.0.0",
  modes: ["dark"],
  variants: { dark: { theme: { colors: { canvas: "#000000" } } } },
};

async function signedPack(): Promise<AppearancePackManifest> {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const spki = new Uint8Array(
    await crypto.subtle.exportKey("spki", pair.publicKey),
  );
  const pack: AppearancePackManifest = {
    ...base,
    signature: {
      algorithm: "ecdsa-p256-sha256",
      publicKey: bytesToBase64Url(spki),
      signature: "",
      publisher: "Test Publisher",
    },
  };
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    pair.privateKey,
    new TextEncoder().encode(signaturePayload(pack)),
  );
  return {
    ...pack,
    signature: {
      ...pack.signature!,
      signature: bytesToBase64Url(new Uint8Array(signature)),
    },
  };
}

describe("appearance publisher signatures", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("canonicalizes objects independent of key order", () => {
    expect(canonicalize({ b: 1, a: { d: 2, c: 3 } })).toBe(
      '{"a":{"c":3,"d":2},"b":1}',
    );
  });

  it("verifies a valid signature and tracks trust", async () => {
    const pack = await signedPack();
    const result = await verifyPublisherSignature(pack);
    expect(result.error).toBeUndefined();
    expect(result.publisher?.fingerprint).toMatch(/^p256:/);
    expect(result.publisher?.trusted).toBe(false);
    expect(result.publisher?.name).toBe("Test Publisher");

    trustPublisher(result.publisher!.fingerprint);
    expect(isTrustedPublisher(result.publisher!.fingerprint)).toBe(true);
    const trusted = await verifyPublisherSignature(pack);
    expect(trusted.publisher?.trusted).toBe(true);
  });

  it("rejects a tampered manifest", async () => {
    const pack = await signedPack();
    const tampered = { ...pack, name: "Tampered" };
    const result = await verifyPublisherSignature(tampered);
    expect(result.error).toContain("签名无效");
  });
});
