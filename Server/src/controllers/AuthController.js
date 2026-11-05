import { SignIn, Register } from "../services/AuthService.js";
import { COOKIE_NAME, cookieOptions } from "../middleware/requireAuth.js";
import { SessionModel } from "../models/Session.js";
import { disconnectSession } from "../sockets/events.js";

export { COOKIE_NAME, cookieOptions };

export async function login(req, res) {
  const { username, password } = req.body;
  if (username == null || password == null) {
    return res
      .status(400)
      .json({ message: "username and password are required" });
  }
  try {
    const result = await SignIn(username, password);

    if (result == null) {
      return res.status(401).json({ message: "User not found" });
    }

    if (result == "Invalid password") {
      return res.status(401).json({ message: "invalid credentials" });
    }

    res.cookie(COOKIE_NAME, result.sessionId, {
      ...cookieOptions,
      expires: new Date(result.expiresAt),
    });
    return res.status(200).json({ message: "logged in" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

export async function register(req, res) {
  const { username, password, email, phoneNumber } = req.body ?? {};
  if (username == null || password == null || email == null || phoneNumber == null) {
    return res.status(400).json({ message: "Username, email, password and primary phone number are required" });
  }

  try {
    const result = await Register(username, password, email, phoneNumber);

    if (typeof result === "string") {
      return res.status(409).json({ message: "Username, email or primary phone number is already in use" });
    }

    res.status(201).json({ message: "registered" });
  } catch (error) {
    // The unique index also catches simultaneous signups that pass the pre-check.
    if (error.code === 11000) {
      return res.status(409).json({ message: "Username, email or primary phone number is already in use" });
    }
    if (error.status === 400) return res.status(400).json({ message: error.message });
    res.status(500).json({ message: "internal server error" });
  }
}

export async function logout(req, res) {
  await SessionModel.deleteOne({ sessionId: req.sessionId });
  disconnectSession(req.sessionId);
  res.clearCookie(COOKIE_NAME, cookieOptions);
  return res.status(200).json({ message: "logged out" });
}
