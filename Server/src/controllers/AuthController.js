export function routes(router) {
  router.post("/login", login);
  router.post("/register", register);
}

export async function login(req, res) {
  res.json({ message: "logged in" });
}

export async function register(req, res) {
  res.json({ message: "registered" });
}
