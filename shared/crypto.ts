import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export const secret = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const userCode = () =>
  randomBytes(4)
    .toString("hex")
    .toUpperCase()
    .match(/.{1,4}/g)!
    .join("-");
export function equalDigest(left: string, right: string) {
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}
