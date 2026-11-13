'use strict';
/* Carnet de classe – étape 1 : Aujourd'hui, Horaire, Classes, Sauvegarde.
   Données : localStorage (aucun serveur). */

const KEY = 'carnet-prof-v1';
const DAYNAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DAYSHORT = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];
const MSHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
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
S.docs = S.docs || [];
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
const quizName = e => { const ch = e.chapterId && S.chapters.find(x => x.id === e.chapterId); return [ch && ch.title, e.title].filter(Boolean).join(' · '); };
const quizOn = iso => S.evals.filter(e => e.date === iso);
const quizLine = e => { const c = klass(e.classId); return (c ? school(c.school).name + ' · ' + c.name : '?') + (e.title ? ' · ' + e.title : ''); };
function quizCard(e) {
  const c = klass(e.classId);
  return `<button class="quiz sch-${esc(c ? c.school : '')}" data-act="eval-open" data-id="${esc(e.id)}"><span class="ico" aria-hidden="true">📝</span><span><b>Interro · ${esc(classLabel(c))}</b><span class="sub2">${esc(c ? school(c.school).name : '')}${quizName(e) ? ' · ' + esc(quizName(e)) : ''}</span></span></button>`;
}
function slotCard(s, opts = {}) {
  const c = klass(s.classId);
  const sc = school(s.school);
  return `<button class="card sch-${esc(s.school)} ${opts.big ? 'big' : ''} ${opts.mark ? 'today-mark' : ''}" data-act="${opts.act || 'slot-edit'}" data-id="${esc(s.id)}" data-w="${esc(opts.w || '')}">
    <span class="time">${fmtT(s.start)}<br><span class="muted small">à ${fmtT(s.end)}</span></span>
    <span class="what"><b>${esc(classLabel(c))}${opts.date && quizOn(opts.date).some(e => e.classId === s.classId) ? '<span class="badge">Interro</span>' : ''}</b><span class="school">${esc(sc.name)}</span></span></button>`;
}

/* ---------- Vues ---------- */
const ui = { lq: '', ls: '', lc: '', lt: '', evoSkill: '', etab: 'quiz', mode: 'day', day: null, ctab: 'students', jw: 0, jsearch: false, jq: '', jc: '' };

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
    return `<button class="quiz sch-${esc(c ? c.school : '')}" data-act="eval-open" data-id="${esc(e.id)}"><span class="ico" aria-hidden="true">📝</span><span><b>${DAYNAMES[d.getDay()]} ${d.getDate()} · ${esc(classLabel(c))}</b><span class="sub2">${esc(c ? school(c.school).name : '')}${quizName(e) ? ' · ' + esc(quizName(e)) : ''}</span></span></button>`;
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
  let h = `<h1>Classes</h1><p class="sub">Choisissez une classe.</p><a class="btn" href="#/library" style="margin-bottom:6px">📚 Bibliothèque de cours · ${S.docs.length}</a>`;
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
    h += `<p class="muted small">Le statut se met à jour avec le journal. Touchez un chapitre pour le détail.</p>` + (l.length ? l.map(chapterRow).join('') : `<p class="empty">Aucun chapitre pour l’instant.</p>`);
    h += `<button class="primary" data-act="chapter-add">Ajouter un chapitre</button>`;
  } else {
    const l = S.docs.filter(d => d.classId === id).sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    h += (l.length ? l.map(docRow).join('') : `<p class="empty">Aucun PDF rangé pour cette classe.</p>`) + `<button class="primary" data-act="doc-add" data-c="${esc(id)}">Ajouter un PDF</button>`;
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
      <span class="time">${DAYSHORT[d.getDay()]} ${d.getDate()}<br><span class="muted small">${MSHORT[d.getMonth()]}</span></span>
      <span class="what"><b>${esc(classLabel(c))}</b><span class="school">${esc(c ? school(c.school).name : '')}${ch ? ' · ' + esc(ch.title) : ''}</span>
      <span class="jtext">${esc(snippet(e.text))}</span>${e.next ? `<span class="jnext">↻ ${esc(snippet(e.next, 70))}</span>` : ''}</span></button></div>`;
  }).join('');
}
const entryDate = e => isoDate(addDays(parseISO(e.w), e.day - 1));

function viewJournal() {
  if (ui.jsearch) {
    return `<h1>Chercher</h1><p class="sub">Dans tout le journal.</p>
    <input id="jq" type="search" placeholder="Mot-clé ou chapitre" value="${esc(ui.jq)}" autocomplete="off">
    <select id="jc" style="margin-top:10px"><option value="">Toute classe</option>${S.schools.map(sc => `<optgroup label="${esc(sc.name)}">` + S.classes.filter(c => c.school === sc.id).map(c => `<option value="${c.id}" ${ui.jc === c.id ? 'selected' : ''}>${esc(sc.name)} · ${esc(c.name)}</option>`).join('') + `</optgroup>`).join('')}</select>
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

/* ---------- Bibliothèque de PDF (IndexedDB) ---------- */
const idb = (() => {
  let db;
  const open = () => db ? Promise.resolve(db) : new Promise((res, rej) => { const r = indexedDB.open('carnet-files', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => { db = r.result; res(db); }; r.onerror = () => rej(r.error); });
  const tx = (mode, fn) => open().then(d => new Promise((res, rej) => { const t = d.transaction('files', mode), rq = fn(t.objectStore('files')); t.oncomplete = () => res(rq && rq.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }));
  return { put: (k, v) => tx('readwrite', s => s.put(v, k)), get: k => tx('readonly', s => s.get(k)), del: k => tx('readwrite', s => s.delete(k)), keys: () => tx('readonly', s => s.getAllKeys()) };
})();
const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(n / 1024)) + ' Ko';
const blobToDataURL = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });

