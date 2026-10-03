import crypto from "crypto";

export function hash(plain) {
  const hash = crypto.createHash("sha256");
  hash.update(plain);
  return hash.digest("hex");
}

export function verify(plain, hashed) {
  return hash(plain) === hashed;
}
