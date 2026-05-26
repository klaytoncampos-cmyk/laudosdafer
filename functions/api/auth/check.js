// functions/api/auth/check.js — GET /api/auth/check
import { getSessionToken, validateSession, json } from '../../_utils.js';

export async function onRequestGet({ request, env }) {
  const token = await getSessionToken(request);
  const valid = await validateSession(env, token);
  return json({ authenticated: valid });
}
