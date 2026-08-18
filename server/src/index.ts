import { createApp } from "./app.js";
import { assertJwtSecret } from "./middleware/auth.js";

// Fail fast: the process must refuse to boot without a strong JWT_SECRET so
// tokens can never be signed with a hardcoded default string.
assertJwtSecret();

const PORT = parseInt(process.env.PORT || "3000", 10);

const app = createApp();

app.listen(PORT, () => {
  console.log(`Bugaputa backend listening on :${PORT}`);
});
