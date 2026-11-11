'use strict';
/* Carnet de classe – étape 1 : Aujourd'hui, Horaire, Classes, Sauvegarde.
   Données : localStorage (aucun serveur). */

const KEY = 'carnet-prof-v1';
const DAYNAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DAYSHORT = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = s => document.querySelector(s);

/* ---------- Données ---------- */
function seed() {
  const schools = [{ id: 'rumes', name: 'Rumes' }, { id: 'saintmaur', name: 'Saint Maur' }];
  const classes = [];
  const cid = (s, n) => s + '-' + n.toLowerCase().replace(/\W/g, '');
  [['rumes', 'P5-6'], ['rumes', 'P3-4'], ['rumes', 'P1-2'],
   ['saintmaur', 'P3'], ['saintmaur', 'P4'], ['saintmaur', 'P5'], ['saintmaur', 'P6']]
    .forEach(([s, n]) => classes.push({ id: cid(s, n), school: s, name: n }));
  const T = {
    rumes: { 1: [['08:00', '10:00', 'P5-6'], ['10:30', '11:15', 'P3-4'], ['11:15', '12:00', 'P1-2'], ['13:30', '14:20', 'P3-4'], ['14:20', '15:10', 'P1-2']] },
    saintmaur: {
      2: [['08:35', '10:15', 'P5'], ['10:40', '11:25', 'P4'], ['11:25', '12:15', 'P3'], ['13:30', '15:25', 'P6']],
      3: [['08:35', '10:15', 'P5'], ['10:40', '11:25', 'P3'], ['11:25', '12:15', 'P6']],
      4: [['10:40', '11:25', 'P4'], ['11:25', '12:15', 'P3'], ['13:30', '15:25', 'P6']],
      5: [['13:30', '14:20', 'P4'], ['14:35', '15:25', 'P5']]
    }
  };
  const slots = [];
  for (const s in T) for (const d in T[s]) T[s][d].forEach(([a, b, n]) =>
    slots.push({ id: uid(), school: s, classId: cid(s, n), day: +d, start: a, end: b }));
  return { v: 1, schools, classes, slots, students: [], chapters: [], journal: {}, evals: [], weights: {}, meta: {} };
}

let S;
try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
if (!S || !S.slots) S = seed();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { alert('Impossible de sauvegarder : espace plein ?'); } };
save();

