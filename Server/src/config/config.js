import "dotenv/config";
import mongoose from "mongoose";

export const config = {
  port: process.env.PORT || 3000,
  db: {
    host: "localhost",
    port: 27017,
    name: "Parley",
  },
  clientUrl: process.env.CLIENT_URL || "http://localhost:4200",
};

export const corsOptions = { origin: config.clientUrl, credentials: true };

function connectionString() {
  return `mongodb://${config.db.host}:${config.db.port}/${config.db.name}`;
}

export async function connectToDb() {
  await mongoose.connect(connectionString(), {
    serverSelectionTimeoutMS: 2000,
  });
  console.log("Conncted to mongodb");
}
