// functions/api/laudos/[id].js — GET / PUT / DELETE /api/laudos/:id
import { requireAuth, json, readJson, ensureLaudosTable, deburrServer } from '../../_utils.js';

function dataExameToTs(dateStr, fallback) {
  if (!dateStr) return fallback;
  const t = Date.parse(dateStr + 'T12:00:00');
  return Number.isNaN(t) ? fallback : t;
}

export async function onRequestGet({ request, env, params }) {
  const unauthorized = await requireAuth(request, env);
  if (unauthorized) return unauthorized;
  await ensureLaudosTable(env);

  const id = parseInt(params.id, 10);
  if (!id) return json({ error: 'id inválido' }, 400);
  const row = await env.DB.prepare('SELECT * FROM laudos_salvos WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'não encontrado' }, 404);
  return json({ laudo: row });
}

export async function onRequestPut({ request, env, params }) {
  const unauthorized = await requireAuth(request, env);
  if (unauthorized) return unauthorized;
  await ensureLaudosTable(env);

  const id = parseInt(params.id, 10);
  if (!id) return json({ error: 'id inválido' }, 400);
  const b = await readJson(request);
  if (!b || !b.nome || !String(b.nome).trim()) return json({ error: 'nome obrigatório' }, 400);

  const exists = await env.DB.prepare('SELECT id FROM laudos_salvos WHERE id = ?').bind(id).first();
  if (!exists) return json({ error: 'não encontrado' }, 404);

  const now = Date.now();
  const cpf = (b.cpf || '').trim() || null;
  const cpfBusca = cpf ? cpf.replace(/\D/g, '') : null;
  const snapshot = typeof b.snapshot === 'string' ? b.snapshot : JSON.stringify(b.snapshot);

  await env.DB.prepare(
    `UPDATE laudos_salvos SET nome=?, nome_busca=?, nascimento=?, cpf=?, cpf_busca=?, data_exame=?, indicacao=?, tipo=?, feve=?, psap=?, resumo=?, texto=?, snapshot=?, updated_at=? WHERE id=?`
  ).bind(
    String(b.nome).trim(), deburrServer(b.nome), b.nascimento || null, cpf, cpfBusca,
    dataExameToTs(b.data_exame, now), b.indicacao || null, b.tipo || null,
    b.feve == null ? null : b.feve, b.psap == null ? null : b.psap,
    b.resumo || null, b.texto, snapshot, now, id
  ).run();

  return json({ ok: true, id });
}

export async function onRequestDelete({ request, env, params }) {
  const unauthorized = await requireAuth(request, env);
  if (unauthorized) return unauthorized;
  await ensureLaudosTable(env);

  const id = parseInt(params.id, 10);
  if (!id) return json({ error: 'id inválido' }, 400);
  await env.DB.prepare('DELETE FROM laudos_salvos WHERE id = ?').bind(id).run();
  return json({ ok: true });
}