let undoSnap = null, toastTimer = null;
function change(fn, msg) {
  undoSnap = JSON.stringify(S);
  fn(S); save(); closeSheet(); render(); toast(msg || 'Enregistré');
}
function undo() {
  if (!undoSnap) return;
  S = JSON.parse(undoSnap); undoSnap = null; save(); hideToast(); closeSheet(); render();
}
function toast(msg) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span><button data-act="undo">Annuler</button>`;
  t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, 10000);
}
function hideToast() { $('#toast').hidden = true; }

/* ---------- Aides ---------- */
const school = id => S.schools.find(s => s.id === id) || { id, name: id };
const klass = id => S.classes.find(c => c.id === id);
const fmtT = t => { const [h, m] = t.split(':'); return (+h) + 'h' + (m === '00' ? '' : m); };
const mins = t => { const [h, m] = t.split(':'); return +h * 60 + +m; };
const slotsOf = d => S.slots.filter(s => s.day === d).sort((a, b) => mins(a.start) - mins(b.start));
const isoDate = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const longDate = d => DAYNAMES[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
const classLabel = c => c ? c.name : '?';

function slotCard(s, opts = {}) {
  const c = klass(s.classId);
  const sc = school(s.school);
  return `<button class="card sch-${esc(s.school)} ${opts.big ? 'big' : ''} ${opts.mark ? 'today-mark' : ''}" data-act="${opts.act || 'slot-edit'}" data-id="${esc(s.id)}">
    <span class="time">${fmtT(s.start)}<br><span class="muted small">à ${fmtT(s.end)}</span></span>
    <span class="what"><b>${esc(classLabel(c))}</b><span class="school">${esc(sc.name)}</span></span></button>`;
}

/* ---------- Vues ---------- */
const ui = { mode: 'day', day: null, ctab: 'students' };

function viewToday() {
  const now = new Date();
  const nowM = now.getHours() * 60 + now.getMinutes();
  const dow = now.getDay();
  const todays = slotsOf(dow);
  const cur = todays.find(s => mins(s.start) <= nowM && nowM < mins(s.end));
  let nxt = todays.find(s => mins(s.start) > nowM), nxtLabel = '';
  if (nxt) nxtLabel = 'Aujourd’hui';
  else {
    for (let off = 1; off <= 7 && !nxt; off++) {
      const d = (dow + off) % 7, l = slotsOf(d);
      if (l.length) { nxt = l[0]; nxtLabel = off === 1 ? 'Demain' : DAYNAMES[d]; }
    }
  }
  let h = `<h1>Aujourd’hui</h1><p class="sub">${esc(longDate(now))}</p>`;
  if (cur) h += `<div class="tag">En cours · jusqu’à ${fmtT(cur.end)}</div>${slotCard(cur, { big: true, act: 'goto-class' })}`;
  if (nxt) h += `<div class="tag">${cur ? 'Ensuite' : 'Prochain cours'} · ${esc(nxtLabel)}</div>${slotCard(nxt, { big: !cur, act: 'goto-class' })}`;
  if (!cur && !nxt) h += `<p class="empty">Aucun cours dans l’horaire.</p>`;
  if (!cur && nxtLabel !== 'Aujourd’hui' && todays.length) h = h.replace('<div class="tag">', '<p class="muted">Plus de cours aujourd’hui.</p><div class="tag">');
  else if (!todays.length) h = h.replace('<div class="tag">', '<p class="muted">Pas de cours aujourd’hui.</p><div class="tag">');

  // Interros de la semaine (alimenté à l'étape 3)
  const mon = new Date(now); mon.setDate(now.getDate() - ((dow + 6) % 7)); mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const ev = S.evals.filter(e => e.date >= isoDate(mon) && e.date <= isoDate(sun)).sort((a, b) => a.date.localeCompare(b.date));
  h += `<h2>Interros cette semaine</h2>`;
  if (!ev.length) h += `<p class="empty">Aucune interro prévue.</p>`;
  else h += ev.map(e => {
    const c = klass(e.classId), d = new Date(e.date + 'T12:00');
    return `<div class="card sch-${esc(c ? c.school : '')}"><span class="time">${DAYSHORT[d.getDay()]} ${d.getDate()}</span><span class="what"><b>${esc(classLabel(c))}</b><span class="school">${esc(e.title || '')}</span></span></div>`;
  }).join('');

  h += `<h2>Journal</h2><a class="btn primary" href="#/journal">Ouvrir le journal</a>`;
  h += `<p style="text-align:center;margin-top:28px"><a class="back" href="#/backup">Sauvegarde et restauration</a></p>`;
  return h;
}

function viewSchedule() {
  const today = new Date().getDay();
  if (ui.day == null) ui.day = (today >= 1 && today <= 5) ? today : 1;
  const seg = `<div class="seg"><button class="${ui.mode === 'day' ? 'on' : ''}" data-act="mode" data-v="day">Jour</button><button class="${ui.mode === 'week' ? 'on' : ''}" data-act="mode" data-v="week">Semaine</button></div>`;
  let h = `<h1>Horaire</h1><p class="sub">Touchez un cours pour le modifier.</p>` + seg;
  if (ui.mode === 'day') {
    h += `<div class="seg">` + [1, 2, 3, 4, 5].map(d =>
      `<button class="${ui.day === d ? 'on' : ''} ${d === today ? 'istoday' : ''}" data-act="day" data-v="${d}">${DAYSHORT[d]}</button>`).join('') + `</div>`;
    h += `<div class="daytitle">${DAYNAMES[ui.day]}</div>`;
    const l = slotsOf(ui.day);
    h += l.length ? l.map(s => slotCard(s)).join('') : `<p class="empty">Pas de cours ce jour-là.</p>`;
  } else {
    for (let d = 1; d <= 5; d++) {
      h += `<div class="daytitle ${d === today ? 'istoday' : ''}">${DAYNAMES[d]}</div>`;
      const l = slotsOf(d);
      h += l.length ? l.map(s => slotCard(s)).join('') : `<p class="empty">Pas de cours.</p>`;
    }
  }
  h += `<div style="margin-top:20px"><button class="primary" data-act="slot-new">Ajouter un cours</button></div>`;
  return h;
}

function viewClasses() {
  let h = `<h1>Classes</h1><p class="sub">Choisissez une classe.</p>`;
  for (const sc of S.schools) {
    h += `<div class="sch-${sc.id}"><span class="schoolhead">${esc(sc.name)}</span>`;
    for (const c of S.classes.filter(c => c.school === sc.id)) {
      const n = S.students.filter(s => s.classId === c.id).length;
      h += `<a class="btn classbtn" href="#/classes/${esc(c.id)}"><b>${esc(c.name)}</b><small>${n} élève${n > 1 ? 's' : ''}</small></a>`;
    }
    h += `<button class="quiet" data-act="class-new" data-school="${sc.id}">+ Ajouter une classe</button></div>`;
  }
  return h;
}

function viewClass(id) {
  const c = klass(id);
  if (!c) return `<a class="back" href="#/classes">← Classes</a><p>Classe introuvable.</p>`;
  const sc = school(c.school);
  let h = `<a class="back" href="#/classes">← Classes</a><div class="sch-${sc.id}">
    <div class="classhead"><h1>${esc(c.name)}</h1><span class="school">${esc(sc.name)}</span></div></div>
    <div class="seg">` + [['students', 'Élèves'], ['chapters', 'Chapitres'], ['courses', 'Cours']].map(([k, l]) =>
      `<button class="${ui.ctab === k ? 'on' : ''}" data-act="ctab" data-v="${k}">${l}</button>`).join('') + `</div>`;
  if (ui.ctab === 'students') {
    const l = S.students.filter(s => s.classId === id).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    h += l.length ? `<ul class="list">` + l.map(s => `<li><button data-act="student-edit" data-id="${s.id}">${esc(s.name)}</button></li>`).join('') + `</ul>` : `<p class="empty">Aucun élève pour l’instant.</p>`;
    h += `<button class="primary" data-act="students-add">Ajouter des élèves</button>`;
  } else if (ui.ctab === 'chapters') {
    const l = S.chapters.filter(s => s.classId === id);
    h += l.length ? `<ul class="list">` + l.map(s => `<li><button data-act="chapter-edit" data-id="${s.id}">${esc(s.title)}</button></li>`).join('') + `</ul>` : `<p class="empty">Aucun chapitre pour l’instant.</p>`;
    h += `<button class="primary" data-act="chapter-add">Ajouter un chapitre</button>`;
  } else {
    h += `<p class="empty">Les cours (fichiers PDF) arrivent à l’étape 4.</p>`;
  }
  h += `<div style="margin-top:28px"><button class="quiet" data-act="class-edit" data-id="${id}">Renommer ou supprimer la classe</button></div>`;
  return h;
}

function viewBackup() {
  const last = S.meta && S.meta.lastExport ? new Date(S.meta.lastExport) : null;
  return `<a class="back" href="#/today">← Aujourd’hui</a><h1>Sauvegarde</h1>
  <p class="sub">Vos données sont uniquement sur ce téléphone. Faites une sauvegarde de temps en temps.</p>
  <p class="muted">${last ? 'Dernière sauvegarde : ' + esc(longDate(last)) : 'Aucune sauvegarde faite pour l’instant.'}</p>
  <div class="stack">
    <button class="primary" data-act="export">Enregistrer une sauvegarde</button>
    <button data-act="import">Restaurer une sauvegarde</button>
    <input type="file" id="importfile" accept=".json,application/json" hidden>
  </div>
  <p class="muted small" style="margin-top:16px">Restaurer remplace toutes les données actuelles. Le bouton « Annuler » permet de revenir en arrière juste après.</p>`;
}

function viewSoon(title, text) {
  return `<h1>${title}</h1><p class="sub">${text}</p><p class="empty">Cette partie arrive aux prochaines étapes.</p>`;
}

/* ---------- Routage ---------- */
function render() {
  const p = (location.hash.replace(/^#\/?/, '') || 'today').split('/');
  const tab = p[0] === 'backup' ? 'today' : p[0];
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  let h;
  switch (p[0]) {
    case 'schedule': h = viewSchedule(); break;
    case 'classes': h = p[1] ? viewClass(decodeURIComponent(p[1])) : viewClasses(); break;
    case 'journal': h = viewSoon('Journal', 'Le journal de bord par semaine.'); break;
    case 'evals': h = viewSoon('Évaluations', 'Interros et points par élève.'); break;
    case 'backup': h = viewBackup(); break;
    default: h = viewToday();
  }
  $('#view').innerHTML = h;
}
window.addEventListener('hashchange', () => { closeSheet(); hideToast(); render(); window.scrollTo(0, 0); });
setInterval(() => { if ($('#sheet').hidden && (location.hash === '' || location.hash === '#/today')) render(); }, 60000);

/* ---------- Feuilles (formulaires) ---------- */
function openSheet(html) { const s = $('#sheet'); s.innerHTML = `<div class="panel">${html}</div>`; s.hidden = false; const i = s.querySelector('input,textarea'); if (i && i.type !== 'time') i.focus(); }
function closeSheet() { const s = $('#sheet'); s.hidden = true; s.innerHTML = ''; }
const formVals = () => Object.fromEntries(new FormData($('#sheet form')));
const closeBtn = `<button type="button" class="quiet" data-act="close">Fermer</button>`;

function textSheet({ title, label, value = '', multi = false, hint = '', act, id = '', del = '' }) {
  openSheet(`<form data-form="${act}" data-id="${esc(id)}"><h2>${esc(title)}</h2>
    <label for="f">${esc(label)}</label>
    ${multi ? `<textarea id="f" name="v" placeholder="Un nom par ligne">${esc(value)}</textarea>` : `<input id="f" name="v" value="${esc(value)}" autocomplete="off">`}
    ${hint ? `<p class="muted small">${esc(hint)}</p>` : ''}
    <div class="stack" style="margin-top:16px"><button class="primary" type="submit">Enregistrer</button>
    ${del ? `<button type="button" class="danger" data-act="${del}" data-id="${esc(id)}">Supprimer</button>` : ''}${closeBtn}</div></form>`);
}

function slotSheet(id, draft) {
  const s = draft || (id ? { ...S.slots.find(x => x.id === id) } : { school: S.schools[0].id, classId: '', day: ui.day || 1, start: '08:00', end: '08:45' });
  const cls = S.classes.filter(c => c.school === s.school);
  if (!cls.find(c => c.id === s.classId)) s.classId = cls[0] ? cls[0].id : '';
  openSheet(`<form data-form="slot" data-id="${esc(id || '')}"><h2>${id ? 'Modifier le cours' : 'Nouveau cours'}</h2>
    <label>École</label><select name="school" data-change="slot-school">${S.schools.map(x => `<option value="${x.id}" ${x.id === s.school ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
    <label>Classe</label><select name="classId">${cls.map(c => `<option value="${c.id}" ${c.id === s.classId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
    <label>Jour</label><select name="day">${[1, 2, 3, 4, 5].map(d => `<option value="${d}" ${+s.day === d ? 'selected' : ''}>${DAYNAMES[d]}</option>`).join('')}</select>
    <div class="row"><div><label>Début</label><input type="time" name="start" value="${s.start}" required></div><div><label>Fin</label><input type="time" name="end" value="${s.end}" required></div></div>
    <p class="muted small" id="err" style="color:#8A3B3B"></p>
    <div class="stack" style="margin-top:12px"><button class="primary" type="submit">Enregistrer</button>
    ${id ? `<button type="button" class="danger" data-act="slot-del" data-id="${id}">Supprimer ce cours</button>` : ''}${closeBtn}</div></form>`);
}

/* ---------- Événements ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) { if (e.target.id === 'sheet') closeSheet(); return; }
  const a = b.dataset.act, id = b.dataset.id, v = b.dataset.v;
  const cid = decodeURIComponent((location.hash.split('/')[2] || ''));
  switch (a) {
    case 'undo': undo(); break;
    case 'close': closeSheet(); break;
    case 'mode': ui.mode = v; render(); break;
    case 'day': ui.day = +v; render(); break;
    case 'ctab': ui.ctab = v; render(); break;
    case 'slot-edit': slotSheet(id); break;
    case 'slot-new': slotSheet(null); break;
    case 'slot-del': change(S => { S.slots = S.slots.filter(x => x.id !== id); }, 'Cours supprimé'); break;
    case 'goto-class': { const s = S.slots.find(x => x.id === id); if (s) location.hash = '#/classes/' + encodeURIComponent(s.classId); break; }
    case 'class-new': textSheet({ title: 'Nouvelle classe', label: 'Nom de la classe', act: 'class-new', id: b.dataset.school }); break;
    case 'class-edit': { const c = klass(id); textSheet({ title: 'Classe', label: 'Nom de la classe', value: c.name, act: 'class-edit', id, del: 'class-del' }); break; }
    case 'class-del': change(S => {
      S.classes = S.classes.filter(c => c.id !== id); S.slots = S.slots.filter(s => s.classId !== id);
      S.students = S.students.filter(s => s.classId !== id); S.chapters = S.chapters.filter(s => s.classId !== id);
      S.evals = S.evals.filter(s => s.classId !== id); location.hash = '#/classes';
    }, 'Classe supprimée'); break;
    case 'students-add': textSheet({ title: 'Ajouter des élèves', label: 'Noms des élèves', multi: true, hint: 'Un élève par ligne. Vous pouvez coller une liste.', act: 'students-add' }); break;
    case 'student-edit': { const s = S.students.find(x => x.id === id); textSheet({ title: 'Élève', label: 'Nom', value: s.name, act: 'student-edit', id, del: 'student-del' }); break; }
    case 'student-del': change(S => { S.students = S.students.filter(x => x.id !== id); }, 'Élève supprimé'); break;
    case 'chapter-add': textSheet({ title: 'Nouveau chapitre', label: 'Titre du chapitre', act: 'chapter-add' }); break;
    case 'chapter-edit': { const s = S.chapters.find(x => x.id === id); textSheet({ title: 'Chapitre', label: 'Titre', value: s.title, act: 'chapter-edit', id, del: 'chapter-del' }); break; }
    case 'chapter-del': change(S => { S.chapters = S.chapters.filter(x => x.id !== id); }, 'Chapitre supprimé'); break;
    case 'export': exportData(); break;
    case 'import': $('#importfile').click(); break;
  }
  void cid;
});

document.addEventListener('change', e => {
  if (e.target.dataset.change === 'slot-school') {
    const f = formVals(); slotSheet($('#sheet form').dataset.id || null, { school: f.school, classId: '', day: f.day, start: f.start, end: f.end });
  }
  if (e.target.id === 'importfile') importData(e.target.files[0]);
});

document.addEventListener('submit', e => {
  e.preventDefault();
  const form = e.target, kind = form.dataset.form, id = form.dataset.id, f = formVals();
  const v = (f.v || '').trim();
  const cid = decodeURIComponent(location.hash.split('/')[2] || '');
  switch (kind) {
    case 'slot': {
      if (mins(f.end) <= mins(f.start)) { $('#err').textContent = 'L’heure de fin doit être après le début.'; return; }
      if (!f.classId) { $('#err').textContent = 'Ajoutez d’abord une classe pour cette école.'; return; }
      change(S => {
        const o = { school: f.school, classId: f.classId, day: +f.day, start: f.start, end: f.end };
        if (id) Object.assign(S.slots.find(x => x.id === id), o); else S.slots.push({ id: uid(), ...o });
      }); ui.day = +f.day; render(); break;
    }
    case 'class-new': if (v) change(S => {
      let cidn = id + '-' + v.toLowerCase().replace(/\W/g, ''); if (S.classes.find(c => c.id === cidn)) cidn += uid();
      S.classes.push({ id: cidn, school: id, name: v });
    }); break;
    case 'class-edit': if (v) change(S => { klass(id).name = v; }); break;
    case 'students-add': {
      const names = (f.v || '').split('\n').map(x => x.trim()).filter(Boolean);
      if (names.length) change(S => names.forEach(n => S.students.push({ id: uid(), classId: cid, name: n })), names.length + ' élève(s) ajouté(s)');
      break;
    }
    case 'student-edit': if (v) change(S => { S.students.find(x => x.id === id).name = v; }); break;
    case 'chapter-add': if (v) change(S => S.chapters.push({ id: uid(), classId: cid, title: v })); break;
    case 'chapter-edit': if (v) change(S => { S.chapters.find(x => x.id === id).title = v; }); break;
  }
});

/* ---------- Sauvegarde ---------- */
function exportData() {
  S.meta = S.meta || {}; S.meta.lastExport = new Date().toISOString(); save();
  const blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'carnet-sauvegarde-' + isoDate(new Date()) + '.json';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  render();
}
function importData(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d || !Array.isArray(d.slots) || !Array.isArray(d.classes)) throw new Error();
      change(S => { Object.keys(S).forEach(k => delete S[k]); Object.assign(S, d); }, 'Sauvegarde restaurée');
    } catch (err) { alert('Ce fichier n’est pas une sauvegarde valide.'); }
  };
  r.readAsText(file);
}

/* ---------- Démarrage ---------- */
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
