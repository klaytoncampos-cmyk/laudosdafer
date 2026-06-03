// ════════════════════════════════════════
// API CLIENT
// ════════════════════════════════════════
const api = {
  async login(password) {
    const r = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({password}), credentials:'same-origin' });
    return { ok: r.ok, data: await r.json().catch(()=>({})) };
  },
  async logout() { return fetch('/api/auth/logout', { method:'POST', credentials:'same-origin' }); },
  async check() {
    const r = await fetch('/api/auth/check', { credentials:'same-origin' });
    if (!r.ok) return false;
    const d = await r.json();
    return !!d.authenticated;
  },
  async getFrases() {
    const r = await fetch('/api/frases', { credentials:'same-origin' });
    return r.ok ? (await r.json()).frases || [] : [];
  },
  async addFrase(categoria, texto) {
    const r = await fetch('/api/frases', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({categoria, texto}), credentials:'same-origin' });
    return r.ok ? await r.json() : null;
  },
  async useFrase(id) {
    return fetch(`/api/frases/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'use'}), credentials:'same-origin' });
  },
  async deleteFrase(id) { return fetch(`/api/frases/${id}`, { method:'DELETE', credentials:'same-origin' }); },
  async getPreferences() {
    const r = await fetch('/api/preferences', { credentials:'same-origin' });
    return r.ok ? (await r.json()).preferences || {} : {};
  },
  async setPreferences(obj) {
    return fetch('/api/preferences', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(obj), credentials:'same-origin' });
  },
  async logLaudo(meta) {
    return fetch('/api/stats', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(meta), credentials:'same-origin' });
  },
  async getStats(days=30) {
    const r = await fetch(`/api/stats?days=${days}`, { credentials:'same-origin' });
    return r.ok ? await r.json() : null;
  }
};

// ════════════════════════════════════════
// AUTH
// ════════════════════════════════════════
async function doLogin() {
  const v = document.getElementById('pwd').value;
  document.getElementById('login-btn').textContent = '...';
  const res = await api.login(v);
  document.getElementById('login-btn').textContent = 'Entrar';
  if (res.ok) showApp();
  else {
    document.getElementById('login-err').textContent = res.data?.error || 'Falha no login';
    document.getElementById('pwd').value = '';
  }
}
async function logout() { await api.logout(); location.reload(); }
async function showApp() {
  document.getElementById('login').style.display = 'none';
  document.getElementById('app').classList.add('shown');
  await loadPreferences();
  await loadFrases();
  buildNavSidebar();
  initBullseye();
  renderPreview();
  updateStickyHeader();
  state.startTime = Date.now();
}
document.getElementById('pwd').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
(async () => { if (await api.check()) showApp(); })();

// ════════════════════════════════════════
// STATE
// ════════════════════════════════════════
const state = {
  mode: { aorta:'auto', ae:'auto', vci:'incluir' },
  concl: 'auto',
  manualOverride: {},
  bullseye: {},
  bullseyeActiveState: 'hipocinesia',
  frases: [],
  startTime: Date.now(),
  tipo: 'ETT',
  eteTipo: 'transesofagica'
};

function setTipo(t) {
  state.tipo = t;
  document.querySelectorAll('.tb-tab[data-tipo]').forEach(b => b.classList.toggle('active', b.dataset.tipo === t));
  document.querySelectorAll('.ete-only').forEach(el => el.style.display = t === 'ETE' ? 'block' : 'none');
  // mostrar/ocultar item ETE no nav
  const navEte = document.querySelector('.nav-section[data-target="ete"]');
  if (navEte) navEte.style.display = t === 'ETE' ? '' : 'none';
  renderPreview();
}
function setEteTipo(v) {
  state.eteTipo = v;
  document.querySelectorAll('#sec-ete .toggle button').forEach(b => b.classList.toggle('active', b.dataset.val === v));
  renderPreview();
}

const SECTIONS_NAV = [
  { id:'paciente', num:'P', label:'Paciente' },
  { id:'estrut', num:'1', label:'Medidas' },
  { id:'aorta', num:'2', label:'Aorta torácica' },
  { id:'ae', num:'3', label:'Átrio esquerdo' },
  { id:'ve', num:'4', label:'Ventrículo esq.' },
  { id:'ad', num:'5', label:'Átrio direito' },
  { id:'vd', num:'6', label:'Ventrículo dir.' },
  { id:'vm', num:'7', label:'Valva mitral' },
  { id:'va', num:'8', label:'Valva aórtica' },
  { id:'vt', num:'9', label:'Valva tricúspide' },
  { id:'vp', num:'10', label:'Valva pulmonar' },
  { id:'peri', num:'11', label:'Pericárdio' },
  { id:'septo', num:'12', label:'Septos' },
  { id:'vci', num:'13', label:'VCI' },
  { id:'ete', num:'E', label:'ETE', eteOnly:true },
  { id:'concl', num:'★', label:'Conclusão' }
];

function buildNavSidebar() {
  const pane = document.getElementById('nav-pane');
  pane.innerHTML = SECTIONS_NAV.map(s => `
    <div class="nav-section normal" data-target="${s.id}" onclick="scrollToSec('${s.id}')" style="${s.eteOnly ? 'display:none' : ''}">
      <div class="nav-num">${s.num}</div>
      <div class="nav-label">${s.label}</div>
      <div class="nav-status">○</div>
    </div>
  `).join('');
}

function scrollToSec(id) {
  const el = document.getElementById('sec-' + id);
  if (el) el.scrollIntoView({ behavior:'smooth', block:'start' });
}

// ════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════
function num(id) { const v = parseFloat(document.getElementById(id).value); return isNaN(v) ? null : v; }
function fmt(n, d=2) { return n===null ? '' : Number(n).toFixed(d).replace('.', ','); }
function getRadio(name) { const r = document.querySelector(`input[name="${name}"]:checked`); return r ? r.value : null; }
function getChecks(name) { return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(e=>e.value); }
function getChecksGrid(id) { return Array.from(document.querySelectorAll(`#${id} input[type="checkbox"]:checked`)).map(e=>e.value); }
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// Quebra um texto de seção em frases, uma por linha.
// Só quebra em "ponto + espaço + início de nova frase" (letra maiúscula/acentuada).
// Preserva decimais (1,1cm² nunca tem ". " no meio) e siglas como "a.e." não ocorrem aqui.
function splitSentences(txt) {
  if (!txt) return [];
  // insere marcador após ". " quando o próximo caractere inicia nova frase
  // (maiúscula A-Z, acentuadas, ou abre com algo como "Ao Doppler")
  const marked = txt.replace(/\.\s+(?=[A-ZÀ-ÖØ-Þ])/g, '.\u0001');
  return marked.split('\u0001').map(s => s.trim()).filter(Boolean);
}

function setMode(sec, mode) {
  state.mode[sec] = mode;
  const head = document.querySelector(`[data-id="${sec}"] .toggle`);
  if (head) head.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.val === mode));
  const alt = document.getElementById(`alt-${sec}`);
  if (alt) alt.style.display = mode === 'alterado' ? 'block' : 'none';
  const prot = document.getElementById(`prot-${sec}`);
  if (prot) prot.style.display = mode === 'protese' ? 'block' : 'none';
  if (sec === 'ae') {
    document.getElementById('ae-grau-block').style.display = mode === 'alterado' ? 'block' : 'none';
  }
  renderPreview();
  updateStatuses();
  updateNav();
  if (typeof renderCorrelations === 'function') renderCorrelations();
}

function setConclMode(m) {
  state.concl = m;
  document.querySelectorAll('[data-id="concl"] .toggle button').forEach(b => b.classList.toggle('active', b.dataset.val === m));
  document.getElementById('concl-manual-box').style.display = m === 'manual' ? 'block' : 'none';
  document.getElementById('concl-auto-info').style.display = m === 'auto' ? 'block' : 'none';
  renderPreview();
}

function onMotilidadeChange() {
  const v = getRadio('ve-mot');
  document.getElementById('segs-container').style.display = v === 'alterada' ? 'block' : 'none';
  renderPreview();
}

function onPeriChange() {
  const v = getRadio('peri');
  const show = v && v !== 'normal' && v !== 'espess' && v !== 'laminar';
  document.getElementById('peri-extra').style.display = show ? 'block' : 'none';
  renderContextualSuggestions();
  renderPreview();
}

document.addEventListener('change', e => {
  if (e.target.id === 'vm-img-chk') {
    document.getElementById('vm-img-row').style.display = e.target.checked ? 'block' : 'none';
    e.target.closest('.opt-chip').classList.toggle('sel', e.target.checked);
    renderPreview();
    return;
  }
  if (e.target.id === 'vm-veg-chk') {
    document.getElementById('vm-veg-row').style.display = e.target.checked ? 'block' : 'none';
    e.target.closest('.opt-chip').classList.toggle('sel', e.target.checked);
    renderPreview();
    return;
  }
  if (e.target.id === 'vm-cusp-chk') {
    document.getElementById('vm-cusp-row').style.display = e.target.checked ? 'block' : 'none';
    e.target.closest('.opt-chip').classList.toggle('sel', e.target.checked);
    renderPreview();
    return;
  }
  if (e.target.id === 'pac-beira') {
    e.target.closest('.opt-chip').classList.toggle('sel', e.target.checked);
    const uti = document.getElementById('uti-context');
    if (uti) uti.style.display = e.target.checked ? 'block' : 'none';
    renderPreview();
    return;
  }
  if (e.target.name === 'vp-base') {
    document.getElementById('vp-alt-body').style.display = e.target.value === 'alterada' ? 'block' : 'none';
  }
  if (e.target.matches('input[type="radio"], input[type="checkbox"]')) {
    const chip = e.target.closest('.opt-chip');
    if (chip && !['vm-img-chk','vm-veg-chk','vm-cusp-chk','pac-beira'].includes(e.target.id)) {
      if (e.target.type === 'radio') {
        const name = e.target.name;
        if (name) document.querySelectorAll(`input[name="${name}"]`).forEach(r => r.closest('.opt-chip')?.classList.remove('sel','auto'));
        if (e.target.checked) chip.classList.add('sel');
        if (name) state.manualOverride[name] = true;
      } else {
        chip.classList.toggle('sel', e.target.checked);
      }
    }
    renderContextualSuggestions();
    renderPreview();
    updateStatuses();
    updateNav();
    updateStickyHeader();
    renderCorrelations();
  }
});

document.addEventListener('input', () => {
  calcAll();
  autoFillFromMeasures();
  renderContextualSuggestions();
  renderPreview();
  updateStatuses();
  updateNav();
  updateStickyHeader();
});

// ════════════════════════════════════════
// CALCULATIONS
// ════════════════════════════════════════
function calcAll() {
  const peso = num('pac-peso'), altCm = num('pac-alt');
  let bsa = null;
  if (peso && altCm) {
    bsa = 0.007184 * Math.pow(peso, 0.425) * Math.pow(altCm, 0.725);
    document.getElementById('pac-bsa').value = fmt(bsa, 2);
  } else document.getElementById('pac-bsa').value = '';

  const siv = num('m-siv'), pp = num('m-pp'), ved = num('m-ved');
  let massaInd = null;
  if (siv && pp && ved) {
    const dCm = ved/10, sCm = siv/10, pCm = pp/10;
    const massaG = 0.8 * 1.04 * (Math.pow(dCm+sCm+pCm, 3) - Math.pow(dCm, 3)) + 0.6;
    if (bsa) { massaInd = massaG / bsa; document.getElementById('m-massa').value = fmt(massaInd, 0); }
    else document.getElementById('m-massa').value = '';
  } else document.getElementById('m-massa').value = '';

  let erp = null;
  if (pp && ved) { erp = (2*pp)/ved; document.getElementById('m-erp').value = fmt(erp, 2); }
  else document.getElementById('m-erp').value = '';

  const sexo = document.getElementById('pac-sexo').value;
  const calcInfo = document.getElementById('calc-info');
  if (massaInd !== null && erp !== null) {
    calcInfo.style.display = 'grid';
    const refMassa = sexo === 'F' ? 95 : 115;
    const massaAlta = massaInd > refMassa;
    const erpAlto = erp > 0.42;
    let padrao;
    if (!massaAlta && !erpAlto) padrao = 'Normal';
    else if (!massaAlta && erpAlto) padrao = 'Remodelamento concêntrico';
    else if (massaAlta && erpAlto) padrao = 'Hipertrofia concêntrica';
    else padrao = 'Hipertrofia excêntrica';
    document.getElementById('calc-padrao').textContent = padrao;
  } else calcInfo.style.display = 'none';

  const vtv = num('vt-vmax');
  const pad = parseFloat(document.getElementById('vt-pad').value) || 5;
  if (vtv) {
    const psap = 4*vtv*vtv + pad;
    document.getElementById('vt-psap').value = fmt(psap, 0);
  } else document.getElementById('vt-psap').value = '';
}