function docRow(d) {
  const c = klass(d.classId);
  return `<button class="srow col sch-${esc(c ? c.school : '')}" style="border-left:10px solid var(--band)" data-act="doc-edit" data-id="${d.id}"><span class="top"><span>📄 ${esc(d.title)}</span><span class="muted small" style="font-weight:400">${fmtSize(d.size || 0)}</span></span><span class="det">${esc(c ? school(c.school).name + ' · ' + c.name : 'Sans classe')}${d.theme ? ' · ' + esc(d.theme) : ''}</span></button>`;
}
function docMatches(d) {
  const q = ui.lq.trim().toLowerCase(), c = klass(d.classId);
  if (ui.ls && (!c || c.school !== ui.ls)) return false;
  if (ui.lc && d.classId !== ui.lc) return false;
  if (ui.lt && d.theme !== ui.lt) return false;
  return !q || [d.title, d.theme, d.name, c && c.name, c && school(c.school).name].join(' ').toLowerCase().includes(q);
}
const docResults = () => { const l = S.docs.filter(docMatches).sort((a, b) => a.title.localeCompare(b.title, 'fr')); return l.length ? l.map(docRow).join('') : `<p class="empty">${S.docs.length ? 'Aucun cours ne correspond.' : 'Aucun PDF rangé pour l’instant.'}</p>`; };
function viewLibrary() {
  const themes = [...new Set(S.docs.map(d => d.theme).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  const cls = S.classes.filter(c => !ui.ls || c.school === ui.ls);
  return `<a class="back" href="#/classes">← Classes</a><h1>Bibliothèque</h1><p class="sub">${S.docs.length} PDF rangé${S.docs.length > 1 ? 's' : ''} sur ce téléphone.</p>
    <button class="primary" data-act="doc-add" data-c="${esc(ui.lc)}" style="margin-bottom:14px">Ajouter un PDF</button>
    <input id="lq" type="search" placeholder="Chercher un titre, un thème…" value="${esc(ui.lq)}" autocomplete="off">
    <div class="row" style="margin-top:10px"><select id="lfs"><option value="">Toute école</option>${S.schools.map(x => `<option value="${x.id}" ${ui.ls === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
    <select id="lfc"><option value="">Toute classe</option>${cls.map(c => `<option value="${c.id}" ${ui.lc === c.id ? 'selected' : ''}>${ui.ls ? '' : esc(school(c.school).name) + ' · '}${esc(c.name)}</option>`).join('')}</select></div>
    <select id="lft" style="margin-top:10px"><option value="">Tout thème</option>${themes.map(t => `<option ${ui.lt === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
    <div id="lres" style="margin-top:18px">${docResults()}</div>`;
}

let docQueue = [];
function pickPdf(classId) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/pdf,.pdf'; inp.multiple = true;
  inp.onchange = async () => {
    const files = [...inp.files].filter(f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (!files.length) { if (inp.files.length) alert('Choisissez un fichier PDF.'); return; }
    docQueue = [];
    try { for (const f of files) { const id = uid(); await idb.put(id, f); docQueue.push({ id, name: f.name, size: f.size, classId }); } }
    catch (e) { alert('Impossible de ranger ce fichier : espace plein ?'); return; }
    nextDoc();
  };
  inp.click();
}
function nextDoc() { const d = docQueue.shift(); if (d) docSheet(d, true, docQueue.length); }
function docSheet(d, isNew, more = 0) {
  const themes = [...new Set(S.docs.map(x => x.theme).filter(Boolean))];
  const title = d.title != null ? d.title : d.name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ');
  if (!d.classId || !klass(d.classId)) d.classId = ui.lc && klass(ui.lc) ? ui.lc : (S.classes[0] || {}).id || '';
  openSheet(`<form data-form="doc" data-id="${d.id}" data-new="${isNew ? 1 : ''}" data-name="${esc(d.name)}" data-size="${d.size || 0}"><h2>${isNew ? 'Nouveau PDF' : 'Cours'}${more ? ' <span class="muted small">(encore ' + more + ' après)</span>' : ''}</h2>
    ${isNew ? '' : `<div class="row" style="margin-top:8px"><button type="button" class="primary" data-act="doc-open" data-id="${d.id}">Ouvrir</button><button type="button" data-act="doc-share" data-id="${d.id}">Partager</button></div>`}
    <label for="dt">Titre</label><input id="dt" name="title" value="${esc(title)}" autocomplete="off" required>
    <label>Classe</label><select name="classId">${S.schools.map(sc => `<optgroup label="${esc(sc.name)}">` + S.classes.filter(c => c.school === sc.id).map(c => `<option value="${c.id}" ${c.id === d.classId ? 'selected' : ''}>${esc(sc.name)} · ${esc(c.name)}</option>`).join('') + `</optgroup>`).join('')}</select>
    <label for="dth">Thème</label><input id="dth" name="theme" list="themes" value="${esc(d.theme || '')}" autocomplete="off" placeholder="Ex. les animaux, la ville">
    <datalist id="themes">${themes.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
    <p class="muted small">${esc(d.name)} · ${fmtSize(d.size || 0)}</p>
    <div class="stack" style="margin-top:12px"><button class="primary" type="submit">Enregistrer</button>
    ${isNew ? `<button type="button" class="quiet" data-act="doc-skip" data-id="${d.id}">Ne pas ranger ce fichier</button>` : `<button type="button" class="danger" data-act="doc-del" data-id="${d.id}">Supprimer</button>${closeBtn}`}</div></form>`);
}
async function openDoc(id, share) {
  const blob = await idb.get(id), d = S.docs.find(x => x.id === id);
  if (!blob) { alert('Fichier introuvable sur ce téléphone.'); return; }
  const name = (d ? d.title : 'cours') + '.pdf';
  if (share) {
    const file = new File([blob], name, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); } catch (e) { /* annulé */ } return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove(); return;
  }
  const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
  if (!window.open(url, '_blank')) location.href = url;
}
async function purgeFiles() { try { const keep = new Set(S.docs.map(d => d.id)); for (const k of await idb.keys()) if (!keep.has(k)) await idb.del(k); } catch (e) { /* ignore */ } }

/* ---------- Évaluations ---------- */
const SKILLS = [['lire', 'Lire'], ['ecrire', 'Écrire'], ['ecouter', 'Écouter'], ['vocab', 'Vocabulaire'], ['parler1', 'Parler sans interaction'], ['parler2', 'Parler avec interaction']];
const num = v => { if (v == null) return null; const t = String(v).trim().replace(',', '.'); return t === '' || isNaN(+t) ? null : +t; };
const getW = k => { const v = num(S.weights && S.weights[k]); return v == null ? 1 : v; };
const defMax = k => { const v = num(S.defmax && S.defmax[k]); return v == null ? 10 : v; };
const ensureMax = ev => { if (!ev.max) { ev.max = {}; SKILLS.forEach(([k]) => { ev.max[k] = defMax(k); }); } };
const maxOf = (e, k) => { const v = e.max ? num(e.max[k]) : defMax(k); return v > 0 ? v : null; };
const scoreOf = (e, sid, k) => num(e.scores && e.scores[sid] && e.scores[sid][k]);
const pctOf = (e, sid, k) => { const m = maxOf(e, k), v = scoreOf(e, sid, k); return m && v != null ? v / m * 100 : null; };
const mean = a => { a = a.filter(x => x != null); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };
const wavg = fn => { let sw = 0, sum = 0; SKILLS.forEach(([k]) => { const p = fn(k); if (p != null) { const w = getW(k); sw += w; sum += w * p; } }); return sw ? sum / sw : null; };
const studentsOf = cid => S.students.filter(s => s.classId === cid).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
const evalsOf = cid => S.evals.filter(e => e.classId === cid);
const stSkill = (cid, sid, k) => mean(evalsOf(cid).map(e => pctOf(e, sid, k)));
const stOverall = (cid, sid) => wavg(k => stSkill(cid, sid, k));
const clSkill = (cid, k) => mean(studentsOf(cid).map(s => stSkill(cid, s.id, k)));
const clOverall = cid => mean(studentsOf(cid).map(s => stOverall(cid, s.id)));
const schSkill = (sch, k) => mean(S.classes.filter(c => c.school === sch).map(c => clSkill(c.id, k)));
const schOverall = sch => mean(S.classes.filter(c => c.school === sch).map(c => clOverall(c.id)));
function evTotal(e, sid) {
  let pts = 0, mx = 0, any = false;
  SKILLS.forEach(([k]) => { const m = maxOf(e, k), v = scoreOf(e, sid, k); if (m && v != null) { pts += v; mx += m; any = true; } });
  return any ? { pts, mx, pct: wavg(k => pctOf(e, sid, k)) } : null;
}
const f1 = v => v == null ? '—' : String(Math.round(v * 10) / 10).replace('.', ',');
const f0 = v => v == null ? '—' : Math.round(v) + ' %';
const chips = items => `<div class="chips">${items.map(([l, v]) => `<div class="chip"><span>${esc(l)}</span><b>${v}</b></div>`).join('')}</div>`;
const skillChips = fn => chips(SKILLS.map(([k, l]) => [l, f0(fn(k))]));

function evalCard(e) {
  const c = klass(e.classId), d = parseISO(e.date), n = studentsOf(e.classId);
  const done = n.filter(s => evTotal(e, s.id)).length;
  return `<button class="quiz sch-${esc(c ? c.school : '')}" data-act="eval-open" data-id="${esc(e.id)}"><span class="ico" aria-hidden="true">📝</span><span><b>${DAYSHORT[d.getDay()]} ${d.getDate()} ${MSHORT[d.getMonth()]} · ${esc(classLabel(c))}</b><span class="sub2">${esc(c ? school(c.school).name : '')}${quizName(e) ? ' · ' + esc(quizName(e)) : ''}${n.length ? ' · ' + done + '/' + n.length + ' encodés' : ''}</span></span></button>`;
}

function viewEvals(p) {
  if (p[1] === 'e') return viewEval(decodeURIComponent(p[2] || ''));
  if (p[1] === 'c') return viewEvalClass(decodeURIComponent(p[2] || ''));
  let h = `<h1>Évaluations</h1><p class="sub">Interros et résultats.</p><div class="seg"><button class="${ui.etab === 'quiz' ? 'on' : ''}" data-act="etab" data-v="quiz">Interros</button><button class="${ui.etab === 'res' ? 'on' : ''}" data-act="etab" data-v="res">Résultats</button></div>`;
  if (ui.etab === 'quiz') {
    const today = isoDate(new Date());
    h += `<button class="primary" data-act="quiz-new">Ajouter une interro</button>`;
    if (!S.evals.length) h += `<p class="empty">Aucune interro pour l’instant.</p>`;
    for (const sc of S.schools) for (const c of S.classes.filter(c => c.school === sc.id)) {
      const l = evalsOf(c.id).slice().sort((a, b) => a.date.localeCompare(b.date));
      if (!l.length) continue;
      h += `<div class="sch-${sc.id}"><span class="schoolhead">${esc(sc.name)} · ${esc(c.name)}</span>` + l.map(e => {
        const tot = SKILLS.reduce((a, [k]) => a + (maxOf(e, k) || 0), 0), n = studentsOf(c.id), done = n.filter(x => evTotal(e, x.id)).length;
        const avg = mean(n.map(x => (evTotal(e, x.id) || {}).pct)), d = parseISO(e.date);
        const det = [d.getDate() + ' ' + MSHORT[d.getMonth()], e.date >= today ? 'à venir' : '', n.length ? done + '/' + n.length + ' encodés' : '', avg != null ? 'moyenne ' + f0(avg) : ''].filter(Boolean).join(' · ');
        return `<button class="srow col" data-act="eval-open" data-id="${esc(e.id)}"><span class="top"><span>${esc(quizName(e) || 'Interro du ' + d.getDate() + ' ' + MSHORT[d.getMonth()])}</span><span>${tot ? '/' + f1(tot) : '—'}</span></span><span class="det">${esc(det)}</span></button>`;
      }).join('') + `<button class="quiet" data-act="quiz-new" data-c="${esc(c.id)}">+ Ajouter une interro en ${esc(c.name)}</button></div>`;
    }
  } else {
    for (const sc of S.schools) {
      h += `<div class="sch-${sc.id}"><span class="schoolhead">${esc(sc.name)}</span><p class="muted">Moyenne de l’école : <b>${f0(schOverall(sc.id))}</b></p>${skillChips(k => schSkill(sc.id, k))}<div style="height:12px"></div>`;
      for (const c of S.classes.filter(c => c.school === sc.id))
        h += `<a class="btn classbtn" href="#/evals/c/${esc(c.id)}"><b>${esc(c.name)}</b><small>${f0(clOverall(c.id))}</small></a>`;
      h += `</div>`;
    }
  }
  h += `<div style="margin-top:24px"><button class="quiet" data-act="weights">Pondérations des compétences</button></div>`;
  return h;
}

function viewEval(id) {
  const e = S.evals.find(x => x.id === id);
  if (!e) return `<a class="back" href="#/evals">← Évaluations</a><p>Interro introuvable.</p>`;
  const c = klass(e.classId), d = parseISO(e.date), sts = studentsOf(e.classId);
  const tested = SKILLS.filter(([k]) => maxOf(e, k));
  let h = `<a class="back" href="#/evals">← Évaluations</a><div class="sch-${esc(c ? c.school : '')}"><div class="classhead"><h1>Interro · ${esc(classLabel(c))}</h1>
    <span class="school">${esc(c ? school(c.school).name : '')}</span><br><span class="muted">${DAYNAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}${quizName(e) ? ' · ' + esc(quizName(e)) : ''}</span></div></div>`;
  if (tested.length) {
    h += `<h2>Moyenne de la classe</h2>` + chips(tested.map(([k, l]) => [l, (m => m == null ? '—' : f1(m) + ' / ' + f1(maxOf(e, k)))(mean(sts.map(s => scoreOf(e, s.id, k))))]));
  }
  h += `<h2>Commentaire sur l’interro</h2><button class="srow" data-act="enote" data-id="${id}"><span class="${e.note ? '' : 'muted'}" style="font-weight:400;white-space:normal">${e.note ? esc(snippet(e.note, 160)) : 'Touchez pour écrire un commentaire…'}</span></button>`;
  h += `<div class="row" style="margin-top:14px"><button data-act="eval-max" data-id="${id}">Points maximum</button><button data-act="quiz-edit" data-id="${id}">Modifier l’interro</button></div><h2>Élèves</h2>`;
  if (!tested.length) h += `<p class="empty">Indiquez d’abord les points maximum de chaque compétence.</p>`;
  else if (!sts.length) h += `<p class="empty">Aucun élève dans cette classe. Ajoutez-les dans Classes.</p>`;
  else h += sts.map(s => { const t = evTotal(e, s.id), cm = (e.comments || {})[s.id];
    const det = tested.filter(([k]) => scoreOf(e, s.id, k) != null).map(([k, l]) => l + ' ' + f1(scoreOf(e, s.id, k)) + '/' + f1(maxOf(e, k))).join(' · ');
    return `<button class="srow col" data-act="enc-open" data-id="${id}" data-s="${s.id}"><span class="top"><span>${esc(s.name)}</span><span class="${t ? '' : 'muted'}">${t ? f1(t.pts) + '/' + f1(t.mx) + ' · ' + f0(t.pct) : 'à encoder'}</span></span>${det ? `<span class="det">${esc(det)}</span>` : ''}${cm ? `<span class="det">💬 ${esc(snippet(cm, 90))}</span>` : ''}</button>`; }).join('');
  return h;
}

function viewEvalClass(cid) {
  const c = klass(cid);
  if (!c) return `<a class="back" href="#/evals">← Évaluations</a><p>Classe introuvable.</p>`;
  const sts = studentsOf(cid);
  let h = `<a class="back" href="#/evals">← Évaluations</a><div class="sch-${esc(c.school)}"><div class="classhead"><h1>${esc(c.name)}</h1><span class="school">${esc(school(c.school).name)}</span></div></div>
    <p>Moyenne générale : <b>${f0(clOverall(cid))}</b></p>${skillChips(k => clSkill(cid, k))}<h2>Évolution de la classe</h2><div class="sch-${esc(c.school)}">${evoBlock(cid, '')}</div><h2>Élèves</h2>`;
  h += sts.length ? sts.map(s => { const det = SKILLS.filter(([k]) => stSkill(cid, s.id, k) != null).map(([k, l]) => l + ' ' + f0(stSkill(cid, s.id, k))).join(' · ');
    return `<button class="srow col" data-act="stu-sum" data-id="${s.id}" data-c="${cid}"><span class="top"><span>${esc(s.name)}</span><span>${f0(stOverall(cid, s.id))}</span></span>${det ? `<span class="det">${esc(det)}</span>` : ''}${s.note ? `<span class="det">💬 ${esc(snippet(s.note, 90))}</span>` : ''}</button>`; }).join('') : `<p class="empty">Aucun élève.</p>`;
  return h + `<p class="muted small" style="margin-top:14px">Moyenne = moyenne des pourcentages obtenus, selon les pondérations.</p>`;
}

function stuSheet(cid, sid) {
  const s = S.students.find(x => x.id === sid), c = klass(cid);
  const evs = evalsOf(cid).filter(e => evTotal(e, sid) || (e.comments || {})[sid]).sort((a, b) => b.date.localeCompare(a.date));
  openSheet(`<h2>${esc(s ? s.name : '')}</h2><p class="muted">${esc(classLabel(c))} · ${esc(c ? school(c.school).name : '')}</p>
    <p>Moyenne générale : <b>${f0(stOverall(cid, sid))}</b></p>${skillChips(k => stSkill(cid, sid, k))}
    <h2 style="margin-top:20px;font-size:1.05rem">Évolution</h2><div class="sch-${esc(c ? c.school : '')}">${evoBlock(cid, sid)}</div>
    <h2 style="margin-top:20px;font-size:1.05rem">Interros</h2>` +
    (evs.length ? evs.map(e => { const t = evTotal(e, sid), d = parseISO(e.date), cm = (e.comments || {})[sid];
      const det = SKILLS.filter(([k]) => maxOf(e, k) && scoreOf(e, sid, k) != null).map(([k, l]) => l + ' ' + f1(scoreOf(e, sid, k)) + '/' + f1(maxOf(e, k))).join(' · ');
      return `<div class="srow col plainrow"><span class="top"><span>${d.getDate()} ${MSHORT[d.getMonth()]}${quizName(e) ? ' · ' + esc(quizName(e)) : ''}</span><span>${t ? f1(t.pts) + '/' + f1(t.mx) + ' · ' + f0(t.pct) : ''}</span></span>${det ? `<span class="det">${esc(det)}</span>` : ''}${cm ? `<span class="det">💬 ${esc(cm)}</span>` : ''}</div>`; }).join('') : `<p class="empty">Aucun résultat encodé.</p>`) +
    `<form data-form="snote" data-id="${sid}" data-c="${cid}"><label for="sn">Notes sur l’élève</label><textarea id="sn" name="v" style="min-height:110px" placeholder="Remarques, points d’attention…">${esc(s && s.note || '')}</textarea>
    <div class="stack" style="margin-top:14px"><button class="primary" type="submit">Enregistrer les notes</button><button type="button" data-act="bulletin" data-id="${sid}" data-c="${cid}">Bulletin imprimable</button>${closeBtn}</div></form>`);
}

/* Évolution dans le temps */
const shortDate = iso => { const d = parseISO(iso); return d.getDate() + ' ' + MSHORT[d.getMonth()]; };
function evoData(cid, sid, k) {
  return evalsOf(cid).slice().sort((a, b) => a.date.localeCompare(b.date)).map(e => {
    const one = id => k ? pctOf(e, id, k) : (evTotal(e, id) || {}).pct;
    const v = sid ? one(sid) : mean(studentsOf(cid).map(x => one(x.id)));
    return { l: shortDate(e.date), v: v == null ? null : v, t: quizName(e) };
  }).filter(x => x.v != null);
}
function evoChart(pts) {
  if (!pts.length) return `<p class="empty">Pas encore de résultats à comparer.</p>`;
  let h = `<div class="evo">` + pts.map(p => `<div class="bar"><span class="bv">${Math.round(p.v)}</span><div class="col"><i style="height:${Math.max(3, Math.min(100, p.v))}%"></i></div><span class="bl">${esc(p.l)}</span></div>`).join('') + `</div>`;
  if (pts.length >= 2) { const d = Math.round(pts[pts.length - 1].v - pts[pts.length - 2].v); h += `<p class="muted small">Dernière interro : ${d === 0 ? 'stable' : (d > 0 ? '+' : '−') + Math.abs(d) + ' points'} par rapport à la précédente.</p>`; }
  return h;
}
function evoBlock(cid, sid) {
  return `<select id="evoSel" class="noprint"><option value="">Toutes les compétences</option>${SKILLS.map(([k, l]) => `<option value="${k}" ${ui.evoSkill === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
    <div class="evoc" data-c="${esc(cid)}" data-s="${esc(sid || '')}" style="margin-top:12px">${evoChart(evoData(cid, sid, ui.evoSkill))}</div>`;
}

/* Chapitres vus en classe */
const CH_STATUS = { todo: 'À venir', doing: 'En cours', done: 'Vu' };
const chLessons = ch => Object.values(S.journal).filter(e => e.chapterId === ch.id && (e.text || e.next)).sort((a, b) => entryDate(a).localeCompare(entryDate(b)));
const chStatus = ch => ch.status || (chLessons(ch).some(e => e.state === 'done') ? 'doing' : 'todo');
function chapterRow(ch) {
  const ls = chLessons(ch).filter(e => e.state === 'done'), st = chStatus(ch);
  const det = ls.length ? ls.length + ' cours fait' + (ls.length > 1 ? 's' : '') + ' · dernier le ' + shortDate(entryDate(ls[ls.length - 1])) : 'Pas encore vu en cours';
  return `<button class="srow col" data-act="chapter-edit" data-id="${ch.id}"><span class="top"><span>${esc(ch.title)}</span><span class="pill2 ${st}">${CH_STATUS[st]}</span></span><span class="det">${det}</span></button>`;
}
function chapterSheet(id) {
  const ch = S.chapters.find(x => x.id === id), c = klass(ch.classId), ls = chLessons(ch), qs = S.evals.filter(e => e.chapterId === id).sort((a, b) => a.date.localeCompare(b.date));
  openSheet(`<form data-form="chapter-edit" data-id="${id}"><h2>Chapitre</h2><p class="muted">${esc(classLabel(c))} · ${esc(c ? school(c.school).name : '')}</p>
    <label for="f">Titre</label><input id="f" name="v" value="${esc(ch.title)}" autocomplete="off">
    <label>Où j’en suis</label><select name="status"><option value="" ${!ch.status ? 'selected' : ''}>Automatique (selon le journal)</option>${Object.entries(CH_STATUS).map(([k, l]) => `<option value="${k}" ${ch.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <h2 style="font-size:1.05rem;margin-top:20px">Cours dans le journal</h2>` +
    (ls.length ? ls.map(e => `<div class="srow col plainrow"><span class="top"><span>${shortDate(entryDate(e))}</span><span class="pill ${e.state}" style="width:auto;min-height:0;padding:2px 10px">${stateLabel(e.state)}</span></span><span class="det">${esc(snippet(e.text || e.next, 100))}</span></div>`).join('') : `<p class="empty">Aucun cours lié. Choisissez ce chapitre dans une entrée du journal.</p>`) +
    `<h2 style="font-size:1.05rem;margin-top:20px">Interros</h2>` +
    (qs.length ? qs.map(e => `<div class="srow plainrow"><span>${shortDate(e.date)}</span><span>${f0(mean(studentsOf(e.classId).map(x => (evTotal(e, x.id) || {}).pct)))}</span></div>`).join('') : `<p class="empty">Aucune interro sur ce chapitre.</p>`) +
    `<div class="stack" style="margin-top:16px"><button class="primary" type="submit">Enregistrer</button><button type="button" class="danger" data-act="chapter-del" data-id="${id}">Supprimer</button>${closeBtn}</div></form>`);
}

/* Bulletin */
function viewBulletin(cid, sid) {
  const c = klass(cid), st = S.students.find(x => x.id === sid);
  if (!c || !st) return `<a class="back" href="#/evals">← Évaluations</a><p>Élève introuvable.</p>`;
  const evs = evalsOf(cid).filter(e => evTotal(e, sid) || (e.comments || {})[sid]).sort((a, b) => a.date.localeCompare(b.date));
  const rows = SKILLS.map(([k, l]) => { const v = stSkill(cid, sid, k); return `<div class="hrow"><span>${esc(l)}</span><span class="hbar"><i style="width:${v == null ? 0 : Math.min(100, v)}%"></i></span><b>${f0(v)}</b></div>`; }).join('');
  return `<a class="back noprint" href="#/evals/c/${esc(cid)}">← ${esc(classLabel(c))}</a>
    <button class="primary noprint" data-act="print" style="margin-bottom:16px">Imprimer / enregistrer en PDF</button>
    <article class="bulletin sch-${esc(c.school)}"><h1>Bulletin de néerlandais</h1>
    <div class="classhead"><h1 style="font-size:1.35rem">${esc(st.name)}</h1><span class="school">${esc(classLabel(c))} · ${esc(school(c.school).name)}</span><br><span class="muted small">Établi le ${esc(longDate(new Date()))}</span></div>
    <p>Moyenne générale : <b>${f0(stOverall(cid, sid))}</b></p><h2>Par compétence</h2>${rows}
    <h2>Évolution (en %)</h2><div id="evo" data-c="${esc(cid)}" data-s="${esc(sid)}">${evoChart(evoData(cid, sid, ''))}</div>
    <h2>Interros</h2>` + (evs.length ? evs.map(e => { const t = evTotal(e, sid), cm = (e.comments || {})[sid];
      const det = SKILLS.filter(([k]) => maxOf(e, k) && scoreOf(e, sid, k) != null).map(([k, l]) => l + ' ' + f1(scoreOf(e, sid, k)) + '/' + f1(maxOf(e, k))).join(' · ');
      return `<div class="srow col plainrow"><span class="top"><span>${shortDate(e.date)}${quizName(e) ? ' · ' + esc(quizName(e)) : ''}</span><span>${t ? f1(t.pts) + '/' + f1(t.mx) + ' · ' + f0(t.pct) : ''}</span></span>${det ? `<span class="det">${esc(det)}</span>` : ''}${cm ? `<span class="det">💬 ${esc(cm)}</span>` : ''}</div>`; }).join('') : `<p class="empty">Aucun résultat.</p>`) +
    (st.note ? `<h2>Remarques</h2><p style="white-space:pre-wrap">${esc(st.note)}</p>` : '') + `</article>`;
}

/* Encodage des points (feuille) */
let ectx = null, eSnap = null, eDirty = false;
function encOpen(eid, sid) {
  const e = S.evals.find(x => x.id === eid); if (!e) return;
  if (!ectx) { eSnap = JSON.stringify(S); eDirty = false; }
  ectx = { eid, sid, list: studentsOf(e.classId).map(x => x.id) };
  drawE();
}
function finishE() { if (!ectx) return false; const d = eDirty; ectx = null; if (d) undoSnap = eSnap; return d; }
function eWrite(k, val) {
  const e = S.evals.find(x => x.id === ectx.eid); ensureMax(e);
  e.scores = e.scores || {}; const sc = (e.scores[ectx.sid] = e.scores[ectx.sid] || {});
  const n = num(val);
  if (String(val).trim() === '') delete sc[k]; else if (n != null) sc[k] = n; else return;
  if (!Object.keys(sc).length) delete e.scores[ectx.sid];
  save(); eDirty = true;
}
function drawE() {
  const { eid, sid, list } = ectx, e = S.evals.find(x => x.id === eid), st = S.students.find(x => x.id === sid), c = klass(e.classId);
  const i = list.indexOf(sid), sc = (e.scores && e.scores[sid]) || {};
  const rows = SKILLS.filter(([k]) => maxOf(e, k)).map(([k, l]) => `<label for="e_${k}">${esc(l)} <span class="muted">(sur ${f1(maxOf(e, k))})</span></label><input id="e_${k}" data-ef="${k}" inputmode="decimal" autocomplete="off" value="${sc[k] != null ? String(sc[k]).replace('.', ',') : ''}">`).join('');
  openSheet(`<div class="sch-${esc(c ? c.school : '')}"><div class="classhead"><h2 style="margin:0">${esc(st ? st.name : '')}</h2><span class="muted">${esc(classLabel(c))} · élève ${i + 1} sur ${list.length}</span></div></div>
    ${rows}<label for="ecm">💬 Commentaire pour cet élève</label><textarea id="ecm" data-ec="1" style="min-height:90px" placeholder="Facultatif">${esc((e.comments || {})[sid] || '')}</textarea>
    <p class="muted small">Laissez vide si l’élève n’a pas fait cette partie. Enregistré automatiquement.</p>
    <div class="row" style="margin-top:12px"><button data-act="enc-prev" ${i <= 0 ? 'disabled' : ''}>‹ Précédent</button><button class="primary" data-act="enc-next" ${i >= list.length - 1 ? 'disabled' : ''}>Suivant ›</button></div>
    <div class="stack" style="margin-top:10px"><button data-act="close">Terminé</button></div>`);
}
function eComment(val) {
  const e = S.evals.find(x => x.id === ectx.eid); e.comments = e.comments || {};
  if (val.trim()) e.comments[ectx.sid] = val; else delete e.comments[ectx.sid];
  save(); eDirty = true;
}
function noteSheet(eid) {
  const e = S.evals.find(x => x.id === eid);
  openSheet(`<form data-form="enote" data-id="${eid}"><h2>Commentaire sur l’interro</h2><label for="en">Ce qui a bien marché, ce qui a posé problème…</label><textarea id="en" name="v" placeholder="Écrivez ici…">${esc(e.note || '')}</textarea>
    <div class="stack" style="margin-top:16px"><button class="primary" type="submit">Enregistrer</button>${closeBtn}</div></form>`);
}
function maxSheet(eid) {
  const e = S.evals.find(x => x.id === eid);
  openSheet(`<form data-form="emax" data-id="${eid}"><h2>Points maximum</h2><p class="muted">Laissez vide ou 0 si la compétence n’est pas évaluée dans cette interro.</p>` +
    SKILLS.map(([k, l]) => `<label>${esc(l)}</label><input name="${k}" inputmode="decimal" value="${maxOf(e, k) != null ? String(maxOf(e, k)).replace('.', ',') : ''}">`).join('') +
    `<div class="stack" style="margin-top:16px"><button class="primary" type="submit">Enregistrer</button>${closeBtn}</div></form>`);
}
function weightsSheet() {
  openSheet(`<form data-form="weights"><h2>Pondérations</h2><p class="muted">Le coefficient donne l’importance de la compétence dans la moyenne (1 = normal, 2 = double, 0 = ignorée). Les points maximum sont proposés pour chaque nouvelle interro.</p>` +
    SKILLS.map(([k, l]) => `<label>${esc(l)}</label><div class="row"><div><span class="muted small">Coefficient</span><input name="w_${k}" inputmode="decimal" value="${String(getW(k)).replace('.', ',')}"></div><div><span class="muted small">Points max</span><input name="m_${k}" inputmode="decimal" value="${String(defMax(k)).replace('.', ',')}"></div></div>`).join('') +
    `<div class="stack" style="margin-top:16px"><button class="primary" type="submit">Enregistrer</button>${closeBtn}</div></form>`);
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
  <p class="muted">${S.docs.length} PDF inclus dans la sauvegarde.</p>
  <p class="muted small" style="margin-top:16px">Restaurer remplace toutes les données actuelles. Le bouton « Annuler » permet de revenir en arrière juste après.</p>`;
}

function viewSoon(title, text) {
  return `<h1>${title}</h1><p class="sub">${text}</p><p class="empty">Cette partie arrive aux prochaines étapes.</p>`;
}

/* ---------- Routage ---------- */
function render() {
  const p = (location.hash.replace(/^#\/?/, '') || 'today').split('/');
  const tab = p[0] === 'backup' ? 'today' : p[0] === 'bulletin' ? 'evals' : p[0] === 'library' ? 'classes' : p[0];
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  let h;
  switch (p[0]) {
    case 'schedule': h = viewSchedule(); break;
    case 'classes': h = p[1] ? viewClass(decodeURIComponent(p[1])) : viewClasses(); break;
    case 'journal': h = viewJournal(); break;
    case 'evals': h = viewEvals(p); break;
    case 'bulletin': h = viewBulletin(decodeURIComponent(p[1] || ''), decodeURIComponent(p[2] || '')); break;
    case 'library': h = viewLibrary(); break;
    case 'backup': h = viewBackup(); break;
    default: h = viewToday();
  }
  $('#view').innerHTML = h;
}
window.addEventListener('hashchange', () => { closeSheet(); hideToast(); render(); window.scrollTo(0, 0); });
setInterval(() => { if ($('#sheet').hidden && (location.hash === '' || location.hash === '#/today')) render(); }, 60000);

/* ---------- Feuilles (formulaires) ---------- */
function openSheet(html) { const s = $('#sheet'); s.innerHTML = `<div class="panel">${html}</div>`; s.hidden = false; const i = s.querySelector('input,textarea'); if (i && i.type !== 'time') i.focus(); }
let pendingReload = false;
function closeSheet() { const d = finishJ() || finishE(); const s = $('#sheet'); s.hidden = true; s.innerHTML = ''; if (d) { render(); toast('Enregistré'); } if (pendingReload) location.reload(); }
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

function quizSheet(id, draft) {
  const q = draft || (id ? { ...S.evals.find(x => x.id === id) } : { date: isoDate(ui.mode === 'day' && ui.day ? weekDate(ui.day) : new Date()), classId: '', chapterId: '', title: '' });
  if (!q.classId || !klass(q.classId)) q.classId = (S.classes[0] || {}).id || '';
  const chs = S.chapters.filter(x => x.classId === q.classId);
  openSheet(`<form data-form="quiz" data-id="${esc(id || '')}"><h2>${id ? 'Modifier l’interro' : 'Nouvelle interro'}</h2>
    <label>Date</label><input type="date" name="date" value="${q.date}" required>
    <label>Classe</label><select name="classId" data-change="quiz-class">${S.schools.map(sc => `<optgroup label="${esc(sc.name)}">` + S.classes.filter(c => c.school === sc.id).map(c => `<option value="${c.id}" ${c.id === q.classId ? 'selected' : ''}>${esc(sc.name)} · ${esc(c.name)}</option>`).join('') + `</optgroup>`).join('')}</select>
    ${chs.length ? `<label>Chapitre</label><select name="chapterId"><option value="">—</option>${chs.map(x => `<option value="${x.id}" ${x.id === q.chapterId ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}</select>` : ''}
    <label>Nom de l’interro</label><input name="title" value="${esc(q.title || '')}" autocomplete="off" placeholder="Ex. Interro sur les vêtements">
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
    case 'doc-add': pickPdf(b.dataset.c || ''); break;
    case 'doc-edit': { const d = S.docs.find(x => x.id === id); if (d) docSheet({ ...d }, false); break; }
    case 'doc-open': openDoc(id, false); break;
    case 'doc-share': openDoc(id, true); break;
    case 'doc-del': change(S => { S.docs = S.docs.filter(x => x.id !== id); }, 'PDF supprimé'); break;
    case 'doc-skip': idb.del(id); closeSheet(); nextDoc(); break;
    case 'eval-open': location.hash = '#/evals/e/' + encodeURIComponent(id); break;
    case 'etab': ui.etab = v; render(); break;
    case 'eval-max': maxSheet(id); break;
    case 'enote': noteSheet(id); break;
    case 'enc-open': encOpen(id, b.dataset.s); break;
    case 'enc-next': case 'enc-prev': { const i = ectx.list.indexOf(ectx.sid) + (a === 'enc-next' ? 1 : -1); if (ectx.list[i]) encOpen(ectx.eid, ectx.list[i]); break; }
    case 'stu-sum': stuSheet(b.dataset.c, id); break;
    case 'weights': weightsSheet(); break;
    case 'j-open': jOpen(b.dataset.w, id); break;
    case 'j-nav': ui.jw = v === '0' ? 0 : ui.jw + +v; render(); break;
    case 'j-search': ui.jsearch = true; render(); break;
    case 'j-search-off': ui.jsearch = false; render(); break;
    case 'j-state': jWrite({ state: v }); drawJ(); break;
    case 'j-toggle': change(S => { const e = S.journal[jkey(b.dataset.w, id)]; e.state = e.state === 'done' ? 'planned' : 'done'; }, 'Modifié'); break;
    case 'j-clear': { delete S.journal[jkey(jctx.w, jctx.id)]; save(); jDirty = true; closeSheet(); break; }
    case 'j-copy': { const src = jEntry(); finishJ(); if (jDirty) { /* garde l'annulation */ } copySheet(src); break; }
    case 'slot-new': slotSheet(null); break;
    case 'quiz-new': quizSheet(null, b.dataset.c ? { date: isoDate(new Date()), classId: b.dataset.c, chapterId: '', title: '' } : undefined); break;
    case 'quiz-edit': quizSheet(id); break;
    case 'quiz-del': change(S => { S.evals = S.evals.filter(x => x.id !== id); }, 'Interro supprimée'); break;
    case 'slot-del': change(S => { S.slots = S.slots.filter(x => x.id !== id); }, 'Cours supprimé'); break;
    case 'goto-class': { const s = S.slots.find(x => x.id === id); if (s) location.hash = '#/classes/' + encodeURIComponent(s.classId); break; }
    case 'class-new': textSheet({ title: 'Nouvelle classe', label: 'Nom de la classe', act: 'class-new', id: b.dataset.school }); break;
    case 'class-edit': { const c = klass(id); textSheet({ title: 'Classe', label: 'Nom de la classe', value: c.name, act: 'class-edit', id, del: 'class-del' }); break; }
    case 'class-del': change(S => {
      S.classes = S.classes.filter(c => c.id !== id); S.slots = S.slots.filter(s => s.classId !== id);
      S.students = S.students.filter(s => s.classId !== id); S.chapters = S.chapters.filter(s => s.classId !== id);
      S.evals = S.evals.filter(s => s.classId !== id); S.docs = S.docs.filter(d => d.classId !== id); location.hash = '#/classes';
    }, 'Classe supprimée'); break;
    case 'students-add': textSheet({ title: 'Ajouter des élèves', label: 'Noms des élèves', multi: true, hint: 'Un élève par ligne. Vous pouvez coller une liste.', act: 'students-add' }); break;
    case 'student-edit': { const s = S.students.find(x => x.id === id); textSheet({ title: 'Élève', label: 'Nom', value: s.name, act: 'student-edit', id, del: 'student-del' }); break; }
    case 'student-del': change(S => { S.students = S.students.filter(x => x.id !== id); }, 'Élève supprimé'); break;
    case 'chapter-add': textSheet({ title: 'Nouveau chapitre', label: 'Titre du chapitre', act: 'chapter-add' }); break;
    case 'chapter-edit': chapterSheet(id); break;
    case 'bulletin': closeSheet(); location.hash = '#/bulletin/' + encodeURIComponent(b.dataset.c) + '/' + encodeURIComponent(id); break;
    case 'print': window.print(); break;
    case 'chapter-del': change(S => { S.chapters = S.chapters.filter(x => x.id !== id); }, 'Chapitre supprimé'); break;
    case 'export': exportData(); break;
    case 'import': $('#importfile').click(); break;
  }
  void cid;
});

document.addEventListener('input', e => {
  if (jctx && e.target.dataset.jf) jWrite({ [e.target.dataset.jf]: e.target.value });
  if (ectx && e.target.dataset.ec) eComment(e.target.value);
  if (ectx && e.target.dataset.ef) eWrite(e.target.dataset.ef, e.target.value);
  if (e.target.id === 'lq') { ui.lq = e.target.value; $('#lres').innerHTML = docResults(); }
  if (e.target.id === 'jq') { ui.jq = e.target.value; $('#jresults').innerHTML = searchResults(); }
});
document.addEventListener('change', e => {
  if (e.target.dataset.change === 'quiz-class') { const f = formVals(); quizSheet($('#sheet form').dataset.id || null, { date: f.date, classId: f.classId, chapterId: '', title: f.title }); }
  if (e.target.id === 'lfs') { ui.ls = e.target.value; if (ui.lc && klass(ui.lc) && ui.ls && klass(ui.lc).school !== ui.ls) ui.lc = ''; render(); }
  if (e.target.id === 'lfc') { ui.lc = e.target.value; render(); }
  if (e.target.id === 'lft') { ui.lt = e.target.value; render(); }
  if (e.target.id === 'evoSel') { ui.evoSkill = e.target.value; const el = e.target.parentElement.querySelector('.evoc'); el.innerHTML = evoChart(evoData(el.dataset.c, el.dataset.s, ui.evoSkill)); }
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
    case 'enote': change(S => { S.evals.find(x => x.id === id).note = f.v || ''; }); break;
    case 'snote': change(S => { S.students.find(x => x.id === id).note = f.v || ''; }); break;
    case 'doc': {
      const o = { title: (f.title || '').trim(), classId: f.classId, theme: (f.theme || '').trim() };
      if (!o.title) return;
      const isNew = form.dataset.new === '1';
      change(S => { if (isNew) S.docs.push({ id, ...o, name: form.dataset.name, size: +form.dataset.size, added: new Date().toISOString() }); else Object.assign(S.docs.find(x => x.id === id), o); }, isNew ? 'PDF rangé' : 'Enregistré');
      if (isNew) { ui.lc = ui.lc; nextDoc(); }
      break;
    }
    case 'emax': change(S => { const ev = S.evals.find(x => x.id === id); ev.max = {}; SKILLS.forEach(([k]) => { const n = num(f[k]); ev.max[k] = n > 0 ? n : 0; }); }); break;
    case 'weights': change(S => { S.weights = {}; S.defmax = {}; SKILLS.forEach(([k]) => { const w = num(f['w_' + k]), m = num(f['m_' + k]); S.weights[k] = w != null && w >= 0 ? w : 1; S.defmax[k] = m != null && m >= 0 ? m : 10; }); }, 'Pondérations enregistrées'); break;
    case 'quiz': {
      if (!f.date || !f.classId) return;
      change(S => { const o = { date: f.date, classId: f.classId, chapterId: f.chapterId || '', title: (f.title || '').trim() };
        if (id) Object.assign(S.evals.find(x => x.id === id), o); else { const ev = { id: uid(), ...o, scores: {} }; ensureMax(ev); S.evals.push(ev); } });
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
    case 'chapter-edit': if (v) change(S => { const ch = S.chapters.find(x => x.id === id); ch.title = v; ch.status = f.status || ''; }); break;
  }
});

/* ---------- Sauvegarde ---------- */
async function exportData() {
  S.meta = S.meta || {}; S.meta.lastExport = new Date().toISOString(); save();
  const out = { ...S, _files: {} };
  try { for (const d of S.docs) { const b = await idb.get(d.id); if (b) out._files[d.id] = await blobToDataURL(b); } }
  catch (e) { alert('Les PDF n’ont pas pu être inclus.'); }
  const blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'carnet-sauvegarde-' + isoDate(new Date()) + '.json';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  render();
}
function importData(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = async () => {
    try {
      const d = JSON.parse(r.result);
      if (!d || !Array.isArray(d.slots) || !Array.isArray(d.classes)) throw new Error();
      const files = d._files || {}; delete d._files; d.docs = d.docs || [];
      for (const id of Object.keys(files)) await idb.put(id, await (await fetch(files[id])).blob());
      change(S => { Object.keys(S).forEach(k => delete S[k]); Object.assign(S, d); }, 'Sauvegarde restaurée');
    } catch (err) { alert('Ce fichier n’est pas une sauvegarde valide.'); }
  };
  r.readAsText(file);
}

/* ---------- Démarrage ---------- */
render();
purgeFiles();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had) return;
    if ($('#sheet').hidden) location.reload(); else pendingReload = true;
  });
  navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {});
}
