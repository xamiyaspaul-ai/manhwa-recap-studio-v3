/**
 * gdrive.ts — Google Drive storage helper (free 15 GB tier).
 *
 * Auth: OAuth2 with a refresh token. Run `scripts/gdrive-auth.ts` once to
 * obtain the refresh token, then set these env vars:
 *   GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET, GDRIVE_REFRESH_TOKEN
 *
 * Files are uploaded as private (owner-only). Downloads are done server-side
 * with the access token, then streamed to the user.
 */

import { google, type drive_v3 } from "googleapis";

let client: drive_v3.Drive | null = null;

export function isGDriveConfigured(): boolean {
  return Boolean(
    process.env.GDRIVE_CLIENT_ID &&
      process.env.GDRIVE_CLIENT_SECRET &&
      process.env.GDRIVE_REFRESH_TOKEN
  );
}

function getDriveClient(): drive_v3.Drive {
  if (client) return client;

  const clientId = process.env.GDRIVE_CLIENT_ID;
  const clientSecret = process.env.GDRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GDRIVE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Google Drive is not configured. Set GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET, GDRIVE_REFRESH_TOKEN."
    );
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, "urn:ietf:wg:oauth:2.0:oob");
  oauth2.setCredentials({ refresh_token: refreshToken });

  client = google.drive({ version: "v3", auth: oauth2 });
  return client;
}

/** Get a fresh access token (refresh tokens don't expire). */
async function getAccessToken(): Promise<string> {
  const oauth2 = new google.auth.OAuth2(
    process.env.GDRIVE_CLIENT_ID,
    process.env.GDRIVE_CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob"
  );
  oauth2.setCredentials({ refresh_token: process.env.GDRIVE_REFRESH_TOKEN });
  const { credentials } = await oauth2.refreshAccessToken();
  if (!credentials.access_token) throw new Error("Failed to refresh Google Drive access token");
  return credentials.access_token;
}

/**
 * Upload a file to Google Drive.
 * @param filePath - absolute local path to the file
 * @param filename - the name to give the file in Drive
 * @returns the Drive file ID (used later to download)
 */
export async function uploadToGDrive(
  filePath: string,
  filename: string
): Promise<string> {
  const drive = getDriveClient();
  const fs = await import("fs");

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      // No parents = uploads to "My Drive" root. To use a folder, set its ID:
      // parents: [process.env.GDRIVE_FOLDER_ID],
    },
    media: {
      mimeType: "video/mp4",
      body: fs.createReadStream(filePath),
    },
    fields: "id",
  });

  if (!res.data.id) throw new Error("Google Drive upload returned no file ID");
  return res.data.id;
}

/**
 * Get the total + used storage on Google Drive (in bytes).
 * Used to check if there's room before uploading.
 */
export async function getGDriveQuota(): Promise<{
  total: number;
  used: number;
  available: number;
}> {
  const drive = getDriveClient();
  const res = await drive.about.get({ fields: "storageQuota" });
  const q = res.data.storageQuota;
  const total = Number(q?.limit) || 15 * 1024 * 1024 * 1024; // default 15 GB
  const used = Number(q?.usage) || 0;
  return { total, used, available: total - used };
}

/**
 * Download a file from Google Drive to a local temp path.
 * @param fileId - the Drive file ID
 * @param destPath - where to save the downloaded file
 */
export async function downloadFromGDrive(
  fileId: string,
  destPath: string
): Promise<void> {
  const drive = getDriveClient();
  const fs = await import("fs");
  const { pipeline } = await import("stream/promises");

  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "stream" }
  );

  const dest = fs.createWriteStream(destPath);
  await pipeline(res.data as NodeJS.ReadableStream, dest);
}
