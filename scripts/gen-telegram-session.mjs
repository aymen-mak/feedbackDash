// One-time helper: generate a TELEGRAM_SESSION string for the Makina analytics
// collector. Runs locally on your machine (you'll get a login code in Telegram).
//
//   TELEGRAM_API_ID=1234567 TELEGRAM_API_HASH=abc... node scripts/gen-telegram-session.mjs
//
// Log in with an account that is a member/admin of the channel you want stats
// for. Paste the printed line into the TELEGRAM_SESSION env var in Vercel.
// The session string is a credential — keep it secret, never commit it.

import telegram from "telegram";
import input from "input";

const { TelegramClient, sessions } = telegram;
const { StringSession } = sessions;

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

if (!apiId || !apiHash) {
  console.error("Set TELEGRAM_API_ID and TELEGRAM_API_HASH first (from my.telegram.org → API development tools).");
  process.exit(1);
}

const client = new TelegramClient(new StringSession(""), apiId, apiHash, { connectionRetries: 5 });

await client.start({
  phoneNumber: () => input.text("Phone number (with country code, e.g. +33…): "),
  password: () => input.text("2FA password (press Enter if you don't use one): "),
  phoneCode: () => input.text("Login code Telegram just sent you: "),
  onError: (err) => console.log(err),
});

console.log("\n===== copy the entire line below into the TELEGRAM_SESSION env var =====\n");
console.log(client.session.save());
console.log("\n(Keep it secret — it grants access to this Telegram account.)\n");

await client.disconnect();
process.exit(0);
