function integer(env, key, fallback, max) {
  const value = env[key] ?? String(fallback);
  const number = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < 1 || number > max) {
    throw new Error(`Invalid ${key}: expected an integer between 1 and ${max}`);
  }
  return number;
}

export function parseServerEnv(env) {
  const nodeEnv = env.NODE_ENV ?? "development";
  if (!["development", "production", "test"].includes(nodeEnv)) {
    throw new Error("Invalid NODE_ENV: expected development, production or test");
  }
  const host = env.HOST ?? "0.0.0.0";
  if (!host || /[\s/]/.test(host)) throw new Error("Invalid HOST");
  let origin;
  try {
    origin = new URL(env.CLIENT_URL ?? "http://localhost:4200");
    if (!["http:", "https:"].includes(origin.protocol) ||
        origin.username || origin.password || origin.pathname !== "/" ||
        origin.search || origin.hash) throw new Error();
  } catch {
    throw new Error("Invalid CLIENT_URL: expected an HTTP(S) origin without credentials or a path");
  }
  const mongoUri = env.MONGODB_URI ?? "mongodb://localhost:27017/Parley";
  if (!/^mongodb(?:\+srv)?:\/\/\S+$/.test(mongoUri)) {
    throw new Error("Invalid MONGODB_URI: expected a MongoDB connection URI");
  }
  return {
    nodeEnv,
    host,
    port: integer(env, "PORT", 3000, 65535),
    clientUrl: origin.origin,
    mongoUri,
    mongoTimeoutMs: integer(env, "MONGODB_SERVER_SELECTION_TIMEOUT_MS", 2000, 2147483647),
    sessionTtlMs: integer(env, "SESSION_TTL_HOURS", 24, 168) * 60 * 60 * 1000,
  };
}
