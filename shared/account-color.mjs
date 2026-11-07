// Java UUID.hashCode() XOR-folds four 32-bit words. MongoDB's 96-bit ObjectId
// is zero-extended to 128 bits, then uses that same fold and low RGB 24 bits.
// Account IDs, never usernames, determine this permanent color.
export function accountColor(accountId) {
  const hex = String(accountId).replaceAll("-", "").toLowerCase();
  if (!/^(?:[\da-f]{24}|[\da-f]{32})$/.test(hex)) return "#e6e6e6";
  const uuid = hex.padStart(32, "0");
  let hash = 0;
  for (let offset = 0; offset < 32; offset += 8) {
    hash ^= Number.parseInt(uuid.slice(offset, offset + 8), 16);
  }
  const rgb = [(hash >>> 16) & 255, (hash >>> 8) & 255, hash & 255];
  const highest = Math.max(...rgb);
  // A black hash has no hue to preserve: use visible neutral gray.
  return highest === 0
    ? "#e6e6e6"
    : "#" +
        rgb
          .map((channel) =>
            Math.round((channel * 230) / highest)
              .toString(16)
              .padStart(2, "0"),
          )
          .join("");
}
