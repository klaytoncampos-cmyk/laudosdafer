// Testes jsdom — pacote pós-laudos 18/06 (itens aprovados pela Dra.) + correção ERP
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8')
  .replace('<script src="app.js"></script>', '');
const appSrc = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.fetch = () => Promise.resolve({ ok: false, json: async () => ({}) });
    window.crypto = window.crypto || { subtle: {}, getRandomValues: a => a };
  }
});
const { window } = dom;
const s = window.document.createElement('script');
s.textContent = appSrc;
window.document.body.appendChild(s);
const doc = window.document;

// helpers
const setNum = (id, v) => { doc.getElementById(id).value = v; };
const setSel = (id, v) => { doc.getElementById(id).value = v; };
const selRadio = (name, val) => {
  const r = [...doc.querySelectorAll(`input[name="${name}"]`)].find(e => e.value === val);
  if (!r) throw new Error(`radio ${name}=${val} não encontrado`);
  r.checked = true;
};
const setChk = (name, val) => {
  const c = [...doc.querySelectorAll(`input[name="${name}"]`)].find(e => e.value === val);
  if (!c) throw new Error(`checkbox ${name}=${val} não encontrado`);
  c.checked = true;
};
// texto do laudo com espaços normalizados (splitSentences quebra em linhas)
const report = () => window.buildPlainReport().replace(/\s+/g, ' ').trim();

let pass = 0, fail = 0;
function has(nome, frase) {
  const ok = report().includes(frase);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${nome}`);
  if (!ok) console.log(`      esperava encontrar: "${frase}"`);
  ok ? pass++ : fail++;
}
function hasNot(nome, frase) {
  const ok = !report().includes(frase);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${nome}`);
  ok ? pass++ : fail++;
}

// ── Baseline normal (regressão) ─────────────────────────────
has('Baseline: septo normal intacto', 'Não foi visualizado shunt ao Doppler colorido.');

// ── Item 2: FOP positivo ────────────────────────────────────
selRadio('septo', 'fop');
has('Item 2 FOP positivo', 'Shunt pelo septo interatrial, esquerda-direita, sugestivo de forame oval patente.');

// ── Item 2: microbolhas negativa ────────────────────────────
selRadio('septo', 'normal');
selRadio('septo-micro', 'negativa');
has('Item 2 microbolhas negativa (1ª frase)', 'Infusão de solução salina agitada evidenciou opacificação adequada das cavidades direitas, sem o surgimento de microbolhas nas cavidades esquerdas em repouso.');
has('Item 2 microbolhas negativa (2ª frase)', 'Ausência de evidência ecocardiográfica de comunicação interatrial (shunt direita-esquerda).');
selRadio('septo-micro', '');

// ── Item 3: estenose aórtica (Veloc máx + Índice Doppler) ───
window.setMode('va', 'alterado');
selRadio('va-est', 'Estenose importante');
setNum('va-vmax', '4');
setNum('va-grad-max', '64');
setNum('va-grad', '38');
setNum('va-area', '0.8');
setNum('va-idx', '0.22');
has('Item 3 Veloc máx (1 decimal)', 'Veloc máx.: 4,0m/s');
has('Item 3 gradiente máx e médio', 'Gradiente sistólico máximo de 64mmHg e médio de 38mmHg');
has('Item 3 Índice Doppler (2 decimais)', 'Índice Doppler: 0,22');
hasNot('Item 3 não usa mais "Vmax="', 'Vmax= 4');
window.setMode('va', 'auto');
setNum('va-vmax', ''); setNum('va-grad-max', ''); setNum('va-grad', ''); setNum('va-area', ''); setNum('va-idx', '');

// ── Item 4: calcificação do anel mitral ─────────────────────
window.setMode('vm', 'alterado');
selRadio('vm-calc', 'Calcificação do anel posterior');
has('Item 4 anel posterior', 'Calcificação do anel posterior');
selRadio('vm-calc', 'Calcificação discreta do anel');
has('Item 4 discreta do anel', 'Calcificação discreta do anel');
selRadio('vm-calc', '');
window.setMode('vm', 'auto');

// ── Item 5: VD sobrecarga de pressão + trombo apical ────────
selRadio('vd-dim', 'aumento-imp');
selRadio('vd-func', 'disf-imp');
setNum('vd-s', '6');
setChk('vd-obs', 'Septo interventricular retificado e com movimento paradoxal, sugestivo de sobrecarga de pressão no ventrículo direito.');
setChk('vd-obs', 'Imagem ecogênica e homogênea, aderida à região apical, sugestiva de trombo.');
has('Item 5 sobrecarga de pressão (septo paradoxal)', 'movimento paradoxal, sugestivo de sobrecarga de pressão no ventrículo direito.');
has('Item 5 trombo apical', 'Imagem ecogênica e homogênea, aderida à região apical, sugestiva de trombo.');
has('Item 5 onda S\'', "Onda S' = 6,0cm/s");
// limpa VD
selRadio('vd-dim', 'normal'); selRadio('vd-func', 'normal'); setNum('vd-s', '');
doc.querySelectorAll('input[name="vd-obs"]:checked').forEach(c => c.checked = false);

// ── Item 6: gradiente dinâmico VSVE ─────────────────────────
setNum('ve-lvot', '20');
has('Item 6 gradiente dinâmico VSVE', 'Gradiente dinâmico na via de saída do ventrículo esquerdo de 20 mmHg (estado hiperdinâmico).');
setNum('ve-lvot', '');

