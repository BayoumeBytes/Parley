import { GetAccount } from "../services/AccountService.js";

export async function requirePhone(req, res, next) {
  try {
    const user = await GetAccount(req.user.id);
    if (user.requiresPhone) {
      return res.status(403).json({
        error: "Add a primary phone number to continue",
        code: "PHONE_REQUIRED",
      });
    }
    next();
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.status ? error.message : "Unable to load account",
    });
  }
}