// ════════════════════════════════════════
// AUTO-FILL FROM MEASURES
// ════════════════════════════════════════
function autoFillFromMeasures() {
  const sexo = document.getElementById('pac-sexo').value;
  const aeVol = num('ae-vol');
  if (aeVol !== null && !state.manualOverride['ae-grau']) {
    let aeAuto = null;
    if (aeVol >= 35 && aeVol <= 41) aeAuto = 'Aumento discreto';
    else if (aeVol >= 42 && aeVol <= 48) aeAuto = 'Aumento moderado';
    else if (aeVol > 48) aeAuto = 'Aumento importante';
    if (aeAuto) {
      autoSelect('ae-grau', aeAuto);
      if (state.mode.ae !== 'alterado') setMode('ae', 'alterado');
    } else {
      if (state.mode.ae === 'alterado' && !state.manualOverride['ae-mode']) setMode('ae', 'auto');
    }
  }
  const ved = num('m-ved');
  if (ved !== null && !state.manualOverride['ve-cav']) {
    let cavAuto = 'normal';
    if (ved >= 57 && ved <= 63) cavAuto = 'aumento-disc';
    else if (ved >= 64 && ved <= 67) cavAuto = 'aumento-mod';
    else if (ved >= 68) cavAuto = 'aumento-imp';
    autoSelect('ve-cav', cavAuto);
  }
  const massaInd = num('m-massa');
  const erp = num('m-erp');
  if (massaInd !== null && erp !== null && sexo && !state.manualOverride['ve-esp']) {
    const refMassa = sexo === 'F' ? 95 : 115;
    const massaAlta = massaInd > refMassa;
    const erpAlto = erp > 0.42;
    let espAuto;
    if (!massaAlta && !erpAlto) espAuto = 'preservada';
    else if (!massaAlta && erpAlto) espAuto = 'remodelamento';
    else if (massaAlta && erpAlto) {
      const delta = massaInd - refMassa;
      if (delta <= 15) espAuto = 'hve-concentrica-disc';
      else if (delta <= 30) espAuto = 'hve-concentrica-mod';
      else espAuto = 'hve-concentrica-imp';
    } else espAuto = 'hve-excentrica';
    autoSelect('ve-esp', espAuto);
  }
  const feve = num('ve-feve');
  if (feve !== null && !state.manualOverride['ve-sist']) {
    let sistAuto;
    if (sexo === 'F') {
      if (feve >= 54) sistAuto = 'preservada';
      else if (feve >= 41) sistAuto = 'disc-reduzida';
      else if (feve >= 30) sistAuto = 'mod-reduzida';
      else sistAuto = 'imp-reduzida';
    } else {
      if (feve >= 52) sistAuto = 'preservada';
      else if (feve >= 41) sistAuto = 'disc-reduzida';
      else if (feve >= 30) sistAuto = 'mod-reduzida';
      else sistAuto = 'imp-reduzida';
    }
    autoSelect('ve-sist', sistAuto);
  }
  document.getElementById('ve-feve').closest('.fld').classList.toggle('fld-crit', feve !== null && feve < 30);
  const psap = parseFloat((document.getElementById('vt-psap').value || '0').replace(',', '.'));
  document.getElementById('vt-psap').closest('.fld').classList.toggle('fld-crit', psap >= 70);
  renderAlerts();
  renderCorrelations();
}

function autoSelect(name, value) {
  document.querySelectorAll(`input[name="${name}"]`).forEach(r => {
    const chip = r.closest('.opt-chip');
    if (r.value === value) {
      r.checked = true;
      chip?.classList.add('sel', 'auto');
    } else {
      r.checked = false;
      chip?.classList.remove('sel', 'auto');
    }
  });
}

// ════════════════════════════════════════
// ALERTS
// ════════════════════════════════════════
function renderAlerts() {
  const zone = document.getElementById('alerts-zone');
  const alerts = [];
  const feve = num('ve-feve');
  const psap = parseFloat((document.getElementById('vt-psap').value || '0').replace(',', '.'));
  const ved = num('m-ved');
  const mot = getRadio('ve-mot');
  const periRad = getRadio('peri');
  const vmEst = getRadio('vm-est');
  const vaEst = getRadio('va-est');

  if (feve !== null && feve < 30) alerts.push({ type:'crit', msg:`⚠ FEVE crítica (${feve}%) — considere recomendação na conclusão` });
  if (psap >= 70) alerts.push({ type:'crit', msg:`⚠ Hipertensão pulmonar importante (PSAP= ${fmt(psap,0)} mmHg)` });
  if (periRad === 'imp') alerts.push({ type:'crit', msg:'⚠ Derrame pericárdico importante' });
  if (vmEst === 'Estenose importante') alerts.push({ type:'crit', msg:'⚠ Estenose mitral importante' });
  if (vaEst === 'Estenose importante') alerts.push({ type:'crit', msg:'⚠ Estenose aórtica importante' });
  if (feve !== null && feve < 40 && mot === 'preservada')
    alerts.push({ type:'warn', msg:'? FEVE reduzida com motilidade preservada — verificar' });
  if (ved !== null && ved >= 68 && getRadio('ve-cav') === 'normal')
    alerts.push({ type:'warn', msg:'? VEd ≥ 68mm mas cavidade marcada normal' });

  zone.innerHTML = alerts.map(a => `<div class="${a.type === 'crit' ? 'crit-alert' : 'warn-alert'}">${a.msg}</div>`).join('');
}

// ════════════════════════════════════════
// CORRELAÇÕES CLÍNICAS (lembretes discretos — aprovadas pela Dra.)
// Só lembram do que AINDA não foi marcado. Nunca preenchem nada.
// ════════════════════════════════════════
function renderCorrelations() {
  const zone = document.getElementById('correl-zone');
  if (!zone) return;
  const hints = [];

  const feve = num('ve-feve');
  const psap = parseFloat((document.getElementById('vt-psap').value || '0').replace(',', '.'));
  const veEsp = getRadio('ve-esp');
  const veCav = getRadio('ve-cav');
  const veDiast = getRadio('ve-diast');
  const aeAlt = state.mode.ae === 'alterado';
  const psapAlt = psap >= 35;

  // 1. Lesão valvar esquerda importante → lembrar AE aumentado + HP
  const vmImp = getRadio('vm-est') === 'Estenose importante' || getRadio('vm-refl') === 'Refluxo importante';
  const vaImp = getRadio('va-est') === 'Estenose importante' || getRadio('va-refl') === 'Refluxo importante';
  if (vmImp || vaImp) {
    const faltam = [];
    if (!aeAlt) faltam.push('átrio esquerdo aumentado');
    if (!psapAlt) faltam.push('hipertensão pulmonar (PSAP)');
    if (faltam.length) hints.push(`<b>Lesão valvar importante</b> costuma vir com: ${faltam.join(' e ')}. Confira se aplica.`);
  }

  // 2. FEVE < 40% → lembrar cavidade VE / diástole / refluxo mitral secundário
  if (feve !== null && feve < 40) {
    const faltam = [];
    if (veCav === 'normal') faltam.push('aumento da cavidade do VE');
    if (veDiast === 'normal') faltam.push('disfunção diastólica');
    const vmReflSec = document.getElementById('vm-refl-sec')?.checked;
    if (!vmReflSec) faltam.push('refluxo mitral secundário');
    if (faltam.length) hints.push(`<b>FEVE reduzida</b> costuma vir com: ${faltam.join(', ')}. Confira se aplica.`);
  }

  // 3. PSAP ≥ 50 → lembrar SÓ refluxo tricúspide (ajuste da Dra.)
  if (psap >= 50) {
    if (state.mode.vt !== 'alterado') hints.push('<b>PSAP elevada</b> costuma acompanhar refluxo tricúspide. Confira a valva tricúspide.');
  }

  // 4. Hipertrofia importante → lembrar SÓ disfunção diastólica (ajuste da Dra.)
  if (veEsp === 'hve-concentrica-imp' || veEsp === 'hve-concentrica-mod-imp') {
    if (veDiast === 'normal') hints.push('<b>Hipertrofia importante</b> costuma acompanhar disfunção diastólica. Confira a função diastólica.');
  }

  zone.innerHTML = hints.map(h => `<div class="correl-hint">💡 ${h}</div>`).join('');
}

// ════════════════════════════════════════
// CONTEXTUAL SUGGESTIONS (interatividade)
// ════════════════════════════════════════
function renderContextualSuggestions() {
  // VM
  const vmSug = document.getElementById('sugest-vm');
  if (vmSug) {
    let chips = [];
    const refl = getRadio('vm-refl');
    const est = getRadio('vm-est');
    if (refl === 'Refluxo importante' || est === 'Estenose importante')
      chips.push('Sugere-se avaliação com transesofágico');
    if (est === 'Estenose importante')
      chips.push('Considerar avaliação para intervenção');
    if (document.getElementById('vm-img-chk')?.checked)
      chips.push('Sugestivo de endocardite — complementar com ETE');
    vmSug.innerHTML = chips.length ? sugestRow('Sugestões pra adicionar na conclusão', chips, 'concl') : '';
  }
  // VA
  const vaSug = document.getElementById('sugest-va');
  if (vaSug) {
    let chips = [];
    const est = getRadio('va-est');
    const vmax = num('va-vmax');
    if (est === 'Estenose importante')
      chips.push('Considerar avaliação para troca valvar / TAVI');
    if (vmax && vmax >= 4)
      chips.push('Velocidade aórtica elevada — atenção a sintomas');
    vaSug.innerHTML = chips.length ? sugestRow('Sugestões pra conclusão', chips, 'concl') : '';
  }
  // PERI
  const periSug = document.getElementById('sugest-peri');
  if (periSug) {
    let chips = [];
    const peri = getRadio('peri');
    const rep = getRadio('peri-rep');
    if (peri === 'imp')
      chips.push('Sinais de tamponamento cardíaco');
    if (peri === 'imp' && rep === 'com')
      chips.push('Avaliar drenagem');
    if (peri === 'mod' || peri === 'imp')
      chips.push('Variação respiratória dos fluxos transvalvares');
    periSug.innerHTML = chips.length ? sugestRow('Sugestões pra conclusão', chips, 'concl') : '';
  }
  // CONCL
  const conclSug = document.getElementById('sugest-concl');
  if (conclSug) {
    let chips = [];
    const feve = num('ve-feve');
    const indic = document.getElementById('pac-indic').value.toLowerCase();
    if (feve !== null && feve < 30) chips.push('Sugere-se cintilografia miocárdica');
    if (feve !== null && feve < 40) chips.push('Considerar otimização do tratamento de IC');
    if (indic.includes('endocard')) chips.push('Indicado ecocardiograma transesofágico');
    if (indic.includes('iam') || indic.includes('isquem')) chips.push('Controle ecocardiográfico em 3 meses');
    chips.push('Controle ecocardiográfico em 6 meses');
    conclSug.innerHTML = chips.length ? sugestRow('Frases sugeridas pra conclusão', chips, 'concl-recom') : '';
  }
}

function sugestRow(label, chips, target) {
  const html = chips.map(c => `<button class="sugest-chip" onclick="appendToTarget('${target}', '${c.replace(/'/g, "\\'")}')">${c}</button>`).join('');
  return `<div class="sugest-row"><span class="sugest-label">💡 ${label}</span>${html}</div>`;
}

function appendToTarget(target, text) {
  let field;
  if (target === 'concl') {
    if (state.concl !== 'manual') setConclMode('manual');
    field = document.getElementById('concl-manual');
  } else if (target === 'concl-recom') {
    field = document.getElementById('recom');
  }
  if (field) {
    const cur = field.value.trim();
    field.value = cur ? cur + ' ' + text + '.' : text + '.';
    renderPreview();
  }
}

