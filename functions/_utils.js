// functions/_utils.js — helpers compartilhados

const ITERATIONS = 100000;
const KEY_LEN = 32;
const SESSION_TTL_DAYS = 30;

// ──────────────────────────────────────────────
// Hash de senha (PBKDF2)
// ──────────────────────────────────────────────

export async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    KEY_LEN * 8
  );
  return Array.from(new Uint8Array(bits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function randomHex(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ──────────────────────────────────────────────
// Sessões
// ──────────────────────────────────────────────

export async function getSessionToken(request) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/laudosdafer_session=([a-f0-9]+)/);
  return match ? match[1] : null;
}

export async function validateSession(env, token) {
  if (!token) return false;
  const now = Date.now();
  const row = await env.DB.prepare(
    'SELECT token FROM sessions WHERE token = ? AND expires_at > ?'
  ).bind(token, now).first();
  return !!row;
}

export async function createSession(env, userAgent) {
  const token = randomHex(32);
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
  await env.DB.prepare(
    'INSERT INTO sessions (token, expires_at, created_at, user_agent) VALUES (?, ?, ?, ?)'
  ).bind(token, expiresAt, now, userAgent || '').run();
  return { token, expiresAt };
}

export async function destroySession(env, token) {
  if (!token) return;
  await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
}

export function sessionCookieHeader(token, expiresAt) {
  const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  return `laudosdafer_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export function clearCookieHeader() {
  return 'laudosdafer_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';
}

// ──────────────────────────────────────────────
// Auth middleware
// ──────────────────────────────────────────────

export async function requireAuth(request, env) {
  const token = await getSessionToken(request);
  const valid = await validateSession(env, token);
  if (!valid) return json({ error: 'Não autorizado' }, 401);
  return null;
}

// ──────────────────────────────────────────────
// JSON responses
// ──────────────────────────────────────────────

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders
    }
  });
}

export async function readJson(request) {
  try { return await request.json(); }
  catch { return null; }
}

// ──────────────────────────────────────────────
// Laudos salvos (arquivo por paciente)
// ──────────────────────────────────────────────

// Cria a tabela na primeira chamada — evita migração manual no deploy.
export async function ensureLaudosTable(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS laudos_salvos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL, nome_busca TEXT NOT NULL,
    nascimento TEXT, cpf TEXT, cpf_busca TEXT,
    data_exame INTEGER NOT NULL, indicacao TEXT, tipo TEXT,
    feve REAL, psap REAL, resumo TEXT, texto TEXT NOT NULL, snapshot TEXT NOT NULL,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_laudos_salvos_nome ON laudos_salvos(nome_busca)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_laudos_salvos_cpf ON laudos_salvos(cpf_busca)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_laudos_salvos_data ON laudos_salvos(data_exame DESC)').run();
}

// Normaliza pra busca: minúsculo, sem acento.
export function deburrServer(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
