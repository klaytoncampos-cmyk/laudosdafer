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

// ── ERP com vírgula (regressão) + grau da HVE pela espessura de parede (protocolo da Dra.) ──
doc.getElementById('pac-sexo').value = 'M';
doc.getElementById('m-massa').value = '217';                  // massa alta
doc.getElementById('m-erp').value = window.fmt(0.60, 2);      // "0,60" — lê a vírgula, não cai pra excêntrica
doc.getElementById('m-siv').value = '18'; doc.getElementById('m-pp').value = '18'; // maior parede 18mm
window.autoFillFromMeasures();
const veEspH = (doc.querySelector('input[name="ve-esp"]:checked') || {}).value;
const okErp = veEspH === 'hve-concentrica-imp';
console.log(`${okErp ? 'PASS' : 'FAIL'}  ERP 0,60 (vírgula) + parede 18mm (H) -> concêntrica importante (obtido=${veEspH})`);
okErp ? pass++ : fail++;

// caso real que a Dra. apontou: mulher, parede 12mm, massa 142, ERP 0,46 -> DISCRETA (não importante)
doc.getElementById('pac-sexo').value = 'F';
doc.getElementById('m-massa').value = '142';
doc.getElementById('m-erp').value = '0,46';
doc.getElementById('m-siv').value = '12'; doc.getElementById('m-pp').value = '12';
window.autoFillFromMeasures();
const veEspF = (doc.querySelector('input[name="ve-esp"]:checked') || {}).value;
const okF = veEspF === 'hve-concentrica-disc';
console.log(`${okF ? 'PASS' : 'FAIL'}  Mulher parede 12mm + massa 142 -> concêntrica discreta (obtido=${veEspF})`);
okF ? pass++ : fail++;

// ERP no limite exato 0,42 com massa normal -> remodelamento (regra ≥0,42)
doc.getElementById('pac-sexo').value = 'F';
doc.getElementById('m-massa').value = '90'; doc.getElementById('m-erp').value = '0,42';
window.autoFillFromMeasures();
const veEspR = (doc.querySelector('input[name="ve-esp"]:checked') || {}).value;
const okR = veEspR === 'remodelamento';
console.log(`${okR ? 'PASS' : 'FAIL'}  ERP 0,42 + massa normal -> remodelamento (obtido=${veEspR})`);
okR ? pass++ : fail++;
['m-massa','m-erp','m-siv','m-pp'].forEach(id => doc.getElementById(id).value = '');
doc.getElementById('pac-sexo').value = '';

// ── Hipocinesia difusa quando FEVE reduzida (frase da Dra., opção C) ──
doc.getElementById('pac-sexo').value = 'F';
setNum('ve-feve', '23'); doc.getElementById('ve-feve-met').value = 'Simpson';
window.autoFillFromMeasures();
const sistVal = (doc.querySelector('input[name="ve-sist"]:checked') || {}).value;
console.log(`${sistVal === 'imp-reduzida' ? 'PASS' : 'FAIL'}  FEVE 23% -> função sistólica importante (obtido=${sistVal})`);
sistVal === 'imp-reduzida' ? pass++ : fail++;
const motVal = (doc.querySelector('input[name="ve-mot"]:checked') || {}).value;
console.log(`${motVal === 'alterada' ? 'PASS' : 'FAIL'}  FEVE 23% -> motilidade auto "alterada" (obtido=${motVal})`);
motVal === 'alterada' ? pass++ : fail++;
has('Hipocinesia difusa (frase da Dra.)', 'Hipocinesia difusa. Disfunção sistólica importante (FEVE= 23% pelo método de Simpson).');
hasNot('Não usa mais "segmentar preservada" com FEVE baixa', 'Contratilidade miocárdica segmentar preservada e função sistólica importante reduzida');
setNum('ve-feve', ''); selRadio('ve-mot', 'preservada'); window.onMotilidadeChange();
doc.getElementById('pac-sexo').value = '';