// ════════════════════════════════════════
// SEGMENTOS — lista usada pelo gerador de texto e pela UI de chips
// ════════════════════════════════════════
const SEG_REGIONS = {
  basal: ['basal-anterior','basal-anterosseptal','basal-inferosseptal','basal-inferior','basal-inferolateral','basal-anterolateral'],
  medio: ['mid-anterior','mid-anterosseptal','mid-inferosseptal','mid-inferior','mid-inferolateral','mid-anterolateral'],
  apical: ['ap-anterior','ap-septal','ap-inferior','ap-lateral','apex']
};

function initBullseye() {
  // Bind nos chips de segmento
  document.querySelectorAll('.seg-chip').forEach(chip => {
    chip.addEventListener('click', () => onSegClick(chip.dataset.seg));
  });
  // Bind no estado a aplicar (uma única vez)
  document.querySelectorAll('.seg-state').forEach(chip => {
    chip.addEventListener('click', () => {
      const st = chip.dataset.state;
      state.bullseyeActiveState = st;
      document.querySelectorAll('.seg-state').forEach(c => c.classList.remove('sel'));
      chip.classList.add('sel');
    });
  });
}

function onSegClick(segId) {
  const st = state.bullseyeActiveState;
  // se já está marcado com o mesmo estado, desmarca
  if (state.bullseye[segId] === st) delete state.bullseye[segId];
  else state.bullseye[segId] = st;
  refreshBullseye();
  renderPreview();
}

function refreshBullseye() {
  document.querySelectorAll('.seg-chip').forEach(chip => {
    const id = chip.dataset.seg;
    const st = state.bullseye[id];
    if (st) chip.setAttribute('data-marked', st);
    else chip.removeAttribute('data-marked');
  });
  // preview no painel dos segmentos
  const preview = document.getElementById('seg-preview');
  if (preview) {
    const txt = bullseyeText();
    if (txt) {
      preview.innerHTML = `<b>Pré-visualização:</b> ${txt}`;
      preview.classList.add('shown');
    } else {
      preview.classList.remove('shown');
    }
  }
}

function clearSegments() {
  state.bullseye = {};
  refreshBullseye();
  renderPreview();
}

function applyDiffuse() {
  // marca todos os 17 segmentos com o estado atual
  const all = [...SEG_REGIONS.basal, ...SEG_REGIONS.medio, ...SEG_REGIONS.apical];
  const st = state.bullseyeActiveState;
  all.forEach(id => { state.bullseye[id] = st; });
  refreshBullseye();
  renderPreview();
}

// aliases mantidos pra compatibilidade
function clearBullseye() { clearSegments(); }
function selectBullseyeState(s) {
  state.bullseyeActiveState = s;
  document.querySelectorAll('.seg-state').forEach(c => c.classList.toggle('sel', c.dataset.state === s));
}

// ════════════════════════════════════════
// BULLSEYE → TEXT
// ════════════════════════════════════════
function bullseyeText() {
  const segs = state.bullseye;
  if (Object.keys(segs).length === 0) return null;
  const byState = {};
  Object.entries(segs).forEach(([id, st]) => { (byState[st] = byState[st] || []).push(id); });
  const stateLabels = { hipocinesia:'Hipocinesia', acinesia:'Acinesia', discinesia:'Discinesia', aneurisma:'Aneurisma' };

  // detecção difusa: todos os 17 segmentos no mesmo estado
  const states = Object.keys(byState);
  if (states.length === 1 && byState[states[0]].length === 17) {
    const st = states[0];
    if (st === 'hipocinesia') return 'Hipocinesia difusa do VE.';
    if (st === 'acinesia') return 'Acinesia difusa do VE.';
    if (st === 'discinesia') return 'Discinesia difusa do VE.';
    if (st === 'aneurisma') return 'Aneurisma difuso do VE.';
  }

  const lines = [];
  ['aneurisma', 'discinesia', 'acinesia', 'hipocinesia'].forEach(st => {
    if (!byState[st]) return;
    lines.push(`${stateLabels[st]} ${describeSegments(byState[st])}`);
  });
  let text = lines.join('. ') + '.';
  if (Object.keys(segs).length < 17) text += ' Contratilidade preservada nas demais paredes.';
  return text;
}

function describeSegments(segIds) {
  if (segIds.length === 17) return 'difusa de todos os segmentos do VE';
  const apicalIds = ['ap-anterior','ap-septal','ap-inferior','ap-lateral','apex'];
  const basalIds = ['basal-anterior','basal-anterosseptal','basal-inferosseptal','basal-inferior','basal-inferolateral','basal-anterolateral'];
  const midIds = ['mid-anterior','mid-anterosseptal','mid-inferosseptal','mid-inferior','mid-inferolateral','mid-anterolateral'];
  const used = new Set();
  const parts = [];

  if (apicalIds.every(i => segIds.includes(i))) {
    parts.push('da região apical (ápex e segmentos apicais de todas as paredes)');
    apicalIds.forEach(i => used.add(i));
  }
  if (basalIds.every(i => segIds.includes(i) && !used.has(i))) {
    parts.push('de todos os segmentos basais');
    basalIds.forEach(i => used.add(i));
  }
  if (midIds.every(i => segIds.includes(i) && !used.has(i))) {
    parts.push('de todos os segmentos médios');
    midIds.forEach(i => used.add(i));
  }
  const fullWalls = {
    anterior: ['basal-anterior','mid-anterior','ap-anterior'],
    inferior: ['basal-inferior','mid-inferior','ap-inferior']
  };
  Object.entries(fullWalls).forEach(([wall, ids]) => {
    if (ids.every(i => segIds.includes(i) && !used.has(i))) {
      parts.push(`de toda a parede ${wall}`);
      ids.forEach(i => used.add(i));
    }
  });
  const wallsBM = {
    anterior:['basal-anterior','mid-anterior'],
    anterosseptal:['basal-anterosseptal','mid-anterosseptal'],
    inferosseptal:['basal-inferosseptal','mid-inferosseptal'],
    inferior:['basal-inferior','mid-inferior'],
    inferolateral:['basal-inferolateral','mid-inferolateral'],
    anterolateral:['basal-anterolateral','mid-anterolateral']
  };
  const wallsWithBM = [];
  Object.entries(wallsBM).forEach(([wall, ids]) => {
    if (ids.every(i => segIds.includes(i) && !used.has(i))) wallsWithBM.push({wall, ids});
  });
  if (wallsWithBM.length >= 2) {
    const names = wallsWithBM.map(w => w.wall);
    const last = names.pop();
    parts.push(`dos segmentos basal e médio das paredes ${names.join(', ')} e ${last}`);
    wallsWithBM.forEach(w => w.ids.forEach(i => used.add(i)));
  } else if (wallsWithBM.length === 1) {
    parts.push(`dos segmentos basal e médio da parede ${wallsWithBM[0].wall}`);
    wallsWithBM[0].ids.forEach(i => used.add(i));
  }
  const segNames = {
    'basal-anterior':'segmento basal anterior', 'basal-anterosseptal':'segmento basal anterosseptal',
    'basal-inferosseptal':'segmento basal inferosseptal', 'basal-inferior':'segmento basal inferior',
    'basal-inferolateral':'segmento basal inferolateral', 'basal-anterolateral':'segmento basal anterolateral',
    'mid-anterior':'segmento médio anterior', 'mid-anterosseptal':'segmento médio anterosseptal',
    'mid-inferosseptal':'segmento médio inferosseptal', 'mid-inferior':'segmento médio inferior',
    'mid-inferolateral':'segmento médio inferolateral', 'mid-anterolateral':'segmento médio anterolateral',
    'ap-anterior':'segmento apical anterior', 'ap-septal':'segmento apical septal',
    'ap-inferior':'segmento apical inferior', 'ap-lateral':'segmento apical lateral',
    'apex':'ápex'
  };
  const remaining = segIds.filter(i => !used.has(i));
  if (remaining.length) {
    const names = remaining.map(i => segNames[i]);
    if (names.length === 1) parts.push(`do ${names[0]}`);
    else { const last = names.pop(); parts.push(`dos ${names.join(', ')} e ${last}`); }
  }
  return parts.join(', ');
}

// ════════════════════════════════════════
// CLASSIFICAÇÃO AORTA
// ════════════════════════════════════════
function classifyAoRaiz(v) {
  if (!v || v <= 37) return null;
  if (v <= 44) return 'discreta';
  if (v <= 51) return 'moderada';
  return 'importante';
}
function classifyAoAsc(v) {
  if (!v || v <= 35) return null;
  if (v <= 42) return 'discreta';
  if (v <= 49) return 'moderada';
  return 'importante';
}

