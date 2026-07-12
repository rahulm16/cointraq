import bcrypt from "bcryptjs";

// Usage: npm run hash-password -- 'your-password'
const pw = process.argv[2];
if (!pw) {
  console.error("Usage: npm run hash-password -- 'your-password'");
  process.exit(1);
}
const hash = bcrypt.hashSync(pw, 10);

// Base64-encode the hash so it contains no "$". Next.js runs dotenv-expand over
// .env and would otherwise treat the "$" sequences in a bcrypt hash as variable
// references and mangle it. The app decodes this automatically at login.
const encoded = Buffer.from(hash, "utf8").toString("base64");
console.log("\nAdd this line to your .env (no escaping needed):\n");
console.log(`APP_PASSWORD_HASH=${encoded}\n`);
