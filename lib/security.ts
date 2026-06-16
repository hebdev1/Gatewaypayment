import "server-only";

import { createHash, randomBytes, webcrypto } from "crypto";
import { requireEnv } from "@/lib/env";

const subtle = webcrypto.subtle;

export function sha256Hex(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function generateApiKey(mode: "sandbox" | "live") {
  const prefix = mode === "live" ? "sk_live" : "sk_test";
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

export function generateWebhookSecret() {
  return `whsec_${randomBytes(32).toString("base64url")}`;
}

export function keyPrefix(value: string) {
  return value.slice(0, 12);
}

export function lastFour(value: string) {
  return value.slice(-4);
}

function encryptionKeyBytes() {
  const raw = requireEnv("CREDENTIAL_ENCRYPTION_KEY");
  const decoded = Buffer.from(raw, "base64");

  if (decoded.length === 32) {
    return decoded;
  }

  const utf8 = Buffer.from(raw, "utf8");
  if (utf8.length === 32) {
    return utf8;
  }

  throw new Error("CREDENTIAL_ENCRYPTION_KEY must be 32 bytes or base64-encoded 32 bytes.");
}

async function importAesKey() {
  return subtle.importKey("raw", encryptionKeyBytes(), "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptJson(value: unknown) {
  const iv = randomBytes(12);
  const key = await importAesKey();
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

  return {
    ciphertext: Buffer.from(encrypted).toString("base64"),
    nonce: Buffer.from(iv).toString("base64")
  };
}