// ════════════════════════════════════════
// REPORT GENERATION
// ════════════════════════════════════════
function genReport() {
  const R = { measures:[], sections:[], conclusao:'', recom:'', extras:[] };
  const altered = [];

  // medidas
  const aoraiz = num('m-aoraiz'); if (aoraiz) R.measures.push(`AO= ${aoraiz}mm`);
  const aoasc = num('m-aoasc');
  const ae = num('m-ae'); if (ae) R.measures.push(`AE= ${ae}mm`);
  const aevol = num('ae-vol'); if (aevol) R.measures.push(`Vol AE indexado= ${aevol}ml/m²`);
  const ved = num('m-ved'); if (ved) R.measures.push(`VEd= ${ved}mm`);
  const ves = num('m-ves'); if (ves) R.measures.push(`VEs= ${ves}mm`);
  const siv = num('m-siv'); if (siv) R.measures.push(`Septo= ${siv}mm`);
  const pp = num('m-pp'); if (pp) R.measures.push(`Parede posterior = ${pp}mm`);
  const massa = document.getElementById('m-massa').value;
  const erp = document.getElementById('m-erp').value;
  if (massa && erp) R.measures.push(`Massa= ${massa}g/m²; ERP= ${erp}`);

  R.indic = document.getElementById('pac-indic').value.trim();
  R.ritmo = document.getElementById('pac-ritmo').value;
  const fc = num('pac-fc');
  if (fc) R.ritmo += ` (FC: ${fc}bpm)`;
  R.janela = document.getElementById('pac-janela').value;
  R.beira = document.getElementById('pac-beira') && document.getElementById('pac-beira').checked;
  if (R.beira) {
    let frase = 'Exame realizado beira-leito';
    const iotvm = document.getElementById('uti-iotvm')?.checked;
    const drogas = [];
    [['uti-nora','uti-nora-dose','noradrenalina'],['uti-dobu','uti-dobu-dose','dobutamina'],['uti-vaso','uti-vaso-dose','vasopressina']].forEach(([ck,ds,nome]) => {
      if (document.getElementById(ck)?.checked) {
        const dose = document.getElementById(ds)?.value.trim();
        drogas.push(dose ? `${nome} ${dose} ml/h` : nome);
      }
    });
    const partes = [];
    if (iotvm) partes.push('sob IOT/VM');
    if (drogas.length) {
      const last = drogas.pop();
      const lista = drogas.length ? drogas.join(', ') + ' e ' + last : last;
      partes.push('em uso de ' + lista);
    }
    if (partes.length) frase += ' com paciente ' + partes.join(' e ');
    R.beiraTxt = frase + '.';
  }

  // AORTA TORÁCICA
  const raizClass = classifyAoRaiz(aoraiz);
  const ascClass = classifyAoAsc(aoasc);
  const extraChs = state.mode.aorta === 'alterado' ? getChecksGrid('opts-aorta') : [];
  const obsAorta = state.mode.aorta === 'alterado' ? document.getElementById('obs-aorta').value.trim() : '';

  let aortaTxt = '';
  const allNormalNoExtra = !raizClass && !ascClass && extraChs.length === 0 && !obsAorta;
  const fluxoPulsat = extraChs.includes('Fluxo e pulsatilidade normais');
  const otherExtras = extraChs.filter(c => c !== 'Fluxo e pulsatilidade normais');

  if (allNormalNoExtra) {
    aortaTxt = 'Raiz da aorta, aorta ascendente e arco aórtico com diâmetros normais.';
  } else {
    let partes = [];
    const aoTermo = (document.getElementById('aorta-termo') && document.getElementById('aorta-termo').value) || 'Dilatação';
    if (raizClass) partes.push(`${aoTermo} ${raizClass} da raiz da aorta${aoraiz ? ` (${aoraiz}mm)` : ''}`);
    if (ascClass) partes.push(`${aoTermo} ${ascClass} da aorta ascendente${aoasc ? ` (${aoasc}mm)` : ''}`);
    const normais = [];
    if (!raizClass && aoraiz) normais.push('raiz da aorta');
    if (!ascClass && aoasc && !otherExtras.includes('Ascendente não visualizada adequadamente')) normais.push('aorta ascendente');
    if (!otherExtras.includes('Arco aórtico não visualizado adequadamente')) normais.push('arco aórtico');
    if (normais.length === 3) partes.push('Raiz da aorta, aorta ascendente e arco aórtico com diâmetros normais');
    else if (normais.length === 2) partes.push(`${capitalize(normais[0])} e ${normais[1]} com diâmetros normais`);
    else if (normais.length === 1) partes.push(`${capitalize(normais[0])} com diâmetro normal`);
    if (otherExtras.includes('Arco aórtico não visualizado adequadamente')) partes.push('Arco aórtico não visualizado adequadamente');
    if (otherExtras.includes('Ascendente não visualizada adequadamente')) partes.push('Aorta ascendente não visualizada adequadamente');
    if (otherExtras.includes('Tubo protético em aorta ascendente')) partes.push('Aorta ascendente com tubo protético em seu interior, apresentando fluxo normal');
    const outros = otherExtras.filter(c => !['Arco aórtico não visualizado adequadamente','Ascendente não visualizada adequadamente','Tubo protético em aorta ascendente'].includes(c));
    if (outros.length) partes.push(outros.join('. '));
    aortaTxt = partes.join('. ') + '.';
    if (obsAorta) aortaTxt += ' ' + obsAorta;
    if (raizClass || ascClass) altered.push('aorta');
  }
  if (fluxoPulsat) aortaTxt += ' Fluxo e pulsatilidade normais.';
  R.sections.push({ lbl:'AORTA TORÁCICA', txt:aortaTxt });

  // AE
  if (state.mode.ae === 'alterado') {
    const grau = getRadio('ae-grau') || 'Aumento';
    let t = grau;
    if (aevol) t += ` (volume indexado= ${aevol}ml/m²)`;
    R.sections.push({ lbl:'ÁTRIO ESQUERDO', txt: t + '.' });
    altered.push('ae');
  } else {
    let t = 'Dimensões normais';
    if (aevol) t += ` (volume indexado= ${aevol}ml/m²)`;
    R.sections.push({ lbl:'ÁTRIO ESQUERDO', txt: t + '.' });
  }

  // VE
  const veEsp = getRadio('ve-esp') || 'preservada';
  const veCav = getRadio('ve-cav') || 'normal';
  const veSist = getRadio('ve-sist') || 'preservada';
  const veMot = getRadio('ve-mot') || 'preservada';
  const veDiast = getRadio('ve-diast') || 'normal';
  const veFeve = num('ve-feve');
  const veFeveMet = document.getElementById('ve-feve-met').value;
  const veEe = num('ve-ee');

  const espMap = {
    'preservada':'Espessura miocárdica preservada.',
    'remodelamento':'Remodelamento concêntrico.',
    'hve-concentrica-disc':'Hipertrofia concêntrica discreta.',
    'hve-concentrica-disc-mod':'Hipertrofia concêntrica discreta a moderada.',
    'hve-concentrica-mod':'Hipertrofia concêntrica moderada.',
    'hve-concentrica-mod-imp':'Hipertrofia concêntrica moderada a importante.',
    'hve-concentrica-imp':'Hipertrofia concêntrica importante.',
    'hve-excentrica':'Hipertrofia excêntrica.',
    'hve-descritiva':'Aumento moderado e simétrico da espessura miocárdica.'
  };
  const cavMap = {
    'normal':'Cavidade ventricular com diâmetro normal.',
    'aumento-disc':'Aumento discreto da cavidade ventricular.',
    'aumento-mod':'Aumento moderado da cavidade ventricular.',
    'aumento-imp':'Aumento importante da cavidade ventricular.'
  };
  const veLines = [espMap[veEsp], cavMap[veCav]];
  if (veEsp !== 'preservada') altered.push('ve-esp');
  if (veCav !== 'normal') altered.push('ve-cav');

  const veSeptoMorf = getRadio('ve-septomorf');
  if (veSeptoMorf) { veLines.push(veSeptoMorf); altered.push('ve-septomorf'); }

  let motText = '';
  if (veMot === 'alterada' && Object.keys(state.bullseye).length) motText = bullseyeText();

  let sistLine;
  const metPart = veFeveMet === 'Simpson' ? 'pelo método de Simpson' : veFeveMet === 'Teicholz' ? 'pelo método de Teicholz' : 'pelo método de Teicholz - janela limitada para Simpson';

  if (motText) {
    veLines.push(motText);
    const map = {
      'preservada':'Função sistólica global preservada',
      'disc-reduzida':'Disfunção sistólica discreta',
      'mod-reduzida':'Disfunção sistólica moderada',
      'imp-reduzida':'Disfunção sistólica importante'
    };
    sistLine = map[veSist];
    if (veFeve !== null) {
      sistLine += veSist === 'preservada' ? `, estimada em ${veFeve}% ${metPart}` : ` (FEVE= ${veFeve}% ${metPart})`;
    }
    sistLine += '.';
  } else {
    const map = {
      'preservada':'Contratilidade miocárdica segmentar e função sistólica preservadas',
      'disc-reduzida':'Contratilidade miocárdica segmentar preservada e função sistólica discretamente reduzida',
      'mod-reduzida':'Contratilidade miocárdica segmentar preservada e função sistólica moderadamente reduzida',
      'imp-reduzida':'Contratilidade miocárdica segmentar preservada e função sistólica importante reduzida'
    };
    sistLine = map[veSist];
    if (veFeve !== null) sistLine += ` (FEVE= ${veFeve}% ${metPart})`;
    sistLine += '.';
  }
  veLines.push(sistLine);
  if (veSist !== 'preservada' || veMot !== 'preservada') altered.push('ve-sist');

  const diastMap = {
    'normal':'Função diastólica normal.',
    'grau-1':'Disfunção diastólica grau I.',
    'grau-2':'Disfunção diastólica grau II.',
    'grau-3':'Disfunção diastólica grau III.',
    'indet':'Função diastólica indeterminada.',
    'na-mp':'Padrão diastólico não avaliado devido ao marcapasso.',
    'na-valv':'Padrão diastólico não avaliado devido à valvopatia mitral.'
  };
  let diastLine = diastMap[veDiast];
  if (veEe !== null && veDiast !== 'na-mp' && veDiast !== 'na-valv') {
    diastLine = diastLine.replace('.', ` (E/e' médio= ${fmt(veEe, 1)}).`);
  }
  veLines.push(diastLine);
  if (veDiast !== 'normal') altered.push('ve-diast');

  // Pressões de enchimento
  const presEnch = document.querySelector('input[name="ve-pres-ench"]:checked');
  if (presEnch) {
    veLines.push('Há sinais de aumento das pressões de enchimento.');
    altered.push('ve-pres-ench');
  }

  // Contraste espontâneo no VE
  const veContraste = getRadio('ve-contraste');
  if (veContraste) {
    veLines.push(`Presença de contraste espontâneo ${veContraste}.`);
    altered.push('ve-contraste');
  }

  R.sections.push({ lbl:'VENTRÍCULO ESQUERDO', txt:veLines.join(' ') });

  // AD
  if (state.mode.ad === 'alterado') {
    const grau = getRadio('ad-grau') || 'Aumento';
    const advol = num('ad-vol');
    let t = grau;
    if (advol) t += ` (volume indexado= ${advol}ml/m²)`;
    R.sections.push({ lbl:'ÁTRIO DIREITO', txt: t + '.' });
    altered.push('ad');
  } else R.sections.push({ lbl:'ÁTRIO DIREITO', txt:'Dimensões normais.' });

  // VD
  const vdDim = getRadio('vd-dim') || 'normal';
  const vdFunc = getRadio('vd-func') || 'normal';
  const tapse = num('vd-tapse');
  const vdObs = getChecks('vd-obs');
  let vdTxt;
  if (vdDim === 'normal' && vdFunc === 'normal') vdTxt = 'Dimensões e função sistólica preservadas.';
  else {
    const dimMap = { 'normal':'Dimensões normais', 'aumento-disc':'Aumento discreto', 'aumento-mod':'Aumento moderado', 'aumento-imp':'Aumento importante' };
    const funcMap = { 'normal':'função sistólica preservada', 'disf-disc':'disfunção sistólica discreta', 'disf-mod':'disfunção sistólica moderada', 'disf-imp':'disfunção sistólica importante' };
    vdTxt = `${dimMap[vdDim]} do ventrículo direito, com ${funcMap[vdFunc]}.`;
    altered.push('vd');
  }
  if (tapse) vdTxt += ` TAPSE= ${tapse}mm.`;
  const vdS = num('vd-s');
  if (vdS !== null) vdTxt += ` Onda S' = ${fmt(vdS, 1)}cm/s.`;
  if (vdObs.length) vdTxt += ' ' + vdObs.join(' ');
  R.sections.push({ lbl:'VENTRÍCULO DIREITO', txt:vdTxt });

  // VM
  R.sections.push(buildMitralSection(altered));
  // VA
  R.sections.push(buildAorticaSection(altered));

  // VT
  if (state.mode.vt === 'alterado') {
    const refl = getRadio('vt-refl');
    const causa = getRadio('vt-refl-causa');
    let reflTxt = (refl || 'refluxo').toLowerCase();
    if (causa) reflTxt += ` (${causa})`;
    R.sections.push({ lbl:'VALVA TRICÚSPIDE', txt:`Cúspides finas, abertura e mobilidade preservadas. Ao Doppler exibe ${reflTxt}, sem gradiente transvalvar significativo.` });
    if (refl && refl !== 'Refluxo mínimo') altered.push('vt');
  } else R.sections.push({ lbl:'VALVA TRICÚSPIDE', txt:'Cúspides finas, abertura e mobilidade preservadas. Ao Doppler não exibe refluxo, sem gradiente transvalvar significativo.' });

  // VP + PSAP
  const vpBase = getRadio('vp-base') || 'normal';
  const vpAlts = getChecks('vp-alt');
  const vtVmax = num('vt-vmax');
  const psapStr = document.getElementById('vt-psap').value;
  const psapNum = parseFloat((psapStr || '0').replace(',', '.'));

  let vpBaseTxt;
  if (vpBase === 'normal') vpBaseTxt = 'Sem anormalidades morfofuncionais. Fluxo transvalvar fisiológico';
  else {
    vpBaseTxt = vpAlts.length ? vpAlts.join('. ') : 'Avaliação morfofuncional alterada';
    altered.push('vp');
  }
  let psapLine;
  if (psapStr && vtVmax) {
    const prefix = psapNum < 35 ? 'Ausência de sinais de hipertensão pulmonar' : 'Sinais de hipertensão pulmonar';
    psapLine = `${prefix} (PSAP= ${psapStr}mmHg, estimada pelo refluxo tricuspídeo - velocidade máxima do refluxo= ${fmt(vtVmax,1)}m/seg).`;
    if (psapNum >= 35) altered.push('psap');
  } else if (psapStr) {
    psapLine = psapNum < 35 ? `Ausência de sinais de hipertensão pulmonar (PSAP= ${psapStr}mmHg).` : `Sinais de hipertensão pulmonar (PSAP= ${psapStr}mmHg).`;
    if (psapNum >= 35) altered.push('psap');
  } else psapLine = 'Ausência de sinais de hipertensão pulmonar.';
  R.sections.push({ lbl:'VALVA PULMONAR', txt: vpBaseTxt + '. ' + psapLine });

  // PERICÁRDIO
  const peri = getRadio('peri') || 'normal';
  if (peri === 'normal') R.sections.push({ lbl:'PERICÁRDIO', txt:'Ausência de derrame pericárdico.' });
  else if (peri === 'espess') { R.sections.push({ lbl:'PERICÁRDIO', txt:'Pericárdio espessado.' }); altered.push('peri:espess'); }
  else if (peri === 'laminar') { R.sections.push({ lbl:'PERICÁRDIO', txt:'Derrame pericárdico laminar.' }); altered.push('peri:laminar'); }
  else {
    const grauMap = { 'disc':'discreto', 'mod':'moderado', 'imp':'importante' };
    const loc = getRadio('peri-loc') || 'circunferencial';
    const rep = getRadio('peri-rep') || 'sem';
    const mm = num('peri-mm');
    const qual = document.getElementById('peri-qual').value;
    let t = `Presença de derrame pericárdico de grau ${grauMap[peri]}`;
    if (mm) t += ` (${mm}mm)`;
    if (qual) t += `, ${qual}`;
    t += `, ${loc}`;
    if (rep === 'restricao') t += '. Não há sinais de restrição miocárdica.';
    else { t += rep === 'com' ? ', com sinais de repercussão hemodinâmica.' : ', sem sinais de repercussão hemodinâmica.'; }
    R.sections.push({ lbl:'PERICÁRDIO', txt:t });
    altered.push('peri:' + peri);
  }

  // SEPTOS
  const sep = getRadio('septo') || 'normal';
  const sepMap = {
    'normal':'Não foi visualizado shunt ao Doppler colorido.',
    'fop':'Sinais sugestivos de forame oval patente / pequena CIA do tipo ostium secundum.',
    'fop-pos-ablacao':'Presença de shunt interatrial esquerda direita na lâmina da fossa oval compatível com status pós procedimento (ablação de fibrilação atrial prévia).',
    'cia':'Comunicação interatrial com shunt ao Doppler colorido.',
    'civ':'Comunicação interventricular ao Doppler colorido.'
  };
  let septoTxt = sepMap[sep];

  // Microbolhas
  const micro = getRadio('septo-micro');
  if (micro === 'negativa') {
    septoTxt += ' Pesquisa de shunt intracardíaco com contraste salino agitado (microbolhas): ausência de passagem de microbolhas do lado direito para o lado esquerdo das cavidades cardíacas.';
  } else if (micro === 'positiva') {
    septoTxt += ' Pesquisa de shunt intracardíaco com contraste salino agitado (microbolhas): presença de passagem de microbolhas do lado direito para o lado esquerdo das cavidades cardíacas.';
    altered.push('septo:micro-pos');
  }

  R.sections.push({ lbl:'SEPTO INTERVENTRICULAR E INTERATRIAL', txt:septoTxt });
  if (sep !== 'normal') altered.push('septo:' + sep);

  const septoIa = getRadio('septo-ia');
  if (septoIa) {
    // anexa à frase de septos já adicionada
    R.sections[R.sections.length - 1].txt += ' ' + septoIa;
    altered.push('septo-ia');
  }

  // VCI (linha solta)
  if (state.mode.vci !== 'omitir') {
    const vci = getRadio('vci') || 'normal';
    const vciMm = num('vci-mm');
    let vciTxt;
    if (vciMm) vciTxt = `Veia cava inferior medindo ${vciMm}mm.`;
    else {
      const m = {
        'normal':'Veia cava inferior com diâmetro normal e variação respiratória preservada.',
        'dilatada-colapso':'Veia cava inferior com diâmetro aumentado e colapso respiratório reduzido.',
        'dilatada-sem-colapso':'Veia cava inferior com diâmetro aumentado e sem colapso respiratório.',
        'pletorica':'Veia cava inferior pletórica.'
      };
      vciTxt = m[vci];
    }
    R.extras.push(vciTxt);
    if (vci !== 'normal') altered.push('vci');
  }

  // Trombo/massa intracavitária (texto livre com dimensões)
  const massaTxt = document.getElementById('achado-massa') ? document.getElementById('achado-massa').value.trim() : '';
  if (massaTxt) {
    R.extras.push(massaTxt.endsWith('.') ? massaTxt : massaTxt + '.');
    altered.push('massa');
  }

  // Derrame pleural (achado extracardíaco)
  const plE = document.getElementById('achado-pleural-e')?.checked;
  const plD = document.getElementById('achado-pleural-d')?.checked;
  const plB = document.getElementById('achado-pleural-bilat')?.checked;
  if (plB) { R.extras.push('Achado extracardíaco: derrame pleural bilateral.'); altered.push('pleural'); }
  else if (plE && plD) { R.extras.push('Achado extracardíaco: derrame pleural bilateral.'); altered.push('pleural'); }
  else if (plE) { R.extras.push('Achado extracardíaco: derrame pleural à esquerda.'); altered.push('pleural'); }
  else if (plD) { R.extras.push('Achado extracardíaco: derrame pleural à direita.'); altered.push('pleural'); }

  // ETE
  if (state.tipo === 'ETE') {
    const veias = getRadio('ete-veias') || 'normal';
    const apend = getRadio('ete-apend') || 'normocontrátil';
    const trombos = getRadio('ete-trombos') || 'ausencia';
    const veg = getRadio('ete-veg') || 'ausencia';
    const eteObs = document.getElementById('ete-obs').value.trim();

    const veiasMap = {
      'normal':'Drenagem normal das veias pulmonares.',
      'habitual':'Drenagem habitual das veias pulmonares.',
      'anomala':'Drenagem anômala das veias pulmonares.'
    };
    R.eteLines = [
      veiasMap[veias],
      `Apêndice atrial esquerdo ${apend}.`,
      trombos === 'ausencia' ? 'Ausência de imagens sugestivas de trombos.' : 'Presença de imagens sugestivas de trombos.',
      veg === 'ausencia' ? 'Ausência de imagens sugestivas de vegetação.' : 'Presença de imagens sugestivas de vegetação.'
    ];
    if (eteObs) R.eteLines.push(eteObs);
    if (trombos === 'presenca') altered.push('ete:trombo');
    if (veg === 'presenca') altered.push('ete:veg');
    if (veias === 'anomala') altered.push('ete:veias');
    if (apend !== 'normocontrátil') altered.push('ete:apend');
  }

  // CONCL
  if (state.concl === 'manual') R.conclusao = document.getElementById('concl-manual').value.trim();
  else R.conclusao = altered.length === 0 ? 'Exame dentro dos parâmetros da normalidade.' : genAutoConcl(altered);
  const comparar = document.getElementById('concl-comparar')?.checked;
  if (comparar && R.conclusao) {
    R.conclusao += (R.conclusao.endsWith('.') ? '' : '.') + ' Obs.: não houve alteração significativa em relação ao exame anterior.';
  }
  R.recom = document.getElementById('recom').value.trim();
  return R;
}

