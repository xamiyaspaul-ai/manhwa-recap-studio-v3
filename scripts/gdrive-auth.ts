/**
 * gdrive-auth.ts — One-time Google Drive OAuth2 setup.
 *
 * Run this script once to obtain a refresh token for Google Drive. The
 * refresh token lets the app upload/download files without you having to
 * re-authorize each time.
 *
 * PREREQUISITES (all free, no credit card):
 *   1. Go to https://console.cloud.google.com/
 *   2. Create a new project (any name).
 *   3. Enable the "Google Drive API":
 *      APIs & Services → Library → search "Google Drive API" → Enable.
 *   4. Configure the OAuth consent screen:
 *      APIs & Services → OAuth consent screen → External → Create.
 *      Fill in app name + your email. Add yourself as a "Test User".
 *      (No app verification needed — you're the only user.)
 *   5. Create OAuth credentials:
 *      APIs & Services → Credentials → Create Credentials → OAuth client ID
 *      → Application type: "Desktop app" → Create.
 *      Copy the Client ID and Client Secret.
 *
 * USAGE:
 *   GDRIVE_CLIENT_ID=xxx.apps.googleusercontent.com \
 *   GDRIVE_CLIENT_SECRET=xxx \
 *   bun run scripts/gdrive-auth.ts
 *
 * It prints a URL → open it in your browser → authorize → paste the code back.
 * The script then prints your GDRIVE_REFRESH_TOKEN to add to .env.
 */

import { google } from "googleapis";
import * as readline from "readline";

const CLIENT_ID = process.env.GDRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GDRIVE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "ERROR: Set GDRIVE_CLIENT_ID and GDRIVE_CLIENT_SECRET env vars first.\n" +
      "See the instructions at the top of this file."
  );
  process.exit(1);
}

const REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob";

async function main() {
  const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

  const scopes = ["https://www.googleapis.com/auth/drive.file"];
  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent", // force consent to get a new refresh token
  });

  console.log("\n========================================");
  console.log("  Google Drive OAuth Setup");
  console.log("========================================\n");
  console.log("1. Open this URL in your browser:\n");
  console.log(authUrl);
  console.log("\n2. Authorize the app. You'll get a code.\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("3. Paste the authorization code here: ", async (code) => {
    rl.close();
    if (!code || !code.trim()) {
      console.error("No code entered. Exiting.");
      process.exit(1);
    }

    try {
      const { tokens } = await oauth2.getToken(code.trim());
      if (!tokens.refresh_token) {
        console.error(
          "ERROR: No refresh token returned. Try again — make sure to use prompt:consent."
        );
        process.exit(1);
      }

      console.log("\n========================================");
      console.log("  SUCCESS! Add these to your .env:");
      console.log("========================================\n");
      console.log(`GDRIVE_CLIENT_ID=${CLIENT_ID}`);
      console.log(`GDRIVE_CLIENT_SECRET=${CLIENT_SECRET}`);
      console.log(`GDRIVE_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log("\nGoogle Drive is now configured. Videos will auto-archive there.");
    } catch (err) {
      console.error("Token exchange failed:", err);
      process.exit(1);
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
