import { createHash, randomBytes } from "crypto";

export function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function opaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function shortCode() {
  return randomBytes(4).toString("hex").toUpperCase().match(/.{1,4}/g)?.join("-") ?? "0000-0000";
}
