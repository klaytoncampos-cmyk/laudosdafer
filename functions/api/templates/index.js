// functions/api/templates/index.js
import { requireAuth, json, readJson } from '../../_utils.js';

export async function onRequestGet({ request, env }) {
  const unauthorized = await requireAuth(request, env);
  if (unauthorized) return unauthorized;

  const { results } = await env.DB.prepare(
    'SELECT id, nome, indicacao, dados, builtin, created_at, updated_at FROM templates ORDER BY nome'
  ).all();

  return json({ templates: results || [] });
}

export async function onRequestPost({ request, env }) {
  const unauthorized = await requireAuth(request, env);
  if (unauthorized) return unauthorized;

  const body = await readJson(request);
  if (!body || !body.nome || !body.dados) {
    return json({ error: 'nome e dados obrigatórios' }, 400);
  }

  const now = Date.now();
  const result = await env.DB.prepare(
    'INSERT INTO templates (nome, indicacao, dados, builtin, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)'
  ).bind(body.nome, body.indicacao || '', JSON.stringify(body.dados), now, now).run();

  return json({ id: result.meta.last_row_id, ok: true });
}
