import { app } from "./app.js";
import { config, connectToDb } from "./config/config.js";

async function start() {
  try {
    await connectToDb();
    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();
