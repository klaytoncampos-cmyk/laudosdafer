// functions/api/frases/index.js — GET / POST /api/frases
import { requireAuth, json, readJson } from '../../_utils.js';

export async function onRequestGet({ request, env }) {
  const unauthorized = await requireAuth(request, env);
  if (unauthorized) return unauthorized;

  const { results } = await env.DB.prepare(
    'SELECT id, categoria, texto, builtin, usage_count, last_used FROM frases ORDER BY usage_count DESC, categoria, id'
  ).all();

  return json({ frases: results || [] });
}

export async function onRequestPost({ request, env }) {
  const unauthorized = await requireAuth(request, env);
  if (unauthorized) return unauthorized;

  const body = await readJson(request);
  if (!body || !body.categoria || !body.texto) {
    return json({ error: 'categoria e texto obrigatórios' }, 400);
  }

  const now = Date.now();
  const result = await env.DB.prepare(
    'INSERT INTO frases (categoria, texto, builtin, usage_count, created_at) VALUES (?, ?, 0, 0, ?)'
  ).bind(body.categoria, body.texto, now).run();

  return json({
    id: result.meta.last_row_id,
    categoria: body.categoria,
    texto: body.texto,
    builtin: 0,
    usage_count: 0
  });
}
