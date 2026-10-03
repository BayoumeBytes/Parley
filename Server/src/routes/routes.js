import Router from "express";
import { routes as authRoutes } from "../controllers/AuthController.js";

export const router = Router();

authRoutes(router);