function buildMitralSection(altered) {
  const m = state.mode.vm;
  if (m === 'protese') {
    const tipo = getRadio('vm-prot-tipo') || 'Prótese em posição mitral';
    const func = getRadio('vm-prot-func') || 'normofuncionante';
    const perival = getRadio('vm-prot-perival');
    const adds = getChecks('vm-prot-add');
    const gradMax = num('vm-prot-grad-max');
    const grad = num('vm-prot-grad');
    const area = num('vm-prot-area');
    let parts = [tipo, func === 'disfuncionante' ? 'com sinais de disfunção' : 'normofuncionante'];
    if (perival) parts.push(perival.toLowerCase());
    if (adds.length) parts.push(adds.join(', ').toLowerCase());
    const np = [];
    if (gradMax !== null && grad !== null) np.push(`gradiente máximo= ${gradMax}mmHg e médio= ${grad}mmHg`);
    else if (gradMax !== null) np.push(`gradiente máximo= ${gradMax}mmHg`);
    else if (grad !== null) np.push(`gradiente médio= ${grad}mmHg`);
    if (area) np.push(`área valvar efetiva= ${area}cm²`);
    let t = parts.join(', ').replace(/^./, c => c.toUpperCase()) + '.';
    if (np.length) t += ` ${np.join('; ')}.`;
    altered.push('vm-prot');
    return { lbl:'VALVA MITRAL', txt:t };
  }
  if (m === 'alterado') {
    const morf = getChecks('vm-morf');
    const calc = getRadio('vm-calc');
    const imgChecked = document.getElementById('vm-img-chk')?.checked;
    const imgSize = num('vm-img-size');
    const imgFace = document.getElementById('vm-img-face').value;
    const vegChecked = document.getElementById('vm-veg-chk')?.checked;
    const vegSize = num('vm-veg-size');
    const cuspChecked = document.getElementById('vm-cusp-chk')?.checked;
    const cuspAnt = document.getElementById('vm-cusp-ant').value.trim();
    const cuspPost = document.getElementById('vm-cusp-post').value.trim();
    const refl = getRadio('vm-refl');
    const reflTipos = getChecks('vm-refl-tipo');
    const reflSec = document.getElementById('vm-refl-sec')?.checked;
    const reflCausa = getRadio('vm-refl-causa');
    const vena = num('vm-vena');
    const wMob = document.getElementById('vm-wilk-mob')?.value;
    const wSub = document.getElementById('vm-wilk-sub')?.value;
    const wFol = document.getElementById('vm-wilk-fol')?.value;
    const wCalc = document.getElementById('vm-wilk-calc')?.value;
    const est = getRadio('vm-est');
    const gradMax = num('vm-grad-max');
    const grad = num('vm-grad');
    const area = num('vm-area');
    const gradTipo = document.getElementById('vm-grad-tipo')?.value ?? 'AE-VE';
    const areaMet = document.getElementById('vm-area-met')?.value ?? 'PHT';

    // morfologia base + adicionais
    let cuspideBase = 'Cúspides finas';
    let modif = [];
    const hasDomo = morf.includes('reumática-domo');
    const hasFusao = morf.includes('fusão comissural');
    morf.forEach(m => {
      if (m === 'discretamente espessadas') cuspideBase = 'Cúspides discretamente espessadas';
      else if (m === 'espessadas') cuspideBase = 'Cúspides espessadas';
      else if (m === 'reumática-domo' || m === 'fusão comissural') { /* tratados à parte */ }
      else modif.push(m);
    });

    // Detecção de endocardite: "Presença de prolapso..."
    const hasProlapsoAmbas = morf.includes('com prolapso de ambas as cúspides');
    const hasDisjuncao = morf.includes('com disjunção do anel valvar');

    let morfLine;
    if (hasProlapsoAmbas && hasDisjuncao) {
      // padrão da Dra: começa com "Presença de prolapso..."
      modif = modif.filter(x => x !== 'com prolapso de ambas as cúspides' && x !== 'com disjunção do anel valvar');
      morfLine = 'Presença de prolapso de ambas as cúspides e disjunção do anel valvar. A abertura valvar é preservada';
      if (modif.length) morfLine += '. ' + capitalize(modif.join(', '));
    } else if (hasProlapsoAmbas) {
      modif = modif.filter(x => x !== 'com prolapso de ambas as cúspides');
      morfLine = 'Presença de prolapso de ambas as cúspides. A abertura valvar é preservada';
      if (modif.length) morfLine += '. ' + capitalize(modif.join(', '));
    } else if (hasDisjuncao) {
      modif = modif.filter(x => x !== 'com disjunção do anel valvar');
      morfLine = `${cuspideBase}, com disjunção do anel valvar`;
      if (modif.length) morfLine += ', ' + modif.join(', ');
      morfLine += '. Abertura preservada';
    } else {
      morfLine = cuspideBase + (modif.length ? ', ' + modif.join(', ') : '') + '. Abertura preservada';
    }

    // Morfologia reumática: substitui "Abertura preservada" pela descrição em domo
    if (hasDomo) {
      morfLine = morfLine.replace(/\.?\s*Abertura preservada$/,
        ', com abertura em domo da cúspide anterior e mobilidade reduzida da cúspide posterior');
      if (!/em domo/.test(morfLine)) morfLine += ', com abertura em domo da cúspide anterior e mobilidade reduzida da cúspide posterior';
    }
    if (hasFusao) morfLine += '. Presença de fusão comissural';

    // Calcificação como frase separada
    if (calc) morfLine += `. ${calc}`;

    // Imagem ecogênica móvel
    if (imgChecked) {
      const sizeTxt = imgSize ? `${imgSize}mm` : 'X mm';
      morfLine += `. Presença de imagem ecogênica móvel aderida à face ${imgFace} da cúspide, medindo cerca de ${sizeTxt} em seu maior eixo`;
    }

    // Vegetação algodonosa
    if (vegChecked) {
      const sizeTxt = vegSize ? `${vegSize}mm` : 'X mm';
      morfLine += `. Presença de imagem de aspecto algodonoso, filamentar e móvel, medindo ${sizeTxt}, que pode corresponder a vegetação`;
    }

    // Doppler
    let dopplerLine;
    if (refl) {
      dopplerLine = `Ao Doppler exibe ${refl.toLowerCase()}`;
      if (reflCausa) dopplerLine += ` (${reflCausa})`;
      else if (reflSec) dopplerLine += ' (secundário)';
      if (reflTipos.length) dopplerLine += ' ' + reflTipos.join(' e ');
      if (vena !== null) dopplerLine += ` (vena contracta= ${fmt(vena, 1)}mm)`;
    } else dopplerLine = 'Ao Doppler não exibe refluxo';

    // Gradientes com prefixo
    const np = [];
    const prefix = gradTipo ? `Gradiente ${gradTipo}` : 'Gradiente';
    if (gradMax !== null && grad !== null) np.push(`${prefix} máximo= ${gradMax}mmHg e médio= ${grad}mmHg`);
    else if (gradMax !== null) np.push(`${prefix} máximo= ${gradMax}mmHg`);
    else if (grad !== null) np.push(`${prefix} médio= ${grad}mmHg`);

    if (area) {
      const aTxt = areaMet ? `Área valvar (${areaMet}) = ${area}cm²` : `Área valvar = ${area}cm²`;
      np.push(aTxt);
    }

    if (est) {
      let eTxt = est.toLowerCase();
      if (np.length) eTxt += `. ${np.join('. ')}`;
      dopplerLine += ', com ' + eTxt;
    } else {
      if (np.length) dopplerLine += `. ${np.join('. ')}`;
      else dopplerLine += ', sem gradiente transvalvar significativo';
    }

    // Espessamento margens livres (frase final, posição própria)
    let finalSentence = '';
    if (cuspChecked && (cuspAnt || cuspPost)) {
      let medidasTxt = [];
      if (cuspAnt) medidasTxt.push(`${cuspAnt} da cúspide anterior`);
      if (cuspPost) medidasTxt.push(`${cuspPost} da cúspide posterior`);
      finalSentence = ` As cúspides são espessadas apenas em suas margens livres com medidas de ${medidasTxt.join(' e ')}, que podem corresponder a vegetação. Os segmentos basal e médio da cúspide possui sua espessura preservada.`;
    }

    altered.push('vm');
    let wilkinsSentence = '';
    if (wMob && wSub && wFol && wCalc) {
      const soma = Number(wMob) + Number(wSub) + Number(wFol) + Number(wCalc);
      wilkinsSentence = ` Escore Wilkins: ${soma} (mobilidade=${wMob}; subvalvar=${wSub}; folhetos=${wFol}; calcificacao=${wCalc}).`;
    }
    return { lbl:'VALVA MITRAL', txt:`${morfLine}. ${dopplerLine}.${finalSentence}${wilkinsSentence}` };
  }
  return { lbl:'VALVA MITRAL', txt:'Cúspides finas, abertura e mobilidade preservadas. Ao Doppler não exibe refluxo, sem gradiente transvalvar significativo.' };
}

