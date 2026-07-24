import { google } from 'googleapis';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { config } from '../config.js';

// drive.file is enough to create files the bot itself uploads.
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

export function isDriveConfigured() {
  const d = config.drive;
  const oauthReady = d.oauth.clientId && d.oauth.clientSecret && d.oauth.refreshToken;
  const serviceAccountReady = d.serviceAccountJson || d.serviceAccountKeyFile;
  return Boolean(oauthReady || serviceAccountReady);
}

async function getAuthClient() {
  const d = config.drive;

  // Option B: OAuth2 — uploads into a folder in a real user's "My Drive".
  if (d.oauth.clientId && d.oauth.clientSecret && d.oauth.refreshToken) {
    const oAuth2 = new google.auth.OAuth2(d.oauth.clientId, d.oauth.clientSecret);
    oAuth2.setCredentials({ refresh_token: d.oauth.refreshToken });
    return oAuth2;
  }

  // Option A: service account — best paired with a Shared Drive.
  let credentials;
  if (d.serviceAccountJson) {
    credentials = JSON.parse(d.serviceAccountJson);
  } else if (d.serviceAccountKeyFile) {
    credentials = JSON.parse(await readFile(d.serviceAccountKeyFile, 'utf8'));
  } else {
    throw new Error('Google Drive is not configured.');
  }
  return new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
}

/**
 * Upload a local file to Google Drive. Returns { id, name, webViewLink }.
 */
export async function uploadToDrive(filePath, fileName) {
  const auth = await getAuthClient();
  const drive = google.drive({ version: 'v3', auth });
  const folderId = config.drive.folderId;

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: folderId ? [folderId] : undefined,
    },
    media: {
      mimeType: 'text/html',
      body: createReadStream(filePath),
    },
    fields: 'id, name, webViewLink',
    supportsAllDrives: true,
  });

  return res.data;
}
