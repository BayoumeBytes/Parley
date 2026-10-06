import Router from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  CreateGroup,
  AddMembers,
  RemoveMembers,
} from "../controllers/ConversationController.js";
import { logout, login, register } from "../controllers/AuthController.js";

export const AuthRouter = Router();
AuthRouter.post("/login", login);
AuthRouter.post("/register", register);

export const ConvRouter = Router();

ConvRouter.post("/creategroup", CreateGroup);
ConvRouter.post("/addmembers", AddMembers);
ConvRouter.post("/removemembers", RemoveMembers);

export const router = Router();
router.use("/auth", AuthRouter);

router.use(requireAuth);
AuthRouter.post("/logout", logout);
router.use("/conv", ConvRouter);
