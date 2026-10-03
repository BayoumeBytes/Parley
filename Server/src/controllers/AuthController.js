import { SignIn, Register } from "../services/AuthService.js";

export function routes(router) {
  router.post("/login", login);
  router.post("/register", register);
}

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
      return res.status(404).json({ message: "User not found" });
    }

    if (result == "Invalid password") {
      return res.status(401).json({ message: "invalid credentials" });
    }

    res.cookie("__Host-session", result, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return res.status(200).json({ message: "logged in" });
  } catch (err) {
    res.status(500).json({ message: "internal server error" });
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
