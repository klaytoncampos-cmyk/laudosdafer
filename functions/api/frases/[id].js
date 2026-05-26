// functions/api/frases/[id].js — DELETE / PATCH /api/frases/:id
import { requireAuth, json, readJson } from '../../_utils.js';

export async function onRequestDelete({ request, env, params }) {
  const unauthorized = await requireAuth(request, env);
  if (unauthorized) return unauthorized;

  const id = parseInt(params.id, 10);
  if (!id) return json({ error: 'id inválido' }, 400);

  // Não permitir deletar builtins
  const row = await env.DB.prepare('SELECT builtin FROM frases WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'não encontrada' }, 404);
  if (row.builtin) return json({ error: 'frase do sistema não pode ser excluída' }, 403);

  await env.DB.prepare('DELETE FROM frases WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

export async function onRequestPatch({ request, env, params }) {
  const unauthorized = await requireAuth(request, env);
  if (unauthorized) return unauthorized;

  const id = parseInt(params.id, 10);
  if (!id) return json({ error: 'id inválido' }, 400);

  const body = await readJson(request);

  // Modo "use": incrementa contador
  if (body && body.action === 'use') {
    const now = Date.now();
    await env.DB.prepare(
      'UPDATE frases SET usage_count = usage_count + 1, last_used = ? WHERE id = ?'
    ).bind(now, id).run();
    return json({ ok: true });
  }

  // Modo edit: só para frases não-builtin
  if (body && body.texto) {
    const row = await env.DB.prepare('SELECT builtin FROM frases WHERE id = ?').bind(id).first();
    if (!row) return json({ error: 'não encontrada' }, 404);
    if (row.builtin) return json({ error: 'builtin não pode ser editada' }, 403);
    await env.DB.prepare('UPDATE frases SET texto = ?, categoria = ? WHERE id = ?')
      .bind(body.texto, body.categoria || 'outras', id).run();
    return json({ ok: true });
  }

  return json({ error: 'ação inválida' }, 400);
}
