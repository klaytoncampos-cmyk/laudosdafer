// functions/api/templates/[id].js
import { requireAuth, json } from '../../_utils.js';

export async function onRequestDelete({ request, env, params }) {
  const unauthorized = await requireAuth(request, env);
  if (unauthorized) return unauthorized;

  const id = parseInt(params.id, 10);
  if (!id) return json({ error: 'id inválido' }, 400);

  const row = await env.DB.prepare('SELECT builtin FROM templates WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'não encontrado' }, 404);
  if (row.builtin) return json({ error: 'builtin não pode ser excluído' }, 403);

  await env.DB.prepare('DELETE FROM templates WHERE id = ?').bind(id).run();
  return json({ ok: true });
}
