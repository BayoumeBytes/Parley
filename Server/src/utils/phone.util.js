import { chatError } from "../services/RoomAccessService.js";

// Require a country code; never guess a region from a local number.
export function normalizePhone(value) {
  if (typeof value !== "string") throw chatError(400, "Primary phone number is required");
  const phone = value.trim().replace(/[\s().-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw chatError(400, "Use an international phone number with a country code, for example +201012345678");
  }
  return phone;
}