// ── Item 7: ritmo FAAR + FC ─────────────────────────────────
setSel('pac-ritmo', 'FAAR');
setNum('pac-fc', '150');
has('Item 7 FAAR com FC', 'Ritmo: FAAR (FC: 150bpm)');
setSel('pac-ritmo', 'Regular e taquicárdico');
setNum('pac-fc', '');
has('Item 7 regular e taquicárdico', 'Ritmo: Regular e taquicárdico');
setSel('pac-ritmo', 'Regular');

// ── Item 9: derrame pleural -> Achados adicionais ───────────
doc.getElementById('achado-pleural-e').checked = true;
has('Item 9 Achados adicionais (esquerda)', 'Achados adicionais: derrame pleural à esquerda.');
hasNot('Item 9 não usa mais "Achado extracardíaco"', 'Achado extracardíaco: derrame pleural');
doc.getElementById('achado-pleural-e').checked = false;

// ── GLS: strain longitudinal global ─────────────────────────
setNum('ve-gls', '-16');
has('GLS corpo do VE (-16)', 'Strain longitudinal global de -16%.');
has('GLS reduzido na conclusão', 'Strain longitudinal global reduzido -16% (valor de referência: < -17%).');
setNum('ve-gls', '14'); // técnica digita sem sinal -> normaliza pra negativo
has('GLS normaliza sinal (14 -> -14%)', 'Strain longitudinal global de -14%.');
setNum('ve-gls', '-20'); // normal: mais negativo que -17
has('GLS normal aparece no corpo (-20)', 'Strain longitudinal global de -20%.');
hasNot('GLS normal não vai pra conclusão', 'Strain longitudinal global reduzido');
setNum('ve-gls', '-17'); // limite: -17 é normal, não reduzido
hasNot('GLS -17 não é reduzido', 'Strain longitudinal global reduzido');
setNum('ve-gls', '');

// ── Revisar: textarea carrega exatamente o laudo gerado ─────
window.openRevisar();
const revVal = doc.getElementById('revisar-text').value;
const okRev = revVal === window.buildPlainReport();
console.log(`${okRev ? 'PASS' : 'FAIL'}  Revisar carrega o laudo gerado`);
okRev ? pass++ : fail++;
window.closeRevisar();

// ── Correção ERP (regressão da sessão anterior) ─────────────
doc.getElementById('pac-sexo').value = 'M';
doc.getElementById('m-massa').value = '217';
doc.getElementById('m-erp').value = window.fmt(0.60, 2); // "0,60"
window.autoFillFromMeasures();
const veEsp = (doc.querySelector('input[name="ve-esp"]:checked') || {}).value;
const okErp = veEsp === 'hve-concentrica-imp';
console.log(`${okErp ? 'PASS' : 'FAIL'}  ERP 0,60 + massa 217 -> concêntrica importante (obtido=${veEsp})`);
okErp ? pass++ : fail++;

// ── Plausibilidade (aviso âmbar, não bloqueia) ──────────────
setNum('m-siv', '40'); window.checkPlausibility();
const sivBad = doc.getElementById('m-siv').closest('.fld').classList.contains('fld-implausible');
console.log(`${sivBad ? 'PASS' : 'FAIL'}  Plausibilidade: septo 40mm marca aviso`);
sivBad ? pass++ : fail++;
setNum('m-siv', '10'); window.checkPlausibility();
const sivOk = !doc.getElementById('m-siv').closest('.fld').classList.contains('fld-implausible');
console.log(`${sivOk ? 'PASS' : 'FAIL'}  Plausibilidade: septo 10mm sem aviso`);
sivOk ? pass++ : fail++;
setNum('m-siv', ''); window.checkPlausibility();

// ── Busca rápida ────────────────────────────────────────────
doc.getElementById('search-input').value = 'mitral';
const okSearch = window.searchResults().map(x => x.id).includes('vm');
console.log(`${okSearch ? 'PASS' : 'FAIL'}  Busca: "mitral" acha a valva mitral`);
okSearch ? pass++ : fail++;
doc.getElementById('search-input').value = '';

// ── Autosave: snapshot/restore preserva o laudo ─────────────
// estado realista: medidas-fonte reais -> massa/ERP derivados por calcAll
doc.getElementById('pac-sexo').value = 'M';
setNum('m-siv', '11'); setNum('m-pp', '11'); setNum('m-ved', '50'); window.calcAll();
doc.getElementById('pac-indic').value = 'IC';
window.setMode('va', 'alterado'); selRadio('va-est', 'Estenose importante'); setNum('va-vmax', '4'); setNum('va-grad', '38');
const snapBefore = window.buildPlainReport();
const snap = window.buildSnapshot();
// bagunça antes de restaurar
window.setMode('va', 'normal'); setNum('va-vmax', ''); setNum('va-grad', ''); setNum('m-siv', ''); setNum('m-ved', ''); window.calcAll();
doc.getElementById('pac-indic').value = '';
window.applySnapshot(snap);
const snapAfter = window.buildPlainReport();
const okSnap = snapBefore === snapAfter;
console.log(`${okSnap ? 'PASS' : 'FAIL'}  Autosave: snapshot/restore preserva o laudo`);
okSnap ? pass++ : fail++;

console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
