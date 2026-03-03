import crypto from "crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || "";
  if (!secret) throw new Error("ENCRYPTION_KEY 환경변수가 설정되지 않았습니다.");
  // SHA-256으로 항상 32바이트 키 생성
  return crypto.createHash("sha256").update(secret).digest();
}

export function encrypt(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();
  // iv:tag:encrypted 형태로 하나의 문자열로 합침
  return Buffer.from(`${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`).toString("base64url");
}

export function decrypt(token: string): string {
  const key = getKey();
  const decoded = Buffer.from(token, "base64url").toString("utf8");
  const [ivHex, tagHex, encrypted] = decoded.split(":");
  if (!ivHex || !tagHex || !encrypted) throw new Error("Invalid token format");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
