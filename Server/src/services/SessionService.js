import crypto from "crypto";

function generateSessionID() {
  return crypto.randomBytes(32).toString("base64url") + Date.now();
}

function VerifySession(session) {
  if (session.expiresAt <= new Date()) return false;
  return true;
}

export { generateSessionID, VerifySession };
