import { parseServerEnv } from "../src/config/env.js";
import { config, connectToDb } from "../src/config/config.js";
import mongoose from "mongoose";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

afterEach(() => jest.restoreAllMocks());

test("loads the server env file independently of cwd without overriding process settings", () => {
  const directory = mkdtempSync(join(tmpdir(), "parley-server-config-"));
  try {
    const loader = join(directory, "src/config/load-env.cjs");
    mkdirSync(join(directory, "src/config"), { recursive: true });
    copyFileSync(resolve(__dirname, "../src/config/load-env.cjs"), loader);
    writeFileSync(join(directory, ".env"),
      "PORT=3200\nNODE_ENV=production\nCLIENT_URL=http://localhost:4300\n");
    const env = {
      ...process.env, PORT: "3300", NODE_ENV: "test",
      NODE_PATH: resolve(__dirname, "../node_modules"),
    };
    delete env.CLIENT_URL;
    const child = spawnSync(process.execPath, [
      "-e",
      `require(${JSON.stringify(loader)}); console.log(JSON.stringify({
        port: process.env.PORT, nodeEnv: process.env.NODE_ENV, origin: process.env.CLIENT_URL
      }));`,
    ], { cwd: tmpdir(), env, encoding: "utf8" });
    expect(child.status).toBe(0);
    expect(JSON.parse(child.stdout)).toEqual({
      port: "3300", nodeEnv: "test", origin: "http://localhost:4300",
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("server configuration has usable local defaults", () => {
  expect(parseServerEnv({})).toEqual({
    nodeEnv: "development", host: "0.0.0.0", port: 3000,
    clientUrl: "http://localhost:4200",
    mongoUri: "mongodb://localhost:27017/Parley",
    mongoTimeoutMs: 2000, sessionTtlMs: 86400000,
  });
});

test("deployment settings support Atlas, custom ports and session expiry", () => {
  expect(parseServerEnv({
    NODE_ENV: "production", HOST: "127.0.0.1", PORT: "3443",
    CLIENT_URL: "https://chat.example.com/",
    MONGODB_URI: "mongodb+srv://user:example@cluster.example.com/chat",
    MONGODB_SERVER_SELECTION_TIMEOUT_MS: "5000", SESSION_TTL_HOURS: "48",
  })).toMatchObject({
    nodeEnv: "production", host: "127.0.0.1", port: 3443,
    clientUrl: "https://chat.example.com", mongoTimeoutMs: 5000,
    sessionTtlMs: 172800000,
  });
});

test.each([
  ["NODE_ENV", "unknown"], ["HOST", ""], ["PORT", "0"], ["PORT", "65536"],
  ["PORT", "3000x"], ["CLIENT_URL", "http://localhost/path"],
  ["CLIENT_URL", "https://user:secret@example.com"],
  ["MONGODB_URI", "secret"], ["SESSION_TTL_HOURS", "169"],
  ["MONGODB_SERVER_SELECTION_TIMEOUT_MS", "-1"],
])("invalid %s fails without including potentially secret values", (key, value) => {
  expect(() => parseServerEnv({ [key]: value })).toThrow(key);
  try {
    parseServerEnv({ [key]: value });
  } catch (error) {
    expect(error.message).not.toContain("secret");
  }
});

test("database connection uses environment config and masks driver errors", async () => {
  const connect = jest.spyOn(mongoose, "connect").mockRejectedValue(new Error("secret"));
  await expect(connectToDb()).rejects.toThrow(
    "Unable to connect to MongoDB; check MONGODB_URI and database availability",
  );
  expect(connect).toHaveBeenCalledWith(config.mongoUri, {
    serverSelectionTimeoutMS: config.mongoTimeoutMs,
  });
});
