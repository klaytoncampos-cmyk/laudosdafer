// functions/api/auth/login.js — POST /api/auth/login
import { hashPassword, createSession, sessionCookieHeader, json, readJson } from '../../_utils.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body || typeof body.password !== 'string') {
    return json({ error: 'Senha não informada' }, 400);
  }

  const auth = await env.DB.prepare(
    'SELECT password_hash, salt FROM auth WHERE id = 1'
  ).first();

  if (!auth) {
    return json({ error: 'Auth não configurada. Rode o script de setup.' }, 500);
  }

  const hash = await hashPassword(body.password, auth.salt);
  if (hash !== auth.password_hash) {
    // delay pequeno pra dificultar brute force
    await new Promise(r => setTimeout(r, 400));
    return json({ error: 'Senha incorreta' }, 401);
  }

  const ua = request.headers.get('User-Agent') || '';
  const { token, expiresAt } = await createSession(env, ua);

  return json({ ok: true }, 200, {
    'Set-Cookie': sessionCookieHeader(token, expiresAt)
  });
}
