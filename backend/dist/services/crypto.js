"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
const crypto_1 = __importDefault(require("crypto"));
const ALGORITHM = "aes-256-gcm";
const SALT = "contentiq_salt_v1"; // static salt is fine — security comes from the secret key
function deriveKey(secret) {
    return crypto_1.default.scryptSync(secret, SALT, 32);
}
function encrypt(text) {
    const secret = process.env.API_KEY_SECRET;
    const iv = crypto_1.default.randomBytes(16);
    const key = deriveKey(secret);
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Format: iv:tag:ciphertext (all hex)
    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}
function decrypt(data) {
    const secret = process.env.API_KEY_SECRET;
    const parts = data.split(":");
    if (parts.length !== 3)
        throw new Error("Invalid encrypted data format");
    const [ivHex, tagHex, encryptedHex] = parts;
    const key = deriveKey(secret);
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return decipher.update(Buffer.from(encryptedHex, "hex")).toString("utf8") + decipher.final("utf8");
}
//# sourceMappingURL=crypto.js.map