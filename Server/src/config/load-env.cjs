const dotenv = require("dotenv");
const path = require("node:path");

// Keep path resolution compatible with both Node and the Jest CommonJS transform.
const loaded = dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
  quiet: true,
});
if (loaded.error && loaded.error.code !== "ENOENT") {
  throw new Error("Unable to load Server/.env; check file permissions and encoding");
}
