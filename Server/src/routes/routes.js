import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePhone } from "../middleware/requirePhone.js";
import { resolveUsers } from "../controllers/UserController.js";
import {
  CreateGroup,
  AddMembers,
  RemoveMembers,
  GetRooms,
} from "../controllers/ConversationController.js";
import { logout, login, register, me, addPhone } from "../controllers/AuthController.js";
import {
  GetHistoryMessages,
  SendMessage,
  MarkRead,
} from "../controllers/MessagesController.js";

export const AuthRouter = Router();
AuthRouter.post("/login", login);
AuthRouter.post("/register", register);
AuthRouter.post("/logout", requireAuth, logout);
AuthRouter.get("/me", requireAuth, me);
AuthRouter.post("/phone", requireAuth, addPhone);

export const ConvRouter = Router();

ConvRouter.post("/creategroup", CreateGroup);
ConvRouter.post("/addmembers", AddMembers);
ConvRouter.post("/removemembers", RemoveMembers);
ConvRouter.post("/getuserrooms", GetRooms);

export const MsgRouter = Router();

MsgRouter.get("/getroomhistory", GetHistoryMessages);
MsgRouter.post("/sendmsg", SendMessage);
MsgRouter.post("/markread", MarkRead);

export const router = Router();
router.use("/auth", AuthRouter);

router.use(requireAuth);
router.use(requirePhone);

router.post("/users/resolve", resolveUsers);
router.use("/conv", ConvRouter);
router.use("/msg", MsgRouter);
