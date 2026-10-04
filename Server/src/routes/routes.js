import Router from "express";
import { AuthRouter } from "../controllers/AuthController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { ConvRouter } from "../controllers/ConversationController.js";

export const router = Router();

router.use("/auth", AuthRouter);

router.use(requireAuth);
router.use("/conversations", ConvRouter);
