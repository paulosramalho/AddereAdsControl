import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function getKey() {
  const hex = process.env.CREDENTIAL_ENCRYPTION_KEY ?? "";
  if (hex.length !== 64) {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY deve ter 64 caracteres hex (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext) {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    ciphertext: encrypted.toString("hex"),
  });
}

export function decrypt(stored) {
  const key = getKey();
  const { iv, tag, ciphertext } = JSON.parse(stored);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
