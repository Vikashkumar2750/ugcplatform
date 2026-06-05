import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const SALT = "contentiq_salt_v1"; // static salt is fine — security comes from the secret key

function deriveKey(secret: string): Buffer {
  return crypto.scryptSync(secret, SALT, 32);
}

export function encrypt(text: string): string {
  const secret = process.env.API_KEY_SECRET!;
  const iv = crypto.randomBytes(16);
  const key = deriveKey(secret);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(data: string): string {
  const secret = process.env.API_KEY_SECRET!;
  const parts = data.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted data format");
  const [ivHex, tagHex, encryptedHex] = parts;
  const key = deriveKey(secret);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return decipher.update(Buffer.from(encryptedHex, "hex")).toString("utf8") + decipher.final("utf8");
}
