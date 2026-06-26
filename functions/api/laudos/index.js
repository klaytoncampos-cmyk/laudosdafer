// functions/api/laudos/index.js — GET (busca/lista) / POST (salvar) /api/laudos
import { requireAuth, json, readJson, ensureLaudosTable, deburrServer } from '../../_utils.js';

function dataExameToTs(dateStr, fallback) {
  if (!dateStr) return fallback;
  const t = Date.parse(dateStr + 'T12:00:00');
  return Number.isNaN(t) ? fallback : t;
}

export async function onRequestGet({ request, env }) {
  const unauthorized = await requireAuth(request, env);
  if (unauthorized) return unauthorized;
  await ensureLaudosTable(env);

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  let sql = 'SELECT id, nome, nascimento, cpf, data_exame, indicacao, tipo, feve, resumo, updated_at FROM laudos_salvos';
  const where = [];
  const binds = [];
  if (q) {
    const digits = q.replace(/\D/g, '');
    if (digits.length >= 6) {
      where.push('(nome_busca LIKE ? OR cpf_busca LIKE ?)');
      binds.push('%' + deburrServer(q) + '%', '%' + digits + '%');
    } else {
      where.push('nome_busca LIKE ?');
      binds.push('%' + deburrServer(q) + '%');
    }
  }
  if (from) { const t = Date.parse(from + 'T00:00:00'); if (!Number.isNaN(t)) { where.push('data_exame >= ?'); binds.push(t); } }
  if (to) { const t = Date.parse(to + 'T23:59:59'); if (!Number.isNaN(t)) { where.push('data_exame <= ?'); binds.push(t); } }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY data_exame DESC, id DESC LIMIT 200';

  const { results } = await env.DB.prepare(sql).bind(...binds).all();
  return json({ laudos: results || [] });
}

export async function onRequestPost({ request, env }) {
  const unauthorized = await requireAuth(request, env);
  if (unauthorized) return unauthorized;
  await ensureLaudosTable(env);

  const b = await readJson(request);
  if (!b || !b.nome || !String(b.nome).trim()) return json({ error: 'nome obrigatório' }, 400);
  if (!b.texto || !b.snapshot) return json({ error: 'laudo vazio' }, 400);

  const now = Date.now();
  const cpf = (b.cpf || '').trim() || null;
  const cpfBusca = cpf ? cpf.replace(/\D/g, '') : null;
  const snapshot = typeof b.snapshot === 'string' ? b.snapshot : JSON.stringify(b.snapshot);

  const r = await env.DB.prepare(
    `INSERT INTO laudos_salvos (nome, nome_busca, nascimento, cpf, cpf_busca, data_exame, indicacao, tipo, feve, psap, resumo, texto, snapshot, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    String(b.nome).trim(), deburrServer(b.nome), b.nascimento || null, cpf, cpfBusca,
    dataExameToTs(b.data_exame, now), b.indicacao || null, b.tipo || null,
    b.feve == null ? null : b.feve, b.psap == null ? null : b.psap,
    b.resumo || null, b.texto, snapshot, now, now
  ).run();

  return json({ id: r.meta.last_row_id });
}
