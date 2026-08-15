import { scrypt as scryptCb, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(hash: string, password: string) {
  try {
    if (hash.startsWith("scrypt:")) {
      const parts = hash.split(":");
      const salt = Buffer.from(parts[1] ?? "", "hex");
      const expected = Buffer.from(parts[2] ?? "", "hex");
      const key = (await scrypt(password, salt, 64)) as Buffer;
      return expected.length === key.length && timingSafeEqual(expected, key);
    }
    const argon2 = (await import("argon2")).default;
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
