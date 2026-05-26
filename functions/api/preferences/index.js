// functions/api/preferences/index.js
import { requireAuth, json, readJson } from '../../_utils.js';

export async function onRequestGet({ request, env }) {
  const unauthorized = await requireAuth(request, env);
  if (unauthorized) return unauthorized;

  const { results } = await env.DB.prepare('SELECT chave, valor FROM preferences').all();
  const obj = {};
  (results || []).forEach(r => { obj[r.chave] = r.valor; });
  return json({ preferences: obj });
}

export async function onRequestPost({ request, env }) {
  const unauthorized = await requireAuth(request, env);
  if (unauthorized) return unauthorized;

  const body = await readJson(request);
  if (!body || typeof body !== 'object') return json({ error: 'corpo inválido' }, 400);

  const now = Date.now();
  const stmts = Object.entries(body).map(([k, v]) =>
    env.DB.prepare(
      'INSERT INTO preferences (chave, valor, updated_at) VALUES (?, ?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, updated_at = excluded.updated_at'
    ).bind(k, String(v), now)
  );
  await env.DB.batch(stmts);
  return json({ ok: true });
}