function buildAorticaSection(altered) {
  const m = state.mode.va;
  const vaAnat = getRadio('va-anat') || 'trivalvular';
  if (m === 'protese') {
    const tipo = getRadio('va-prot-tipo') || 'Prótese em posição aórtica';
    const func = getRadio('va-prot-func') || 'normofuncionante';
    const perival = getRadio('va-prot-perival');
    const vmax = num('va-prot-vmax');
    const gradMax = num('va-prot-grad-max');
    const grad = num('va-prot-grad');
    const area = num('va-prot-area');
    let parts = [tipo, func === 'disfuncionante' ? 'com sinais de disfunção' : 'normofuncionante'];
    if (perival) parts.push(perival.toLowerCase());
    const np = [];
    if (vmax) np.push(`Vmax= ${vmax}m/s`);
    if (gradMax !== null && grad !== null) np.push(`gradiente máximo= ${gradMax}mmHg e médio= ${grad}mmHg`);
    else if (gradMax !== null) np.push(`gradiente máximo= ${gradMax}mmHg`);
    else if (grad !== null) np.push(`gradiente médio= ${grad}mmHg`);
    if (area) np.push(`área valvar efetiva= ${area}cm²`);
    let t = parts.join(', ').replace(/^./, c => c.toUpperCase()) + '.';
    if (np.length) t += ` ${np.join('; ')}.`;
    altered.push('va-prot');
    return { lbl:'VALVA AÓRTICA', txt:t };
  }
  if (m === 'alterado') {
    const morf = getChecks('va-morf');
    const refl = getRadio('va-refl');
    const est = getRadio('va-est');
    const vmax = num('va-vmax');
    const gradMax = num('va-grad-max');
    const grad = num('va-grad');
    const area = num('va-area');
    const gradTipo = document.getElementById('va-grad-tipo')?.value ?? 'sistólico';
    const areaMet = document.getElementById('va-area-met')?.value ?? 'Equação de Continuidade';

    let base = vaAnat === 'bicuspide' ? 'Valva aórtica bicúspide' : 'Trivalvular';
    let cuspideDesc = 'com válvulas finas';
    let modif = [];
    let aoDomo = false;
    let aoCalcExtensa = false;
    morf.forEach(m => {
      if (m === 'discretamente espessadas') cuspideDesc = 'com válvulas discretamente espessadas';
      else if (m === 'espessadas') cuspideDesc = 'com válvulas espessadas';
      else if (m === 'calcificadas') modif.push('com calcificação');
      else if (m === 'pontos de calcificação') modif.push('pontos de calcificação');
      else if (m === 'calcificação nas bordas livres') modif.push('com calcificação nas bordas livres');
      else if (m === 'abertura em domo') aoDomo = true;
      else if (m === 'extensa calcificação degenerativa') aoCalcExtensa = true;
      else if (m === 'janela limitada') modif.push('não foi possível avaliar sua morfologia devido janela acústica limitada');
      else modif.push(m);
    });
    let morfLine;
    if (aoCalcExtensa) {
      // redação própria da Dra para estenose aórtica calcificada degenerativa
      morfLine = `${base} ${cuspideDesc}`.replace('com válvulas finas', 'com válvulas');
      morfLine += (modif.length ? ', ' + modif.join(', ') : '') + '. Análise morfológica de difícil avaliação devido a extensa calcificação. Abertura valvar significativamente reduzida';
    } else {
      const fechoAbertura = aoDomo ? 'abertura em domo' : 'abertura e mobilidade preservadas';
      morfLine = `${base} ${cuspideDesc}` + (modif.length ? ', ' + modif.join(', ') : '') + ', ' + fechoAbertura;
    }

    let dopplerLine = refl ? `Ao Doppler exibe ${refl.toLowerCase()}` : 'Ao Doppler não exibe refluxo';
    const vaReflCausa = getRadio('va-refl-causa');
    if (refl && vaReflCausa) dopplerLine += ` (${vaReflCausa})`;

    const np = [];
    if (vmax) np.push(`Vmax= ${vmax}m/s`);
    const prefix = gradTipo ? `Gradiente ${gradTipo}` : 'Gradiente';
    if (gradMax !== null && grad !== null) np.push(`${prefix} máximo de ${gradMax}mmHg e médio de ${grad}mmHg`);
    else if (gradMax !== null) np.push(`${prefix} máximo de ${gradMax}mmHg`);
    else if (grad !== null) np.push(`${prefix} médio de ${grad}mmHg`);

    if (area) {
      const aTxt = areaMet ? `Área valvar = ${area}cm² (${areaMet})` : `Área valvar = ${area}cm²`;
      np.push(aTxt);
    }

    if (est) {
      let eTxt = est.toLowerCase();
      if (np.length) eTxt += `. ${np.join('. ')}`;
      dopplerLine += ', com ' + eTxt;
    } else {
      if (np.length) dopplerLine += `. ${np.join('. ')}`;
      else dopplerLine += ', sem gradiente transvalvar significativo';
    }
    altered.push('va');
    return { lbl:'VALVA AÓRTICA', txt:`${morfLine}. ${dopplerLine}.` };
  }
  const prefix2 = vaAnat === 'bicuspide' ? 'Bicúspide' : 'Trivalvular';
  if (vaAnat === 'bicuspide') altered.push('va-bic');
  return { lbl:'VALVA AÓRTICA', txt:`${prefix2} com válvulas finas, abertura e mobilidade preservadas. Ao Doppler não exibe refluxo, sem gradiente transvalvar significativo.` };
}

