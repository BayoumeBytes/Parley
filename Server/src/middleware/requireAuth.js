import { SessionModel } from "../models/Session.js";

export const COOKIE_NAME = "__Host-session";
export const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
};

export async function findValidSession(Id) {
  if (typeof Id !== "string" || Id.length === 0) return null;

  const session = await SessionModel.findOne({ sessionId: Id });
  if (!session) return null;
  if (session.expiresAt < Date.now()) return null;
  return session;
}

export async function requireAuth(req, res, next) {
  try {
    const session = await findValidSession(req.cookies[COOKIE_NAME]);
    if (!session) {
      res.clearCookie(COOKIE_NAME, cookieOptions);
      return res.status(401).send("Unauthorized");
    }
    req.user = { id: session.userId.toString() };
    req.sessionId = session.sessionId;
    next();
  } catch (error) {
    next(error);
  }
}
