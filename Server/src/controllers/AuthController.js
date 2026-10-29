import { SignIn, Register } from "../services/AuthService.js";
import "dotenv/config";

const isProd = process.env.NODE_ENV === "production";
export const COOKIE_NAME = isProd ? "__Host-session" : "session";
export const cookieOptions = {
  httpOnly: true,
  secure: isProd, // false on http://localhost
  sameSite: "lax",
  path: "/",
};

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

    res.cookie(process.env.session, result.sessionId, {
      ...cookieOptions,
      expires: new Date(result.expiresAt),
      // maxAge: result.expiresAt,
    });
    return res.status(200).json({ message: "logged in" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

export async function register(req, res) {
  const { username, password, email } = req.body;
  if (username == null || password == null || email == null) {
    return res.status(400).json({ message: "fields are required" });
  }

  try {
    const result = await Register(username, password, email);

    if (typeof result === "string") {
      return res.status(409).json({ message: "user already exists" });
    }

    res.status(201).json({ message: "registered" });
  } catch (err) {
    res.status(500).json({ message: "internal server error" });
  }
}

export async function logout(req, res) {
  res.clearCookie(process.env.session, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
  return res.status(200).json({ message: "logged out" });
}
