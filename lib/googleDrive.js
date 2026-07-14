const { google } = require('googleapis');
const { Readable } = require('stream');

/**
 * Uploads a PDF buffer to the configured Google Drive folder.
 * Requires these env vars:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY   (with literal \n escaped, see .env.local.example)
 *   GOOGLE_DRIVE_FOLDER_ID
 */
async function uploadToDrive(buffer, filename) {
  const {
    GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    GOOGLE_DRIVE_FOLDER_ID,
  } = process.env;

  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || !GOOGLE_DRIVE_FOLDER_ID) {
    // Drive isn't configured — skip silently so local/dev use without Drive still works.
    return { skipped: true };
  }

  const auth = new google.auth.JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  const drive = google.drive({ version: 'v3', auth });

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [GOOGLE_DRIVE_FOLDER_ID],
    },
    media: {
      mimeType: 'application/pdf',
      body: Readable.from(buffer),
    },
    fields: 'id, webViewLink',
  });

  return { skipped: false, fileId: res.data.id, link: res.data.webViewLink };
}

module.exports = { uploadToDrive };
