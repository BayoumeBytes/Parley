import express from "express";
import cors from "cors";
import { router } from "./routes/routes.js";
import errorhandler from "errorhandler";
import "dotenv/config";

export const app = express();

app.use(cors());
app.use(express.json());
if (process.env.NODE_ENV === "development") {
  // only use in development
  app.use(errorhandler());
}

app.use("/api", router);
