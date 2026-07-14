export default function handler(req, res) {
  res.setHeader('Set-Cookie', 'auth=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax');
  return res.status(200).json({ success: true });
}
