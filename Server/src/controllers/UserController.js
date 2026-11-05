import { ResolveUsers } from "../services/UserService.js";

export async function resolveUsers(req, res) {
  try {
    return res.json({ users: await ResolveUsers(req.body?.identifiers) });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.status ? error.message : "Unable to find users",
    });
  }
}
