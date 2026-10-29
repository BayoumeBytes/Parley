import { app } from "./app.js";
import { config, connectToDb } from "./config/config.js";
import { createServer } from "node:http";
import { initSockets } from "./sockets/index.js";

async function start() {
  try {
    await connectToDb();
    const server = createServer(app);
    initSockets(server);

    server.on("error", (error) => {
      console.error("Server error:", error.code);
      process.exit(1);
    });

    server.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();
