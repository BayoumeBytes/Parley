import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  CreateGroup,
  AddMembers,
  RemoveMembers,
  GetRooms,
} from "../controllers/ConversationController.js";
import { logout, login, register } from "../controllers/AuthController.js";
import {
  GetHistoryMessages,
  SendMessage,
} from "../controllers/MessagesController.js";

export const AuthRouter = Router();
AuthRouter.post("/login", login);
AuthRouter.post("/register", register);
AuthRouter.post("/logout", requireAuth, logout);

export const ConvRouter = Router();

ConvRouter.post("/creategroup", CreateGroup);
ConvRouter.post("/addmembers", AddMembers);
ConvRouter.post("/removemembers", RemoveMembers);
ConvRouter.post("/getuserrooms", GetRooms);

export const MsgRouter = Router();

MsgRouter.get("/getroomhistory", GetHistoryMessages);
MsgRouter.post("/sendmsg", SendMessage);

export const router = Router();
router.use("/auth", AuthRouter);

router.use(requireAuth);

router.use("/conv", ConvRouter);
router.use("/msg", MsgRouter);
