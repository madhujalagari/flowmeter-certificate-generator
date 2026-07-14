const ftp = require('basic-ftp');
const { Readable } = require('stream');

/**
 * Uploads a PDF buffer to the configured FTP server.
 * Requires these env vars:
 *   FTP_HOST
 *   FTP_PORT       (optional, defaults to 21)
 *   FTP_USER
 *   FTP_PASSWORD
 *   FTP_REMOTE_DIR (optional, defaults to "/")
 *   FTP_SECURE     (optional, "true" to use FTPS/explicit TLS)
 */
async function uploadToFtp(buffer, filename) {
  const { FTP_HOST, FTP_USER, FTP_PASSWORD } = process.env;

  if (!FTP_HOST || !FTP_USER || !FTP_PASSWORD) {
    // FTP isn't configured — skip silently, same pattern as Google Drive.
    return { skipped: true };
  }

  const client = new ftp.Client(15000); // 15s timeout
  client.ftp.verbose = false;

  try {
    await client.access({
      host: FTP_HOST,
      port: process.env.FTP_PORT ? parseInt(process.env.FTP_PORT, 10) : 21,
      user: FTP_USER,
      password: FTP_PASSWORD,
      secure: process.env.FTP_SECURE === 'true',
    });

    const remoteDir = process.env.FTP_REMOTE_DIR || '/';
    if (remoteDir !== '/') {
      await client.ensureDir(remoteDir);
    }

    await client.uploadFrom(Readable.from(buffer), filename);

    return { skipped: false };
  } finally {
    client.close();
  }
}

module.exports = { uploadToFtp };
