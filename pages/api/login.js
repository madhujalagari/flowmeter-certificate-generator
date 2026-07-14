export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  const { password } = req.body || {};
  const correctPassword = process.env.SITE_PASSWORD;

  if (!correctPassword) {
    return res.status(500).json({ error: 'Server missing SITE_PASSWORD env var' });
  }

  if (password === correctPassword) {
    // Simple session cookie, valid 12 hours. Not encrypted/signed —
    // fine for a low-stakes internal tool, but let me know if you want
    // it hardened further.
    res.setHeader(
      'Set-Cookie',
      `auth=1; Path=/; HttpOnly; Max-Age=${60 * 60 * 12}; SameSite=Lax`
    );
    return res.status(200).json({ success: true });
  }

  return res.status(401).json({ error: 'Incorrect password' });
}
