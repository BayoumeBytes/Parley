import express from "express";
import cors from "cors";
import { router } from "./routes/routes.js";
import errorhandler from "errorhandler";
import "dotenv/config";
import cookieParser from "cookie-parser";
import { corsOptions } from "./config/config.js";

export const app = express();

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

if (process.env.NODE_ENV === "development") {
  // only use in development
  app.use(errorhandler());
}

app.use("/api", router);
