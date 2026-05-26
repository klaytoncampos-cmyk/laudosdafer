-- ════════════════════════════════════════════════════════════
-- Laudos da Fer — Schema D1
-- ════════════════════════════════════════════════════════════

-- ══════════════════════
-- AUTENTICAÇÃO
-- ══════════════════════

CREATE TABLE IF NOT EXISTS auth (
  id INTEGER PRIMARY KEY,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ══════════════════════
-- FRASES PRONTAS
-- ══════════════════════

CREATE TABLE IF NOT EXISTS frases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria TEXT NOT NULL,
  texto TEXT NOT NULL,
  builtin INTEGER NOT NULL DEFAULT 0,
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_frases_cat ON frases(categoria);
CREATE INDEX IF NOT EXISTS idx_frases_usage ON frases(usage_count DESC);

-- ══════════════════════
-- TEMPLATES POR INDICAÇÃO
-- ══════════════════════

CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  indicacao TEXT,
  dados TEXT NOT NULL,
  builtin INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- ══════════════════════
-- PREFERÊNCIAS DA USUÁRIA
-- ══════════════════════

CREATE TABLE IF NOT EXISTS preferences (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- ══════════════════════
-- LOG DE LAUDOS (METADATA APENAS — SEM DADOS DE PACIENTE)
-- ══════════════════════

CREATE TABLE IF NOT EXISTS laudo_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,
  alterado INTEGER NOT NULL,
  duracao_ms INTEGER,
  feve REAL,
  psap REAL,
  achados TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_laudo_log_created ON laudo_log(created_at DESC);

-- ════════════════════════════════════════════════════════════
-- SEED — FRASES PRONTAS PADRÃO
-- ════════════════════════════════════════════════════════════

INSERT OR IGNORE INTO frases (categoria, texto, builtin, created_at) VALUES
  ('endocardite', 'Imagem ecogênica móvel aderida à face atrial da cúspide mitral, sugestiva de vegetação, medindo cerca de X mm em seu maior eixo.', 1, strftime('%s','now')*1000),
  ('endocardite', 'Refluxo mitral importante, com jato excêntrico, associado à imagem suspeita de vegetação — quadro compatível com endocardite infecciosa.', 1, strftime('%s','now')*1000),
  ('endocardite', 'Sugere-se complementação com ecocardiograma transesofágico para melhor avaliação morfológica e descarte de abscesso perivalvar.', 1, strftime('%s','now')*1000),
  ('endocardite', 'Espessamento da fibrosa intervalvar mitro-aórtica (FIMA) com imagem anecoica em seu interior, podendo corresponder a abscesso em formação.', 1, strftime('%s','now')*1000),
  ('endocardite', 'Ausência de imagem sugestiva de vegetação.', 1, strftime('%s','now')*1000),
  ('protese', 'Prótese biológica em posição mitral, normofuncionante, sem refluxo perivalvar significativo.', 1, strftime('%s','now')*1000),
  ('protese', 'Prótese mecânica em posição aórtica com gradiente médio elevado para o tipo e tamanho da prótese — sugerir avaliação com transesofágico para descartar disfunção.', 1, strftime('%s','now')*1000),
  ('protese', 'Aorta ascendente com tubo protético em seu interior, apresentando fluxo normal.', 1, strftime('%s','now')*1000),
  ('iam', 'Alterações segmentares compatíveis com sequela de infarto miocárdico, com função sistólica global moderadamente reduzida.', 1, strftime('%s','now')*1000),
  ('iam', 'Acinesia da região apical (ápex e segmentos apicais de todas as paredes), com discinesia segmentar — não se descarta presença de aneurisma apical.', 1, strftime('%s','now')*1000),
  ('iam', 'Contratilidade preservada nas demais paredes.', 1, strftime('%s','now')*1000),
  ('ic', 'Disfunção sistólica importante do VE com FEVE estimada inferior a 30%, com aumento importante da cavidade ventricular.', 1, strftime('%s','now')*1000),
  ('ic', 'Padrão hemodinâmico de elevação de pressões de enchimento (E/e'' elevada, AE aumentado, PSAP elevada) — compatível com insuficiência cardíaca de fração de ejeção reduzida.', 1, strftime('%s','now')*1000),
  ('hp', 'Hipertensão pulmonar importante (PSAP estimada ≥ 70 mmHg), com refluxo tricúspide moderado e veia cava inferior pletórica.', 1, strftime('%s','now')*1000),
  ('tamponamento', 'Derrame pericárdico de grau importante, circunferencial, com sinais de repercussão hemodinâmica (colapso diastólico de câmaras direitas e variação respiratória acentuada dos fluxos transvalvares) — quadro sugestivo de tamponamento cardíaco.', 1, strftime('%s','now')*1000),
  ('dissecao', 'Imagem linear móvel no interior da aorta ascendente, compatível com flap de dissecção. Indicada avaliação complementar com angio-TC torácica em caráter de urgência.', 1, strftime('%s','now')*1000),
  ('outras', 'Janela acústica limitada.', 1, strftime('%s','now')*1000),
  ('outras', 'Fios de marcapasso em cavidades direitas.', 1, strftime('%s','now')*1000);

-- ════════════════════════════════════════════════════════════
-- SEED — PREFERÊNCIAS PADRÃO
-- ════════════════════════════════════════════════════════════

INSERT OR IGNORE INTO preferences (chave, valor, updated_at) VALUES
  ('theme', 'light', strftime('%s','now')*1000),
  ('density', 'comfortable', strftime('%s','now')*1000),
  ('pad_default', '5', strftime('%s','now')*1000),
  ('feve_method_default', 'Simpson', strftime('%s','now')*1000);