function genAutoConcl(altered) {
  const lines = [];
  const veEsp = getRadio('ve-esp');
  const veSist = getRadio('ve-sist');
  const veDiast = getRadio('ve-diast');

  if (veEsp && veEsp !== 'preservada') {
    const map = {
      'remodelamento':'Remodelamento concêntrico',
      'hve-concentrica-disc':'Hipertrofia concêntrica discreta',
      'hve-concentrica-disc-mod':'Hipertrofia concêntrica do ventrículo esquerdo de grau discreto a moderado',
      'hve-concentrica-mod':'Hipertrofia concêntrica moderada',
      'hve-concentrica-mod-imp':'Hipertrofia concêntrica do ventrículo esquerdo de grau moderado a importante',
      'hve-concentrica-imp':'Hipertrofia concêntrica importante',
      'hve-excentrica':'Hipertrofia excêntrica',
      'hve-descritiva':'Aumento moderado e simétrico da espessura miocárdica'
    };
    if (map[veEsp]) lines.push(map[veEsp]);
  }
  if (veSist && veSist !== 'preservada') {
    const map = { 'disc-reduzida':'Disfunção sistólica discreta do VE', 'mod-reduzida':'Disfunção sistólica moderada do VE', 'imp-reduzida':'Disfunção sistólica importante do VE' };
    const feve = num('ve-feve');
    lines.push(map[veSist] + (feve ? ` (FEVE= ${feve}%)` : ''));
  }
  if (veDiast && veDiast !== 'normal' && veDiast !== 'indet' && veDiast !== 'na-mp' && veDiast !== 'na-valv') {
    const map = { 'grau-1':'Disfunção diastólica grau I', 'grau-2':'Disfunção diastólica grau II', 'grau-3':'Disfunção diastólica grau III' };
    lines.push(map[veDiast]);
  }
  if (Object.keys(state.bullseye).length > 0) lines.push('Alterações da motilidade segmentar (vide laudo)');
  const veContrasteC = getRadio('ve-contraste');
  if (veContrasteC) lines.push(`Presença de contraste espontâneo ${veContrasteC}`);
  const aeGrauC = altered.includes('ae') ? getRadio('ae-grau') : null;
  const adGrauC = altered.includes('ad') ? getRadio('ad-grau') : null;
  if (aeGrauC && adGrauC && aeGrauC === adGrauC) {
    // mesmo grau nos dois átrios → frase biatrial
    lines.push(`${aeGrauC} biatrial`);
  } else {
    if (aeGrauC) lines.push(`${aeGrauC} do átrio esquerdo`);
    if (adGrauC) lines.push(`${adGrauC} do átrio direito`);
  }

  // Detecção de DUPLA LESÃO: estenose + refluxo na mesma valva
  // Helper: hierarquia de graus
  const GRAU_RANK = { 'mínimo':0, 'discreto':1, 'discreta':1, 'discreto a moderado':2, 'moderado':3, 'moderada':3, 'moderado a importante':4, 'importante':5 };
  function pegaMaiorGrau(estGrau, reflGrau) {
    const eRank = GRAU_RANK[estGrau] ?? 0;
    const rRank = GRAU_RANK[reflGrau] ?? 0;
    return eRank >= rRank ? estGrau : reflGrau;
  }

  const vmRefl = getRadio('vm-refl');
  const vmEst = getRadio('vm-est');
  const vmDupla = altered.includes('vm') && vmRefl && vmEst;
  const vaRefl = getRadio('va-refl');
  const vaEst = getRadio('va-est');
  const vaDupla = altered.includes('va') && vaRefl && vaEst && vaEst !== 'Esclerose valvar';

  if (vmDupla) {
    const grauEst = vmEst.replace('Estenose ', '');
    const grauRefl = vmRefl.replace('Refluxo ', '');
    // forma feminina pra concordância com "Dupla lesão... mitral X"
    const grauMaior = pegaMaiorGrau(grauEst, grauRefl);
    const grauFem = grauMaior.replace(/o$/, 'a').replace(/o a /, 'a a ');
    lines.push(`Dupla lesão valvar mitral ${grauFem} (etiologia degenerativa senil)`);
  } else if (altered.includes('vm')) {
    if (vmEst) lines.push(`${vmEst} mitral`);
    if (vmRefl && vmRefl !== 'Refluxo mínimo') lines.push(`${vmRefl} mitral`);
  }

  if (altered.includes('vm-prot')) {
    const tipo = getRadio('vm-prot-tipo');
    if (tipo) lines.push(tipo);
  }

  if (vaDupla) {
    const grauEst = vaEst.replace('Estenose ', '');
    const grauRefl = vaRefl.replace('Refluxo ', '');
    const grauMaior = pegaMaiorGrau(grauEst, grauRefl);
    const grauFem = grauMaior.replace(/o$/, 'a').replace(/o a /, 'a a ');
    lines.push(`Dupla lesão valvar aórtica ${grauFem} (etiologia degenerativa senil)`);
  } else if (altered.includes('va')) {
    if (vaEst && vaEst !== 'Esclerose valvar') lines.push(`${vaEst} aórtica`);
    if (vaRefl && vaRefl !== 'Refluxo mínimo') lines.push(`${vaRefl} aórtico`);
  }

  if (altered.includes('va-prot')) {
    const tipo = getRadio('va-prot-tipo');
    if (tipo) lines.push(tipo);
  }
  if (altered.includes('va-bic')) lines.push('Valva aórtica bicúspide');
  if (altered.includes('vt')) {
    const refl = getRadio('vt-refl');
    if (refl && refl !== 'Refluxo mínimo' && refl !== 'Refluxo discreto') lines.push(`${refl} tricúspide`);
  }
  if (altered.some(a => a.startsWith('peri:'))) {
    const p = altered.find(a => a.startsWith('peri:')).split(':')[1];
    const map = { 'laminar':'Derrame pericárdico laminar', 'disc':'Derrame pericárdico discreto', 'mod':'Derrame pericárdico moderado', 'imp':'Derrame pericárdico importante', 'espess':'Pericárdio espessado' };
    if (map[p]) lines.push(map[p]);
  }
  const psapVal = document.getElementById('vt-psap').value;
  const psapNum = parseFloat((psapVal || '0').replace(',', '.'));
  if (psapNum >= 70) lines.push(`Hipertensão pulmonar importante (PSAP= ${psapVal}mmHg)`);
  else if (psapNum >= 50) lines.push(`Hipertensão pulmonar moderada (PSAP= ${psapVal}mmHg)`);
  else if (psapNum >= 35) lines.push(`Hipertensão pulmonar discreta (PSAP= ${psapVal}mmHg)`);
  if (altered.some(a => a.startsWith('septo:'))) {
    const s = altered.find(a => a.startsWith('septo:')).split(':')[1];
    const map = {
      'fop':'Forame oval patente / CIA OS',
      'fop-pos-ablacao':'Shunt interatrial na lâmina da fossa oval, compatível com status pós-procedimento (ablação de fibrilação atrial prévia)',
      'cia':'CIA com shunt',
      'civ':'CIV',
      'micro-pos':'Pesquisa de shunt com microbolhas positiva'
    };
    if (map[s]) lines.push(map[s]);
  }
  if (altered.includes('vd')) lines.push('Alterações de dimensão e/ou função do VD');
  if (altered.includes('massa')) lines.push('Imagem intracavitária descrita no corpo do laudo');
  if (altered.includes('pleural')) lines.push('Derrame pleural (vide achados)');
  if (altered.includes('aorta')) {
    const r = classifyAoRaiz(num('m-aoraiz'));
    const a = classifyAoAsc(num('m-aoasc'));
    const aoTermo = (document.getElementById('aorta-termo') && document.getElementById('aorta-termo').value) || 'Dilatação';
    if (r) lines.push(`${aoTermo} ${r} da raiz da aorta`);
    if (a) lines.push(`${aoTermo} ${a} da aorta ascendente`);
  }
  // ETE: linhas extras
  if (altered.includes('ete:trombo')) lines.push('Presença de imagens sugestivas de trombos (ETE)');
  if (altered.includes('ete:veg')) lines.push('Presença de imagens sugestivas de vegetação (ETE)');
  if (altered.includes('ete:apend')) lines.push('Apêndice atrial esquerdo com contratilidade reduzida');
  if (altered.includes('ete:veias')) lines.push('Drenagem anômala das veias pulmonares');
  return lines.length ? lines.join('. ') + '.' : 'Alterações descritas no corpo do laudo.';
}

// ════════════════════════════════════════
// PREVIEW
// ════════════════════════════════════════
function renderPreview() {
  const R = genReport();
  const body = document.getElementById('preview-body');
  // Título dinâmico ETT / ETE
  let titulo = 'ECOCARDIOGRAMA TRANSTORÁCICO COM DOPPLER COLORIDO';
  if (state.tipo === 'ETE') {
    titulo = state.eteTipo === 'esofagica'
      ? 'ECOCARDIOGRAMA TRANSTORÁCICO COM COMPLEMENTAÇÃO ESOFÁGICA'
      : 'ECOCARDIOGRAMA TRANSTORÁCICO COM COMPLEMENTAÇÃO TRANSESOFÁGICA';
  }
  let html = `<div class="p-title">${titulo}</div>`;
  if (R.measures.length) {
    html += '<div class="p-section"><span class="p-label">DADOS ESTRUTURAIS:</span></div>';
    html += '<div class="p-measures">' + R.measures.map(m => `<div class="ml">${m}</div>`).join('') + '</div>';
  }
  html += '<div class="p-section" style="margin-top:10px"><span class="p-label">DADOS DESCRITIVOS:</span></div>';
  html += `<div class="p-section"><span class="p-label">Ritmo:</span> <span class="p-text">${R.ritmo}</span></div>`;
  if (R.indic) html += `<div class="p-section"><span class="p-label">Indicação:</span> <span class="p-text">${R.indic}</span></div>`;
  if (R.beira) html += `<div class="p-section"><span class="p-text">${R.beiraTxt || 'Exame realizado beira-leito.'}</span></div>`;
  if (R.janela) html += `<div class="p-section"><span class="p-text">${R.janela}</span></div>`;
  R.sections.forEach(s => {
    const frases = splitSentences(s.txt);
    const corpo = frases.map(f => `<div class="p-text">${f}</div>`).join('');
    html += `<div class="p-section" style="margin-top:8px"><span class="p-label">${s.lbl}:</span>${corpo}</div>`;
  });
  if (R.extras.length) {
    html += '<div class="p-section" style="margin-top:8px">' + R.extras.map(e => `<span class="p-text">${e}</span>`).join(' ') + '</div>';
  }
  // Linhas ETE específicas
  if (R.eteLines && R.eteLines.length) {
    html += '<div class="p-section" style="margin-top:14px">' + R.eteLines.map(l => `<div class="p-text">${l}</div>`).join('') + '</div>';
  }
  if (R.conclusao) html += `<div class="p-concl"><span class="p-label">CONCLUSÃO:</span><br><span class="p-text">${R.conclusao}</span></div>`;
  if (R.recom) html += `<div class="p-section" style="margin-top:8px"><span class="p-label">Recomendações:</span> <span class="p-text">${R.recom}</span></div>`;
  body.innerHTML = html;
  document.getElementById('preview-meta').textContent = `atualizado · ${new Date().toLocaleTimeString('pt-BR').slice(0,5)}`;
}

function updateStatuses() {
  const veAlt = ['ve-esp','ve-cav','ve-sist','ve-diast'].some(n => {
    const v = getRadio(n);
    return v && v !== 'preservada' && v !== 'normal';
  }) || (getRadio('ve-mot') === 'alterada');
  setStatus('ve', veAlt);
  const vdAlt = (getRadio('vd-dim') && getRadio('vd-dim') !== 'normal') || (getRadio('vd-func') && getRadio('vd-func') !== 'normal');
  setStatus('vd', vdAlt);
  const va = getRadio('va-anat');
  const vaAlt = state.mode.va === 'alterado' || state.mode.va === 'protese' || (va && va === 'bicuspide');
  setStatus('va', vaAlt, state.mode.va === 'protese' ? 'Prótese' : null);
  const vmAlt = state.mode.vm === 'alterado' || state.mode.vm === 'protese';
  setStatus('vm', vmAlt, state.mode.vm === 'protese' ? 'Prótese' : null);
  ['peri','septo','vci'].forEach(k => {
    const v = getRadio(k);
    setStatus(k, v && v !== 'normal');
  });
  setStatus('aorta', state.mode.aorta === 'alterado' || classifyAoRaiz(num('m-aoraiz')) || classifyAoAsc(num('m-aoasc')));
  setStatus('ae', state.mode.ae === 'alterado');
  setStatus('ad', state.mode.ad === 'alterado');
  setStatus('vt', state.mode.vt === 'alterado');
  setStatus('vp', state.mode.vp === 'alterado' || getRadio('vp-base') === 'alterada');
}

function setStatus(sec, isAlt, customLabel) {
  const el = document.getElementById('st-' + sec);
  if (!el) return;
  el.textContent = isAlt ? (customLabel || 'Alterado') : 'Normal';
  el.className = 'sec-status ' + (isAlt ? 'alterado' : 'normal');
}

function updateNav() {
  SECTIONS_NAV.forEach(s => {
    const ns = document.querySelector(`.nav-section[data-target="${s.id}"]`);
    if (!ns) return;
    const st = document.getElementById('st-' + s.id);
    let cls = 'normal', icon = '✓';
    if (st && st.classList.contains('alterado')) { cls = 'altered'; icon = '⚠'; }
    if (s.id === 'paciente' || s.id === 'estrut' || s.id === 'concl') { cls = 'normal'; icon = ''; }
    ns.className = `nav-section ${cls}`;
    ns.querySelector('.nav-status').textContent = icon;
  });
}

function updateStickyHeader() {
  const indic = document.getElementById('pac-indic').value || '—';
  const sexo = document.getElementById('pac-sexo').value;
  const ritmo = document.getElementById('pac-ritmo').value;
  const fc = num('pac-fc');
  const feve = num('ve-feve');
  const psap = document.getElementById('vt-psap').value;
  document.getElementById('sp-indic').textContent = indic.length > 30 ? indic.slice(0,30) + '...' : indic;
  document.getElementById('sp-sexo').textContent = sexo === 'M' ? '♂' : sexo === 'F' ? '♀' : '—';
  document.getElementById('sp-ritmo').textContent = fc ? `${ritmo} (${fc}bpm)` : ritmo;
  const sfeve = document.getElementById('sp-feve-wrap');
  document.getElementById('sp-feve').textContent = feve !== null ? `${feve}%` : '—';
  sfeve.classList.toggle('crit', feve !== null && feve < 40);
  const spsap = document.getElementById('sp-psap-wrap');
  document.getElementById('sp-psap').textContent = psap ? `${psap}mmHg` : '—';
  spsap.classList.toggle('crit', psap && parseFloat(psap.replace(',', '.')) >= 50);
}

