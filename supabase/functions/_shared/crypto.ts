import { getEnv } from "./env.ts";

function bytesToHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function textToBytes(value: string) {
  return new TextEncoder().encode(value);
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", textToBytes(value));
  return bytesToHex(digest);
}

export async function hmacSha256Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    textToBytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, textToBytes(message));
  return bytesToHex(signature);
}

async function importAesKey() {
  const raw = getEnv("CREDENTIAL_ENCRYPTION_KEY");

  if (!raw) {
    throw new Error("Missing CREDENTIAL_ENCRYPTION_KEY.");
  }

  let keyBytes: Uint8Array;
  try {
    keyBytes = base64ToBytes(raw);
  } catch {
    keyBytes = textToBytes(raw);
  }

  if (keyBytes.length !== 32) {
    keyBytes = textToBytes(raw);
  }

  if (keyBytes.length !== 32) {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY must be 32 bytes or base64-encoded 32 bytes.");
  }

  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
}

export async function decryptJson<T>(ciphertext: string, nonce: string): Promise<T> {
  const key = await importAesKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(nonce) },
    key,
    base64ToBytes(ciphertext)
  );

  return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}
