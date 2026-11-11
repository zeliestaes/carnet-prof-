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

const mondayOf = d => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const parseISO = iso => new Date(iso + 'T12:00');
const weekDate = dow => { const n = new Date(); const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() - ((n.getDay() + 6) % 7) + (dow + 6) % 7); return d; };
const quizOn = iso => S.evals.filter(e => e.date === iso);
const quizLine = e => { const c = klass(e.classId); return (c ? school(c.school).name + ' · ' + c.name : '?') + (e.title ? ' · ' + e.title : ''); };
function quizCard(e) {
  const c = klass(e.classId);
  return `<button class="quiz sch-${esc(c ? c.school : '')}" data-act="quiz-edit" data-id="${esc(e.id)}"><span class="ico" aria-hidden="true">📝</span><span><b>Interro · ${esc(classLabel(c))}</b><span class="sub2">${esc(c ? school(c.school).name : '')}${e.title ? ' · ' + esc(e.title) : ''}</span></span></button>`;
}
function slotCard(s, opts = {}) {
  const c = klass(s.classId);
  const sc = school(s.school);
  return `<button class="card sch-${esc(s.school)} ${opts.big ? 'big' : ''} ${opts.mark ? 'today-mark' : ''}" data-act="${opts.act || 'slot-edit'}" data-id="${esc(s.id)}" data-w="${esc(opts.w || '')}">
    <span class="time">${fmtT(s.start)}<br><span class="muted small">à ${fmtT(s.end)}</span></span>
    <span class="what"><b>${esc(classLabel(c))}${opts.date && quizOn(opts.date).some(e => e.classId === s.classId) ? '<span class="badge">Interro</span>' : ''}</b><span class="school">${esc(sc.name)}</span></span></button>`;
}

/* ---------- Vues ---------- */
const ui = { mode: 'day', day: null, ctab: 'students', jw: 0, jsearch: false, jq: '', jc: '' };

function viewToday() {
  const now = new Date();
  const nowM = now.getHours() * 60 + now.getMinutes();
  const dow = now.getDay();
  const todays = slotsOf(dow);
  const cur = todays.find(s => mins(s.start) <= nowM && nowM < mins(s.end));
  let nxt = todays.find(s => mins(s.start) > nowM), nxtLabel = '', nxtDate = new Date(now);
  if (nxt) nxtLabel = 'Aujourd’hui';
  else {
    for (let off = 1; off <= 7 && !nxt; off++) {
      const d = (dow + off) % 7, l = slotsOf(d);
      if (l.length) { nxt = l[0]; nxtLabel = off === 1 ? 'Demain' : DAYNAMES[d]; nxtDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off); }
    }
  }
  const iso = isoDate(now);
  let h = `<h1>Aujourd’hui</h1><p class="sub">${esc(longDate(now))}</p>`;
  const qt = quizOn(iso);
  if (qt.length) h += `<div class="tag">Interro aujourd’hui</div>` + qt.map(quizCard).join('') + `<div style="height:14px"></div>`;
  if (cur) h += `<div class="tag">En cours · jusqu’à ${fmtT(cur.end)}</div>${slotCard(cur, { big: true, act: 'j-open', w: isoDate(weekDate(1)), date: iso })}`;
  if (nxt) h += `<div class="tag">${cur ? 'Ensuite' : 'Prochain cours'} · ${esc(nxtLabel)}</div>${slotCard(nxt, { big: !cur, act: 'j-open', w: isoDate(mondayOf(nxtDate)), date: nxtLabel === 'Aujourd’hui' ? iso : '' })}`;
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
    return `<button class="quiz sch-${esc(c ? c.school : '')}" data-act="quiz-edit" data-id="${esc(e.id)}"><span class="ico" aria-hidden="true">📝</span><span><b>${DAYNAMES[d.getDay()]} ${d.getDate()} · ${esc(classLabel(c))}</b><span class="sub2">${esc(c ? school(c.school).name : '')}${e.title ? ' · ' + esc(e.title) : ''}</span></span></button>`;
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
    const dd = weekDate(ui.day), iso = isoDate(dd);
    h += `<div class="daytitle">${DAYNAMES[ui.day]} ${dd.getDate()}</div>` + quizOn(iso).map(quizCard).join('');
    const l = slotsOf(ui.day);
    h += l.length ? l.map(s => slotCard(s, { date: iso })).join('') : `<p class="empty">Pas de cours ce jour-là.</p>`;
  } else {
    for (let d = 1; d <= 5; d++) {
      const dd = weekDate(d), iso = isoDate(dd);
      h += `<div class="daytitle ${d === today ? 'istoday' : ''}">${DAYNAMES[d]} ${dd.getDate()}</div>` + quizOn(iso).map(quizCard).join('');
      const l = slotsOf(d);
      h += l.length ? l.map(s => slotCard(s, { date: iso })).join('') : `<p class="empty">Pas de cours.</p>`;
    }
  }
  h += `<div style="margin-top:20px"><div class="stack"><button class="primary" data-act="quiz-new">Ajouter une interro</button><button data-act="slot-new">Ajouter un cours</button></div></div>`;
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