// ════════════════════════════════════════
// COPY
// ════════════════════════════════════════
function buildPlainReport() {
  const R = genReport();
  let titulo = 'ECOCARDIOGRAMA TRANSTORÁCICO COM DOPPLER COLORIDO';
  if (state.tipo === 'ETE') {
    titulo = state.eteTipo === 'esofagica'
      ? 'ECOCARDIOGRAMA TRANSTORÁCICO COM COMPLEMENTAÇÃO ESOFÁGICA'
      : 'ECOCARDIOGRAMA TRANSTORÁCICO COM COMPLEMENTAÇÃO TRANSESOFÁGICA';
  }
  let txt = titulo + '\n\n';
  if (R.measures.length) txt += 'DADOS ESTRUTURAIS\n' + R.measures.join('\n') + '\n\n';
  txt += 'DADOS DESCRITIVOS:\n';
  txt += `Ritmo: ${R.ritmo}\n`;
  if (R.indic) txt += `Indicação: ${R.indic}\n`;
  if (R.beira) txt += (R.beiraTxt || 'Exame realizado beira-leito.') + '\n';
  if (R.janela) txt += `${R.janela}\n`;
  txt += '\n';
  R.sections.forEach(s => {
    const frases = splitSentences(s.txt);
    txt += `${s.lbl}:\n${frases.join('\n')}\n`;
  });
  if (R.extras.length) txt += '\n' + R.extras.join(' ') + '\n';
  if (R.eteLines && R.eteLines.length) txt += '\n' + R.eteLines.join('\n') + '\n';
  if (R.conclusao) txt += `\nCONCLUSÃO:\n${R.conclusao}\n`;
  if (R.recom) txt += `\nRecomendações: ${R.recom}\n`;
  return txt;
}

async function copyReport() {
  const txt = buildPlainReport();
  await navigator.clipboard.writeText(txt);
  const btn = document.getElementById('btn-copy');
  btn.classList.add('copied');
  btn.innerHTML = '✓ Copiado!';
  // log stats (sem dados de paciente)
  const R = genReport();
  const feve = num('ve-feve');
  const psap = parseFloat((document.getElementById('vt-psap').value || '0').replace(',','.')) || null;
  const altered = !R.conclusao.includes('parâmetros da normalidade');
  api.logLaudo({
    tipo: state.tipo,
    alterado: altered,
    duracao_ms: Date.now() - state.startTime,
    feve, psap
  }).catch(()=>{});
  state.startTime = Date.now();
  setTimeout(() => {
    btn.classList.remove('copied');
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar laudo';
  }, 2000);
}

function resetAll() {
  if (!confirm('Limpar tudo e começar novo laudo?')) return;
  document.querySelectorAll('input[type="number"], input[type="text"], textarea').forEach(i => i.value = '');
  document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(i => i.checked = false);
  document.querySelectorAll('.opt-chip.sel, .opt-chip.auto').forEach(c => c.classList.remove('sel', 'auto'));
  state.bullseye = {};
  state.bullseyeActiveState = 'hipocinesia';
  state.manualOverride = {};
  state.startTime = Date.now();
  state.tipo = 'ETT';
  state.eteTipo = 'transesofagica';
  refreshBullseye();
  // resetar estado dos chips de segmento (visual)
  document.querySelectorAll('.seg-chip').forEach(c => c.removeAttribute('data-marked'));
  document.querySelectorAll('.seg-state').forEach(c => c.classList.remove('sel'));
  const segStateHipo = document.querySelector('.seg-state[data-state="hipocinesia"]');
  if (segStateHipo) segStateHipo.classList.add('sel');
  // toggle ETT
  setTipo('ETT');
  setEteTipo('transesofagica');

  const defaults = [
    've-esp::preservada','ve-cav::normal','ve-sist::preservada','ve-mot::preservada','ve-diast::normal',
    'vd-dim::normal','vd-func::normal','va-anat::trivalvular',
    'peri::normal','septo::normal','septo-micro::','vci::normal',
    'vm-prot-func::normofuncionante','va-prot-func::normofuncionante',
    'vm-prot-perival::','va-prot-perival::',
    'peri-loc::circunferencial','peri-rep::sem','vp-base::normal',
    'ete-veias::normal','ete-apend::normocontrátil','ete-trombos::ausencia','ete-veg::ausencia',
    'vt-refl-causa::','vm-calc::','ve-septomorf::','septo-ia::',
    'vm-refl-causa::','va-refl-causa::','ve-contraste::'
  ];
  defaults.forEach(d => {
    const [name, val] = d.split('::');
    const inp = document.querySelector(`input[name="${name}"][value="${val}"]`);
    if (inp) { inp.checked = true; inp.closest('.opt-chip')?.classList.add('sel'); }
  });
  document.getElementById('pac-ritmo').value = 'Regular';
  document.getElementById('pac-sexo').value = '';
  document.getElementById('pac-janela').value = '';
  document.getElementById('vt-pad').value = '5';
  document.getElementById('ve-feve-met').value = 'Simpson';
  // selects novos com defaults
  const vmGradTipo = document.getElementById('vm-grad-tipo'); if (vmGradTipo) vmGradTipo.value = 'AE-VE';
  const vmAreaMet = document.getElementById('vm-area-met'); if (vmAreaMet) vmAreaMet.value = 'PHT';
  const vaGradTipo = document.getElementById('va-grad-tipo'); if (vaGradTipo) vaGradTipo.value = 'sistólico';
  const vaAreaMet = document.getElementById('va-area-met'); if (vaAreaMet) vaAreaMet.value = 'Equação de Continuidade';
  const aoTermoSel = document.getElementById('aorta-termo'); if (aoTermoSel) aoTermoSel.value = 'Dilatação';
  ['vm-wilk-mob','vm-wilk-sub','vm-wilk-fol','vm-wilk-calc'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  document.getElementById('vm-img-row').style.display = 'none';
  const vmVegRow = document.getElementById('vm-veg-row'); if (vmVegRow) vmVegRow.style.display = 'none';
  const vmCuspRow = document.getElementById('vm-cusp-row'); if (vmCuspRow) vmCuspRow.style.display = 'none';
  document.getElementById('segs-container').style.display = 'none';
  const utiCtx = document.getElementById('uti-context'); if (utiCtx) utiCtx.style.display = 'none';
  document.getElementById('peri-extra').style.display = 'none';
  document.getElementById('vp-alt-body').style.display = 'none';
  state.mode = { aorta:'auto', ae:'auto', vci:'incluir' };
  ['aorta','ae','vci'].forEach(s => setMode(s, state.mode[s]));
  ['ad','vm','va','vt','vp'].forEach(s => setMode(s, 'normal'));
  state.concl = 'auto';
  setConclMode('auto');
  calcAll();
  renderContextualSuggestions();
  renderPreview();
  updateStatuses();
  updateNav();
  updateStickyHeader();
}

function aplicarTudoNormal() { resetAll(); document.getElementById('preview-meta').textContent = 'tudo normal aplicado'; }

// ════════════════════════════════════════
// TEMPLATES
// ════════════════════════════════════════
function aplicarTemplate(t) {
  closeDropdowns();
  const map = {
    'pre-iam':{ indic:'Pós-IAM — avaliar função ventricular e motilidade segmentar', focus:'ve' },
    'ic':{ indic:'Insuficiência cardíaca — avaliação de função e dimensões', focus:'ve' },
    'has':{ indic:'HAS — avaliar HVE e função ventricular', focus:'estrut' },
    'pre-cv':{ indic:'Pré-cardioversão de FA — avaliar AE e descartar trombo', focus:'ae' },
    'endocardite':{ indic:'Suspeita de endocardite — avaliar vegetações', focus:'vm' }
  };
  const tpl = map[t];
  if (!tpl) return;
  document.getElementById('pac-indic').value = tpl.indic;
  scrollToSec(tpl.focus);
  renderPreview();
  updateStickyHeader();
}

function toggleDropdown(id) {
  closeDropdowns(id);
  document.getElementById(id).classList.toggle('shown');
}
function closeDropdowns(except) {
  document.querySelectorAll('.dropdown-menu').forEach(d => { if (d.id !== except) d.classList.remove('shown'); });
}
document.addEventListener('click', e => { if (!e.target.closest('.dropdown-wrap')) closeDropdowns(); });

// ════════════════════════════════════════
// FRASES (D1)
// ════════════════════════════════════════
const FRASES_LABELS = {
  endocardite:'Endocardite', protese:'Prótese', iam:'IAM / Isquemia',
  ic:'IC / Disfunção', hp:'Hipertensão Pulmonar', tamponamento:'Tamponamento',
  dissecao:'Dissecção', outras:'Outras'
};

async function loadFrases() {
  state.frases = await api.getFrases();
}

function openFrases() { document.getElementById('modal-frases').classList.add('shown'); renderFrases(); }
function closeFrases() { document.getElementById('modal-frases').classList.remove('shown'); }

function renderFrases() {
  const q = (document.getElementById('frase-search').value || '').toLowerCase();
  const filtered = q ? state.frases.filter(f => f.texto.toLowerCase().includes(q)) : state.frases;
  const grouped = {};
  filtered.forEach(f => { (grouped[f.categoria] = grouped[f.categoria] || []).push(f); });
  let html = '';
  Object.keys(FRASES_LABELS).forEach(cat => {
    if (!grouped[cat]) return;
    html += `<div class="frase-cat"><h4>${FRASES_LABELS[cat]}</h4>`;
    grouped[cat].forEach(f => {
      html += `<div class="frase-item" onclick="copyFrase(${f.id})">
        ${escapeHtml(f.texto)}
        ${f.usage_count ? `<span class="use-badge">${f.usage_count}× usada</span>` : ''}
        ${!f.builtin ? `<button class="del-btn" onclick="event.stopPropagation();deleteFrase(${f.id})">Excluir</button>` : ''}
      </div>`;
    });
    html += '</div>';
  });
  if (!html) html = '<div class="hint">Nenhuma frase encontrada.</div>';
  document.getElementById('frases-list').innerHTML = html;
}

function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }

async function copyFrase(id) {
  const f = state.frases.find(f => f.id === id);
  if (!f) return;
  await navigator.clipboard.writeText(f.texto);
  await api.useFrase(id);
  await loadFrases();
  renderFrases();
  alert('Frase copiada. Cole onde quiser inserir.');
}

async function addFrase() {
  const cat = document.getElementById('frase-cat-new').value;
  const texto = document.getElementById('frase-text-new').value.trim();
  if (!texto) return;
  await api.addFrase(cat, texto);
  document.getElementById('frase-text-new').value = '';
  await loadFrases();
  renderFrases();
}

async function deleteFrase(id) {
  if (!confirm('Excluir esta frase?')) return;
  await api.deleteFrase(id);
  await loadFrases();
  renderFrases();
}

// ════════════════════════════════════════
// STATS
// ════════════════════════════════════════
async function openStats() {
  document.getElementById('modal-stats').classList.add('shown');
  const body = document.getElementById('stats-body');
  body.innerHTML = '<div class="hint">Carregando...</div>';
  const s = await api.getStats(30);
  if (!s) { body.innerHTML = '<div class="hint">Erro ao carregar.</div>'; return; }
  const pctNormais = s.total ? Math.round((s.normais / s.total) * 100) : 0;
  const tempoMedio = s.duracao_media_ms ? Math.round(s.duracao_media_ms / 1000) : 0;
  body.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="lbl">Laudos (30d)</div><div class="val">${s.total}</div></div>
      <div class="stat-card"><div class="lbl">Normais</div><div class="val">${s.normais}</div><div class="sub">${pctNormais}% do total</div></div>
      <div class="stat-card"><div class="lbl">Alterados</div><div class="val">${s.alterados}</div></div>
      <div class="stat-card"><div class="lbl">Tempo médio</div><div class="val">${tempoMedio}s</div></div>
      <div class="stat-card"><div class="lbl">FEVE média</div><div class="val">${s.feve_media ? Math.round(s.feve_media) + '%' : '—'}</div></div>
    </div>
    ${s.frases_mais_usadas && s.frases_mais_usadas.length ? `
      <h4 style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:7px">Frases mais usadas</h4>
      ${s.frases_mais_usadas.map(f => `<div class="frase-item" style="cursor:default">${escapeHtml(f.texto)}<span class="use-badge">${f.usage_count}×</span></div>`).join('')}
    ` : ''}
  `;
}
function closeStats() { document.getElementById('modal-stats').classList.remove('shown'); }

// ════════════════════════════════════════
// PREFERENCES
// ════════════════════════════════════════
async function loadPreferences() {
  const p = await api.getPreferences();
  if (p.theme) document.body.setAttribute('data-theme', p.theme);
  if (p.density) document.body.setAttribute('data-density', p.density);
}

async function toggleTheme() {
  const cur = document.body.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', next);
  await api.setPreferences({ theme: next });
}

async function toggleDensity() {
  const cur = document.body.getAttribute('data-density');
  const next = cur === 'compact' ? 'comfortable' : 'compact';
  document.body.setAttribute('data-density', next);
  await api.setPreferences({ density: next });
}
