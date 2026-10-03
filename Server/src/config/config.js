import "dotenv/config";
import mongoose from "mongoose";

export const config = {
  port: process.env.PORT || 3000,
  db: {
    host: "localhost",
    port: 27017,
    name: "Parley",
  },
};

function connectionString() {
  return `mongodb://${config.db.host}:${config.db.port}/${config.db.name}`;
}

export async function connectToDb() {
  await mongoose
    .connect(connectionString())
    .then(() => {
      console.log("Connected to MongoDB");
    })
    .catch((err) => {
      console.error("Failed to connect to MongoDB", err);
    });
}
