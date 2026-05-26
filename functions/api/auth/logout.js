// functions/api/auth/logout.js — POST /api/auth/logout
import { getSessionToken, destroySession, clearCookieHeader, json } from '../../_utils.js';

export async function onRequestPost({ request, env }) {
  const token = await getSessionToken(request);
  await destroySession(env, token);
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookieHeader() });
}
