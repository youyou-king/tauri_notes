import type { AppearancePackManifest } from "./appearancePack";

export const TRUSTED_PUBLISHERS_KEY =
  "tauri-notes.trusted-appearance-publishers.v1";

export type AppearancePublisher = {
  name?: string;
  fingerprint: string;
  trusted: boolean;
};

export type PublisherVerification = {
  publisher?: AppearancePublisher;
  error?: string;
};

type SignatureBlock = NonNullable<AppearancePackManifest["signature"]>;

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
    .join(",")}}`;
}

export function signaturePayload(pack: AppearancePackManifest): string {
  const { signature: _signature, ...body } = pack;
  return canonicalize(body);
}

export function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(
    padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="),
  );
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function readTrustedFingerprints(): Set<string> {
  try {
    const raw = window.localStorage.getItem(TRUSTED_PUBLISHERS_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw);
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

export function trustPublisher(fingerprint: string): void {
  const trusted = readTrustedFingerprints();
  trusted.add(fingerprint);
  window.localStorage.setItem(
    TRUSTED_PUBLISHERS_KEY,
    JSON.stringify([...trusted].sort()),
  );
}

export function isTrustedPublisher(fingerprint: string): boolean {
  return readTrustedFingerprints().has(fingerprint);
}

export async function publisherFingerprint(
  publicKey: Uint8Array,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    publicKey as unknown as ArrayBuffer,
  );
  return `p256:${bytesToBase64Url(new Uint8Array(digest)).slice(0, 16)}`;
}

export async function verifyPublisherSignature(
  pack: AppearancePackManifest,
): Promise<PublisherVerification> {
  if (!pack.signature) {
    return {};
  }
  const signature: SignatureBlock = pack.signature;
  if (signature.algorithm !== "ecdsa-p256-sha256") {
    return { error: "不支持的发布者签名算法" };
  }
  try {
    const keyBytes = base64UrlToBytes(signature.publicKey);
    const signatureBytes = base64UrlToBytes(signature.signature);
    const key = await crypto.subtle.importKey(
      "spki",
      keyBytes as unknown as ArrayBuffer,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      signatureBytes as unknown as ArrayBuffer,
      new TextEncoder().encode(signaturePayload(pack)),
    );
    if (!valid) {
      return { error: "外观包发布者签名无效" };
    }
    const fingerprint = await publisherFingerprint(keyBytes);
    return {
      publisher: {
        name: signature.publisher,
        fingerprint,
        trusted: isTrustedPublisher(fingerprint),
      },
    };
  } catch {
    return { error: "外观包发布者签名无效" };
  }
}
