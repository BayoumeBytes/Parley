import "./load-env.cjs";
import mongoose from "mongoose";
import { parseServerEnv } from "./env.js";

export const config = parseServerEnv(process.env);

export const corsOptions = { origin: config.clientUrl, credentials: true };

export async function connectToDb() {
  try {
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: config.mongoTimeoutMs,
    });
  } catch {
    // Driver errors can contain credentials from a connection URI.
    throw new Error("Unable to connect to MongoDB; check MONGODB_URI and database availability");
  }
  console.log("Connected to MongoDB");
}