// ── #1/#7 Conclusão "Insuficiência [valva] [grau] ([causa])" ──
selRadio('va-est', ''); selRadio('vm-est', '');
window.setMode('vm', 'alterado'); selRadio('vm-refl', 'Refluxo importante'); selRadio('vm-refl-causa', 'secundário à dilatação do anel');
window.setMode('va', 'alterado'); selRadio('va-refl', 'Refluxo importante'); selRadio('va-refl-causa', 'secundário a ectasia da aorta');
window.setMode('vt', 'alterado'); selRadio('vt-refl', 'Refluxo moderado'); selRadio('vt-refl-causa', 'secundário a dilatação do anel');
has('#1 Insuficiência mitral importante (secundária)', 'Insuficiência mitral importante (secundária)');
has('#1 Insuficiência aórtica importante (ectasia da aorta)', 'Insuficiência aórtica importante (ectasia da aorta)');
has('#1 Insuficiência tricúspide moderada (secundária)', 'Insuficiência tricúspide moderada (secundária)');
hasNot('#1 não usa mais "Refluxo importante mitral"', 'Refluxo importante mitral');
has('#7 corpo: secundário a ectasia da aorta', '(secundário a ectasia da aorta)');
selRadio('va-refl-causa', 'de etiologia degenerativa');
has('#1 aórtica etiologia degenerativa', 'Insuficiência aórtica importante (etiologia degenerativa)');
window.setMode('vm', 'normal'); window.setMode('va', 'normal'); window.setMode('vt', 'normal');

// ── #2 Aumento da cavidade do VE na conclusão ──
selRadio('ve-cav', 'aumento-imp');
has('#2 Aumento importante do VE na conclusão', 'Aumento importante do ventrículo esquerdo');
selRadio('ve-cav', 'normal');

// ── #4 Septo por sobrecarga de volume ──
selRadio('ve-septomorf', 'Retificação diastólica do septo interventricular devido sobrecarga de volume.');
has('#4 Septo sobrecarga de volume', 'Retificação diastólica do septo interventricular devido sobrecarga de volume.');
selRadio('ve-septomorf', '');

// ── #8 Microbolhas negativa com Valsalva ──
selRadio('septo-micro', 'negativa-valsalva');
has('#8 Microbolhas Valsalva', 'em repouso e após manobra de Valsalva');
hasNot('#8 não é a frase "em repouso." sozinha', 'esquerdas em repouso. Ausência');
selRadio('septo-micro', '');

// ── #9 Espessamento biventricular (amiloidose) ──
selRadio('ve-esp', 'hve-descritiva');
doc.getElementById('vd-espess').checked = true; setNum('vd-espess-mm', '8');
has('#9 corpo: espessura do VD (8mm)', 'Aumento simétrico da espessura miocárdica (8mm).');
has('#9 conclusão: biventricular', 'Aumento da espessura miocárdica biventricular');
doc.getElementById('vd-espess').checked = false; setNum('vd-espess-mm', ''); selRadio('ve-esp', 'preservada');

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

// ── Arquivo: payload de salvar bem-formado ──
doc.getElementById('save-nome').value = 'Fulano de Tal';
doc.getElementById('save-nasc').value = '1950-05-10';
doc.getElementById('pac-indic').value = 'IC';
const payload = window.buildLaudoPayload();
const snapObj = (() => { try { return JSON.parse(payload.snapshot); } catch (e) { return null; } })();
const okPayload = payload.nome === 'Fulano de Tal' && payload.nascimento === '1950-05-10' &&
  payload.indicacao === 'IC' && typeof payload.texto === 'string' && payload.texto.length > 0 &&
  snapObj && snapObj.ids;
console.log(`${okPayload ? 'PASS' : 'FAIL'}  Arquivo: payload de salvar (nome + texto + snapshot)`);
okPayload ? pass++ : fail++;
doc.getElementById('save-nome').value = ''; doc.getElementById('save-nasc').value = ''; doc.getElementById('pac-indic').value = '';

console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