const jkey = (w, id) => w + '|' + id;
const jDefaultState = (w, day) => isoDate(addDays(parseISO(w), day - 1)) < isoDate(new Date()) ? 'done' : 'planned';
const stateLabel = st => st === 'done' ? '✓ Fait' : 'Prévu';
const snippet = (t, n = 110) => { t = (t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t; };

function jRow(slot, w) {
  const e = S.journal[jkey(w, slot.id)], c = klass(slot.classId), sc = school(slot.school);
  const has = e && (e.text || e.next);
  return `<div class="jrow sch-${esc(slot.school)}"><button class="card ${has ? '' : 'plain'}" data-act="j-open" data-id="${esc(slot.id)}" data-w="${w}">
    <span class="time">${fmtT(slot.start)}<br><span class="muted small">à ${fmtT(slot.end)}</span></span>
    <span class="what"><b>${esc(classLabel(c))}</b><span class="school">${esc(sc.name)}</span>
    ${e && e.text ? `<span class="jtext">${esc(snippet(e.text))}</span>` : (has ? '' : `<span class="muted small">Touchez pour écrire</span>`)}
    ${e && e.next ? `<span class="jnext">↻ ${esc(snippet(e.next, 70))}</span>` : ''}</span></button>
    ${e && e.text ? `<button class="pill ${e.state}" data-act="j-toggle" data-id="${esc(slot.id)}" data-w="${w}" aria-label="Changer entre Prévu et Fait">${stateLabel(e.state)}</button>` : ''}</div>`;
}

function weekLabel(mon) {
  const fri = addDays(mon, 4);
  return mon.getDate() + (mon.getMonth() !== fri.getMonth() ? ' ' + MONTHS[mon.getMonth()] : '') + ' au ' + fri.getDate() + ' ' + MONTHS[fri.getMonth()];
}

function searchResults() {
  const q = ui.jq.trim().toLowerCase();
  if (!q && !ui.jc) return `<p class="empty">Tapez un mot, ou choisissez une classe.</p>`;
  const list = Object.values(S.journal).filter(e => {
    if (!e.text && !e.next) return false;
    if (ui.jc && e.classId !== ui.jc) return false;
    if (!q) return true;
    const c = klass(e.classId), ch = S.chapters.find(x => x.id === e.chapterId);
    return [e.text, e.next, c && c.name, c && school(c.school).name, ch && ch.title].join(' ').toLowerCase().includes(q);
  }).sort((a, b) => entryDate(b).localeCompare(entryDate(a)));
  if (!list.length) return `<p class="empty">Rien trouvé.</p>`;
  return list.map(e => {
    const c = klass(e.classId), d = parseISO(entryDate(e)), ch = S.chapters.find(x => x.id === e.chapterId);
    return `<div class="jrow sch-${esc(c ? c.school : '')}"><button class="card" data-act="j-open" data-id="${esc(e.slotId)}" data-w="${e.w}">
      <span class="time">${DAYSHORT[d.getDay()]} ${d.getDate()}<br><span class="muted small">${MONTHS[d.getMonth()].slice(0, 4)}.</span></span>
      <span class="what"><b>${esc(classLabel(c))}</b><span class="school">${esc(c ? school(c.school).name : '')}${ch ? ' · ' + esc(ch.title) : ''}</span>
      <span class="jtext">${esc(snippet(e.text))}</span>${e.next ? `<span class="jnext">↻ ${esc(snippet(e.next, 70))}</span>` : ''}</span></button></div>`;
  }).join('');
}
const entryDate = e => isoDate(addDays(parseISO(e.w), e.day - 1));

function viewJournal() {
  if (ui.jsearch) {
    return `<h1>Chercher</h1><p class="sub">Dans tout le journal.</p>
    <input id="jq" type="search" placeholder="Mot-clé ou chapitre" value="${esc(ui.jq)}" autocomplete="off">
    <select id="jc" style="margin-top:10px"><option value="">Toutes les classes</option>${S.schools.map(sc => `<optgroup label="${esc(sc.name)}">` + S.classes.filter(c => c.school === sc.id).map(c => `<option value="${c.id}" ${ui.jc === c.id ? 'selected' : ''}>${esc(sc.name)} · ${esc(c.name)}</option>`).join('') + `</optgroup>`).join('')}</select>
    <div id="jresults" style="margin-top:18px">${searchResults()}</div>
    <button class="quiet" data-act="j-search-off" style="margin-top:12px">← Retour à la semaine</button>`;
  }
  const mon = addDays(mondayOf(new Date()), 7 * ui.jw), w = isoDate(mon), todayIso = isoDate(new Date());
  const rel = ui.jw === 0 ? 'Cette semaine' : ui.jw === 1 ? 'Semaine prochaine' : ui.jw === -1 ? 'Semaine dernière' : ui.jw > 0 ? 'Dans ' + ui.jw + ' semaines' : 'Il y a ' + (-ui.jw) + ' semaines';
  let h = `<h1>Journal</h1><p class="sub">${rel} · ${esc(weekLabel(mon))}</p>
    <div class="row" style="margin-bottom:10px"><button data-act="j-nav" data-v="-1">‹ Précédente</button><button data-act="j-nav" data-v="1">Suivante ›</button></div>
    <div class="row"><button class="${ui.jw === 0 ? 'primary' : ''}" data-act="j-nav" data-v="0">Cette semaine</button><button data-act="j-search">🔍 Chercher</button></div>`;
  for (let d = 1; d <= 5; d++) {
    const dd = addDays(mon, d - 1), iso = isoDate(dd);
    h += `<div class="daytitle ${iso === todayIso ? 'istoday' : ''}">${DAYNAMES[d]} ${dd.getDate()}</div>` + quizOn(iso).map(quizCard).join('');
    const l = slotsOf(d);
    h += l.length ? l.map(s => jRow(s, w)).join('') : `<p class="empty">Pas de cours.</p>`;
  }
  return h;
}

/* --- Entrée de journal (feuille) --- */
let jctx = null, jSnap = null, jDirty = false;
function jOpen(w, slotId) {
  if (!w) w = isoDate(mondayOf(new Date()));
  const slot = S.slots.find(x => x.id === slotId), e = S.journal[jkey(w, slotId)];
  const info = e ? { classId: e.classId, day: e.day, start: e.start, end: e.end } : slot && { classId: slot.classId, day: slot.day, start: slot.start, end: slot.end };
  if (!info) return;
  jctx = { w, id: slotId, info }; jSnap = JSON.stringify(S); jDirty = false;
  drawJ();
}
const jEntry = () => S.journal[jkey(jctx.w, jctx.id)] || { ...jctx.info, w: jctx.w, slotId: jctx.id, text: '', next: '', state: jDefaultState(jctx.w, jctx.info.day), chapterId: '' };
function jWrite(patch) { S.journal[jkey(jctx.w, jctx.id)] = { ...jEntry(), ...patch }; save(); jDirty = true; }
function finishJ() {
  if (!jctx) return false;
  const k = jkey(jctx.w, jctx.id), e = S.journal[k];
  if (e && !e.text.trim() && !e.next.trim()) { delete S.journal[k]; save(); }
  const d = jDirty; jctx = null; if (d) undoSnap = jSnap; return d;
}
function drawJ() {
  const e = jEntry(), c = klass(e.classId), dd = addDays(parseISO(e.w), e.day - 1), iso = isoDate(dd);
  const quiz = quizOn(iso).some(q => q.classId === e.classId);
  const chs = S.chapters.filter(x => x.classId === e.classId);
  openSheet(`<div class="sch-${esc(c ? c.school : '')}"><div class="classhead"><h2 style="margin:0">${esc(classLabel(c))} · ${esc(c ? school(c.school).name : '')}</h2>
    <span class="muted">${DAYNAMES[dd.getDay()]} ${dd.getDate()} ${MONTHS[dd.getMonth()]} · ${fmtT(e.start)}–${fmtT(e.end)}</span>${quiz ? ' <span class="badge">Interro</span>' : ''}</div></div>
    <div class="seg"><button class="${e.state === 'planned' ? 'on' : ''}" data-act="j-state" data-v="planned">Prévu</button><button class="${e.state === 'done' ? 'on' : ''}" data-act="j-state" data-v="done">✓ Fait</button></div>
    <label for="jt">${e.state === 'done' ? 'Ce que j’ai fait' : 'Ce que je compte faire'}</label>
    <textarea id="jt" data-jf="text" placeholder="Écrivez ici…">${esc(e.text)}</textarea>
    <label for="jn">↻ À reprendre la prochaine fois</label>
    <textarea id="jn" data-jf="next" style="min-height:90px">${esc(e.next)}</textarea>
    ${chs.length ? `<label for="jc2">Chapitre</label><select id="jc2" data-jf="chapterId"><option value="">—</option>${chs.map(x => `<option value="${x.id}" ${x.id === e.chapterId ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}</select>` : ''}
    <p class="muted small">Enregistré automatiquement.</p>
    <div class="stack"><button class="primary" data-act="close">Terminé</button><button data-act="j-copy">Copier vers une autre semaine</button>${S.journal[jkey(jctx.w, jctx.id)] ? `<button class="quiet" data-act="j-clear">Effacer cette entrée</button>` : ''}</div>`);
}
function copySheet(src) {
  const base = addDays(parseISO(src.w), 7 + src.day - 1);
  openSheet(`<form data-form="jcopy" data-w="${src.w}" data-id="${esc(src.slotId)}"><h2>Copier vers…</h2>
    <p class="muted">Le texte est copié en « Prévu ». S’il y a déjà du texte, il est ajouté à la suite.</p>
    <label>Date de la semaine visée</label><input type="date" name="date" value="${isoDate(base)}" data-change="jcopy-date" required>
    <label>Cours</label><select name="slot">${copySlotOptions(src, isoDate(base))}</select>
    <div class="stack" style="margin-top:16px"><button class="primary" type="submit">Copier</button>${closeBtn}</div></form>`);
}
function copySlotOptions(src, dateIso) {
  const dow = parseISO(dateIso).getDay();
  const opts = S.slots.filter(s => s.classId === src.classId).sort((a, b) => a.day - b.day || mins(a.start) - mins(b.start));
  const pick = (opts.find(s => s.day === dow) || opts[0] || {}).id;
  return opts.map(s => `<option value="${s.id}" ${s.id === pick ? 'selected' : ''}>${DAYNAMES[s.day]} ${fmtT(s.start)}–${fmtT(s.end)}</option>`).join('') || '<option value="">Aucun cours pour cette classe</option>';
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
    case 'journal': h = viewJournal(); break;
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
function closeSheet() { const d = finishJ(); const s = $('#sheet'); s.hidden = true; s.innerHTML = ''; if (d) { render(); toast('Enregistré'); } }
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
    <p class="muted small" id="err" style="color:#7E3A3B"></p>
    <div class="stack" style="margin-top:12px"><button class="primary" type="submit">Enregistrer</button>
    ${id ? `<button type="button" class="danger" data-act="slot-del" data-id="${id}">Supprimer ce cours</button>` : ''}${closeBtn}</div></form>`);
}

function quizSheet(id) {
  const q = id ? S.evals.find(x => x.id === id) : { date: isoDate(ui.mode === 'day' && ui.day ? weekDate(ui.day) : new Date()), classId: '', title: '' };
  openSheet(`<form data-form="quiz" data-id="${esc(id || '')}"><h2>${id ? 'Modifier l’interro' : 'Nouvelle interro'}</h2>
    <label>Date</label><input type="date" name="date" value="${q.date}" required>
    <label>Classe</label><select name="classId">${S.schools.map(sc => `<optgroup label="${esc(sc.name)}">` + S.classes.filter(c => c.school === sc.id).map(c => `<option value="${c.id}" ${c.id === q.classId ? 'selected' : ''}>${esc(sc.name)} · ${esc(c.name)}</option>`).join('') + `</optgroup>`).join('')}</select>
    <label>Chapitre ou sujet</label><input name="title" value="${esc(q.title || '')}" autocomplete="off" placeholder="Ex. Chapitre 3, les animaux">
    <div class="stack" style="margin-top:16px"><button class="primary" type="submit">Enregistrer</button>
    ${id ? `<button type="button" class="danger" data-act="quiz-del" data-id="${id}">Supprimer l’interro</button>` : ''}${closeBtn}</div></form>`);
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
    case 'j-open': jOpen(b.dataset.w, id); break;
    case 'j-nav': ui.jw = v === '0' ? 0 : ui.jw + +v; render(); break;
    case 'j-search': ui.jsearch = true; render(); break;
    case 'j-search-off': ui.jsearch = false; render(); break;
    case 'j-state': jWrite({ state: v }); drawJ(); break;
    case 'j-toggle': change(S => { const e = S.journal[jkey(b.dataset.w, id)]; e.state = e.state === 'done' ? 'planned' : 'done'; }, 'Modifié'); break;
    case 'j-clear': { delete S.journal[jkey(jctx.w, jctx.id)]; save(); jDirty = true; closeSheet(); break; }
    case 'j-copy': { const src = jEntry(); finishJ(); if (jDirty) { /* garde l'annulation */ } copySheet(src); break; }
    case 'slot-new': slotSheet(null); break;
    case 'quiz-new': quizSheet(null); break;
    case 'quiz-edit': quizSheet(id); break;
    case 'quiz-del': change(S => { S.evals = S.evals.filter(x => x.id !== id); }, 'Interro supprimée'); break;
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

document.addEventListener('input', e => {
  if (jctx && e.target.dataset.jf) jWrite({ [e.target.dataset.jf]: e.target.value });
  if (e.target.id === 'jq') { ui.jq = e.target.value; $('#jresults').innerHTML = searchResults(); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'jc') { ui.jc = e.target.value; $('#jresults').innerHTML = searchResults(); }
  if (e.target.dataset.change === 'jcopy-date') {
    const f = $('#sheet form'), src = { classId: (S.journal[jkey(f.dataset.w, f.dataset.id)] || {}).classId };
    $('#sheet select[name=slot]').innerHTML = copySlotOptions(src, e.target.value);
  }
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
    case 'jcopy': {
      const src = S.journal[jkey(form.dataset.w, id)], tgt = S.slots.find(x => x.id === f.slot);
      if (!src || !tgt || !f.date) return;
      const tw = isoDate(mondayOf(parseISO(f.date)));
      change(S => {
        const k = jkey(tw, tgt.id), old = S.journal[k] || {};
        const join = (a, b) => [a, b].filter(x => x && x.trim()).join('\n\n');
        S.journal[k] = { w: tw, slotId: tgt.id, classId: tgt.classId, day: tgt.day, start: tgt.start, end: tgt.end,
          text: join(old.text, src.text), next: join(old.next, src.next), state: 'planned', chapterId: old.chapterId || src.chapterId || '' };
      }, 'Copié');
      ui.jw = Math.round((parseISO(tw) - mondayOf(new Date())) / 604800000); ui.jsearch = false;
      if (location.hash !== '#/journal') { location.hash = '#/journal'; setTimeout(() => toast('Copié'), 60); } else render();
      break;
    }
    case 'quiz': {
      if (!f.date || !f.classId) return;
      change(S => { const o = { date: f.date, classId: f.classId, title: (f.title || '').trim() }; if (id) Object.assign(S.evals.find(x => x.id === id), o); else S.evals.push({ id: uid(), ...o }); });
      break;
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
