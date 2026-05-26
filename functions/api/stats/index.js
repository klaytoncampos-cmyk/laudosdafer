// functions/api/stats/index.js
import { requireAuth, json, readJson } from '../../_utils.js';

// POST /api/stats — registra um laudo finalizado (metadata only)
export async function onRequestPost({ request, env }) {
  const unauthorized = await requireAuth(request, env);
  if (unauthorized) return unauthorized;

  const body = await readJson(request);
  if (!body) return json({ error: 'corpo inválido' }, 400);

  const now = Date.now();
  await env.DB.prepare(
    'INSERT INTO laudo_log (tipo, alterado, duracao_ms, feve, psap, achados, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    body.tipo || 'ETT',
    body.alterado ? 1 : 0,
    body.duracao_ms || null,
    body.feve || null,
    body.psap || null,
    body.achados || null,
    now
  ).run();

  return json({ ok: true });
}

// GET /api/stats — painel de produtividade
export async function onRequestGet({ request, env }) {
  const unauthorized = await requireAuth(request, env);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '30', 10);
  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  const totals = await env.DB.prepare(
    'SELECT COUNT(*) as total, SUM(alterado) as alterados, AVG(duracao_ms) as duracao_media, AVG(feve) as feve_media FROM laudo_log WHERE created_at >= ?'
  ).bind(since).first();

  const byDay = await env.DB.prepare(
    "SELECT strftime('%Y-%m-%d', created_at/1000, 'unixepoch') as dia, COUNT(*) as qtd FROM laudo_log WHERE created_at >= ? GROUP BY dia ORDER BY dia"
  ).bind(since).all();

  const topFrases = await env.DB.prepare(
    'SELECT categoria, texto, usage_count FROM frases WHERE usage_count > 0 ORDER BY usage_count DESC LIMIT 10'
  ).all();

  return json({
    periodo_dias: days,
    total: totals?.total || 0,
    alterados: totals?.alterados || 0,
    normais: (totals?.total || 0) - (totals?.alterados || 0),
    duracao_media_ms: totals?.duracao_media || 0,
    feve_media: totals?.feve_media || 0,
    por_dia: byDay.results || [],
    frases_mais_usadas: topFrases.results || []
  });
}
