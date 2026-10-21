/* ===== نُور — نظام إدارة الحياة ===== */
const $ = (s) => document.querySelector(s);

const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTH_NAMES = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

/* الأكسنت الافتراضي — مصدر واحد في JS (يرتبط بـ --accent في CSS) */
const NOOR_ACCENT = '#B85C38';

/* لوحة الألوان الموحّدة — المصدر الوحيد للاختيار اللوني في كل التطبيق */
const COLORS = [NOOR_ACCENT, '#4A7C59', '#3F6A8C', '#A03030', '#8A5A9E', '#C9A227', '#111111', '#D4A574', '#7B9E6B', '#5C7A9E', '#B87333', '#9B6B8E', '#8B7355', '#6B8E8E', '#A67B5B', '#C4956A', '#8FA67B', '#6B9BC4', '#B85C5C'];

const GOAL_EMOJI_CATS = [
  { label: 'رياضة', emojis: ['🥊', '🏋️', '🏃‍♂️', '🏊', '🐴', '⚔️', '🎯', '🥋', '🏹'] },
  { label: 'معرفة', emojis: ['📚', '🧠', '💡', '🎓', '✏️', '🔬', '📖'] },
  { label: 'مال', emojis: ['💰', '📈', '💎', '🏦'] },
  { label: 'صحة', emojis: ['❤️', '🧘', '💪', '🌿', '🍎'] },
  { label: 'علاقات', emojis: ['👥', '💬', '🤝', '🏠'] },
  { label: 'إبداع', emojis: ['🎨', '🎵', '✍️', '🎬', '📷'] },
  { label: 'روح', emojis: ['🕌', '🤲', '☪️', '📿', '🌙'] }
];

const state = {
  page: 'tasks',
  settings: {},
  projects: [],
  daily: null,
  stats: null,
  goals: [],
  archiveFilter: { q: '', type: 'all', year: '' },
  archiveMode: 'list',
  archiveHistYear: null,
  apiTodayHabits: [],
  habitsList: [],
  barrier: null,
  barrierHost: null,
  journalSrv: { feelings: [], decisions: [], desires: [], experiences: [], cats: [], projects: [], today: null, goalsGrouped: [], goalsByYear: [], goalsView: 'grouped', goalsYear: null },
  journalWiz: null,
  timer: { mode: 'pomodoro', total: 0, left: 0, running: false, iv: null, endAt: 0, cyclesDone: 0, focusMin: 25, project_id: null, sessionTasks: [], projectSel: '', apiProjectId: null, materialId: null, materials: [], currentMaterial: null, materialTasks: [], materialVideos: [], apiProjects: [] }
};

/* سجلّ الأخطاء معروضًا للمستخدم كي نتمكّن من تشخيص ما يجهله */
window.__noorErrors = [];
function noorLogError(label, detail) {
  const entry = label + (detail ? ' — ' + detail : '');
  window.__noorErrors.push(entry);
  if (window.__noorErrors.length > 20) window.__noorErrors.shift();
  try {
    if (typeof showToast === 'function') showToast(label.slice(0, 120), 'bad');
    let b = document.getElementById('noorErrBtn');
    if (!b) {
      b = document.createElement('button');
      b.id = 'noorErrBtn';
      b.textContent = '⚠ ' + window.__noorErrors.length;
      b.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:99998;background:#7a1f1f;color:#ffd9d9;border:2px solid #2b0f0f;font-family:inherit;font-weight:700;font-size:12px;padding:6px 10px;cursor:pointer;box-shadow:4px 4px 0 #000';
      b.onclick = function () {
        const txt = window.__noorErrors.slice().reverse().join('\n\n');
        if (typeof openModal === 'function') openModal('سجل الأخطاء (انسخ وأرسل)', '<textarea class="input" rows="14" readonly style="direction:ltr;font-size:var(--fs-sm)">' + txt.replace(/</g, '&lt;') + '</textarea>');
      };
      (document.body || document.documentElement).appendChild(b);
    }
    b.textContent = '⚠ ' + window.__noorErrors.length;
  } catch (_) {}
}
window.addEventListener('error', function (e) {
  noorLogError('خطأ: ' + String(e.message || '').slice(0, 160), e.filename ? (e.filename + ':' + e.lineno) : '');
});
/* الوعود المرفوضة بلا معالج لا تصل لمستمع الخطأ أعلاه — نلتقطها هنا كي لا تفشل العمليات بصمت */
window.addEventListener('unhandledrejection', function (e) {
  const msg = e && e.reason && (e.reason.message || String(e.reason)) || 'عملية غير مكتملة';
  noorLogError('وعود غير معالجة: ' + String(msg).slice(0, 160));
});
/* امتلاء مساحة التخزين: النواة ترسل الحدث ونحن نبّه المستخدم فوراً */
window.addEventListener('noor-quota', function () {
  try { if (typeof showToast === 'function') showToast('⚠ مساحة التخزين ممتلئة — احذف بعض الأرشيف أو صدّر نسخة احتياطية', 'bad'); } catch (_) {}
});

const PAGE_META = {
  tasks:   { title: 'المهام اليومية',   desc: 'مهام اليوم وعاداتك — قائمة بسيطة' },
  vision:  { title: 'النظرة',           desc: 'من أنا، المنظور، القيم، وأهداف حياتك عبر السنين' },
  journal: { title: 'التدوين الشامل',   desc: 'مساحاتك الداخلية (أفكارك) والخارجية (ما تتعلمه من العالم)' },
  projects:{ title: 'المشاريع',         desc: 'مشاريعك النشطة — أين يجب أن يذهب تركيزك' },
  library: { title: 'المكتبة الشخصية',  desc: 'بيئة قراءة ومشاهدة معزولة — كتبك وكورساتك وشروحاتك بلا تشتيت' },
  timer:   { title: 'المؤقت',           desc: 'بومودورو وتركيز حر — كل دقيقة تُسجَّل تلقائيًا في الإحصائيات' },
  stats:   { title: 'الإحصائيات',       desc: 'نسبة الاقتراب من الهدف بالسنة — وكل ما يصب هنا' },
  archive: { title: 'الأرشيف',          desc: 'كل ما أنجزته عبر السنوات — لا شيء يُحذف نهائيًا' }
};

const PROJECT_TYPES = [
  { key: 'عام',   icon: '📁', title: 'عام' },
  { key: 'كتاب',  icon: '📕', title: 'كتاب' },
  { key: 'فيديو', icon: '🎬', title: 'فيديو' },
  { key: 'عادة',  icon: '🔁', title: 'عادة متكررة' },
  { key: 'كورس',  icon: '🎓', title: 'كورس' },
  { key: 'دراسة', icon: '📚', title: 'دراسة' }
];
const projectType = (k) => PROJECT_TYPES.find((t) => t.key === k) || PROJECT_TYPES[0];

/* ═══════════════════════════════════════════════════════════════════
   كاش الصور: يحوّل base64 إلى Blob URLs في الذاكرة (أسرع بكثير)
   ═══════════════════════════════════════════════════════════════════ */
const _imgCache = new Map();
function cachedCover(src) {
  src = assetUrl(src);
  if (!src) return '';
  if (_imgCache.has(src)) return _imgCache.get(src);
  try {
    const parts = src.split(',');
    const mime = (parts[0] || '').match(/data:([^;]+)/);
    const type = mime ? mime[1] : 'image/jpeg';
    const bin = atob(parts[1] || '');
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const blob = new Blob([arr], { type });
    const url = URL.createObjectURL(blob);
    _imgCache.set(src, url);
    return url;
  } catch (e) { return src; }
}
/* تحميل مسبق لجميع الأغلفة عند بدء التشغيل */
function preloadCovers() {
  try {
    const projects = NoorStore.getProjects();
    projects.forEach((item) => {
      if (item.cover && !_imgCache.has(item.cover)) cachedCover(item.cover);
    });
  } catch (e) {}
}
function starsHTML(r) {
  const v = Math.max(0, Math.min(5, Math.round(Number(r) || 0)));
  return `<span class="stars" title="${v} من 5">${'★'.repeat(v)}${'☆'.repeat(5 - v)}</span>`;
}
function starInputHTML(v) {
  v = Math.max(0, Math.min(5, Math.round(Number(v) || 0)));
  let h = '<div class="star-pick">';
  for (let i = 1; i <= 5; i++) h += `<span class="star-opt${i <= v ? ' on' : ''}" data-v="${i}" onclick="setStarPick(this)">★</span>`;
  return h + '<input type="hidden" id="star-val" value="' + v + '"></div>';
}
function setStarPick(el) {
  const v = Number(el.dataset.v);
  document.querySelectorAll('.star-opt').forEach((s, idx) => s.classList.toggle('on', idx < v));
  $('#star-val').value = v;
  play('tick');
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* مسار ملف محلي يبدأ بـ / يُحلّ نسبةً إلى صفحة الحالية كي يعمل تحت أي مسار فرعي
   (مثل https://user.github.io/noor/) بدل جذر النطاق. الروابط الخارجية تبقى كما هي. */
function assetUrl(u) {
  var s = String(u || '');
  if (!s || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|data:|blob:)/i.test(s)) return s;
  return s.replace(/^\/+/, '');
}

function fileToBase64(file, maxW, maxH, cb) {
  if (!file || !file.type.startsWith('image/')) return cb(null);
  var reader = new FileReader();
  reader.onload = function (e) {
    var img = new Image();
    img.onload = function () {
      var w = img.width, h = img.height;
      var scale = Math.min(1, maxW / w, maxH / h);
      var cw = Math.round(w * scale), ch = Math.round(h * scale);
      var canvas = document.createElement('canvas');
      canvas.width = cw; canvas.height = ch;
      canvas.getContext('2d').drawImage(img, 0, 0, cw, ch);
      cb(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function handleCoverFile(input, targetId) {
  var file = input.files[0];
  if (!file) return;
  fileToBase64(file, 400, 300, function (dataUrl) {
    if (dataUrl) {
      var el = document.getElementById(targetId);
      if (el) el.value = dataUrl;
      showToast('تم تحميل الصورة');
    } else {
      showToast('صيغة الملف غير مدعومة', 'bad');
    }
  });
}

/* رفع ملف عام (PDF/مستند/صوت…) من الجهاز — يُنسخ داخل النظام كـ data URL ليبقى بعد الحفظ */
async function handleProjectFile(input, nameId, dataId) {
  var file = input.files[0];
  if (!file) return;
  try {
    /* عبر السيرفر حتى 1 جيجا، ومحليًا 8 ميجا كرابط بيانات */
    const res = await uploadBigFile(file);
    var n = document.getElementById(nameId);
    var d = document.getElementById(dataId);
    if (n) n.value = res.name || file.name;
    if (d) d.value = String(res.url || '');
    showToast('تم إرفاق الملف داخل النظام ✓');
  } catch (err) { showToast(err.message, 'bad'); }
}

/* زر فتح الملف المُخزّن داخل النظام (يُستعمل في تفاصيل المشروع والمشروع المؤرشف) */
function projectFileLinkHTML(p) {
  if (!p || !p.file) return '';
  return `
    <div class="lib-detail lib-detail-sm" style="margin-top:8px">
      <div class="lib-detail-body" style="flex-direction:row;align-items:center;gap:10px;flex-wrap:wrap">
        <span>📄 الملف المخزّن داخل النظام:</span>
        <a class="btn btn-sm" href="${esc(assetUrl(p.file))}" target="_blank" rel="noopener" download="${esc(p.file_name || 'ملف')}">فتح «${esc(p.file_name || 'مرفق')}»</a>
      </div>
    </div>`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtDateAr(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_NAMES[date.getDay()]} ${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

function showToast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  $('#toasts').appendChild(t);
  if (type === 'agent') play('agent');
  else if (type === 'success') play('success');
  else if (type === 'alert' || type === 'bad') play('alert');
  else play('tick');
  const dur = (type === 'bad' || type === 'alert') ? 6000 : 2800;
  setTimeout(() => { t.classList.add('hide'); setTimeout(() => t.remove(), 350); }, dur);
}

let audioCtx = null;
function tone(f, d = .12, t = 'sine', v = .08, delay = 0) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = t; o.frequency.value = f;
    const s = audioCtx.currentTime + delay;
    g.gain.setValueAtTime(0, s);
    g.gain.linearRampToValueAtTime(v, s + .015);
    g.gain.exponentialRampToValueAtTime(.001, s + d);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(s); o.stop(s + d + .05);
  } catch (e) {}
}
const sfx = {
  click: () => tone(500, .06, 'sine', .05),
  success: () => { tone(520, .12, 'sine', .08); tone(660, .12, 'sine', .08, .08); tone(780, .18, 'sine', .08, .16); },
  open: () => { tone(340, .09, 'triangle', .07); tone(450, .11, 'triangle', .07, .06); },
  agent: () => { tone(640, .08, 'square', .03); tone(900, .11, 'square', .03, .07); },
  alert: () => { tone(300, .15, 'sawtooth', .05); tone(230, .17, 'sawtooth', .05, .14); },
  tick: () => tone(720, .05, 'sine', .03),
};
const SOUND_KEY = 'noor.sound';
function soundEnabled() {
  return localStorage.getItem(SOUND_KEY) !== '0';
}
function play(name) {
  if (!soundEnabled()) return;
  const fn = sfx[name];
  if (fn) fn();
}
function toggleSound() {
  const on = localStorage.getItem(SOUND_KEY) !== '1';
  localStorage.setItem(SOUND_KEY, on ? '1' : '0');
  syncSoundButton();
}
function syncSoundButton() {
  const btn = $('#soundBtn');
  if (!btn) return;
  const on = soundEnabled();
  btn.title = on ? 'كتم الأصوات' : 'تفعيل الأصوات';
  btn.classList.toggle('muted', !on);
}

/* ===== التنقل ===== */
async function go(page) {
  play('click');
  state.page = page;
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.page === page));
  const meta = PAGE_META[page] || { title: '', desc: '' };
  $('#page-title').textContent = meta.title;
  $('#page-desc').textContent = meta.desc;
  const content = $('#content');
  content.innerHTML = '<div class="loading">…جارٍ التحميل</div>';
  try {
  if (page === 'tasks') await renderTasks();
  else if (page === 'vision') await renderVision();
  else if (page === 'journal') await renderJournal();
  else if (page === 'projects') await renderProjects();
  else if (page === 'library') await renderLibrary();
    else if (page === 'timer') await renderTimer();
    else if (page === 'stats') await renderStats();
    else if (page === 'archive') await renderArchive();
  } catch (e) {
    content.innerHTML = `<div class="error-box">${esc(e.message)}</div>`;
  }
  updateSidebarStatus();
}

/* إعادة رسم الصفحة الحالية فقط دون تغيير المسار أو أصوات — تُستخدم بعد سحب لقطة أحدث */
function refreshCurrentPage() {
  const p = state.page || 'tasks';
  if (p === 'tasks') return renderTasks();
  if (p === 'vision') return renderVision();
  if (p === 'journal') return renderJournal();
  if (p === 'projects') return renderProjects();
  if (p === 'library') return renderLibrary();
  if (p === 'timer') return renderTimer();
  if (p === 'stats') return renderStats();
  if (p === 'archive') return renderArchive();
  return Promise.resolve();
}

/* ===== المهام: قائمة اليوم الموحدة ===== */
async function renderTasks() {
  if (!NoorStore.hasLifePlan()) return renderOnboarding();
  const d = NoorStore.daily();
  state.daily = d;
  state.projects = NoorStore.getProjects();
  state.apiTodayHabits = (await apiFetch('/api/habits/today')) || [];
  await ensureBarrier();
  await ensureJournalToday();
  if (state.yearSel == null) state.yearSel = NoorStore.yearIndex(d.date);

  /* يوم العطلة الدوري: راحة كاملة — لا مهام ولا ترحيل ولا لوم (يُعطّل خلال مرحلة التأسيس) */
  if (!(state.ignoreRestDate === todayISO()) && isRestDayToday() && !NoorStore.inFreeze(todayISO())) {
    const s = NoorStore.getSettings();
    const html = `
      <div class="page-head">
        <div>
          <h2 class="page-title">🌴 يوم عطلة</h2>
          <p class="page-sub">${fmtDateAr(d.date)}</p>
        </div>
      </div>
      <div class="empty-box" style="text-align:center;padding:40px 20px">
        <div style="font-size:42px;margin-bottom:8px">🌴</div>
        <strong>اليوم يوم راحة مجدولة — كل ${+s.rest_day_every || 3} أيام تجدد طاقتك</strong>
        <p>تتوقف فيه المهام اليومية والترحيل لتعود بنشاط كامل غدًا. لا شيء يُحتسب عليك اليوم.</p>
        <button class="btn btn-ghost" onclick="ignoreRestDay()">أريد العمل اليوم على أي حال</button>
      </div>`;
    $('#content').innerHTML = html;
    return;
  }

  /* لافتة مرحلة التأسيس (الجمود) — تظهر فوق المهام دون منعها */
  const fz = NoorStore.freezeInfo();
  const foundationBanner = (fz && NoorStore.inFreeze(d.date)) ? `
    <div class="foundation-banner">
      <div class="fb-ic">🧱</div>
      <div class="fb-body">
        <strong>مرحلة التأسيس — يوم ${fz.days - NoorStore.freezeRemaining(d.date) + 1} من ${fz.days}</strong>
        <p>هذه الأيام لصنع الأساس: أضف أهدافك وقيمك وعاداتك وروتينك. لا تُحتسب ضمن تتبّع الإنجاز حتى الآن.</p>
        <div class="fb-actions">
          <button class="btn btn-sm" onclick="openGoalModalForYear(1)">+ هدف</button>
          <button class="btn btn-sm" onclick="openHabitsModal()">+ عادة</button>
          <button class="btn btn-sm" onclick="openLibItemModal()">+ عنصر مكتبة</button>
          <button class="btn btn-sm btn-ghost" onclick="openSettings()">إيقاف/تعديل</button>
        </div>
      </div>
    </div>` : '';

  const html = `
    <div class="page-head">
      <div>
        <h2 class="page-title">مهام ${d.weekday}</h2>
        <p class="page-sub">${fmtDateAr(d.date)} — ${d.tasks.length} في انتظارك · أسبوع ${NoorStore.weekInYear(d.date)} من السنة ${NoorStore.yearIndex(d.date)}</p>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <button class="btn" onclick="openHabitsModal()">عاداتي</button>
        <button class="btn btn-lg" onclick="openTaskModal()">+ إضافة مهمة</button>
      </div>
    </div>
    ${foundationBanner}
    ${limitBreakBanner()}
    ${renderTodayBody(d)}
    ${challengesZoneHTML()}`;
  $('#content').innerHTML = html;
  bindDnD();
}

/* يوم العطلة الدوري: كل N أيام من بداية الخطة (إعداد rest_day_every، 0=معطل).
   يوم بداية الخطة نفسه يوم عمل دائماً — أول عطلة تأتي بعد اكتمال أول دورة */
function _isRestDate(dateStr) {
  try {
    const s = NoorStore.getSettings();
    const every = Number(s.rest_day_every || 0);
    if (!every || every < 1 || !s.life_start) return false;
    const d0 = new Date(String(s.life_start).slice(0, 10) + 'T00:00:00Z');
    const d1 = new Date(dateStr + 'T00:00:00Z');
    if (isNaN(d0) || isNaN(d1)) return false;
    const diff = Math.round((d1 - d0) / 86400000);
    return diff > 0 && (diff % Math.round(every)) === 0;
  } catch (e) { return false; }
}
function isRestDayToday() { return _isRestDate(todayISO()); }

/* عدد أيام العمل (غير العطل) في الفترة (fromDate, toDate] — يوم العطلة لا يُحسب يوماً */
function _workDaysBetween(fromDate, toDate) {
  let n = 0;
  const d1 = new Date(toDate + 'T00:00:00Z');
  for (let d = new Date(new Date(fromDate + 'T00:00:00Z').getTime() + 86400000); d <= d1; d = new Date(d.getTime() + 86400000)) {
    if (_isRestDate(d.toISOString().slice(0, 10))) continue;
    n++;
    if (n > 400) break;
  }
  return n;
}

/* الجوائز تُفتح يوم العطلة الدوري فقط؛ وإن عُطّلت دورة العطل فيُسمح بها أي يوم */
function rewardsUnlockedToday() {
  try {
    const s = NoorStore.getSettings();
    const every = Number(s.rest_day_every || 0);
    if (!every || every < 1 || !s.life_start) return true;
    return isRestDayToday();
  } catch (e) { return false; }
}

function ignoreRestDay() {
  /* التجاوز مرتبط بتاريخ اليوم فقط — لا يسري على أيام العطل القادمة */
  state.ignoreRestDate = todayISO();
  renderTasks();
}

/* يوم كسر الحدود: كل 3 أيام من بداية الخطة — يضيف تحدي شجاعة/انضباط */
function limitBreakBanner() {
  try {
    if (!NoorStore.isLimitBreakDay(todayISO())) return '';
    const challenges = NoorStore.getChallenges();
    const today = todayISO();
    const todayChallenges = challenges.filter((c) => c.start <= today && !c.archived_at);
    if (todayChallenges.length > 0) return '';
    return `
      <div class="foundation-banner" style="border-color:var(--amber)">
        <div class="fb-ic">🔥</div>
        <div class="fb-body">
          <strong>يوم كسر الحدود — يوم التحدي!</strong>
          <p>كل 3 أيام تأتي فرصة لإضافة تحدي شجاعة أو انضباط جديد. اختر تحدياً وابدأ الآن!</p>
          <div class="fb-actions">
            <button class="btn" onclick="openTaskChallengeModal(null)">⚔️ إضافة تحدي</button>
          </div>
        </div>
      </div>`;
  } catch (e) { return ''; }
}

function renderTodayBody(d) {
  const habitPrio = {};
  NoorStore.getHabits().forEach((h) => { habitPrio[h.id] = h.priority || 99; });
  const apiHabits = (state.apiTodayHabits || []).map((h) => ({
    id: 'api-habit-' + h.id, date: d.date, title: h.title, desc: '',
    source: 'habit', src_id: h.id, done: !!h.done, carried: 0, project_id: null, apiHabit: true
  }));
  /* قائمة واحدة موحدة: عادات ومهام وكسر حدود ويوميات — كلها صفوف متطابقة الحجم والأدوات بلا تصنيف */
  const habits = [...apiHabits, ...d.tasks.filter((t) => t.source === 'habit')]
    .sort((a, b) => (habitPrio[a.src_id] || 99) - (habitPrio[b.src_id] || 99) || String(a.id).localeCompare(String(b.id)));
  const others = d.tasks.filter((t) => t.source !== 'habit');
  const rows = [...habits, ...others];
  state.todayRows = rows;
  state.barrierHost = resolveBarrierHost();
  const barrierRow = state.barrier ? barrierTaskRow(state.barrier) : '';
  const journalDone = !!dailyJournalPost(todayISO());
  const journalRow = taskRowHTML({
    dataId: 'daily-journal',
    done: journalDone,
    checkOnclick: 'openDailyJournal()',
    checkTitle: journalDone ? 'أعد فتح يومياتك وتحديثها' : 'اكتب يوميات اليوم',
    mainOnclick: 'openDailyJournal()',
    titleHTML: 'اليوميات'
  });
  const rowsHTML = barrierRow + journalRow + rows.map(taskRow).join('');
  return `
    <div class="task-list" id="task-list">
      ${rowsHTML || '<div class="empty-box"><strong>لا مهام اليوم</strong><p>أضف مهمة يدوية من «+ إضافة مهمة»، أو أنشئ عادة من زر «عاداتي» أو مشروعًا في قسم المشاريع.</p></div>'}
    </div>`;
}

/* مُصيّر الصف الموحد: البنية الوحيدة لكل عناصر قائمة اليوم — نفس الحجم والحدود والأدوات بالضبط */
function taskRowHTML(o) {
  return `
    <div class="task${o.done ? ' is-done' : ''}" data-id="${o.dataId}">
      <button class="task-check" onclick="${o.checkOnclick}" title="${o.checkTitle}">${o.done ? '✓' : ''}</button>
      <div class="task-main"${o.mainOnclick ? ` onclick="${o.mainOnclick}"` : ''}>
        <div class="task-title">${o.badge || ''}${o.titleHTML}</div>
        ${o.descHTML || ''}
      </div>
      ${o.actionsHTML ? `<div class="task-actions">${o.actionsHTML}</div>` : ''}
    </div>`;
}

const qid = (id) => (typeof id === 'string' ? `'${id}'` : id);

/* ===== العادات (SQLite عبر API — منفصلة عن المشاريع) ===== */
const HABIT_DAY_KEYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
const HABIT_DAY_LABELS = { sat: 'سبت', sun: 'أحد', mon: 'اثنين', tue: 'ثلاثاء', wed: 'أربعاء', thu: 'خميس', fri: 'جمعة' };

function parseHabitDays(v) {
  if (!v) return [];
  try {
    const p = JSON.parse(v);
    return Array.isArray(p) ? p.filter((x) => typeof x === 'string') : [];
  } catch (e) { return []; }
}
function parseHabitDayNumbers(v) {
  if (!v) return [];
  const DAY_KEY = { sat: 6, sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5 };
  try {
    const p = JSON.parse(v);
    if (!Array.isArray(p)) return [];
    return p.map((x) => (typeof x === 'number' ? x : DAY_KEY[x] != null ? DAY_KEY[x] : -1)).filter((n) => n >= 0 && n <= 6);
  } catch (e) { return []; }
}
function habitDaysLabel(v) {
  const days = parseHabitDays(v);
  if (!days.length) return 'كل يوم';
  return days.map((k) => HABIT_DAY_LABELS[k] || k).join('، ');
}

function renderHabitsList(list) {
  if (!list.length) return '<div class="empty-box" style="margin-top:12px"><p>لا عادات بعد — أضف أول عادة.</p></div>';
  return `<div class="h-list">` + list.map((h) => `
    <div class="habit-row">
      <div>
        <div class="habit-title">${esc(h.title)}</div>
        <div class="muted">${habitDaysLabel(h.allowed_days)}</div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="icon-btn" onclick="editHabit(${h.id})" title="تعديل">✎</button>
        <button class="icon-btn danger" onclick="deleteHabit(${h.id})" title="حذف">✕</button>
      </div>
    </div>`).join('') + `</div>`;
}

function habitDaysField(checkedDays) {
  const sel = checkedDays || [];
  return HABIT_DAY_KEYS.map((k) =>
    `<label class="day-opt"><input type="checkbox" value="${k}" ${sel.includes(k) ? 'checked' : ''}>${HABIT_DAY_LABELS[k]}</label>`
  ).join('');
}

async function openHabitsModal() {
  state.habitsList = (await apiFetch('/api/habits')) || [];
  openModal('عاداتي — تتكرر في مهام اليوم', `
    <div class="field"><label>عادة جديدة</label>
      <input class="input" id="h-title" placeholder="مثال: قراءة 20 صفحة" autofocus>
    </div>
    <div class="field"><label>الأيام المسموحة (اتركها فارغة = كل يوم)</label>
      <div class="day-opts">${habitDaysField([])}</div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="saveDailyHabit()">+ إضافة العادة</button>
      <button class="btn btn-ghost" onclick="closeModal()">إغلاق</button>
    </div>
    ${renderHabitsList(state.habitsList)}`);
}

function editHabit(id) {
  const h = (state.habitsList || []).find((x) => x.id === id);
  if (!h) return;
  const days = parseHabitDays(h.allowed_days);
  openModal('تعديل العادة', `
    <div class="field"><label>العنوان</label>
      <input class="input" id="h-title" value="${esc(h.title)}" autofocus>
    </div>
    <div class="field"><label>الأيام المسموحة (فارغة = كل يوم)</label>
      <div class="day-opts">${habitDaysField(days)}</div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="saveDailyHabit(${id})">حفظ</button>
      <button class="btn btn-ghost" onclick="openHabitsModal()">إلغاء</button>
    </div>`);
}

async function saveDailyHabit(id) {
  const title = $('#h-title')?.value.trim();
  if (!title) return showToast('العنوان مطلوب', 'bad');
  const days = [...document.querySelectorAll('#modalBody .day-opt input:checked')].map((i) => i.value);
  try {
    if (id) await apiSend('PUT', '/api/habits/' + id, { title, allowed_days: days });
    else await apiSend('POST', '/api/habits', { title, allowed_days: days });
    play('success');
    showToast('تم الحفظ');
    await openHabitsModal();
    await renderTasks();
  } catch (e) { showToast(e.message, 'bad'); }
}

async function deleteHabit(id) {
  if (!confirm('أرشفة هذه العادة؟ ستُخزن في الأرشيف ولن تظهر في القائمة النشطة.')) return;
  try {
    await apiSend('DELETE', '/api/habits/' + id);
    play('tick');
    showToast('تمت الأرشفة');
    await openHabitsModal();
    await renderTasks();
  } catch (e) { showToast(e.message, 'bad'); }
}

/* ===== كسر الحواجز (SQLite عبر API) ===== */
const BARRIER_HOST_KEYWORDS = ['تمارين', 'تمرين', 'حفظ', 'تعلم', 'قراء', 'تحدث', 'مذاكر', 'دراس', 'مراجع', 'مطالع', 'تعليم'];

async function ensureBarrier() {
  const today = todayISO();
  try {
    const r = await apiSend('POST', '/api/barrier-tasks/ensure', { date: today });
    if (r && (r.generated || r.already_today)) {
      state.barrier = {
        date: today, barrier_task_id: r.barrier_task_id, title: r.title,
        category: r.category || '', already_today: !!r.already_today,
        host_task_id: r.host_task_id || null, host_title: r.host_title || null
      };
    } else {
      state.barrier = null;
    }
  } catch (e) {
    state.barrier = null;
  }
}

function isBarrierDone(b) {
  return localStorage.getItem('noor_barrier_done_' + b.date) === '1';
}

/* الشارة تدور على كل مهام اليوم (بما فيها العادات) بالتسلسل،
   مع نقل يدوي فوري لأي مهمة دون كسر الترتيب الآلي القادم. */
function pickBarrierHost() {
  const today = todayISO();
  const cands = state.todayRows || [];
  if (!cands.length) return null;
  /* النقل اليدوي يتقدم دائماً على الدوران الآلي */
  let manual = null;
  try { manual = localStorage.getItem('noor_barrier_host_' + today); } catch (e) {}
  if (manual) {
    const mt = cands.find((t) => String(t.id) === String(manual));
    if (mt) return mt;
  }
  /* الدوران الآلي: فوق المهام غير المنجزة فقط كي لا تختفي الشارة خلف صف مُنجز */
  const active = cands.filter((t) => !t.done);
  const pool = active.length ? active : cands;
  try {
    if (localStorage.getItem('noor_barrier_host_day') !== today) {
      const idx = Number(localStorage.getItem('noor_barrier_host_idx') || 0);
      localStorage.setItem('noor_barrier_host_day', today);
      localStorage.setItem('noor_barrier_host_idx', String((idx + 1) % pool.length));
    }
  } catch (e) {}
  let idx2 = 0;
  try { idx2 = Number(localStorage.getItem('noor_barrier_host_idx') || 0); } catch (e) {}
  return pool[idx2 % pool.length];
}

/* نافذة نقل شارة كسر الحدود: تضم كل مهام اليوم بلا استثناء */
function openBarrierMoveModal() {
  const cands = state.todayRows || [];
  if (!cands.length) return showToast('لا توجد مهام اليوم لنقل الشارة إليها', 'bad');
  const cur = state.barrierHost;
  openModal('🔥 نقل شارة كسر الحدود', `
    <p class="count" style="margin-bottom:10px">اختر المهمة التي تُكسر فيها الحدود اليوم — النقل يعمل فوراً ولا يغيّر الدوران الآلي للأيام القادمة.</p>
    ${cands.map((t) => {
      const isCur = cur && String(cur.id) === String(t.id);
      return `<div class="dh-item" style="cursor:pointer;${isCur ? 'background:var(--wash-warm)' : ''}" onclick="moveBarrierBadge('${String(t.id).replace(/'/g, '')}')">
        <span class="dh-ic">📌</span><span>${esc(t.title)}</span>${isCur ? '<span class="count" style="margin-inline-start:auto">الشارة الحالية 🔥</span>' : ''}
      </div>`;
    }).join('')}`);
}

function moveBarrierBadge(taskId) {
  try { localStorage.setItem('noor_barrier_host_' + todayISO(), String(taskId)); } catch (e) {}
  closeModal();
  play('tick');
  showToast('نُقلت الشارة لهذه المهمة');
  renderTasks();
}

/* نقل الشارة مباشرة من زر ⇄ على الصف نفسه — بلا نافذة */
function moveBadgeHere(taskId) {
  try { localStorage.setItem('noor_barrier_host_' + todayISO(), String(taskId)); } catch (e) {}
  play('tick');
  showToast('🔥 الشارة الآن على هذه المهمة');
  renderTasks();
}

/* المهمة التي تُكسر فيها الحدود: النقل اليدوي أولاً، ثم host_task_id من السجل،
   وإلا الدوران الآلي على كل مهام اليوم. */
function resolveBarrierHost() {
  const today = todayISO();
  try {
    const manual = localStorage.getItem('noor_barrier_host_' + today);
    if (manual) {
      const mt = (state.todayRows || []).find((t) => String(t.id) === String(manual));
      if (mt) return { id: mt.id, title: mt.title };
    }
  } catch (e) {}
  const b = state.barrier;
  if (b && b.host_task_id && (state.todayRows || []).some((t) => String(t.id) === String(b.host_task_id))) {
    return { id: b.host_task_id, title: b.host_title || 'مهمة اليوم' };
  }
  return pickBarrierHost();
}

/* كسر الحدود = صف عادي تماماً ضمن القائمة الموحدة — نفس البنية والحجم بلا أي فرق */
function barrierTaskRow(b) {
  const done = isBarrierDone(b);
  return taskRowHTML({
    dataId: 'barrier',
    done,
    checkOnclick: 'toggleBarrier()',
    checkTitle: done ? 'تراجع عن الإتمام' : 'إتمام كسر الحدود',
    mainOnclick: 'openBarrierMoveModal()',
    titleHTML: `🔥 ${esc(b.title || 'تحدٍّ جديد')}`,
    descHTML: b.category ? `<div class="task-desc">${esc(b.category)}</div>` : '',
    actionsHTML: `<button class="icon-btn" onclick="event.stopPropagation();openBarrierMoveModal()" title="نقل شارة كسر الحدود لمهمة أخرى">⇄</button>`
  });
}

let _barrierBusy = false;
async function toggleBarrier() {
  const b = state.barrier;
  /* بلا تحدٍّ حقيقي (بلا معرف) لا شيء يُزامَن — حماية من صف وهمي */
  if (!b || !b.barrier_task_id || _barrierBusy) return;
  _barrierBusy = true;
  try {
    const key = 'noor_barrier_done_' + b.date;
    const hostKey = 'noor_barrier_host_done_' + b.date;
    const cur = localStorage.getItem(key) === '1';
    const next = !cur;
    try { localStorage.setItem(key, next ? '1' : '0'); } catch (e) {}
    Bridge.markDirty(); Bridge.queuePush();
    /* التسلسل الصارم: الإتمام يحرر التحدي الحالي ليليك التالي في نافذته، والتراجع يعيده */
    try { await apiSend('POST', '/api/barrier-tasks/complete', { id: b.barrier_task_id, done: next }); } catch (e) {}
    const host = state.barrierHost;
    if (host) {
      try {
        const hostRow = (state.todayRows || []).find((x) => String(x.id) === String(host.id));
        if (hostRow) {
          if (hostRow.apiHabit) {
            /* الشارة على عادة API → مزامنة الإنجاز عبر مسار العادات.
               التراجع يعكس العادة فقط إذا كان إتمامها بفعل التحدي لا بيد المستخدم */
            const ah = (state.apiTodayHabits || []).find((x) => Number(x.id) === Number(hostRow.src_id));
            if (next) {
              try {
                await apiSend('PUT', '/api/habits/' + Number(hostRow.src_id) + '/log', { date: todayISO(), done: 1 });
                if (ah) ah.done = 1;
              } catch (e) {}
              try { localStorage.setItem(hostKey, '1'); } catch (e) {}
            } else if (ah && ah.done && localStorage.getItem(hostKey) === '1') {
              try {
                await apiSend('PUT', '/api/habits/' + Number(hostRow.src_id) + '/log', { date: todayISO(), done: 0 });
                if (ah) ah.done = 0;
              } catch (e) {}
              try { localStorage.removeItem(hostKey); } catch (e) {}
            }
          } else {
            const curHostDone = !!hostRow.done;
            if (next && !curHostDone) {
              NoorStore.toggleTask(hostRow.id, true);
              try { localStorage.setItem(hostKey, '1'); } catch (e) {}
            } else if (!next && curHostDone && localStorage.getItem(hostKey) === '1') {
              /* لا نُلغي إنجازاً أجره المستخدم بنفسه — فقط ما أنجزه التحدي */
              NoorStore.toggleTask(hostRow.id, false);
              try { localStorage.removeItem(hostKey); } catch (e) {}
            }
          }
        }
      } catch (e) {}
      try {
        if (!next) localStorage.removeItem(hostKey);
      } catch (e) {}
    }
    play(next ? 'success' : 'tick');
    await renderTasks();
  } finally {
    setTimeout(() => { _barrierBusy = false; }, 350);
  }
}

async function renderBarrierZone() {
  const box = $('#barrier-zone');
  if (!box) return;
  const list = (await apiFetch('/api/barrier-tasks')) || [];
  const active = list.filter((t) => t.active);
  box.innerHTML = active.length ? active.map((t, i) => `
    <div class="barrier-row">
      <div>
        <div class="habit-title">${esc(t.title)}</div>
        ${t.category ? `<div class="muted">${esc(t.category)}</div>` : ''}
      </div>
      <div style="display:flex;gap:6px">
        <button class="icon-btn" ${i === 0 ? 'disabled' : ''} onclick="moveBarrierTask(${t.id}, -1)" title="أعلى">↑</button>
        <button class="icon-btn" ${i === active.length - 1 ? 'disabled' : ''} onclick="moveBarrierTask(${t.id}, 1)" title="أسفل">↓</button>
        <button class="icon-btn danger" onclick="deleteBarrierTask(${t.id})" title="حذف">✕</button>
      </div>
    </div>`).join('') : '<p class="count">لا عناصر بعد — أضف أول عنصر مثل «التحدث بجرأة».</p>';
}

async function addBarrierTask() {
  const title = $('#bar-title')?.value.trim();
  if (!title) return showToast('العنوان مطلوب', 'bad');
  const category = $('#bar-category')?.value.trim() || '';
  try {
    await apiSend('POST', '/api/barrier-tasks', { title, category });
    play('success');
    showToast('تمت الإضافة');
    $('#bar-title').value = '';
    $('#bar-category').value = '';
    renderBarrierZone();
  } catch (e) { showToast(e.message, 'bad'); }
}

let _reorderBusy = false;
async function moveBarrierTask(id, dir) {
  if (_reorderBusy) return;
  _reorderBusy = true;
  try {
    const list = (await apiFetch('/api/barrier-tasks')) || [];
    const active = list.filter((t) => t.active);
    const idx = active.findIndex((t) => t.id === id);
    const j = idx + dir;
    if (idx === -1 || j < 0 || j >= active.length) return;
    const ids = active.map((t) => t.id);
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    await apiSend('POST', '/api/barrier-tasks/reorder', { ids });
    renderBarrierZone();
  } catch (e) { showToast(e.message, 'bad'); }
  finally { _reorderBusy = false; }
}

async function deleteBarrierTask(id) {
  if (!confirm('حذف هذا العنصر من قائمة كسر الحواجز؟')) return;
  try {
    await apiSend('DELETE', '/api/barrier-tasks/' + id);
    play('tick');
    showToast('تم الحذف');
    renderBarrierZone();
  } catch (e) { showToast(e.message, 'bad'); }
}

/* ===== مهام كسر الحدود (barrier_hosts) ===== */
async function renderBarrierHostZone() {
  const box = $('#barrier-host-zone');
  if (!box) return;
  const list = (await apiFetch('/api/barrier-hosts')) || [];
  const active = list.filter((t) => t.active);
  box.innerHTML = active.length ? active.map((t, i) => `
    <div class="barrier-row">
      <div>
        <div class="habit-title">${esc(t.title)}</div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="icon-btn" ${i === 0 ? 'disabled' : ''} onclick="moveBarrierHost(${t.id}, -1)" title="أعلى">↑</button>
        <button class="icon-btn" ${i === active.length - 1 ? 'disabled' : ''} onclick="moveBarrierHost(${t.id}, 1)" title="أسفل">↓</button>
        <button class="icon-btn danger" onclick="deleteBarrierHost(${t.id})" title="حذف">✕</button>
      </div>
    </div>`).join('') : '<p class="count">لا مهام بعد — أضف مهمة تُكسر فيها الحدود مثل «التحدث باللغة الإنجليزية».</p>';
}

async function addBarrierHost() {
  const title = $('#bar-host-title')?.value.trim();
  if (!title) return showToast('العنوان مطلوب', 'bad');
  try {
    await apiSend('POST', '/api/barrier-hosts', { title });
    play('success');
    showToast('تمت الإضافة');
    $('#bar-host-title').value = '';
    renderBarrierHostZone();
  } catch (e) { showToast(e.message, 'bad'); }
}

async function moveBarrierHost(id, dir) {
  try {
    const list = (await apiFetch('/api/barrier-hosts')) || [];
    const active = list.filter((t) => t.active);
    const idx = active.findIndex((t) => t.id === id);
    const j = idx + dir;
    if (idx === -1 || j < 0 || j >= active.length) return;
    const ids = active.map((t) => t.id);
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    await apiSend('POST', '/api/barrier-hosts/reorder', { ids });
    renderBarrierHostZone();
  } catch (e) { showToast(e.message, 'bad'); }
}

async function deleteBarrierHost(id) {
  if (!confirm('حذف هذه المهمة من قائمة كسر الحدود؟')) return;
  try {
    await apiSend('DELETE', '/api/barrier-hosts/' + id);
    play('tick');
    showToast('تم الحذف');
    renderBarrierHostZone();
  } catch (e) { showToast(e.message, 'bad'); }
}

/* ===== التهيئة الأولى: قيم الحياة ===== */
function renderOnboarding() {
  $('#content').innerHTML = `
    <div class="onboard">
      <div class="card onboard-card">
        <div class="card-body">
          <h2 class="onboard-title">قيم حياتك</h2>
          <p class="onboard-sub">أدخل قيم حياتك كلها — القيمة هي المستوى الأعلى في نظامك (مثال: رياضي، غني، عالِم). داخل كل قيمة أهداف، وداخل الأهداف مهام فرعية (فروع/مراحل)، وداخل المهام الفرعية مشاريع. ستجدها لاحقًا في قسم الأهداف ← مساحة الوعي الذاتي.</p>
          <div class="onboard-list" id="onboard-list"></div>
          <div class="onboard-add">
            <input class="input" id="onboard-input" placeholder="مثال: رياضي / غني / عالِم" autofocus>
            <button class="btn" onclick="addOnboardGoal()">+ إضافة</button>
          </div>
          <div class="onboard-colors" id="onboard-colors">
            ${COLORS.map((c, i) => `<label class="day-opt color-opt" title="${c}"><input type="radio" name="onboard-color" value="${c}" ${i === 0 ? 'checked' : ''}><span class="dot" style="background:${c}"></span></label>`).join('')}
          </div>
          <div class="modal-actions">
            <button class="btn btn-lg" onclick="finishOnboarding()">✓ حفظ وبدء الرحلة</button>
          </div>
        </div>
      </div>
    </div>`;
  renderOnboardList();
  const inp = $('#onboard-input');
  if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') addOnboardGoal(); });
}

let onboardGoals = [];
function renderOnboardList() {
  const list = $('#onboard-list');
  if (!list) return;
  list.innerHTML = onboardGoals.length
    ? onboardGoals.map((g, i) => `<div class="onboard-item"><span class="dot" style="background:${g.color}"></span><span class="onboard-item-title">${esc(g.title)}</span><button class="icon-btn danger" onclick="removeOnboardGoal(${i})">✕</button></div>`).join('')
    : '<p class="count">لا قيم بعد — أضف أول قيمة.</p>';
}
function addOnboardGoal() {
  const title = $('#onboard-input').value.trim();
  if (!title) return showToast('اكتب اسم القيمة', 'bad');
  const color = document.querySelector('input[name="onboard-color"]:checked')?.value || NOOR_ACCENT;
  onboardGoals.push({ title, color });
  $('#onboard-input').value = '';
  renderOnboardList();
  $('#onboard-input').focus();
}
function removeOnboardGoal(i) {
  onboardGoals.splice(i, 1);
  renderOnboardList();
}
async function finishOnboarding() {
  if (!onboardGoals.length) return showToast('أضف قيمة واحدة على الأقل', 'bad');
  try {
    NoorStore.setLifeStart(todayISO());
    onboardGoals.forEach((g) => NoorStore.addValue({ title: g.title, color: g.color }));
    play('success');
    closeModal();
    await renderTasks();
    /* الخطوة التالية أمام المستخدم مباشرة: زر واحد يفتح نافذة أول هدف */
    const vals = NoorStore.getValues();
    const firstValId = vals.length ? vals[0].id : null;
    openModal('🎉 بدأت رحلتك!', `
      <p style="margin-bottom:14px">حُفظت قيمك وبدأ عدّ رحلتك اليوم. الخطوة التالية: حوّل أول قيمة إلى هدف واضح.</p>
      <div class="modal-actions">
        <button class="btn btn-lg" onclick="closeModal(); openGoalModal(null, ${JSON.stringify(firstValId)})">➕ أضف هدفك الأول</button>
        <button class="btn btn-ghost" onclick="closeModal()">لاحقًا</button>
      </div>`);
  } catch (err) { showToast(err.message, 'bad'); }
}

/* صف مهمة عادية/عادة ضمن القائمة الموحدة — نفس بنية taskRowHTML لكل الصفوف */
function taskRow(t) {
  const idArg = qid(t.id);
  const isHost = state.barrierHost && String(state.barrierHost.id) === String(t.id);
  const isHabit = t.source === 'habit';
  const badge = isHost
    ? '<button type="button" class="host-badge" onclick="event.stopPropagation();openBarrierMoveModal()" title="شارة كسر الحدود — اضغط لنقلها لمهمة أخرى">🔥 كسر الحدود</button> '
    : '';
  let actions = '';
  if (state.barrier) {
    actions += isHost
      ? '<button class="icon-btn" onclick="event.stopPropagation();openBarrierMoveModal()" title="نقل الشارة لمهمة أخرى">⇄</button>'
      : `<button class="icon-btn" onclick="event.stopPropagation();moveBadgeHere(${idArg})" title="اجعل هذه المهمة موضع شارة كسر الحدود">⇄</button>`;
  }
  if (isHabit) {
    actions += `<button class="icon-btn" onclick="event.stopPropagation();editTaskHabit(${Number(t.src_id)})" title="تعديل العادة">✎</button>`;
  } else {
    actions += `<button class="icon-btn" onclick="event.stopPropagation();openTaskChallengeModal(${idArg})" title="تحويل المهمة إلى تحدي بمدة محددة">⚔️</button>`
      + `<button class="icon-btn" onclick="openTaskModal(${t.id})" title="تعديل">✎</button>`
      + `<button class="icon-btn danger" onclick="archiveTask(${t.id})" title="أرشفة">✕</button>`
      + '<span class="grip" draggable="true" title="اسحب للترتيب"><i></i><i></i><i></i><i></i><i></i><i></i></span>';
  }
  let titleHTML = esc(t.title);
  if (t.source === 'project' && t.project_id && !isHabit) {
    const proj = state.projects.find((p) => p.id === t.project_id);
    if (proj && proj.type === 'عادة') {
      titleHTML = `<span class="count" style="margin-inline-start:4px">${esc(proj.name)}</span> ` + titleHTML;
    }
  }
  return taskRowHTML({
    dataId: t.id,
    done: t.done,
    checkOnclick: `toggleTask(${idArg})`,
    checkTitle: t.done ? 'إلغاء الإنجاز' : 'إتمام المهمة',
    mainOnclick: isHabit ? `editTaskHabit(${Number(t.src_id)})` : `openTaskModal(${t.id})`,
    badge,
    titleHTML,
    descHTML: t.desc ? `<div class="task-desc">${esc(t.desc)}</div>` : '',
    actionsHTML: actions
  });
}

/* تعديل عادة من صف القائمة: يضمن تحميل قائمة العادات أولًا،
   وإن كانت العادة من المخزن القديم يفتح مدير العادات بدلاً من زر ميت */
async function editTaskHabit(habitId) {
  try {
    if (!state.habitsList || !state.habitsList.length) state.habitsList = (await apiFetch('/api/habits')) || [];
  } catch (e) { state.habitsList = state.habitsList || []; }
  const h = state.habitsList.find((x) => Number(x.id) === Number(habitId));
  if (!h) return openHabitsModal();
  editHabit(Number(habitId));
}

let _dndStyleInjected = false;
function injectDndStyles() {
  if (_dndStyleInjected) return;
  _dndStyleInjected = true;
  const s = document.createElement('style');
  s.textContent = '.task-dragging{opacity:.35!important;transform:scale(.97);transition:opacity .15s,transform .15s}.task.drag-over{border-top:3px solid var(--accent)!important;padding-top:2px}.task:not(.task-dragging) .grip{cursor:grab}.task-dragging .grip{cursor:grabbing}';
  document.head.appendChild(s);
}
function bindDnD() {
  const list = $('#task-list');
  if (!list) return;
  injectDndStyles();
  let dragId = null;
  let dragEl = null;
  list.querySelectorAll('.grip').forEach((g) => {
    g.setAttribute('draggable', 'true');
    g.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      dragEl = g.closest('.task');
      dragId = dragEl ? dragEl.dataset.id : null;
      if (dragEl) dragEl.classList.add('task-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragId || '');
    });
    g.addEventListener('dragend', () => {
      if (dragEl) dragEl.classList.remove('task-dragging');
      list.querySelectorAll('.drag-over').forEach((c) => c.classList.remove('drag-over'));
      dragId = null;
      dragEl = null;
    });
  });
  list.querySelectorAll('.task').forEach((card) => {
    if (isNaN(Number(card.dataset.id))) return;
    card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('drag-over'); });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', async (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      if (!dragId || dragId === card.dataset.id) return;
      const cards = [...list.querySelectorAll('.task')];
      const from = cards.findIndex((c) => c.dataset.id === dragId);
      const to = cards.findIndex((c) => c.dataset.id === card.dataset.id);
      if (from < 0 || to < 0) return;
      const moved = cards.splice(from, 1);
      cards.splice(to, 0, moved[0]);
      const ids = cards.map((c) => Number(c.dataset.id)).filter((n) => !isNaN(n));
      try {
        NoorStore.reorderTasks(ids);
        await renderTasks();
      } catch (err) { showToast(err.message, 'bad'); }
    });
  });
}

const toggleTaskBusy = new Set();
async function toggleTask(id) {
  if (toggleTaskBusy.has(id)) return;
  toggleTaskBusy.add(id);
  try {
    if (typeof id === 'string' && id.indexOf('api-habit-') === 0) {
      const hid = Number(id.slice(10));
      const h = (state.apiTodayHabits || []).find((x) => x.id === hid);
      if (!h) return;
      h.done = h.done ? 0 : 1;
      await apiSend('PUT', '/api/habits/' + hid + '/log', { date: todayISO(), done: h.done ? 1 : 0 });
      play(h.done ? 'success' : 'tick');
      await renderTasks();
      return;
    }
    const t = state.daily && state.daily.tasks.find((x) => x.id === id);
    if (!t) return;
    t.done = !t.done;
    NoorStore.toggleTask(id, t.done);
    play(t.done ? 'success' : 'tick');
    await renderTasks();
  } catch (err) { showToast(err.message, 'bad'); }
  setTimeout(() => toggleTaskBusy.delete(id), 300);
}

async function archiveTask(id) {
  if (!confirm('أرشفة هذه المهمة؟ لن تُحذف نهائيًا بل ستنتقل إلى الأرشيف.')) return;
  try {
    play('tick');
    const t = state.daily && state.daily.tasks.find((x) => x.id === id);
    if (t && t.source === 'project' && t.src_id) {
      NoorStore.archiveProjectTask(t.src_id);
      showToast('أُرشف المهمة — لن تظهر بعد الآن');
    } else {
      NoorStore.archiveTask(id);
      showToast('تمت الأرشفة');
    }
    await renderTasks();
  } catch (err) { showToast(err.message, 'bad'); }
}

function openTaskModal(id) {
  const t = id && state.daily ? state.daily.tasks.find((x) => x.id === id) : null;
  openModal(t ? 'تعديل المهمة' : 'مهمة جديدة', `
    <div class="field"><label>عنوان المهمة</label><input class="input" id="m-title" value="${t ? esc(t.title) : ''}" placeholder="مثال: قراءة 20 صفحة" autofocus></div>
    <div class="field"><label>وصف المهمة (اختياري)</label><textarea class="input" id="m-desc" rows="3">${t ? esc(t.desc) : ''}</textarea></div>
    <div class="field"><label>فئة المهمة — من أي مشروع</label>
      <select class="input" id="m-project">
        <option value="">— بدون مشروع —</option>
        ${state.projects.map((p) => `<option value="${p.id}" ${t && t.project_id === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="saveTask(${t ? t.id : 'null'})">${t ? 'حفظ التعديلات' : 'إضافة'}</button>
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>`);
}

async function saveTask(id) {
  const title = $('#m-title').value.trim();
  if (!title) return showToast('أدخل عنوان المهمة', 'bad');
  const desc = $('#m-desc').value.trim();
  const project_id = $('#m-project').value || null;
  try {
    if (id) NoorStore.updateTask(id, { title, desc, project_id });
    else NoorStore.addTask({ title, desc, project_id });
    closeModal();
    play('success');
    showToast('تم الحفظ');
    await renderTasks();
  } catch (err) { showToast(err.message, 'bad'); }
}

/* ===== تحويل مهمة إلى تحدي شخصي بمدة أيام محددة — مستقل تمامًا عن نظام كسر الحواجز ===== */
function openTaskChallengeModal(taskId) {
  const t = state.daily && state.daily.tasks.find((x) => x.id === taskId);
  if (!t) return showToast('المهمة غير موجودة', 'bad');
  openModal('⚔️ تحويل إلى تحدي', `
    <p class="count" style="margin-bottom:10px">حوّل هذه المهمة إلى تحدٍّ بمدة محددة — مثال: «ختم القرآن في يوم». يظهر التحدي في قسم التحديات أسفل مهام اليوم، ولا يؤثر على نظام كسر الحواجز.</p>
    <div class="field"><label>اسم التحدي</label><input class="input" id="ch-title" value="${esc(t.title)}" placeholder="مثال: ختم القرآن"></div>
    <div class="field"><label>مدة التحدي (عدد الأيام)</label><input class="input" type="number" id="ch-days" min="1" max="365" value="1"></div>
    <div class="modal-actions">
      <button class="btn" onclick="submitTaskChallenge(${t.id})">⚔️ إطلاق التحدي</button>
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>`);
}

async function submitTaskChallenge(taskId) {
  const title = ($('#ch-title') && $('#ch-title').value.trim()) || '';
  const total = Number(($('#ch-days') && $('#ch-days').value) || 1);
  if (!title) return showToast('اكتب اسم التحدي', 'bad');
  if (!(total >= 1 && total <= 365)) return showToast('المدة يجب أن تكون بين 1 و365 يومًا', 'bad');
  try {
    NoorStore.addChallenge({ task_id: taskId, title, total });
    closeModal();
    play('success');
    showToast('أُطلق التحدي ⚔️ — تجده أسفل مهام اليوم');
    await renderTasks();
  } catch (err) { showToast(err.message, 'bad'); }
}

/* قسم التحديات الجارية أسفل مهام اليوم — شبكة أيام يُعلَّم كل منها عند الإنجاز */
function challengesZoneHTML() {
  let list = [];
  try { list = NoorStore.getChallenges(); } catch (e) { return ''; }
  if (!list.length) return '';
  const today = todayISO();
  const cards = list.map((c) => {
    let doneN = 0;
    const days = [];
    for (let i = 0; i < c.total; i++) {
      const ds = addDaysISO(c.start, i);
      const isDone = c.done_dates.indexOf(ds) >= 0;
      if (isDone) doneN++;
      const future = ds > today;
      days.push(`<div class="ch-day${isDone ? ' done' : ''}${future ? ' future' : ''}${ds === today ? ' today' : ''}"${future ? '' : ` onclick="challengeToggleDay(${c.id},'${ds}')"`} title="${ds}${future ? ' — لم يحن بعده' : ''}"><span class="dnum">${i + 1}</span>${isDone ? '<span class="dmark">✓</span>' : ''}</div>`);
    }
    const pct = Math.round((doneN / c.total) * 100);
    const complete = doneN >= c.total;
    return `<div class="card ch-card${complete ? ' ch-complete' : ''}">
      <div class="card-head"><h3 class="card-title">${complete ? '🏆' : '⚔️'} ${esc(c.title)}</h3>
        <span style="display:flex;gap:8px;align-items:center">
          <span class="streak-pill">${doneN}/${c.total} · ${pct}%</span>
          <button class="btn btn-xs btn-danger" onclick="deleteChallengeUI(${c.id})" title="حذف التحدي">🗑</button>
        </span></div>
      <div class="card-body">
        <div class="an-bar" style="margin-bottom:10px"><span class="an-fill" style="width:${pct}%"></span></div>
        <div class="ch-grid">${days.join('')}</div>
        <p class="count" style="margin-top:8px">${complete ? 'اكتمل التحدي بالكامل — أبدعت!' : (c.total === 1 ? 'يوم واحد — أنجزه اليوم ليكتمل التحدي' : 'اضغط مربع اليوم بعد إنجازه')}${c.start !== today ? ' · بدأ ' + fmtDateAr(c.start) : ''}</p>
      </div></div>`;
  }).join('');
  return `<h3 class="card-title mt">⚔️ التحديات الجارية</h3><div class="grid-2">${cards}</div>`;
}

async function challengeToggleDay(id, ds) {
  try {
    NoorStore.toggleChallengeDay(id, ds);
    play('tick');
    await renderTasks();
  } catch (err) { showToast(err.message, 'bad'); }
}

async function deleteChallengeUI(id) {
  if (!confirm('حذف هذا التحدي؟ سينتقل إلى بيانات المؤرشفة ولن يظهر مجددًا.')) return;
  try {
    NoorStore.archiveChallenge(id);
    play('tick');
    showToast('حُذف التحدي');
    await renderTasks();
  } catch (err) { showToast(err.message, 'bad'); }
}


/* ===== إدارة الأهداف (تستخدم في الإعدادات وقسم الأهداف) ===== */
function openGoalModal(id, valueId) {
  const goals = NoorStore.getGoals();
  const values = NoorStore.getValues();
  const g = id ? goals.find((x) => x.id === id) : null;
  const colors = COLORS;
  const dfltYear = state.yearSel || NoorStore.yearIndex(NoorStore.todayStr());
  const durType = (g && g.duration_type) || 'weeks';
  const emojiGrid = GOAL_EMOJI_CATS.map((cat) =>
    `<div class="emoji-cat"><span class="emoji-cat-label">${esc(cat.label)}</span><div class="emoji-grid">${cat.emojis.map((ic) => `<label class="day-opt icon-opt"><input type="radio" name="g-icon" value="${ic}" ${(g && g.icon === ic) ? 'checked' : ''}>${ic}</label>`).join('')}</div></div>`
  ).join('');
  openModal(g ? 'تعديل الهدف' : 'هدف جديد', `
    <div class="field"><label>عنوان الهدف</label><input class="input" id="g-title" value="${g ? esc(g.title) : ''}" placeholder="مثال: أن أصبح رياضيًا"></div>
    <div class="field"><label>القيمة (المستوى الأعلى — اختياري)</label>
      <select class="input" id="g-value">
        <option value="">— بدون قيمة —</option>
        ${values.map((v) => `<option value="${v.id}" ${(g ? g.value_id : (valueId || null)) === v.id ? 'selected' : ''}>${esc(v.title)}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>تفاصيل الهدف</label><textarea class="input" id="g-details" rows="3" placeholder="وصف تفصيلي للهدف، خطواته، معايير الإنجاز...">${g ? esc(g.details || '') : ''}</textarea></div>
    <div class="field"><label>الأيقونة</label>
      <div class="emoji-picker-wrap">${emojiGrid}</div>
    </div>
    <div class="field"><label>اللون</label>
      <div class="day-pick">
        ${colors.map((c) => `<label class="day-opt color-opt" title="${c}"><input type="radio" name="g-color" value="${c}" ${(!g && c === colors[0]) || (g && g.color === c) ? 'checked' : ''}><span class="dot" style="background:${c}"></span></label>`).join('')}
      </div>
    </div>
    <div class="field-row">
      <div class="field"><label>مدة الهدف</label>
        <div class="field-row">
          <input class="input" id="g-duration" type="number" min="1" step="1" value="${g ? (g.duration_years || 1) : 1}">
          <select class="input" id="g-dur-type" style="max-width:140px" onchange="document.getElementById('g-dur-label').textContent=this.value==='months'?'شهر':this.value==='quarters'?'أرباع سنة':'سنوات'">
            <option value="weeks" ${durType === 'weeks' ? 'selected' : ''}>أسابيع</option>
            <option value="months" ${durType === 'months' ? 'selected' : ''}>أشهر</option>
            <option value="quarters" ${durType === 'quarters' ? 'selected' : ''}>أرباع سنة</option>
          </select>
        </div>
      </div>
      <div class="field"><label>من سنة</label><input class="input" id="g-yr-from" type="number" min="1" value="${g ? g.year : dfltYear}"></div>
      <div class="field"><label>إلى سنة</label><input class="input" id="g-yr-to" type="number" min="1" value="${g ? (g.years && g.years.length ? Math.max.apply(null, g.years) : g.year) : dfltYear}"></div>
      <div class="field"><label>&nbsp;</label><button class="btn" onclick="applyGoalYearRange()">تطبيق المدى</button></div>
    </div>
    <div class="field"><label>سنوات ظهور الهدف (اختر من الخطة — لا يظهر في غيرها)</label>
      <div class="day-pick" id="g-years" style="max-height:170px;overflow:auto">${yearChipsHTML(g, dfltYear)}</div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="saveGoal(${g ? g.id : 'null'})">${g ? 'حفظ التعديلات' : 'إنشاء'}</button>
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>`);
}

/* رقاقات اختيار سنوات الظهور في مودال الهدف */
function yearChipsHTML(g, dfltYear) {
  const planYears = Math.max(6, Math.round(Number(NoorStore.getSettings().plan_years) || 20));
  const maxY = Math.max(planYears, NoorStore.yearIndex(NoorStore.todayStr()) + 2);
  const selected = g && g.years && g.years.length ? g.years : [dfltYear || 1];
  const chips = [];
  for (let y = 1; y <= maxY; y++) {
    const on = selected.indexOf(y) >= 0;
    chips.push(`<label class="day-opt year-opt${on ? ' on' : ''}"><input type="checkbox" name="g-year-chk" value="${y}" ${on ? 'checked' : ''}>سنة ${y}</label>`);
  }
  return chips.join('');
}

function applyGoalYearRange() {
  const from = Math.max(1, parseInt($('#g-yr-from').value) || 1);
  const to = Math.max(from, parseInt($('#g-yr-to').value) || from);
  document.querySelectorAll('input[name="g-year-chk"]').forEach((c) => {
    const y = Number(c.value);
    c.checked = y >= from && y <= to;
    if (c.closest('label')) c.closest('label').classList.toggle('on', c.checked);
  });
  play('tick');
}

async function saveGoal(id) {
  const title = $('#g-title').value.trim();
  if (!title) return showToast('أدخل عنوان الهدف', 'bad');
  const icon = document.querySelector('input[name="g-icon"]:checked')?.value || '🎯';
  const color = document.querySelector('input[name="g-color"]:checked')?.value || NOOR_ACCENT;
  const duration = Math.max(1, parseInt($('#g-duration').value) || 1);
  const duration_type = $('#g-dur-type')?.value || 'weeks';
  const details = ($('#g-details')?.value || '').trim();
  let years = Array.from(document.querySelectorAll('input[name="g-year-chk"]:checked'))
    .map((c) => Number(c.value)).sort((a, b) => a - b);
  if (!years.length) {
    const dflt = Math.max(1, parseInt($('#g-yr-from').value) || 1);
    years = [dflt];
  }
  const year = years[0];
  const value_id = Number($('#g-value').value) || null;
  try {
    if (id) NoorStore.updateGoal(id, { title, icon, color, year, years, duration_years: duration, duration_type, details, value_id });
    else NoorStore.addGoal({ title, icon, color, year, years, duration_years: duration, duration_type, details, value_id });
    closeModal();
    play('success');
    showToast('تم الحفظ');
    refreshGoalsViews();
  } catch (err) { showToast(err.message, 'bad'); }
}

function refreshGoalsViews() {
  if (state.page === 'journal') renderJournal().catch(function (e) { console.error(e); });
  else if (state.page === 'vision') renderVision().catch(function (e) { console.error(e); });
  else if (state.page === 'stats') renderStats().catch(function (e) { console.error(e); });
}

async function toggleGoalComplete(id) {
  try {
    NoorStore.toggleGoalComplete(id);
    play('success');
    showToast('تم تحديث حالة الهدف');
    refreshGoalsViews();
  } catch (err) { showToast(err.message, 'bad'); }
}

async function archiveGoalItem(id) {
  if (!confirm('أرشفة هذا الهدف مع كل مهامه الفرعية وعاداته ومشاريعه؟')) return;
  try {
    play('tick');
    NoorStore.archiveGoal(id);
    closeModal();
    showToast('تمت الأرشفة');
    refreshGoalsViews();
  } catch (err) { showToast(err.message, 'bad'); }
}

/* ===== إدارة القيم (المستوى الأعلى في قسم الأهداف) ===== */
function openValueModal(id) {
  const values = NoorStore.getValues();
  const v = id ? values.find((x) => x.id === id) : null;
  const colors = COLORS;
  const icons = ['◆', '⭐', '💎', '🌱', '🕋', '🎯', '❤️', '🧠', '💰', '💪', '📚', '👑'];
  openModal(v ? 'تعديل القيمة' : 'قيمة جديدة', `
    <div class="field"><label>عنوان القيمة</label><input class="input" id="v-title" value="${v ? esc(v.title) : ''}" placeholder="مثال: رياضي / غني / عالِم"></div>
    <div class="field"><label>الأيقونة</label>
      <div class="day-pick">
        ${icons.map((ic) => `<label class="day-opt icon-opt"><input type="radio" name="v-icon" value="${ic}" ${(v && v.icon === ic) || (!v && ic === '◆') ? 'checked' : ''}>${ic}</label>`).join('')}
      </div>
    </div>
    <div class="field"><label>اللون</label>
      <div class="day-pick">
        ${colors.map((c) => `<label class="day-opt color-opt" title="${c}"><input type="radio" name="v-color" value="${c}" ${(!v && c === colors[0]) || (v && v.color === c) ? 'checked' : ''}><span class="dot" style="background:${c}"></span></label>`).join('')}
      </div>
    </div>
    <div class="field"><label>أولوية القيمة (1 = الأعلى — تحدد ترتيب الظهور بين القيم)</label><input class="input" id="v-priority" type="number" min="1" value="${v ? (v.priority || 999) : (values.reduce((m, x) => Math.max(m, x.priority || 0), 0) + 1)}"></div>
    <div class="modal-actions">
      <button class="btn" onclick="saveValue(${v ? v.id : 'null'})">${v ? 'حفظ التعديلات' : 'إضافة'}</button>
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>`);
}

async function saveValue(id) {
  const title = $('#v-title').value.trim();
  if (!title) return showToast('أدخل عنوان القيمة', 'bad');
  const icon = document.querySelector('input[name="v-icon"]:checked')?.value || '◆';
  const color = document.querySelector('input[name="v-color"]:checked')?.value || NOOR_ACCENT;
  const priority = Math.max(1, parseInt($('#v-priority').value) || 999);
  try {
    if (id) NoorStore.updateValue(id, { title, icon, color, priority });
    else NoorStore.addValue({ title, icon, color, priority });
    closeModal();
    play('success');
    showToast('تم الحفظ');
    refreshGoalsViews();
  } catch (err) { showToast(err.message, 'bad'); }
}

async function archiveValueItem(id) {
  if (!confirm('أرشفة هذه القيمة؟ (أهدافها ومهامها الفرعية ومشاريعها تبقى لكن بدون قيمة)')) return;
  try {
    play('tick');
    NoorStore.archiveValue(id);
    closeModal();
    showToast('تمت الأرشفة');
    refreshGoalsViews();
  } catch (err) { showToast(err.message, 'bad'); }
}

/* ===== إدارة المهام الفرعية ===== */
function openSubgoalModal(goalId, id) {
  const goals = NoorStore.getGoals();
  const s = id ? goals.flatMap((g) => NoorStore.getSubgoals(g.id)).find((x) => x.id === id) : null;
  const gid = s ? s.goal_id : (goalId || (goals[0] ? goals[0].id : null));
  const year = goals.find((g) => g.id === gid)?.year || state.yearSel || 1;
  const siblings = gid ? NoorStore.getSubgoals(gid) : [];
  const maxPrio = siblings.reduce((m, x) => Math.max(m, x.priority || 0), 0);
  const dfltPrio = s ? (s.priority || 999) : (maxPrio + 1);
  openModal(s ? 'تعديل المهمة الفرعية' : 'مهمة فرعية جديدة', `
    <div class="field"><label>الهدف</label>
      <select class="input" id="sg-goal">
        ${goals.map((g) => `<option value="${g.id}" ${g.id === gid ? 'selected' : ''}>${esc(g.title)} (سنة ${g.year})</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>عنوان المهمة الفرعية</label><input class="input" id="sg-title" value="${s ? esc(s.title) : ''}" placeholder="مثال: بناء القدرة على الجري 10 كم"></div>
    <div class="field"><label>أسبوع المهمة (ضمن السنة ${year})</label>
      <input class="input" id="sg-week" type="number" min="1" max="${NoorStore.yearWeeks()}" value="${s ? s.week : NoorStore.weekInYear(NoorStore.todayStr())}">
    </div>
    <div class="field-row">
      <div class="field"><label>الأولوية (1 = الأعلى — تحدد ترتيب ظهور الفرع بين أخواته)</label><input class="input" id="sg-priority" type="number" min="1" max="999" value="${dfltPrio}"></div>
      <div class="field"><label>المدة بالأسابيع</label><input class="input" id="sg-weeks" type="number" min="1" value="${s ? (s.weeks || 1) : 1}"></div>
    </div>
    <p class="count" style="display:block">52 أسبوع = سنة · 78 = سنة ونصف</p>
    <div class="modal-actions">
      <button class="btn" onclick="saveSubgoal(${s ? s.id : 'null'})">${s ? 'حفظ التعديلات' : 'إضافة'}</button>
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>`);
}

async function saveSubgoal(id) {
  const goal_id = Number($('#sg-goal').value);
  const title = $('#sg-title').value.trim();
  if (!title) return showToast('أدخل عنوان المهمة الفرعية', 'bad');
  const week = Math.max(1, parseInt($('#sg-week').value) || 1);
  const priority = Math.max(1, parseInt($('#sg-priority').value) || 999);
  const weeks = Math.max(1, parseInt($('#sg-weeks').value) || 1);
  try {
    if (id) NoorStore.updateSubgoal(id, { title, week, priority, weeks });
    else NoorStore.addSubgoal({ goal_id, title, week, priority, weeks });
    closeModal();
    play('success');
    showToast('تم الحفظ');
    refreshGoalsViews();
  } catch (err) { showToast(err.message, 'bad'); }
}

async function archiveSubgoalItem(id) {
  if (!confirm('أرشفة هذه المهمة الفرعية مع عاداتها ومشاريعها؟')) return;
  try {
    play('tick');
    NoorStore.archiveSubgoal(id);
    closeModal();
    showToast('تمت الأرشفة');
    refreshGoalsViews();
  } catch (err) { showToast(err.message, 'bad'); }
}

/* ===== إدارة العادات ===== */
function openHabitModal(subgoalId, id) {
  const allHabits = NoorStore.getGoals().flatMap((g) => NoorStore.getSubgoals(g.id)).flatMap((s) => NoorStore.getHabits({ subgoal_id: s.id }));
  const h = id ? allHabits.find((x) => x.id === id) : null;
  const goals = NoorStore.getGoals();
  const sgid = h ? h.subgoal_id : (subgoalId || null);
  const gid = h ? h.goal_id : (goals[0] ? goals[0].id : null);
  const week = h ? h.week : NoorStore.weekInYear(NoorStore.todayStr());
  const icons = ['🏃', '📖', '✍️', '🧠', '💧', '🙏', '🌙', '🥗', '🏋️', '🎵', '🗣️', '⭐'];
  openModal(h ? 'تعديل العادة' : 'عادة جديدة', `
    <div class="field"><label>الهدف</label>
      <select class="input" id="hb-goal" onchange="onHabitGoalPick()">
        ${goals.map((g) => `<option value="${g.id}" ${g.id === gid ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>المهمة الفرعية</label>
      <select class="input" id="hb-subgoal">
        ${NoorStore.getSubgoals(gid).map((s) => `<option value="${s.id}" ${s.id === sgid ? 'selected' : ''}>${esc(s.title)} (أسبوع ${s.week})</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>اسم العادة</label><input class="input" id="hb-title" value="${h ? esc(h.title) : ''}" placeholder="مثال: جري 20 دقيقة"></div>
    <div class="field"><label>الأيقونة</label>
      <div class="day-pick">
        ${icons.map((ic) => `<label class="day-opt icon-opt"><input type="radio" name="hb-icon" value="${ic}" ${(h && h.icon === ic) || (!h && ic === '⭐') ? 'checked' : ''}>${ic}</label>`).join('')}
      </div>
    </div>
    <div class="field"><label>أيام التكرار</label>
      <div class="day-pick">
        ${DAY_NAMES.map((d, i) => `<label class="day-opt"><input type="checkbox" name="hb-day" value="${i}" ${h && h.days.includes(i) ? 'checked' : ''}>${d}</label>`).join('')}
      </div>
    </div>
    <div class="field"><label>الدقائق يوميًا</label><input class="input" id="hb-minutes" type="number" min="0" value="${h ? h.minutes : 20}"></div>
    <div class="field-row">
      <div class="field"><label>يبدأ من الأسبوع</label><input class="input" id="hb-week" type="number" min="1" max="${NoorStore.yearWeeks()}" value="${h ? h.week : week}"></div>
      <div class="field"><label>عدد الأسابيع</label><input class="input" id="hb-weeks" type="number" min="1" value="${h ? h.weeks : 12}"></div>
    </div>
    <div class="field"><label>الأولوية (1 = الأعلى — تُرتب مهام العادات تلقائيًا)</label><input class="input" id="hb-priority" type="number" min="1" max="100" value="${h ? (h.priority || 99) : 99}"></div>
    <div class="modal-actions">
      <button class="btn" onclick="saveHabit(${h ? h.id : 'null'})">${h ? 'حفظ التعديلات' : 'إضافة'}</button>
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>`);
}

function onHabitGoalPick() {
  const gid = Number($('#hb-goal').value);
  $('#hb-subgoal').innerHTML = NoorStore.getSubgoals(gid).map((s) => `<option value="${s.id}">${esc(s.title)} (أسبوع ${s.week})</option>`).join('');
}

async function saveHabit(id) {
  const subgoal_id = Number($('#hb-subgoal').value);
  const title = $('#hb-title').value.trim();
  if (!title) return showToast('أدخل اسم العادة', 'bad');
  const icon = document.querySelector('input[name="hb-icon"]:checked')?.value || '⭐';
  const days = [...document.querySelectorAll('#modalBody input[name="hb-day"]:checked')].map((c) => Number(c.value));
  if (!days.length) return showToast('اختر يومًا واحدًا على الأقل', 'bad');
  const minutes = Math.max(0, parseInt($('#hb-minutes').value) || 0);
  const week = Math.max(1, parseInt($('#hb-week').value) || 1);
  const weeks = Math.max(1, parseInt($('#hb-weeks').value) || 1);
  const priority = Math.max(1, parseInt($('#hb-priority').value) || 99);
  try {
    if (id) NoorStore.updateHabit(id, { title, icon, days, minutes, week, weeks, priority });
    else NoorStore.addHabit({ subgoal_id, title, icon, days, minutes, week, weeks, priority, start_date: weekStartForSub(subgoal_id, week) });
    closeModal();
    play('success');
    showToast('تم الحفظ — ستظهر العادة في مهام أيامها تلقائيًا');
  } catch (err) { showToast(err.message, 'bad'); }
}

async function archiveHabitItem(id) {
  if (!confirm('أرشفة هذه العادة؟')) return;
  try {
    play('tick');
    NoorStore.archiveHabit(id);
    closeModal();
    showToast('تمت الأرشفة');
  } catch (err) { showToast(err.message, 'bad'); }
}

/* ===== صفحة المشاريع النشطة (شريط جانبي) ===== */
async function renderProjects() {
  const LIBRARY_TYPES = ['كتاب', 'فيديو', 'كورس'];
  const projects = NoorStore.getProjects().slice().filter((p) => !LIBRARY_TYPES.includes(p.type)).sort((a, b) => (a.priority || 999) - (b.priority || 999));
  const activeAll = projects.filter((p) => !p.completed_at);
  /* قاعدة التركيز المضاد للتشتت: مشروع واحد فقط يُعرض لكل هدف (الأعلى أولوية)،
     والمشاريع المستقلة بلا هدف تظهر كلها. البقية في طابور الانتظار ويرتّب تلقائيًا عند الإنجاز. */
  const seenGoal = {};
  const active = [];
  const queued = [];
  activeAll.forEach((p) => {
    if (!p.goal_id) { active.push(p); return; }
    if (!seenGoal[p.goal_id]) { seenGoal[p.goal_id] = true; active.push(p); }
    else queued.push(p);
  });
  /* وضع التركيز لا يغيّر ترتيب البطاقات ولا مواضعها — شارة صغيرة فقط */
  const done = projects.filter((p) => p.completed_at);
  const today = NoorStore.todayStr();
  const nowWeek = NoorStore.weekInYear(today);
  const ws = NoorStore.weekStartDate(NoorStore.yearIndex(today), nowWeek);
  const sessions = NoorStore.getSessions({ from: ws, to: today });
  const focusByProject = {};
  sessions.forEach((s) => { if (s.mode !== 'break' && s.project_id) focusByProject[s.project_id] = (focusByProject[s.project_id] || 0) + s.minutes; });
  const goals = NoorStore.getGoals();
  const goalOf = (id) => goals.find((g) => g.id === id);
  const subOf = (sid) => { for (const g of goals) { const s = NoorStore.getSubgoals(g.id).find((x) => x.id === sid); if (s) return s; } return null; };

  const card = (p) => {
    const goal = goalOf(p.goal_id);
    const sub = subOf(p.subgoal_id);
    const focus = focusByProject[p.id] || 0;
    const inWindow = p.week <= nowWeek && nowWeek <= p.week + p.weeks - 1;
    const remaining = p.tasks.filter((t) => !t.completed_at).length;
    const context = [goal ? goal.title : null, sub ? sub.title : null].filter(Boolean).join(' · ');
    const subText = p.notes || context || 'مشروع تركيز';
    const weekTag = `أسبوع ${p.week}${p.weeks > 1 ? `-${p.week + p.weeks - 1}` : ''}`;
    const pt = projectType(p.type);
    const isMedia = p.type !== 'عام';
    const cover = isMedia && p.cover ? `<div class="pcard-cover"><img src="${cachedCover(p.cover)}" alt="" loading="lazy" onerror="this.closest('.pcard-cover').style.display='none'"></div>` : '';
    const rating = p.rating > 0 ? starsHTML(p.rating) : '';
    const mediaMeta = isMedia ? `<div class="pcard-meta">${p.author ? `<span class="pcard-author">${pt.icon} ${esc(p.author)}</span>` : ''}${rating}</div>` : '';
    const mediaSummary = isMedia && p.summary ? `<div class="pcard-summary">${esc(p.summary.length > 150 ? p.summary.slice(0, 150) + '…' : p.summary)}</div>` : '';
    return `
      <div class="card pcard${p.focused ? ' pcard-focused' : ''}" style="--box-color:${esc(p.color) || NOOR_ACCENT}" onclick="openProjectTasksModal(${p.id})" title="اضغط للدخول إلى المشروع وتعديل مهامه">
        ${cover}
        <div class="pcard-top">
          <div class="item-ic">${isMedia ? pt.icon : '📂'}</div>
          <div class="item-body">
            <div class="item-title">${esc(p.name)}${p.focused ? ' <span class="tag gold" style="font-size:var(--fs-xs);padding:1px 6px;vertical-align:middle">مركّز</span>' : ''}</div>
            <div class="item-sub">${esc(subText)}</div>
            ${mediaMeta}
          </div>
        </div>
        ${mediaSummary}
        <div class="pcard-tags">
          <span>
            <span class="chip ${p.type === 'كتاب' ? 'chip-blue' : (p.type === 'فيديو' ? 'chip-warn' : 'chip-gray')}">${pt.icon} ${esc(pt.title)}</span>
            <span class="tag ${inWindow ? 'gold' : 'blue'}">${inWindow ? '🎯 تركيز هذا الأسبوع' : 'متابعة'}</span>
            <span class="tag gray">${weekTag}</span>
            <span class="tag gray">${remaining} مهمة</span>
            ${p.link ? `<a class="tag blue" href="${esc(p.link)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="فتح الرابط المباشر">🔗 رابط</a>` : ''}
          </span>
          <span class="muted">${focus} د تركيز</span>
        </div>
        <div class="pcard-actions">
          <button class="btn btn-xs btn-ghost" onclick="event.stopPropagation();toggleCompleteProject(${p.id})" title="إنجاز المشروع بالكامل">✓ إنجاز</button>
          ${p.type === 'دراسة' ? `<button class="btn btn-xs btn-ghost" onclick="event.stopPropagation();openMaterialsModal(${p.id})" title="مواد المشروع ومهامها وفيديوهاتها">📚 المواد</button>` : ''}
          <button class="btn btn-xs ${p.focused ? 'btn-success' : 'btn-ghost'}" onclick="event.stopPropagation();toggleProjectFocus(${p.id})" title="${p.focused ? 'إخراج المشروع من وضع التركيز' : 'وضع المشروع في حالة التركيز'}">${p.focused ? 'مركّز' : 'تركيز'}</button>
          <button class="btn btn-xs btn-ghost" onclick="event.stopPropagation();openProjectModal(${p.id})" title="تعديل المشروع">✎</button>
          <button class="btn btn-xs btn-danger" onclick="event.stopPropagation();archiveProject(${p.id})" title="أرشفة المشروع">🗑</button>
        </div>
      </div>`;
  };

  const html = `
    <div class="page-head">
      <div>
        <h2 class="page-title">المشاريع</h2>
        <p class="page-sub">مشروع واحد فقط لكل هدف يظهر هنا — أنجز الحالي ليرتفع التالي تلقائيًا</p>
      </div>
      <button class="btn btn-lg" onclick="openProjectModal()">+ مشروع جديد</button>
    </div>
    ${active.length ? `<div class="grid-2">${active.map(card).join('')}</div>` : '<div class="card"><div class="empty"><div class="e-ic">📂</div><p>لا مشاريع نشطة — أضف مشروعاً تريد التركيز عليه</p></div></div>'}
    ${queued.length ? `
    <details class="card" style="margin-top:14px">
      <summary style="cursor:pointer;padding:12px 16px;font-weight:700">⏳ في الطابور خلف مشاريع أهدافها (${queued.length}) — تظهر تلقائيًا عند إنجاز ما قبلها</summary>
      <div class="grid-2" style="padding:0 12px 12px">${queued.map(card).join('')}</div>
    </details>` : ''}
    ${done.length ? `
    <h3 class="card-title mt" style="font-size:17px;">المشاريع المنجزة ✓</h3>
    ${done.map((p) => {
      const goal = goalOf(p.goal_id);
      const sub = subOf(p.subgoal_id);
      const context = [goal ? goal.title : null, sub ? sub.title : null].filter(Boolean).join(' · ');
      return `
      <div class="card pdone-item" onclick="openProjectTasksModal(${p.id})" title="اضغط للدخول إلى المشروع">
        <div class="item-ic" style="--box-color:var(--green)">✅</div>
        <div class="item-body">
          <div class="item-title">${esc(p.name)}</div>
          <div class="item-sub">${context ? `${esc(context)} — ` : ''}أنجز في ${fmtDateAr(String(p.completed_at || '').slice(0, 10))}</div>
        </div>
        <button class="btn btn-xs btn-ghost" onclick="event.stopPropagation();toggleCompleteProject(${p.id})" title="إلغاء الإنجاز">↺</button>
      </div>`;
    }).join('')}` : ''}
  `;
  $('#content').innerHTML = html;
}

/* وضع التركيز على مشروع: زر اختياري يُبرز المشروع ويطفوه أعلى القائمة — لا يؤثر على بقية المشاريع إطلاقًا */
async function toggleProjectFocus(id) {
  try {
    const p = NoorStore.getProjectById(id);
    if (!p) return showToast('المشروع غير موجود', 'bad');
    NoorStore.updateProject(id, { focused: !p.focused });
    play('tick');
    showToast(p.focused ? 'خرج المشروع من وضع التركيز' : '🎯 المشروع الآن قيد التركيز');
    await renderProjects();
  } catch (err) { showToast(err.message, 'bad'); }
}

/* بوابة الإكمال الصارم: لا يُنجز المشروع إلا بعد كتابة الملخص والتقييم بالنجوم */
function openProjectCompleteModal(id) {  const p = NoorStore.getProjectById(id);
  if (!p) return showToast('المشروع غير موجود', 'bad');
  const media = ['كتاب', 'كورس', 'فيديو', 'دراسة'].includes(p.type);
  openModal('✓ إنجاز: ' + p.name, `
    <p class="count" style="margin-bottom:10px">قاعدة الإكمال الصارم: اكتب ملخصك لما أنجزت${media ? ' وقيّم بالنجوم' : ''} — ثم ينتقل المشروع ببطاقته إلى تجميع المعرفة والمكتبة.</p>
    <div class="field"><label>الملخص (ماذا تعلمت؟ ما الذي تحقق؟)</label><textarea class="input" id="pc-summary" rows="4" placeholder="${p.summary ? esc(p.summary) : 'اكتب ملخصًا واضحًا…'}">${p && p.summary ? esc(p.summary) : ''}</textarea></div>
    ${media ? `<div class="field"><label>التقييم بالنجوم</label>${starInputHTML(p ? p.rating : 0)}</div>` : ''}
    <div class="modal-actions">
      <button class="btn" onclick="submitProjectComplete(${id})">✓ إنجاز المشروع</button>
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>`);
}

async function submitProjectComplete(id) {
  const summary = ($('#pc-summary') && $('#pc-summary').value.trim()) || 'تم إنجاز هذا المشروع وجمعُّه في المعرفة.';
  const p = NoorStore.getProjectById(id);
  if (!p) return showToast('المشروع غير موجود', 'bad');
  const media = ['كتاب', 'كورس', 'فيديو', 'دراسة'].includes(p.type);
  const rating = $('#star-val') ? Number($('#star-val').value || 0) : (p.rating || 0);
  try {
    NoorStore.updateProject(id, { summary, rating: media ? rating : (p.rating || 0) });
    NoorStore.completeProject(id);
    play('success');
    showToast('أُنجز المشروع بالكامل ✓ وانتقل لتجميع المعرفة');
    closeModal();
    await rerenderCurrent();
  } catch (err) { showToast(err.message, 'bad'); }
}

async function toggleCompleteProject(id) {
  try {
    const p = NoorStore.getProjectById(id);
    if (!p) return showToast('المشروع غير موجود', 'bad');
    /* البوابة: عند الإنجاز أول مرة يُفتح نموذج بسيط (الملخص والتقييم اختياريان) */
    if (p && !p.completed_at) { openProjectCompleteModal(id); return; }
    NoorStore.completeProject(id);
    play('tick');
    showToast('أُلغي إنجاز المشروع');
    await rerenderCurrent();
  } catch (err) { showToast(err.message, 'bad'); }
}

/* إعادة رسم الصفحة الحالية بأمان — تُستخدم بعد تغيير حالة المشروع */
async function rerenderCurrent() {
  const p = state.page;
  try {
    if (p === 'projects') await renderProjects();
    else if (p === 'stats' || p === 'vision') await renderStats();
    else if (p === 'library') await renderLibrary();
    else if (p === 'archive') await renderArchive();
    else if (p === 'journal') await renderJournal();
    else if (p === 'timer') await renderTimer();
    else await renderTasks();
  } catch (e) { showToast('تعذّر التحديث: ' + e.message, 'bad'); }
}

/* ===== إدارة المشاريع (تستخدم في الإعدادات وصفحة المشاريع) ===== */
let pjEdit = null;
/* تفاصيل الكتاب/الفيديو (المؤلف، التقييم، الغلاف، الملخص) تُكتب أثناء الإنجاز أو بعده — لا عند إنشاء المشروع */
function pjTypeFieldsHTML(type, p) {
  if (type === 'عادة') {
    const vids = (p && p.video_urls && p.video_urls.length) ? p.video_urls : (p && p.video_url ? [p.video_url] : ['']);
    const vidInputs = vids.map((v, i) => `
      <div class="field-row" style="align-items:center;margin-bottom:4px" id="pj-vid-row-${i}">
        <input class="input" id="pj-video-${i}" dir="ltr" value="${esc(v || '')}" placeholder="https://youtube.com/…" style="flex:1">
        ${vids.length > 1 ? `<button type="button" class="icon-btn danger" onclick="document.getElementById('pj-vid-row-${i}').remove();renumberHabitVideos()" title="إزالة الرابط">✕</button>` : ''}
      </div>`).join('');
    return `
      <div class="field"><label>روابط يوتيوب (اختياري — مشجع أو شرح للعادة، يمكن إضافة عدة روابط)</label>
        <div id="pj-videos-list">${vidInputs}</div>
        <button type="button" class="btn btn-xs btn-ghost" onclick="addHabitVideoField()" style="margin-top:4px">+ أضف رابط فيديو آخر</button>
      </div>
      <div class="field-row">
        <div class="field" style="flex:1"><label>دقائق تقريبًا لكل مرة</label><input class="input" id="pj-minutes" type="number" min="1" value="${p && p.minutes ? p.minutes : 20}"></div>
      </div>
      <p class="count" style="display:block">عادة متكررة: لا تظهر في «المشاريع» بل تظهر تلقائيًا في مهامك اليومية في الأيام المسموحة فقط — ويمكن ربطها بهدف ليظهر تحته في الهرم.</p>`;
  }
  if (type === 'دراسة') return `<p class="count" style="display:block">مشروع دراسة: أضف المواد الدراسية من زر «📚 المواد» في بطاقة المشروع — كل مادة لها مهامها وفيديوهاتها وملفاتها ومدتها — وتُعرض في المؤقت عند اختيار المشروع.</p>`;
  return '';
}
function addHabitVideoField() {
  const list = $('#pj-videos-list');
  if (!list) return;
  const idx = list.querySelectorAll('.field-row').length;
  const row = document.createElement('div');
  row.className = 'field-row';
  row.style.cssText = 'align-items:center;margin-bottom:4px';
  row.id = 'pj-vid-row-' + idx;
  row.innerHTML = `<input class="input" id="pj-video-${idx}" dir="ltr" value="" placeholder="https://youtube.com/…" style="flex:1"><button type="button" class="icon-btn danger" onclick="this.closest('.field-row').remove();renumberHabitVideos()" title="إزالة الرابط">✕</button>`;
  list.appendChild(row);
  row.querySelector('input').focus();
}
function renumberHabitVideos() {
  const list = $('#pj-videos-list');
  if (!list) return;
  const rows = list.querySelectorAll('.field-row');
  rows.forEach((r, i) => {
    r.id = 'pj-vid-row-' + i;
    const inp = r.querySelector('input');
    if (inp) inp.id = 'pj-video-' + i;
    const btn = r.querySelector('.icon-btn');
    if (btn && rows.length > 1) btn.style.display = '';
    else if (btn) btn.style.display = 'none';
  });
}
function collectHabitVideoUrls() {
  const list = $('#pj-videos-list');
  if (!list) return [];
  const urls = [];
  list.querySelectorAll('input[id^="pj-video-"]').forEach((inp) => {
    const v = (inp.value || '').trim();
    if (v) urls.push(v);
  });
  return urls;
}
function onPjTypeChange() {
  const t = $('#pj-type').value;
  $('#pj-type-fields').innerHTML = pjTypeFieldsHTML(t, pjEdit);
  const names = { 'عام': 'اسم المشروع', 'كتاب': 'عنوان الكتاب', 'فيديو': 'عنوان الفيديو', 'عادة': 'اسم العادة', 'كورس': 'اسم الكورس', 'دراسة': 'اسم المادة / المشروع' };
  $('#pj-name-label').textContent = names[t] || 'اسم المشروع';
  $('#pj-name').placeholder = t === 'كتاب' ? 'مثال: اسم الكتاب' : (t === 'فيديو' ? 'مثال: اسم الفيديو' : (t === 'كورس' ? 'مثال: كورس اللغة الإنجليزية' : (t === 'دراسة' ? 'مثال: مذاكرة امتحانات الشهر' : 'مثال: كتابة الكتاب')));
  const notesLabel = $('#pj-notes-label');
  if (notesLabel) notesLabel.textContent = t === 'عادة' ? 'وصف العادة (اختياري)' : 'وصف قصير (اختياري)';
  const isHabit = t === 'عادة';
  const mediaFields = $('#pj-media-fields');
  if (mediaFields) mediaFields.style.display = isHabit ? 'none' : '';
  const subField = $('#pj-subgoal-field');
  if (subField) subField.style.display = isHabit ? 'none' : '';
  const goalLabel = $('#pj-goal-label');
  if (goalLabel) goalLabel.textContent = isHabit ? 'الهدف (اختياري — يظهر تحت الهدف في الهرم)' : 'الهدف';
  const goalSel = $('#pj-goal');
  if (goalSel && isHabit && !goalSel.querySelector('option[value=""]')) {
    goalSel.insertAdjacentHTML('afterbegin', '<option value="" ' + (!pjEdit ? 'selected' : '') + '>— بدون ربط هدف —</option>');
  }
  if (goalSel && !isHabit && goalSel.querySelector('option[value=""]')) {
    goalSel.querySelector('option[value=""]').remove();
  }
}

function openProjectModal(id, subgoalId, goalId) {
  const p = id ? NoorStore.getProjects().find((x) => x.id === id) : null;
  pjEdit = p;
  const colors = COLORS.slice(0, 6);
  const goals = NoorStore.getGoals();
  const nowWeek = NoorStore.weekInYear(NoorStore.todayStr());
  const ptype = p ? (p.type || 'عام') : 'عام';
  const gid = p ? p.goal_id : (ptype === 'عادة' ? (goalId || null) : (goalId || (goals[0] ? goals[0].id : null)));
  const firstSub = gid ? (NoorStore.getSubgoals(gid)[0] || null) : null;
  const sgid = p ? p.subgoal_id : (subgoalId || (firstSub ? firstSub.id : null));
  const subs = gid ? NoorStore.getSubgoals(gid) : [];
  const dfltWeek = p ? p.week : nowWeek;
  openModal(p ? 'تعديل المشروع' : 'مشروع جديد', `
    <div class="field-row">
      <div class="field" style="flex:1"><label id="pj-name-label">${({ 'عام': 'اسم المشروع', 'كتاب': 'عنوان الكتاب', 'فيديو': 'عنوان الفيديو', 'عادة': 'اسم العادة', 'كورس': 'اسم الكورس', 'دراسة': 'اسم المادة / المشروع' })[ptype] || 'اسم المشروع'}</label><input class="input" id="pj-name" value="${p ? esc(p.name) : ''}" placeholder="${ptype === 'كتاب' ? 'مثال: اسم الكتاب' : (ptype === 'فيديو' ? 'مثال: اسم الفيديو' : (ptype === 'كورس' ? 'مثال: كورس اللغة الإنجليزية' : (ptype === 'دراسة' ? 'مثال: مذاكرة امتحانات الشهر' : 'مثال: كتابة الكتاب')))}"></div>
      <div class="field" style="flex:0 0 150px"><label>نوع المشروع</label>
        <select class="input" id="pj-type" onchange="onPjTypeChange()">
          ${PROJECT_TYPES.map((t) => `<option value="${t.key}" ${t.key === ptype ? 'selected' : ''}>${t.icon} ${t.title}</option>`).join('')}
        </select>
      </div>
    </div>
    <div id="pj-type-fields">${pjTypeFieldsHTML(ptype, p)}</div>
    <div class="field"><label id="pj-notes-label">${ptype === 'عادة' ? 'وصف العادة (اختياري)' : 'وصف قصير (اختياري)'}</label><textarea class="input" id="pj-notes" rows="2">${p ? esc(p.notes) : ''}</textarea></div>
    <div id="pj-media-fields">
      <div class="field"><label>غلاف المشروع (صورة)</label>
        <div class="field-row" style="align-items:center;gap:10px">
          <input type="file" id="pj-cover-file" accept="image/*" style="display:none" onchange="handleCoverFile(this,'pj-cover')">
          <button class="btn btn-xs" onclick="$('#pj-cover-file').click()">📂 اختر صورة من الجهاز</button>
          <input class="input" id="pj-cover" value="${p ? esc(p.cover) : ''}" placeholder="أو أدخل رابط صورة" dir="ltr" style="flex:1">
        </div>
        ${p && p.cover ? `<div style="margin-top:6px"><img src="${cachedCover(p.cover)}" style="max-width:120px;max-height:80px;border:1px solid var(--border-light)" loading="lazy" onerror="this.style.display='none'"></div>` : ''}
      </div>
      <div class="field"><label>ملف المشروع (PDF/مستند حتى 2 ميجا — يُنسخ داخل النظام ليُقرأ لاحقًا من الأرشيف)</label>
        <div class="field-row" style="align-items:center;gap:10px">
          <input type="file" id="pj-file-input" style="display:none" onchange="handleProjectFile(this,'pj-file-name','pj-file-data')">
          <input type="hidden" id="pj-file-data" value="${p && p.file ? esc(p.file) : ''}">
          <button class="btn btn-xs" onclick="$('#pj-file-input').click()">📂 إرفاق ملف من الجهاز</button>
          <input class="input" id="pj-file-name" readonly value="${p && p.file_name ? esc(p.file_name) : ''}" placeholder="لم يُرفق ملف بعد" style="flex:1">
          ${p && p.file ? '<span class="count">✓ مخزّن داخل النظام</span>' : ''}
        </div>
      </div>
      <div class="field"><label>رابط مباشر (كورس/فيديو/قراءة — يُفتح ويُشغَّل من المكتبة والمؤقت)</label>
        <input class="input" id="pj-link" dir="ltr" value="${p && p.link ? esc(p.link) : ''}" placeholder="https://youtube.com/playlist?… أو رابط المنصة">
      </div>
    </div>
    <div class="field" id="pj-goal-field"><label id="pj-goal-label">${ptype === 'عادة' ? 'الهدف (اختياري — يظهر تحت الهدف في الهرم)' : 'الهدف'}</label>
      <select class="input" id="pj-goal" onchange="onSubgoalPick()">
        ${ptype === 'عادة' ? '<option value="" ' + (!p && !gid ? 'selected' : '') + '>— بدون ربط هدف —</option>' : ''}
        ${goals.map((g) => `<option value="${g.id}" ${g.id === gid ? 'selected' : ''}>${esc(g.title)} (سنة ${g.year})</option>`).join('')}
      </select>
    </div>
    <div class="field" id="pj-subgoal-field"><label>المهمة الفرعية (اختياري)</label>
      <select class="input" id="pj-subgoal">
        <option value="">— بدون فرع (يظهر المشروع كل أسابيع السنة) —</option>
        ${subs.map((s) => `<option value="${s.id}" ${s.id === sgid ? 'selected' : ''}>${esc(s.title)} (أسبوع ${s.week})</option>`).join('')}
      </select>
    </div>
    <p class="count" style="display:block">بدون فرع: يظهر المشروع في كل أسابيع السنة. مع فرع: يُحصر ظهوره في نطاق الفرع.</p>
    ${!p ? `<div class="field"><label>قائمة المهام المتسلسلة الكاملة (مهمة في كل سطر — تُدخل بالترتيب وتظهر واحدة كل يوم)</label><textarea class="input" id="pj-tasks-list" rows="5" placeholder="مثال:&#10;قراءة الفصل الأول وتلخيصه&#10;حل تمارين الفصل الأول&#10;مراجعة الفصلين وكتابة الخلاصة"></textarea></div>
    <div class="field"><label>أول مهمة تلقائية (اختياري — بديل سريع عن القائمة)</label><input class="input" id="pj-first-task" placeholder="مثال: كتابة مقدمة الكتاب"></div>` : ''}
    <div class="field-row">
      <div class="field"><label>المدة المتوقعة (أسابيع)</label><input class="input" id="pj-weeks" type="number" min="1" value="${p ? p.weeks : 12}"></div>
      <div class="field"><label>يبدأ من الأسبوع (اختياري — افتراضي: الحالي ${nowWeek})</label><input class="input" id="pj-week" type="number" min="1" max="${NoorStore.yearWeeks()}" value="${dfltWeek}"></div>
    </div>
    <div class="field"><label>الأيام المسموح بها (في الأيام غير المحددة لا يظهر المشروع ولا مهامه)</label>
      <div class="day-pick">
        ${DAY_NAMES.map((d, i) => `<label class="day-opt"><input type="checkbox" name="pj-day" value="${i}" ${!p || (p.days && p.days.includes(i)) ? 'checked' : ''}>${d}</label>`).join('')}
      </div>
    </div>
    <p class="count" style="display:block">تظهر مهام المشروع بالتسلسل: مهمة واحدة في اليوم، والمهمة التالية لا تظهر قبل إنجاز السابقة.</p>
    <div class="field"><label>اللون</label>
      <div class="day-pick">
        ${colors.map((c) => `<label class="day-opt color-opt" title="${c}"><input type="radio" name="pj-color" value="${c}" ${(!p && c === colors[0]) || (p && p.color === c) ? 'checked' : ''}><span class="dot" style="background:${c}"></span></label>`).join('')}
      </div>
    </div>
    <div class="field"><label>الأولوية ضمن الهدف (1 = الأعلى — يُنفَّذ الأقل رقمًا أولًا ثم التالي)</label><input class="input" id="pj-priority" type="number" min="1" max="100" value="${p ? (p.priority || 1) : 1}"></div>
    <div class="modal-actions">
      <button class="btn" onclick="saveProject(${p ? p.id : 'null'})">${p ? 'حفظ التعديلات' : 'إنشاء'}</button>
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>`);
  onPjTypeChange();
}

function onSubgoalPick() {
  const gid = Number($('#pj-goal').value);
  const subs = NoorStore.getSubgoals(gid);
  $('#pj-subgoal').innerHTML = subs.map((s) => `<option value="${s.id}">${esc(s.title)} (أسبوع ${s.week})</option>`).join('');
}

async function saveProject(id) {
  const name = $('#pj-name').value.trim();
  if (!name) return showToast('أدخل اسم المشروع', 'bad');
  const notes = $('#pj-notes').value.trim();
  const color = document.querySelector('input[name="pj-color"]:checked')?.value || '';
  const priority = Math.max(1, parseInt($('#pj-priority').value) || 1);
  const goal_id = Number($('#pj-goal').value) || null;
  const subgoal_id = Number($('#pj-subgoal').value) || null;
  const week = Math.max(1, parseInt($('#pj-week').value) || 1);
  const weeks = Math.max(1, parseInt($('#pj-weeks').value) || 1);
  const days = [...document.querySelectorAll('input[name="pj-day"]:checked')].map((c) => Number(c.value));
  if (!days.length) return showToast('اختر يومًا مسموحًا واحدًا على الأقل', 'bad');
  const type = $('#pj-type').value;
  if (type === 'عادة') {
    try {
      if (id) {
        closeModal();
        showToast('العادات المتكررة تُحرَّر من الهرم (✎ بجانب العادة)');
      } else {
        const goal_id = Number($('#pj-goal').value) || null;
        const days = [...document.querySelectorAll('input[name="pj-day"]:checked')].map((c) => Number(c.value));
        if (!days.length) return showToast('اختر يومًا مسموحًا واحدًا على الأقل', 'bad');
        const weeks = Math.max(1, parseInt($('#pj-weeks').value) || 1);
        const minutes = Math.max(1, parseInt($('#pj-minutes')?.value) || 20);
        const video_urls = collectHabitVideoUrls();
        await apiSend('POST', '/api/habits', {
          title: name, allowed_days: days, minutes, weeks,
          video_url: video_urls[0] || '',
          video_urls: video_urls,
          notes, goal_id
        });
        closeModal();
        play('success');
        showToast('أُنشئت العادة المتكررة — ستظهر في مهام أيامها المسموحة');
        if (state.page === 'projects') await renderProjects();
        else if (state.page === 'journal') await renderJournal();
        else if (state.page === 'vision') await renderVision();
        else if (state.page === 'stats') await renderStats();
      }
    } catch (err) { showToast(err.message, 'bad'); }
    return;
  }
  const val = (sel) => { const el = $(sel); return el ? String(el.value || '').trim() : ''; };
  const data = {
    name, notes, color, priority, goal_id, subgoal_id, week, weeks, days, type,
    cover: val('#pj-cover'),
    link: val('#pj-link'),
    file_name: val('#pj-file-name'),
    file: $('#pj-file-data') ? $('#pj-file-data').value : ''
  };
  if ($('#pj-author')) data.author = val('#pj-author');
  if ($('#star-val')) data.rating = Number($('#star-val').value || 0);
  if ($('#pj-summary')) data.summary = val('#pj-summary');
  try {
    if (id) {
      NoorStore.updateProject(id, data);
    } else {
      const proj = NoorStore.addProject(Object.assign({}, data, { start_date: weekStartForSub(subgoal_id, week) }));
      /* قائمة المهام المتسلسلة الكاملة: سطر = مهمة، بالترتيب */
      const taskLines = (($('#pj-tasks-list') && $('#pj-tasks-list').value) || '')
        .split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 60);
      taskLines.forEach((t) => NoorStore.addProjectTask(proj.id, { title: t }));
      const firstTask = ($('#pj-first-task')?.value || '').trim();
      if (!taskLines.length && firstTask) NoorStore.addProjectTask(proj.id, { title: firstTask });
      if (taskLines.length) showToast(`أُدخلت ${taskLines.length} مهمة بالتسلسل`);
    }
    closeModal();
    play('success');
    showToast('تم الحفظ — تظهر مهام المشروع بالتسلسل في أيامها المسموحة');
    if (state.page === 'projects') await renderProjects();
    else if (state.page === 'journal') await renderJournal();
  } catch (err) { showToast(err.message, 'bad'); }
}

function weekStartForSub(subgoalId, week) {
  const goals = NoorStore.getGoals();
  for (const g of goals) {
    if (NoorStore.getSubgoals(g.id).some((s) => s.id === subgoalId)) {
      return NoorStore.weekStartDate(g.year, week);
    }
  }
  return todayISO();
}

async function archiveProject(id) {
  if (!confirm('أرشفة هذا المشروع مع كل مهامه؟ يمكن رؤيته لاحقًا في الأرشيف.')) return;
  try {
    play('tick');
    NoorStore.archiveProject(id);
    closeModal();
    showToast('تمت الأرشفة');
    if (state.page === 'projects') await renderProjects();
    else if (state.page === 'journal') await renderJournal();
  } catch (err) { showToast(err.message, 'bad'); }
}

function openProjectTaskModal(pid, tid) {
  const p = NoorStore.getProjects().find((x) => x.id === pid);
  if (!p) return;
  const pt = tid ? p.tasks.find((x) => x.id === tid) : null;
  taskSourceCount = pt && pt.sources.length ? pt.sources.length : 0;
  openModal(tid ? 'تعديل مهمة المشروع' : 'مهمة جديدة للمشروع', `
    <div class="field"><label>المشروع</label><div class="field-static">${esc(p.name)}</div></div>
    <div class="field"><label>عنوان المهمة</label><input class="input" id="pt-title" value="${pt ? esc(pt.title) : ''}" placeholder="مثال: كتابة فصل 3"></div>
    <div class="field"><label>وصف (اختياري)</label><textarea class="input" id="pt-desc" rows="2">${pt ? esc(pt.desc) : ''}</textarea></div>
    ${p.type === 'دراسة' ? `
    <div class="field"><label>ساعات المهمة (المخطط لها)</label><input class="input" id="pt-hours" type="number" min="0" value="${pt ? (pt.hours || 0) : 0}"></div>
    <div class="field"><label>مصادر المهمة (كتاب / فيديو)</label>
      <div id="pt-sources">${pt && pt.sources.length ? pt.sources.map((s, i) => taskSourceRowHTML(s, i)).join('') : ''}</div>
      <button class="btn btn-xs" onclick="addTaskSourceRow()">+ إضافة مصدر</button>
    </div>
    <p class="count" style="display:block">المصادر تظهر مجتمعة قابلة للتشغيل في المؤقت أثناء العمل على المهمة.</p>` : ''}
    <p class="count" style="display:block">تظهر بالتسلسل: لا تظهر هذه المهمة قبل إنجاز المهمة السابقة — في الأيام المسموحة للمشروع فقط.</p>
    <div class="modal-actions">
      <button class="btn" onclick="saveProjectTask(${pid}, ${tid || 'null'})">${tid ? 'حفظ التعديلات' : 'إضافة'}</button>
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>`);
}

function openProjectTasksModal(pid) {
  const p = NoorStore.getProjects().find((x) => x.id === pid);
  if (!p) return;
  const goals = NoorStore.getGoals();
  const goal = goals.find((g) => g.id === p.goal_id);
  let sub = null;
  if (goal) sub = NoorStore.getSubgoals(goal.id).find((s) => s.id === p.subgoal_id);
  const nowWeek = NoorStore.weekInYear(NoorStore.todayStr());
  const inWindow = p.week <= nowWeek && nowWeek <= p.week + p.weeks - 1;
  const daysLabel = p.days.length === 7 ? 'كل الأيام' : p.days.map((d) => DAY_NAMES[d]).join('، ');
  const pt = projectType(p.type);
  const isMedia = p.type !== 'عام';
  const mediaHead = isMedia ? `
    <div class="lib-detail-head">
      ${p.cover ? `<div class="lib-detail-cover-lg"><img src="${cachedCover(p.cover)}" alt="" loading="lazy" onerror="this.closest('.lib-detail-cover-lg').style.display='none'"></div>` : ''}
      <div class="lib-detail-info">
        <h3 style="margin:0">${esc(p.name)}</h3>
        <div class="lib-detail-meta">
          <span>${pt.icon} ${esc(pt.title)}</span>
          ${p.author ? `<span>✍️ ${esc(p.author)}</span>` : ''}
          ${p.rating > 0 ? `<span>${starsHTML(p.rating)}</span>` : ''}
        </div>
        ${p.summary ? `<div class="lib-detail-summary-box">${esc(p.summary)}</div>` : ''}
      </div>
    </div>` : '';
  openModal(p.name, `
    <div style="display:flex;gap:12px;align-items:start;margin-bottom:16px;flex-wrap:wrap">
      <span class="goal-ic small" style="background:${esc(p.color) || NOOR_ACCENT}">${p.completed_at ? '✅' : (isMedia ? pt.icon : '📁')}</span>
      <div style="flex:1;min-width:200px">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:4px">
          ${p.type !== 'عام' ? `<span class="chip chip-xs">${pt.icon} ${esc(pt.title)}</span>` : ''}
          ${p.completed_at ? '<span class="chip chip-xs" style="background:var(--green);color:var(--white)">✓ مُنجز</span>' : ''}
          <span class="count">أسبوع ${p.week}${p.weeks > 1 ? `-${p.week + p.weeks - 1}` : ''} · أولوية ${p.priority}</span>
        </div>
        <div class="count" style="margin-bottom:4px">${goal ? `${esc(goal.title)} · ` : ''}الأيام: ${esc(daysLabel)} · أسبوعنا ${nowWeek} — ${inWindow ? 'نشط الآن ✓' : 'خارج أسابيعه'}</div>
        ${p.notes ? `<p style="margin:6px 0 0;font-size:var(--fs-sm);color:var(--text-muted)">${esc(p.notes)}</p>` : ''}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${p.completed_at
          ? `<button class="btn btn-xs" onclick="toggleCompleteProject(${p.id})">↺ إلغاء الإنجاز</button>`
          : `<button class="btn btn-xs btn-success" onclick="toggleCompleteProject(${p.id})">✓ إنجاز</button>`}
        <button class="btn btn-xs" onclick="openProjectModal(${p.id})">✎ تعديل</button>
        <button class="btn btn-xs btn-ghost" onclick="archiveProject(${p.id})">أرشفة</button>
      </div>
    </div>
    ${mediaHead}
    ${projectFileLinkHTML(p)}
    ${isMedia ? `
    <details class="dj-section" style="margin-top:10px"${p.completed_at ? ' open' : ''}>
      <summary>✍️ تفاصيل ${pt.title} — تُكتب أثناء الإنجاز أو بعده ${p.completed_at ? '' : '(اختياري الآن)'}</summary>
      <div style="padding:10px;display:flex;flex-direction:column;gap:10px">
        <div class="field-row">
          <div class="field"><label>${pt.key === 'كتاب' ? 'المؤلف' : 'الاسم'}</label><input class="input" id="pd-author" value="${esc(p.author)}" placeholder="${pt.key === 'كتاب' ? 'اسم المؤلف' : 'اسم القناة / المتحدث'}"></div>
          <div class="field"><label>التقييم (من 5 نجوم)</label>${starInputHTML(p.rating)}</div>
        </div>
        <div class="field"><label>صورة الغلاف (اختياري)</label>
          <div class="field-row" style="align-items:center;gap:10px">
            <input type="file" id="pd-cover-file" accept="image/*" style="display:none" onchange="handleCoverFile(this,'pd-cover')">
            <button class="btn btn-xs" onclick="$('#pd-cover-file').click()">📂 صورة من الجهاز</button>
            <input class="input" id="pd-cover" value="${esc(p.cover)}" placeholder="رابط صورة الغلاف" dir="ltr" style="flex:1">
          </div>
        </div>
        <div class="field"><label>الملخص / التجربة</label><textarea class="input" id="pd-summary" rows="4" placeholder="${pt.key === 'كتاب' ? 'خلاصة الكتاب وأهم ما فيه…' : 'أهم ما تعلمته من هذا الفيديو…'}">${esc(p.summary)}</textarea></div>
        <div class="field"><label>ملف ${pt.key === 'كتاب' ? 'الكتاب' : 'المحتوى'} (PDF/مستند حتى 2 ميجا — يُنسخ داخل النظام)</label>
          <div class="field-row" style="align-items:center;gap:10px">
            <input type="file" id="pd-book-file" style="display:none" onchange="handleProjectFile(this,'pd-book-name','pd-book-data')">
            <input type="hidden" id="pd-book-data" value="${esc(p.file || '')}">
            <button class="btn btn-xs" onclick="$('#pd-book-file').click()">📂 إرفاق ${pt.key === 'كتاب' ? 'ملف الكتاب' : 'الملف'} من الجهاز</button>
            <input class="input" id="pd-book-name" readonly value="${esc(p.file_name || '')}" placeholder="لم يُرفق بعد" style="flex:1">
            ${p.file ? '<span class="count">✓ مخزّن داخل النظام</span>' : ''}
          </div>
        </div>
        <div><button class="btn" onclick="saveProjectDetails(${p.id})">حفظ التفاصيل</button></div>
      </div>
    </details>` : ''}
    <p class="count" style="display:block;margin:10px 0">المهام داخلية متسلسلة: التالية غير المنجزة تظهر فقط في الأيام المسموحة.</p>
    <div class="pt-list">
      ${p.tasks.length ? p.tasks.map((pt, idx) => `
        <div class="settings-item project">
          <span class="item-type">${pt.completed_at ? '✓' : String(idx + 1)}</span>
          <span class="item-title">${esc(pt.title)}</span>
          <span class="item-meta">${pt.completed_at ? 'منجزة' : 'بالتسلسل'}${pt.hours > 0 ? ` · ⏱ ${pt.hours} ساعة` : ''}${pt.sources.length ? ` · ${pt.sources.length} 📦 مصدر` : ''}</span>
          <div class="item-actions">
            <button class="icon-btn" onclick="openProjectTaskModal(${pid}, ${pt.id})" title="تعديل">✎</button>
            <button class="icon-btn danger" onclick="archiveProjectTask(${pt.id})" title="أرشفة">✕</button>
          </div>
        </div>`).join('') : '<div class="empty-box"><strong>لا مهام داخلية بعد</strong><p>أضف أول مهمة — ستظهر في أول يوم مسموح تلقائيًا.</p></div>'}
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="openProjectTaskModal(${pid})">+ مهمة جديدة</button>
      <button class="btn btn-ghost" onclick="closeModal()">إغلاق</button>
    </div>`);
}


let taskSourceCount = 0;
function taskSourceRowHTML(s, i) {
  const vid = s && s.type !== 'book' ? ytVideoId(s.url) : null;
  const preview = vid
    ? `<div id="pt-src-pl-${i}" class="pt-src-preview">${ytThumbHTML(vid, ytVideoStart(s.url), '#pt-src-pl-' + i)}</div>`
    : '';
  return '<div class="field-row pt-src-row" style="align-items:flex-start">' +
    '<div class="pt-src-controls">' +
    '<select class="input" id="pt-src-type-' + i + '" style="width:110px" onchange="updateTaskSourcePreview(' + i + ')"><option value="video"' + (!s || s.type === 'video' ? ' selected' : '') + '>🎬 فيديو</option><option value="book"' + (s && s.type === 'book' ? ' selected' : '') + '>📚 كتاب</option></select>' +
    '<input class="input" id="pt-src-title-' + i + '" placeholder="العنوان" value="' + (s ? esc(s.title) : '') + '" style="flex:1">' +
    '<input class="input" id="pt-src-url-' + i + '" placeholder="الرابط — يوتيوب للفيديو" dir="ltr" value="' + (s ? esc(s.url) : '') + '" style="flex:1.4" oninput="updateTaskSourcePreview(' + i + ')">' +
    '<button class="icon-btn danger" onclick="removeTaskSourceRow(this)" title="حذف">✕</button>' +
    '</div>' + preview + '</div>';
}
function updateTaskSourcePreview(i) {
  const row = document.getElementById('pt-src-pl-' + i);
  const typeEl = document.getElementById('pt-src-type-' + i);
  const urlEl = document.getElementById('pt-src-url-' + i);
  if (!urlEl || !typeEl) return;
  const isVideo = typeEl.value !== 'book';
  const vid = isVideo ? ytVideoId(urlEl.value) : null;
  const host = row || document.createElement('div');
  if (vid && !row) {
    host.id = 'pt-src-pl-' + i;
    host.className = 'pt-src-preview';
    urlEl.closest('.pt-src-row').appendChild(host);
  }
  host.innerHTML = vid ? ytThumbHTML(vid, ytVideoStart(urlEl.value), '#pt-src-pl-' + i) : '';
  if (!vid && row) row.innerHTML = '';
}
function addTaskSourceRow() {
  const box = $('#pt-sources');
  if (!box) return;
  box.insertAdjacentHTML('beforeend', taskSourceRowHTML(null, taskSourceCount++));
}
function removeTaskSourceRow(btn) {
  const row = btn.closest('.field-row');
  if (row) row.remove();
}

async function saveProjectTask(pid, tid) {
  const title = $('#pt-title').value.trim();
  if (!title) return showToast('أدخل عنوان المهمة', 'bad');
  const desc = $('#pt-desc').value.trim();
  const payload = { title, desc };
  if ($('#pt-hours')) {
    payload.hours = Math.max(0, parseFloat($('#pt-hours').value) || 0);
    const sources = [];
    document.querySelectorAll('#pt-sources .field-row').forEach((row) => {
      const t = row.querySelector('select') ? row.querySelector('select').value : 'video';
      const stitle = (row.querySelector('input[id^="pt-src-title-"]') ? row.querySelector('input[id^="pt-src-title-"]').value : '').trim();
      const url = (row.querySelector('input[id^="pt-src-url-"]') ? row.querySelector('input[id^="pt-src-url-"]').value : '').trim();
      if (stitle || url) sources.push({ type: t, title: stitle, url });
    });
    payload.sources = sources;
  }
  try {
    if (tid) NoorStore.updateProjectTask(tid, payload);
    else NoorStore.addProjectTask(pid, payload);
    closeModal();
    play('success');
    showToast('تم الحفظ — ستظهر بعد إنجاز المهمة السابقة');
    if (state.page === 'projects') await renderProjects();
    else openProjectTasksModal(pid);
  } catch (err) { showToast(err.message, 'bad'); }
}

async function archiveProjectTask(id) {
  if (!confirm('أرشفة هذه المهمة؟')) return;
  try {
    play('tick');
    const owner = NoorStore.getProjects().find((p) => p.tasks.some((t) => t.id === id));
    NoorStore.archiveProjectTask(id);
    closeModal();
    showToast('تمت الأرشفة');
    if (state.page === 'projects') await renderProjects();
    else if (owner) openProjectTasksModal(owner.id);
  } catch (err) { showToast(err.message, 'bad'); }
}

/* حفظ تفاصيل الكتاب/الفيديو (المؤلف، التقييم، الغلاف، الملخص) من نافذة المهام */
async function saveProjectDetails(id) {
  try {
    NoorStore.updateProject(id, {
      author: ($('#pd-author') ? $('#pd-author').value : '').trim(),
      rating: $('#star-val') ? Number($('#star-val').value || 0) : 0,
      cover: ($('#pd-cover') ? $('#pd-cover').value : '').trim(),
      summary: ($('#pd-summary') ? $('#pd-summary').value : '').trim(),
      file_name: ($('#pd-book-name') ? $('#pd-book-name').value : '').trim(),
      file: $('#pd-book-data') ? $('#pd-book-data').value : ''
    });
    play('success');
    showToast('تم حفظ التفاصيل');
    if (state.page === 'projects') await renderProjects();
    openProjectTasksModal(id);
  } catch (err) { showToast(err.message, 'bad'); }
}

/* ===== المكتبة الشخصية المعزولة (07) =====
   بيئة قراءة ومشاهدة هادئة: الكتب PDF تُقرأ داخل التطبيق، الكورسات والفيديوهات
   تُشغَّل مدمجة بلا تنقل خارجي، والمكتمل منها يظهر عليه ملخصه وتقييمه. */
const LIB_SECTIONS = [
  { key: 'كتاب',  ic: '📕', title: 'الكتب',               desc: 'اقرأ داخل التطبيق — ارفع عدة كتب دفعة واحدة' },
  { key: 'كورس',  ic: '🎓', title: 'الكورسات',            desc: 'شغّل الدروس والقوائم من هنا بلا تشتيت' },
  { key: 'دراسة', ic: '🧮', title: 'الشروحات الدراسية',   desc: 'شروحات أكاديمية مرتبطة بمشاريع الدراسة' },
  { key: 'فيديو', ic: '▶️', title: 'الفيديوهات المعرفية', desc: 'تعلم مستقل — قناة معرفية شخصية' }
];

function ytEmbedUrl(url) {
  try {
    const u = new URL(url);
    const h = u.hostname.replace('www.', '');
    if (h === 'youtu.be') return 'https://www.youtube.com/embed' + u.pathname;
    if (h.endsWith('youtube.com') || h.endsWith('youtube-nocookie.com')) {
      if (u.pathname === '/watch') { const v = u.searchParams.get('v'); if (v) return 'https://www.youtube.com/embed/' + v; }
      if (u.pathname === '/playlist') { const l = u.searchParams.get('list'); if (l) return 'https://www.youtube.com/embed/videoseries?list=' + encodeURIComponent(l); }
      const m = /\/(?:shorts|live|v)\/([A-Za-z0-9_-]{11})/i.exec(u.pathname);
      if (m) return 'https://www.youtube.com/embed/' + m[1];
      return 'https://www.youtube.com/embed' + u.pathname + (u.search || '');
    }
  } catch (e) { /* ليس رابطًا صالحًا */ }
  return '';
}

async function renderLibrary() {
  preloadCovers();
  const projects = NoorStore.getProjects();
  const sec = state.libSection && LIB_SECTIONS.some((s) => s.key === state.libSection) ? state.libSection : null;
  const shown = sec ? projects.filter((p) => p.type === sec) : projects.filter((p) => LIB_SECTIONS.some((s) => s.key === p.type));
  const activeSec = LIB_SECTIONS.find((s) => s.key === sec);
  const counts = LIB_SECTIONS.map((s) => {
    const list = projects.filter((p) => p.type === s.key);
    const done = list.filter((p) => p.completed_at).length;
    return { ...s, n: list.length, done };
  });
  const totalAll = counts.reduce((a, c) => a + c.n, 0);
  const doneAll = counts.reduce((a, c) => a + c.done, 0);

  /* بطاقات الإحصاء العلوية بأسلوب stat-card في نظام الحياة */
  const heroCards = `
    <div class="lib-hero">
      <div class="card lib-stat-card lib-stat-total">
        <span class="lib-stat-num">${totalAll}</span>
        <span class="lib-stat-label">📚 عنصر في مكتبتك</span>
        <div class="progress"><div class="progress-fill" style="width:${totalAll ? Math.round((doneAll / totalAll) * 100) : 0}%"></div></div>
        <span class="count">${doneAll} مكتمل · ${totalAll ? Math.round((doneAll / totalAll) * 100) : 0}%</span>
      </div>
      ${counts.map((c) => `
      <button class="card lib-stat-card ${sec === c.key ? 'on' : ''}" onclick="state.libSection='${sec === c.key ? '' : c.key}';play('click');renderLibrary()">
        <span class="lib-stat-num">${c.n}</span>
        <span class="lib-stat-label">${c.ic} ${c.title}</span>
        <div class="progress"><div class="progress-fill" style="width:${c.n ? Math.round((c.done / c.n) * 100) : 0}%"></div></div>
        <span class="count">${c.done} مكتمل من ${c.n}</span>
      </button>`).join('')}
    </div>`;

  let body = '';
  if (!shown.length) {
    body = `<div class="card"><div class="empty">
      <div class="e-ic">📖</div>
      <h3 class="card-title" style="justify-content:center">${activeSec ? `${activeSec.ic} ${activeSec.title}` : 'مكتبتك فارغة'}</h3>
      <p>${activeSec ? activeSec.desc : 'أضف أول كتاب PDF أو ضع رابط كورس وابدأ رحلة القراءة المعزولة'}</p>
      <div class="lib-empty-actions">
        <button class="btn btn-primary" onclick="openLibItemModal()">+ إضافة عنصر للمكتبة</button>
        <button class="btn" onclick="$('#lib-books-input').click()">📤 رفع كتب PDF دفعة واحدة</button>
      </div>
    </div></div>`;
  } else {
    body = `<div class="lib-grid">${shown.map(libCardHTML).join('')}</div>`;
  }

  const html = `
    <div class="page-head">
      <div>
        <h2 class="page-title">المكتبة الشخصية</h2>
        <p class="page-sub">بيئة معزولة للقراءة والمشاهدة — اقرأ الكتاب وشغّل الدرس من هنا، والمكتمل يظهر ملخصه وتقييمه</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="openLibItemModal()">+ إضافة</button>
        <button class="btn" onclick="$('#lib-books-input').click()">📤 رفع كتب PDF</button>
        <input type="file" id="lib-books-input" accept="application/pdf,.pdf" multiple style="display:none" onchange="libBooksPicked(this)">
      </div>
    </div>
    ${heroCards}
    ${body}`;
  $('#content').innerHTML = html;
}

const LIB_COVER_TONES = [NOOR_ACCENT, '#2D5B7A', '#4A7C59', '#7A5C9C', '#B8860B', '#A8456B'];

function libCoverHTML(p, big) {
  if (p.cover) return `<img class="${big ? 'lib-cover-big' : 'lib-cover'}" src="${cachedCover(p.cover)}" alt="" loading="lazy">`;
  /* عناصر الفيديو/الكورس: مصغرة يوتيوب حقيقية + شارة تشغيل — معاملة مختلفة كلياً عن الكتب */
  const isVid = p.type === 'فيديو' || p.type === 'كورس';
  if (isVid) {
    const vid = ytVideoId((p.video_urls && p.video_urls[0]) || p.video_url || '') || ytVideoId(p.link || '') || ytVideoId(p.file || '');
    if (vid) {
      return `<div class="${big ? 'lib-cover-big' : 'lib-cover'} lib-cover-video"><img src="https://i.ytimg.com/vi/${vid}/hqdefault.jpg" alt="" loading="lazy" onerror="this.parentElement.classList.add('no-thumb')"><span class="lib-play-badge">▶</span></div>`;
    }
  }
  /* الغلاف = أول صفحة حقيقية من ملف PDF عبر عارض المتصفح المدمج — بلا مكتبات خارجية */
  const f = assetUrl(p.file || '');
  if (f && /\.pdf($|\?)/i.test(f) && !/^data:/i.test(f)) {
    const src = f + '#page=1&toolbar=0&navpanes=0&scrollbar=0&statusbar=0&view=FitH';
    return `<div class="${big ? 'lib-cover-big' : 'lib-cover'} lib-cover-pdf"><iframe src="${esc(src)}" title="أول صفحة — ${esc(p.name)}" scrolling="no" loading="lazy" tabindex="-1" aria-hidden="true"></iframe></div>`;
  }
  const pt = PROJECT_TYPES.find((t) => t.key === p.type) || { icon: '📁' };
  const tone = LIB_COVER_TONES[(Number(p.id) || 0) % LIB_COVER_TONES.length];
  return `<div class="${big ? 'lib-cover-big' : 'lib-cover'}" style="background:${tone}">
      <span>${pt.icon}</span><i>${esc(p.name)}</i>
    </div>`;
}

function libCardHTML(p) {
  const done = !!p.completed_at;
  const hasOpen = !!(p.file || p.link || p.video_url || (p.video_urls && p.video_urls.length));
  const isVidT = p.type === 'فيديو' || p.type === 'كورس';
  const pt = projectType(p.type);
  const rating = p.rating > 0 ? `<div class="lib-stars">${starsHTML(p.rating)}</div>` : '';
  const summary = (done && p.summary) ? `<p class="lib-summary">${esc(p.summary.length > 120 ? p.summary.slice(0, 120) + '…' : p.summary)}</p>` : '';
  return `
  <div class="lib-card ${done ? 'lib-done' : ''}" onclick="${hasOpen ? `openLibReader(${p.id})` : `openProjectTasksModal(${p.id})`}">
    <div class="lib-card-cover">${libCoverHTML(p)}${isVidT && hasOpen ? '<span class="vid-badge">▶</span>' : ''}</div>
    <div class="lib-card-body">
      <div class="lib-card-type">${pt.icon} ${esc(pt.title)}</div>
      <h4 class="lib-card-title">${esc(p.name)}</h4>
      ${p.author ? `<div class="lib-card-author">${esc(p.author)}</div>` : ''}
      ${rating}
      ${summary}
      <div class="lib-card-footer">
        <span class="lib-card-file">${hasOpen ? (isVidT ? '▶ مشاهدة' : (p.file ? '📖 ملف' : '🔗 رابط')) : ''}</span>
        ${done ? '<span class="lib-card-done">✓ مُنجز</span>' : ''}
      </div>
    </div>
  </div>`;
}

/* نافذة القراءة/المشاهدة المعزولة + جلسة تركيز مدمجة تُسجَّل في الإحصائيات */
let libSessionTimer = null;
let libSessionStart = 0;

/* مشغل فيديو مخصص للمكتبة: إطار 16:9 + ملء الشاشة — مختلف تمامًا عن قارئ الكتب */
function fsToggle(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (document.fullscreenElement) { document.exitFullscreen(); return; }
  const rq = el.requestFullscreen || el.webkitRequestFullscreen;
  if (rq) rq.call(el);
}

function libVideoEmbed(src, name) {
  return `<div class="lib-video-wrap"><iframe class="lib-frame" src="${esc(src)}" title="مشغل ${esc(name)}" allow="accelerometer;autoplay;encrypted-media;picture-in-picture;fullscreen" allowfullscreen></iframe></div>`;
}

function openLibReader(id) {
  const p = NoorStore.getProjectById(id);
  if (!p) return showToast('العنصر غير موجود', 'bad');
  play('click');
  const isVideoType = p.type === 'فيديو' || p.type === 'كورس';
  let inner = '';
  let isVideo = false;
  /* الرابط قد يكون في حقل الفيديو أو الملف أو الرابط — كلاهما يُفحص ليوتيوب أولًا */
  const srcField = isVideoType ? (p.video_url || p.file || p.link || '') : (p.file || p.link || p.video_url || '');
  const yt = ytEmbedUrl(srcField);
  if (yt) {
    inner = libVideoEmbed(yt, p.name);
    isVideo = true;
  } else if (p.file) {
    inner = `<iframe class="lib-frame" src="${esc(assetUrl(p.file))}" title="قارئ ${esc(p.name)}"></iframe>`;
  } else if (p.link) {
    inner = `<div class="empty" style="padding:30px"><p>رابط خارجي غير قابل للتضمين</p><a class="btn" href="${esc(p.link)}" target="_blank" rel="noopener">🔗 فتح الرابط</a></div>`;
  } else {
    return showToast('لا ملف أو رابط بعد — أضفهما من تفاصيل العنصر', 'bad');
  }
  const pt = projectType(p.type);
  openModal(p.name, `
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;font-size:var(--fs-sm);color:var(--text-muted);flex-wrap:wrap">
      <span>${pt.icon} ${esc(pt.title)}</span>
      ${p.author ? `<span>✍️ ${esc(p.author)}</span>` : ''}
      ${p.rating > 0 ? `<span>${starsHTML(p.rating)}</span>` : ''}
    </div>
    <div id="lib-reader-view"${isVideo || !isVideoType ? '' : ''}>${inner}</div>
    <div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap">
      <span id="lib-session-label" class="count" style="flex:1">${isVideo ? 'جلسة مشاهدة' : 'جلسة قراءة'}: متوقفة</span>
      ${isVideo ? '<button class="btn btn-sm btn-ghost" onclick="fsToggle(\'lib-reader-view\')">⛶ ملء الشاشة</button>' : ''}
      <button class="btn btn-sm" id="lib-session-btn" data-pid="${p.id}" onclick="toggleLibSession(${p.id})">▶ جلسة تركيز</button>
      ${p.link && !p.file ? `<a class="btn btn-sm btn-ghost" href="${esc(p.link)}" target="_blank" rel="noopener">🔗 فتح خارجيًا</a>` : ''}
      <button class="btn btn-sm btn-ghost" onclick="closeLibReader()">إغلاق</button>
    </div>`);
}

function toggleLibSession(projectId) {
  if (libSessionTimer) {
    clearInterval(libSessionTimer); libSessionTimer = null;
    const mins = Math.round((Date.now() - libSessionStart) / 60000);
    try {
      if (mins >= 1) NoorStore.addSession({ mode: 'focus', minutes: mins, project_id: projectId, note: 'جلسة قراءة/مشاهدة من المكتبة' });
      showToast(mins >= 1 ? `سُجلت جلسة ${mins} دقيقة ✓` : 'جلسة قصيرة جدًا — لم تُسجل', mins >= 1 ? 'good' : 'bad');
    } catch (err) { showToast(err.message, 'bad'); }
    const b = $('#lib-session-btn'); if (b) b.textContent = '▶ ابدأ جلسة تركيز';
    const l = $('#lib-session-label'); if (l) l.textContent = 'جلسة قراءة: متوقفة';
    return;
  }
  libSessionStart = Date.now();
  /* لو أُغلقت النافذة من ESC/الخلفية/✕ تتوقف الجلسة وتُسجل تلقائياً كي لا تضيع الدقائق */
  modalCloseHooks.push(() => {
    if (libSessionTimer) {
      const b = $('#lib-session-btn');
      if (b && b.dataset.pid) toggleLibSession(Number(b.dataset.pid));
    }
  });
  libSessionTimer = setInterval(() => {
    const s = Math.floor((Date.now() - libSessionStart) / 1000);
    const l = $('#lib-session-label');
    if (l) l.textContent = `⏱ جارٍ: ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }, 1000);
  const b = $('#lib-session-btn'); if (b) b.textContent = '⏹ إيقاف وتسجيل الجلسة';
  showToast('انطلقت الجلسة — كل دقيقة تُحسب لك');
}

function closeLibReader() {
  /* لو المستخدم أغلق النافذة والجلسة شغالة نسجلها تلقائيًا حتى لا تضيع الدقائق */
  if (libSessionTimer) {
    const btn = $('#lib-session-btn');
    if (btn && btn.dataset.pid) toggleLibSession(Number(btn.dataset.pid));
  }
  closeModal();
}

async function libBooksPicked(input) {
  const files = [...(input.files || [])];
  input.value = '';
  if (!files.length) return;
  let ok = 0;
  for (const f of files) {
    if (!/\.pdf$/i.test(f.name)) { showToast(`تخطي «${f.name}» — ليس PDF`, 'bad'); continue; }
    try {
      /* uploadBigFile تتولى الأمرين: عبر السيرفر حتى 1 جيجا، ومحليًا حتى 8 ميجا */
      const res = await uploadBigFile(f);
      const url = String(res.url || '');
      NoorStore.addProject({
        name: f.name.replace(/\.pdf$/i, ''), type: 'كتاب',
        file: url, file_name: res.name || f.name,
        notes: 'أُضيف من الرفع الجماعي للمكتبة'
      });
      ok++;
    } catch (err) { showToast(`«${f.name}»: ${err.message}`, 'bad'); }
  }
  if (ok) {
    play('success');
    showToast(`أُضيف ${ok} كتاب إلى مكتبتك 📚`);
    await renderLibrary();
  }
}

function openLibItemModal() {
  openModal('+ عنصر جديد في المكتبة', `
    <div class="field"><label>النوع</label>
      <select class="input" id="li-type" onchange="document.getElementById('li-file-wrap').style.display=this.value==='كتاب'?'block':'none'">
        ${LIB_SECTIONS.map((s) => `<option value="${s.key}">${s.ic} ${s.title}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>العنوان</label><input class="input" id="li-name" placeholder="اسم الكتاب / الكورس / الشرح"></div>
    <div class="field"><label>المؤلف / المصدر (اختياري)</label><input class="input" id="li-author"></div>
    <div class="field"><label>رابط مباشر (يوتيوب/منصة الكورس)</label><input class="input" id="li-link" dir="ltr" placeholder="https://…"></div>
    <div class="field" id="li-file-wrap" style="display:block"><label>ملف PDF (للكتب — حتى 8 ميجا محليًا، وحتى 1 جيجا عبر السيرفر)</label>
      <div class="field-row" style="align-items:center;gap:10px">
        <input type="file" id="li-file-input" accept="application/pdf,.pdf" style="display:none" onchange="handleProjectFile(this,'li-file-name','li-file-data')">
        <input type="hidden" id="li-file-data" value="">
        <button class="btn btn-xs" onclick="$('#li-file-input').click()">📂 اختيار ملف</button>
        <input class="input" id="li-file-name" readonly placeholder="لم يُختر ملف" style="flex:1">
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="saveLibItem()">حفظ في المكتبة</button>
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>`);
}

async function saveLibItem() {
  const name = ($('#li-name').value || '').trim();
  if (!name) return showToast('أدخل عنوان العنصر', 'bad');
  try {
    NoorStore.addProject({
      name,
      type: $('#li-type').value,
      author: ($('#li-author').value || '').trim(),
      link: ($('#li-link').value || '').trim(),
      file: $('#li-file-data').value || '',
      file_name: ($('#li-file-name').value || '').trim()
    });
    play('success');
    closeModal();
    showToast('أُضيف إلى مكتبتك الشخصية ✓');
    if (state.page === 'library') await renderLibrary();
  } catch (err) { showToast(err.message, 'bad'); }
}

/* ===== المؤقت ===== */
function modeMin(mode) {
  const s = state.settings || {};
  if (mode === 'pomodoro') return Math.max(1, Number(s.pomodoro_min) || 25);
  if (mode === 'short_break') return Math.max(1, Number(s.short_break_min) || 5);
  if (mode === 'long_break') return Math.max(1, Number(s.long_break_min) || 15);
  return 0;
}
function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ===== طبقة API محلية (localStorage) — يعمل بدون سيرفر ===== */
const _LS_KEY = 'noor_local_api';
function _lsDB() { try { return JSON.parse(localStorage.getItem(_LS_KEY) || '{}'); } catch (e) { return {}; } }
function _lsSave(d) {
  try {
    localStorage.setItem(_LS_KEY, JSON.stringify(d));
    /* حاسم: أي كتابة هنا بيانات جديدة يجب أن تُعلَّم كـ«أحدث من اللقطة» وتُدفع للقاعدة فوراً،
       وإلا اعتبرها reconcile قديمة واستبدلها بالنسخة المخزنة عند الإقلاع التالي */
    try { localStorage.setItem('noor_last_change', String(Date.now())); } catch (e) {}
  } catch (e) { /* مساحة ممتلئة */ }
  try { if (typeof globalThis.NoorPersistHook === 'function') globalThis.NoorPersistHook(); } catch (e) {}
}
let _idSeq = 0;
/* هويات فريدة حتى لو فُتحت نافذتان بنفس المللي ثانية أو رجعت ساعة الجهاز للخلف */
function _nid() { return Date.now() * 1000 + (++_idSeq % 1000); }

/* ترحيل لمرة واحدة: قوائم قديمة منفصلة → المخزن المحلي الموحد */
function _migrateLegacyLists() {
  try {
    if (localStorage.getItem('noor_merged_v1')) return;
    const db = _lsDB();
    let changed = false;
    [['noor_feelings', 'feelings'], ['noor_decisions', 'decisions'], ['noor_experiences', 'experiences']].forEach((pair) => {
      let legacy = null;
      try { legacy = JSON.parse(localStorage.getItem(pair[0]) || 'null'); } catch (e) { legacy = null; }
      if (Array.isArray(legacy) && legacy.length) {
        const cur = db[pair[1]] || [];
        legacy.forEach((x) => { if (x && !cur.some((y) => String(y.id) === String(x.id))) cur.push(x); });
        db[pair[1]] = cur;
        changed = true;
      }
    });
    if (changed) _lsSave(db);
    localStorage.setItem('noor_merged_v1', String(Date.now()));
  } catch (e) {}
}

/* النسخ التلقائي الموحد: إجابات اليوميات المكتوبة → مشاعر/قرارات/تجارب في مكان واحد */
function _typedAnswerToStore(q, answer, date) {
  try {
    const db = _lsDB();
    const base = { id: Date.now(), source: 'journal', question_id: q.id, created_at: new Date().toISOString(), text: answer };
    if (q.type === 'feeling') { base.date = date; (db.feelings = db.feelings || []).unshift(base); }
    else if (q.type === 'decision') { base.date = date; (db.decisions = db.decisions || []).unshift(base); }
    else if (q.type === 'experience') { (db.experiences = db.experiences || []).unshift(Object.assign(base, { category_name: q.sub || '' })); }
    else return;
    _lsSave(db);
  } catch (e) {}
}

function _matchRoute(path, pattern) {
  const pp = pattern.split('/');
  const pa = path.split('/');
  if (pp.length !== pa.length) return null;
  const g = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) { g[pp[i].slice(1)] = pa[i]; } else if (pp[i] !== pa[i]) return null;
  }
  return g;
}

/* فك ترميز آمن: أي سلسلة تخزين مكسورة (مثل % غير مكتمل) لا تُسقط الطلب */
function _decodeSafe(s) {
  try { return decodeURIComponent(String(s)); } catch (e) { return String(s); }
}

function _goalsGroupedLocal() {
  const vals = NoorStore.getValues().filter(v => !v.archived_at);
  const goals = NoorStore.getGoals().filter(g => !g.archived_at);
  const projects = NoorStore.getProjects();
  return vals.map(v => ({
    id: v.id, name: v.title, color: v.color, priority_rank: v.priority,
    goals: goals.filter(g => g.value_id === v.id).map(g => {
      const ps = projects.filter(p => p.goal_id === g.id);
      const doneProj = ps.filter(p => p.completed_at);
      return {
        id: g.id, title: g.title, status: g.completed_at ? 'done' : 'active',
        start_year: g.year, end_year: g.years && g.years.length ? g.years[g.years.length - 1] : g.year,
        projects: ps.map(p => ({ id: p.id, name: p.name, status: p.completed_at ? 'done' : 'active', duration_days: null }))
      };
    })
  }));
}

function _goalsByYearLocal(year) {
  const goals = NoorStore.getGoals().filter(g => !g.archived_at);
  const vals = NoorStore.getValues();
  const yearMap = {};
  goals.forEach(g => {
    const yrs = g.years && g.years.length ? g.years : [g.year || 1];
    yrs.forEach(y => {
      if (!yearMap[y]) yearMap[y] = [];
      const v = vals.find(x => x.id === g.value_id) || { title: 'بدون قيمة', priority: 0, color: '' };
      yearMap[y].push({ value: v, goal: Object.assign({}, g, { status: g.completed_at ? 'done' : 'active' }) });
    });
  });
  return Object.keys(yearMap).sort((a, b) => a - b)
    .map(y => ({ year: Number(y), items: yearMap[y] }))
    .filter(x => year ? x.year === Number(year) : true);
}

function _fetchLocal(path) {
  const db = _lsDB();
  const [base, qs] = path.split('?');
  const params = {};
  if (qs) qs.split('&').forEach(p => { const kv = p.split('='); params[_decodeSafe(kv[0])] = _decodeSafe(kv[1] || ''); });
  let g;

  if (base === '/api/habits/today') {
    const habits = db.habits || [];
    const logs = db.habit_logs || {};
    const today = todayISO();
    const dow = new Date(today + 'T00:00:00').getDay();
    const DAY_KEY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    return habits.filter(h => {
      if (h.active === 0) return false;
      let days = [];
      try { days = JSON.parse(h.allowed_days || '[]'); } catch (e) { days = []; }
      if (days.length && !days.some(d => {
        const n = typeof d === 'number' ? d : DAY_KEY.indexOf(d);
        return n >= 0 && n === dow;
      })) return false;
      if (h.start_date && h.weeks) {
        const start = new Date(String(h.start_date).slice(0, 10) + 'T00:00:00').getTime();
        const now = new Date(today + 'T00:00:00').getTime();
        const end = start + (Number(h.weeks) || 1) * 7 * 86400000;
        if (now < start || now >= end) return false;
      }
      return true;
    }).map(h => ({ ...h, done: !!(logs[h.id] && logs[h.id][today]) }));
  }
  if (base === '/api/habits') return (db.habits || []).filter(h => h.active !== 0 && !h.archived_at);
  if (base === '/api/barrier-tasks') return (db.barrier_tasks || []).filter(t => t.active !== 0);
  if (base === '/api/barrier-hosts') return (db.barrier_hosts || []).filter(t => t.active !== 0);
  if (base === '/api/journal/feelings') return (db.feelings || []).filter(x => !x.archived_at);
  if (base === '/api/journal/decisions') return (db.decisions || []).filter(x => !x.archived_at);
  if (base === '/api/desires') return (db.desires || []).filter(x => !x.archived_at);
  if (base === '/api/life-experiences') return (db.experiences || []).filter(x => !x.archived_at);
  if (base === '/api/experience-categories') return (db.exp_categories || []).filter(x => !x.archived_at);
  if (base === '/api/journal/questions') return (db.journal_questions || NoorStore.getJournalQuestions()).filter(q => !q.archived_at);
  if (base === '/api/journal/entry') return { ok: true };
  if (base === '/api/goals/grouped') return _goalsGroupedLocal();
  if (base === '/api/goals/by-year') return _goalsByYearLocal();
  if (base === '/api/journal/state') {
    const d = params.date || todayISO();
    const questions = (db.journal_questions || NoorStore.getJournalQuestions()).filter(q => !q.archived_at);
    const journal = NoorStore.getTodayJournal(d);
    const answered = journal.answers.filter(a => a.answer && a.answer.trim()).length;
    return { date: d, questions: questions.map(q => { const a = journal.answers.find(x => x.questionId === q.id); return { id: q.id, text: q.text, type: q.type || 'normal', answer: (a && a.answer) || '' }; }), answered, total: questions.length };
  }
  if (base === '/api/journal/timeline') {
    const entries = (NoorStore.getJournalHistory() || []).map(d => {
      const j = NoorStore.getTodayJournal(d);
      const qs = db.journal_questions || NoorStore.getJournalQuestions();
      return { date: d, answered: j.answers.filter(a => a.answer && a.answer.trim()).length, total: qs.length };
    });
    return { entries: entries.filter(e => e.answered > 0), feelings: (db.feelings || []).filter(x => !x.archived_at), decisions: (db.decisions || []).filter(x => !x.archived_at), experiences: (db.experiences || []).filter(x => !x.archived_at) };
  }
  if (base === '/api/projects') return (NoorStore.getProjects() || []).map(p => ({ ...p, status: p.completed_at ? 'done' : 'active' }));
  return null;
}

function _sendLocal(method, path, body) {
  const db = _lsDB();
  let g;

  if (method === 'POST' && path === '/api/barrier-tasks/ensure') {
    const today = todayISO();
    /* يوم العطلة لا يُحسب يوماً في دورة كسر الحدود: لا توليد ولا تقدّم مؤشر ولا مسّ للتاريخ */
    if (_isRestDate(today)) {
      return { ok: true, generated: false };
    }
    /* الفجوة تُحسب بأيام العمل فقط — أيام العطل لا تُقص من النافذة */
    const gap = db.barrier_last ? _workDaysBetween(db.barrier_last, today) : 999;
    /* دورة الـ 3 أيام: التحدي يظهر في يومه الثالث فقط — بقية الأيام لا صف ولا شارة */
    if (db.barrier_last && gap >= 0 && gap < 3) {
      return { ok: true, generated: false };
    }
    const tasks = (db.barrier_tasks || []).filter(t => t.active !== 0);
    /* لا تحديات معرَّفة إطلاقاً → لا توليد ولا صف وهمي؛ الصفحة بلا كسر حدود حتى تُضاف عناصر */
    if (!tasks.length) { _lsSave(db); return { ok: true, generated: false, already_today: false }; }
    let chosen = null;
    if (tasks.length) {
      /* التسلسل الصارم: التحدٍّ غير المنجز يبقى هو المطلوب ولا يتقدم المؤشر حتى يُنجز */
      const activeId = db.barrier_active_id || null;
      const activeTask = activeId ? tasks.find(t => String(t.id) === String(activeId)) : null;
      if (activeTask) {
        chosen = activeTask;
      } else {
        const order = (db.barrier_order || []).filter(id => tasks.some(t => String(t.id) === String(id)));
        const pool = order.length ? order.map(id => tasks.find(t => String(t.id) === String(id))).filter(Boolean) : tasks;
        const idx = (db.barrier_idx || 0) % pool.length;
        chosen = pool[idx];
        db.barrier_idx = ((db.barrier_idx || 0) + 1) % pool.length;
        db.barrier_active_id = chosen ? chosen.id : null;
      }
    }
    db.barrier_last = today;
    db.barrier_title = chosen ? chosen.title : '';
    db.barrier_category = chosen ? (chosen.category || '') : '';
    _lsSave(db);
    return { already_today: false, generated: true, barrier_task_id: chosen ? chosen.id : null, title: db.barrier_title, category: db.barrier_category, host_task_id: null, host_title: null };
  }

  if (method === 'POST' && path === '/api/barrier-tasks/complete') {
    if (body.done === false) db.barrier_active_id = body.id != null ? body.id : db.barrier_active_id;
    else db.barrier_active_id = null;
    _lsSave(db);
    return { ok: true };
  }

  if (method === 'POST' && path === '/api/habits') {
    const item = {
      id: _nid(), title: body.title || '',
      allowed_days: JSON.stringify(body.allowed_days || []),
      active: 1, created_at: new Date().toISOString(),
      minutes: body.minutes || 0, video_url: body.video_url || '',
      video_urls: Array.isArray(body.video_urls) ? body.video_urls : (body.video_url ? [body.video_url] : []),
      goal_id: body.goal_id || null, weeks: body.weeks || 1, notes: body.notes || '',
      start_date: body.start_date || todayISO()
    };
    if (!db.habits) db.habits = []; db.habits.push(item); _lsSave(db); return item;
  }
  if ((g = _matchRoute(path, '/api/habits/:id')) && method === 'PUT') {
    const i = (db.habits || []).findIndex(h => String(h.id) === g.id);
    if (i >= 0) { Object.assign(db.habits[i], body); if (body.allowed_days) db.habits[i].allowed_days = JSON.stringify(body.allowed_days); _lsSave(db); return db.habits[i]; }
    throw new Error('العنصر غير موجود: ' + path);
  }
  if ((g = _matchRoute(path, '/api/habits/:id/log')) && method === 'PUT') {
    if (!db.habit_logs) db.habit_logs = {}; const hid = g.id; if (!db.habit_logs[hid]) db.habit_logs[hid] = {};
    db.habit_logs[hid][body.date] = body.done; _lsSave(db); return { ok: true };
  }
  if ((g = _matchRoute(path, '/api/habits/:id')) && method === 'DELETE') {
    const h = (db.habits || []).find(x => String(x.id) === g.id);
    if (h) { h.active = 0; h.archived_at = new Date().toISOString(); }
    else console.warn('[noor] حذف عادة غير موجودة:', path);
    _lsSave(db); return { ok: true };
  }

  if (method === 'POST' && path === '/api/barrier-tasks') {
    const item = { id: _nid(), title: body.title || '', category: body.category || '', active: 1, sort_order: (db.barrier_tasks || []).length, created_at: new Date().toISOString() };
    if (!db.barrier_tasks) db.barrier_tasks = []; db.barrier_tasks.push(item); _lsSave(db); return item;
  }
  if (method === 'POST' && path === '/api/barrier-tasks/reorder') {
    if (body.ids && db.barrier_tasks) { body.ids.forEach((id, i) => { const t = db.barrier_tasks.find(x => x.id === id); if (t) t.sort_order = i; }); db.barrier_order = body.ids; _lsSave(db); }
    return { ok: true };
  }
  if ((g = _matchRoute(path, '/api/barrier-tasks/:id')) && method === 'DELETE') {
    const t = (db.barrier_tasks || []).find(x => String(x.id) === g.id); if (t) t.active = 0; else console.warn('[noor] حذف مهمة حد غير موجودة:', path); _lsSave(db); return { ok: true };
  }

  if (method === 'POST' && path === '/api/barrier-hosts') {
    const item = { id: _nid(), title: body.title || '', active: 1, sort_order: (db.barrier_hosts || []).length, created_at: new Date().toISOString() };
    if (!db.barrier_hosts) db.barrier_hosts = []; db.barrier_hosts.push(item); _lsSave(db); return item;
  }
  if (method === 'POST' && path === '/api/barrier-hosts/reorder') {
    if (body.ids && db.barrier_hosts) { body.ids.forEach((id, i) => { const t = db.barrier_hosts.find(x => x.id === id); if (t) t.sort_order = i; }); _lsSave(db); }
    return { ok: true };
  }
  if ((g = _matchRoute(path, '/api/barrier-hosts/:id')) && method === 'DELETE') {
    const t = (db.barrier_hosts || []).find(x => String(x.id) === g.id); if (t) t.active = 0; else console.warn('[noor] حذف مضيف حد غير موجود:', path); _lsSave(db); return { ok: true };
  }

  if (method === 'POST' && path === '/api/journal/feelings') {
    const item = { id: _nid(), date: body.date || todayISO(), text: body.text || '', source: body.source || 'manual', created_at: new Date().toISOString() };
    if (!db.feelings) db.feelings = []; db.feelings.unshift(item); _lsSave(db); return item;
  }
  if ((g = _matchRoute(path, '/api/journal/feelings/:id')) && method === 'DELETE') {
    const f = (db.feelings || []).find(x => String(x.id) === g.id);
    if (f) f.archived_at = new Date().toISOString();
    else console.warn('[noor] حذف شعور غير موجود:', path);
    _lsSave(db); return { ok: true };
  }
  if (method === 'POST' && path === '/api/journal/decisions') {
    const item = { id: _nid(), date: body.date || todayISO(), text: body.text || '', source: body.source || 'manual', created_at: new Date().toISOString() };
    if (!db.decisions) db.decisions = []; db.decisions.unshift(item); _lsSave(db); return item;
  }
  if ((g = _matchRoute(path, '/api/journal/decisions/:id')) && method === 'DELETE') {
    const x = (db.decisions || []).find(y => String(y.id) === g.id);
    if (x) x.archived_at = new Date().toISOString();
    else console.warn('[noor] حذف قرار غير موجود:', path);
    _lsSave(db); return { ok: true };
  }

  if (method === 'POST' && path === '/api/desires') {
    const item = { id: _nid(), text: body.text || '', category: body.category || '', target_pct: body.target_pct || 80, active: 1, created_at: new Date().toISOString() };
    if (!db.desires) db.desires = []; db.desires.unshift(item); _lsSave(db); return item;
  }
  if ((g = _matchRoute(path, '/api/desires/:id')) && method === 'PUT') {
    const i = (db.desires || []).findIndex(x => String(x.id) === g.id); if (i >= 0) { Object.assign(db.desires[i], body); _lsSave(db); return db.desires[i]; }
    throw new Error('العنصر غير موجود: ' + path);
  }
  if ((g = _matchRoute(path, '/api/desires/:id')) && method === 'DELETE') {
    const x = (db.desires || []).find(y => String(y.id) === g.id);
    if (x) { x.archived_at = new Date().toISOString(); x.active = 0; }
    else console.warn('[noor] حذف رغبة غير موجودة:', path);
    _lsSave(db); return { ok: true };
  }

  if (method === 'POST' && path === '/api/life-experiences') {
    const item = { id: _nid(), text: body.text || '', source: body.source || 'manual', category_id: body.category_id || null, category_name: body.category_name || '', created_at: new Date().toISOString() };
    if (!db.experiences) db.experiences = []; db.experiences.unshift(item); _lsSave(db); return item;
  }
  if ((g = _matchRoute(path, '/api/life-experiences/:id')) && method === 'PUT') {
    const i = (db.experiences || []).findIndex(x => String(x.id) === g.id); if (i >= 0) { Object.assign(db.experiences[i], body); _lsSave(db); return db.experiences[i]; }
    throw new Error('العنصر غير موجود: ' + path);
  }
  if ((g = _matchRoute(path, '/api/life-experiences/:id')) && method === 'DELETE') {
    const x = (db.experiences || []).find(y => String(y.id) === g.id);
    if (x) x.archived_at = new Date().toISOString();
    else console.warn('[noor] حذف تجربة غير موجودة:', path);
    _lsSave(db); return { ok: true };
  }

  if (method === 'POST' && path === '/api/experience-categories') {
    const item = { id: _nid(), name: body.name || '' };
    if (!db.exp_categories) db.exp_categories = []; db.exp_categories.push(item); _lsSave(db); return item;
  }

  if (method === 'PUT' && path === '/api/journal/answers') {
    NoorStore.saveJournalAnswer(body.question_id, body.answer_text, body.date);
    return { ok: true };
  }
  if (method === 'POST' && path === '/api/journal/entry') {
    NoorStore.completeJournal(body.date || todayISO());
    return { ok: true };
  }

  if (method === 'POST' && path === '/api/journal/questions') {
    const qs = db.journal_questions || NoorStore.getJournalQuestions();
    const item = { id: _nid(), text: body.text || '', type: body.type || 'normal', order_index: qs.length + 1 };
    qs.push(item); db.journal_questions = qs; NoorStore.saveJournalQuestions(qs); _lsSave(db); return item;
  }
  if ((g = _matchRoute(path, '/api/journal/questions/:id')) && method === 'PUT') {
    const qs = db.journal_questions || NoorStore.getJournalQuestions();
    const i = qs.findIndex(x => String(x.id) === g.id);
    if (i >= 0) { Object.assign(qs[i], body); db.journal_questions = qs; NoorStore.saveJournalQuestions(qs); _lsSave(db); return qs[i]; }
    throw new Error('العنصر غير موجود: ' + path);
  }
  if ((g = _matchRoute(path, '/api/journal/questions/:id')) && method === 'DELETE') {
    const qs = db.journal_questions || NoorStore.getJournalQuestions();
    const q = qs.find(x => String(x.id) === g.id);
    if (q) q.archived_at = new Date().toISOString();
    db.journal_questions = qs; NoorStore.saveJournalQuestions(qs); _lsSave(db); return { ok: true };
  }

  if ((g = _matchRoute(path, '/api/goals/:id')) && method === 'PUT') {
    NoorStore.updateGoal(Number(g.id), body);
    return { ok: true };
  }

  /* ===== المواد الدراسية — محاكاة محلية كاملة ===== */
  const [mBase, mQs] = path.split('?');
  const mParams = {};
  if (mQs) mQs.split('&').forEach((p) => { const kv = p.split('='); mParams[_decodeSafe(kv[0])] = _decodeSafe(kv[1] || ''); });

  if (method === 'GET' && mBase === '/api/study_materials') {
    let rows = (db.study_materials || []).filter(x => !x.archived_at);
    if (mParams.project_id) rows = rows.filter(x => String(x.project_id) === String(mParams.project_id));
    return rows.sort((a, b) => (a.sort || 0) - (b.sort || 0) || a.id - b.id);
  }
  if (method === 'POST' && path === '/api/study_materials') {
    const item = { id: _nid(), project_id: body.project_id || null, title: body.title || '', type: body.type || 'subject', url: body.url || '', pdf_url: body.pdf_url || '', file: body.file || '', file_name: body.file_name || '', video_url: body.video_url || '', duration_minutes: body.duration_minutes || 0, created_at: new Date().toISOString() };
    if (!db.study_materials) db.study_materials = []; db.study_materials.push(item); _lsSave(db); return item;
  }
  if ((g = _matchRoute(mBase, '/api/study_materials/:id')) && method === 'PUT') {
    const i = (db.study_materials || []).findIndex(x => String(x.id) === g.id);
    if (i >= 0) { Object.assign(db.study_materials[i], body); _lsSave(db); return db.study_materials[i]; }
    throw new Error('العنصر غير موجود: ' + path);
  }
  if ((g = _matchRoute(mBase, '/api/study_materials/:id')) && method === 'DELETE') {
    const x = (db.study_materials || []).find(y => String(y.id) === g.id);
    if (x) x.archived_at = new Date().toISOString();
    else console.warn('[noor] حذف مادة دراسية غير موجودة:', path);
    _lsSave(db); return { ok: true };
  }
  if (method === 'GET' && mBase === '/api/material_tasks') {
    let rows = (db.material_tasks || []).filter(x => !x.archived_at);
    if (mParams.material_id) rows = rows.filter(x => String(x.material_id) === String(mParams.material_id));
    return rows.sort((a, b) => (a.sort || 0) - (b.sort || 0) || a.id - b.id);
  }
  if (method === 'POST' && path === '/api/material_tasks') {
    const item = { id: _nid(), material_id: body.material_id || null, title: body.title || '', done: body.done ? 1 : 0, sort: body.sort || 0, created_at: new Date().toISOString() };
    if (!db.material_tasks) db.material_tasks = []; db.material_tasks.push(item); _lsSave(db); return item;
  }
  if ((g = _matchRoute(mBase, '/api/material_tasks/:id')) && method === 'PUT') {
    const i = (db.material_tasks || []).findIndex(x => String(x.id) === g.id);
    if (i >= 0) { Object.assign(db.material_tasks[i], body); _lsSave(db); return db.material_tasks[i]; }
    throw new Error('العنصر غير موجود: ' + path);
  }
  if ((g = _matchRoute(mBase, '/api/material_tasks/:id')) && method === 'DELETE') {
    const x = (db.material_tasks || []).find(y => String(y.id) === g.id);
    if (x) x.archived_at = new Date().toISOString();
    else console.warn('[noor] حذف مهمة مادة غير موجودة:', path);
    _lsSave(db); return { ok: true };
  }
  if (method === 'GET' && mBase === '/api/material_videos') {
    let rows = (db.material_videos || []).filter(x => !x.archived_at);
    if (mParams.material_id) rows = rows.filter(x => String(x.material_id) === String(mParams.material_id));
    return rows.sort((a, b) => (a.sort || 0) - (b.sort || 0) || a.id - b.id);
  }
  if (method === 'POST' && path === '/api/material_videos') {
    const item = { id: _nid(), material_id: body.material_id || null, title: body.title || '', url: body.url || '', done: body.done ? 1 : 0, sort: body.sort || 0, created_at: new Date().toISOString() };
    if (!db.material_videos) db.material_videos = []; db.material_videos.push(item); _lsSave(db); return item;
  }
  if ((g = _matchRoute(mBase, '/api/material_videos/:id')) && method === 'PUT') {
    const i = (db.material_videos || []).findIndex(x => String(x.id) === g.id);
    if (i >= 0) { Object.assign(db.material_videos[i], body); _lsSave(db); return db.material_videos[i]; }
    throw new Error('العنصر غير موجود: ' + path);
  }
  if ((g = _matchRoute(mBase, '/api/material_videos/:id')) && method === 'DELETE') {
    const x = (db.material_videos || []).find(y => String(y.id) === g.id);
    if (x) x.archived_at = new Date().toISOString();
    else console.warn('[noor] حذف فيديو مادة غير موجود:', path);
    _lsSave(db); return { ok: true };
  }

  return null;
}

/* ===== جسر الخلود: قاعدة البيانات على القرص هي المخزن الرئيسي =====
   كل حفظ محلي يُدفع فوراً كلقطة كاملة للخادم، مع إعادة محاولة كل 3 ثوانٍ حتى يصل الحفظ،
   ولقطة أخيرة إلزامية عند إغلاق الصفحة، وعند الإقلاع يُستعاد الأحدث بين المتصفح والقرص. */
const Bridge = {
  serverOn: false,
  pushing: false,
  pendingPush: false,
  _t: null,
  _retryT: null,

  async detect() {
    /* وضع الملف المباشر (file://): لا خادم — تخزين محلي كامل فورًا */
    if (location.protocol === 'file:') { this.serverOn = false; return; }
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2000);
      const r = await fetch('/api/health', { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(t);
      this.serverOn = !!(r && r.ok);
    } catch (e) { this.serverOn = false; }
  },

  /* عند الإقلاع: الأحدث يفوز — نقارن آخر تغيير محلي بآخر لقطة محفوظة على القرص */
  _reconciling: false,
  async reconcile() {
    if (!this.serverOn || this._reconciling) return;
    this._reconciling = true;
    try {
      let info = null;
      try { info = await (await fetch('/api/sync/info', { cache: 'no-store' })).json(); } catch (e) { console.error('[noor] فشل قراءة حالة المزامنة:', e); this.scheduleRetry(); return; }
      if (!info || !info.exists) { this.markDirty(); this.pushNow(); return; }
      const localTs = Number(localStorage.getItem('noor_last_change') || 0);
      const serverTs = Date.parse(info.saved_at || '') || 0;
      /* صفر مخاطرة: أي تغيير محلي لم يصل القاعدة بعد يفوز دائمًا — لا نسحب لقطة فوقه */
      const dirty = localStorage.getItem('noor_dirty') === '1';
      /* لا نستبدل بيانات المستخدم المحلية بلقطة الخادم إلا إن كانت محليًا فارغة تمامًا (أول تشغيل) */
      const localEmpty = NoorStore.isEmpty && NoorStore.isEmpty();
      if (!dirty && localEmpty && serverTs > 0) {
        try {
          const r = await fetch('/api/sync', { cache: 'no-store' });
          if (r.ok) {
            const snap = await r.json();
            NoorStore.restore(snap);
            localStorage.setItem('noor_last_change', String(Date.parse(snap.exported_at) || serverTs));
            this.clearDirty();
            /* جُلبت لقطة أحدث من القرص: أعد رسم الصفحة الحالية لتعرضها فوراً */
            try { if (typeof this.afterPull === 'function') this.afterPull(); } catch (e) {}
          }
        } catch (e) { console.error('[noor] تفشل سحب اللقطة من الخادم:', e); }
      } else {
        this.pushNow();
      }
    } finally {
      this._reconciling = false;
    }
  },

  /* علم «تغييرات لم تصل القاعدة بعد» — يضمن عدم ضياع أي شيء حتى لو انطفأ الاتصال */
  markDirty() { try { localStorage.setItem('noor_dirty', '1'); } catch (e) {} },
  clearDirty() { try { localStorage.removeItem('noor_dirty'); } catch (e) {} },

  pushNow() {
    if (!this.serverOn) return;
    if (this.pushing) { this.pendingPush = true; return; }
    this.pushing = true;
    this.markDirty();
    try {
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Noor-Sync': '1' },
        body: JSON.stringify(NoorStore.dump())
      }).then((r) => {
        this.pushing = false;
        if (r && r.ok) {
          /* وصلت اللقطة للقاعدة: نستعمل ساعة العميل حصرياً في كل الطوابع،
             لأن المقارنة عند الإقلاع تجري بين هذا الطابع وطوابع الحفظ المحلية (ساعة العميل أيضاً)
             — خلط ساعة الخادم يفتح نافذة تراجع لو كانت ساعته متقدمة */
          try { localStorage.setItem('noor_last_change', String(Date.now())); } catch (e) {}
          this.clearDirty();
        } else {
          this.scheduleRetry();
        }
        if (this.pendingPush) { this.pendingPush = false; this.queuePush(); }
      }).catch(() => { this.pushing = false; this.scheduleRetry(); });
    } catch (e) { this.pushing = false; this.scheduleRetry(); }
  },

  scheduleRetry() {
    /* صفر مخاطرة: إعادة محاولة كل 3 ثوانٍ حتى تصل اللقطة إلى قاعدة البيانات */
    if (this._retryT) return;
    this._retryT = setTimeout(() => { this._retryT = null; if (Bridge.serverOn) Bridge.pushNow(); }, 3000);
  },

  queuePush() {
    if (!this.serverOn) return;
    clearTimeout(this._t);
    /* دفع شبه فوري: 250 مللي فقط لتجميع دفعات النقر السريعة */
    this._t = setTimeout(() => this.pushNow(), 250);
  },

  flushOnExit() {
    /* إغلاق التبويب أو التنقل: لقطة أخيرة عبر sendBeacon لا تعيق الخروج.
       المتصفحات تحدّد ~64KB للـbeacon — عند الفشل نجرب fetch keepalive كخطة بديلة */
    try {
      if (!this.serverOn) return;
      const payload = JSON.stringify(NoorStore.dump());
      let ok = false;
      if (navigator.sendBeacon) {
        try { ok = navigator.sendBeacon('/api/sync', new Blob([payload], { type: 'application/json' })); } catch (e) { ok = false; }
      }
      if (!ok) fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Noor-Sync': '1' }, body: payload, keepalive: true }).catch(() => {});
    } catch (e) {}
  },

  install() {
    globalThis.NoorPersistHook = () => this.queuePush();
    try {
      window.addEventListener('pagehide', () => this.flushOnExit());
      /* العودة للتبويب أو رجوع الشبكة: نكتشف الخادم وندفع أي تغييرات غير مسلّمة فقط —
         لا reconcile كامل هنا كي لا تُمس بيانات عدّلت للتو أثناء غياب التبويب */
      const rewire = () => { this.detect().then(() => { if (this.serverOn) { try { if (localStorage.getItem('noor_dirty') === '1') this.pushNow(); } catch (e) {} } }); };
      window.addEventListener('online', rewire);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') rewire(); });
    } catch (e) {}
  }
};

/* رفع ملفات كبيرة عبر الخادم (بث مباشر إلى القرص)، أو base64 في الوضع المحلي */
async function uploadBigFile(file, onProgress) {
  if (!(file instanceof File)) throw new Error('ملف غير صالح');
  if (Bridge.serverOn) {
    const safeName = file.name.replace(/[\\/:*?"<>|]+/g, '_');
    const xhr = new XMLHttpRequest();
    const url = '/api/upload/' + encodeURIComponent(Date.now() + '-' + safeName);
    const result = await new Promise((resolve, reject) => {
      xhr.open('PUT', url, true);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      if (xhr.upload && onProgress) xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) onProgress(ev.loaded / ev.total); };
      xhr.onload = () => {
        try { const j = JSON.parse(xhr.responseText); if (xhr.status >= 200 && xhr.status < 300 && j.ok) resolve(j); else reject(new Error(j.error || 'فشل الرفع')); }
        catch (e) { reject(new Error('فشل الرفع')); }
      };
      xhr.onerror = () => reject(new Error('تعذر الاتصال بالخادم'));
      xhr.send(file);
    });
    return result;
  }
  if (file.size > 8 * 1024 * 1024) throw new Error('في الوضع المحلي الحد 8MB — شغّل الخادم لرفع الملفات الضخمة');
  const dataUrl = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('تعذرت قراءة الملف'));
    fr.readAsDataURL(file);
  });
  return { ok: true, url: dataUrl, name: file.name };
}

async function apiFetch(path) {
  const out = _fetchLocal(path);
  if (out !== null && out !== undefined) return out;
  /* مسارات GET لم تُدرج في _fetchLocal (المواد الدراسية) — محاكاة محلية في _sendLocal */
  return _sendLocal('GET', path, null);
}

async function apiSend(method, path, body) {
  const out = _sendLocal(method, path, body);
  if (out === null && method !== 'GET') {
    /* مسارات لم تُهاجر بعد إلى المحاكاة المحلية: جرّب الخادم إن كان حاضرًا */
    if (!Bridge.serverOn) return null;
    try {
      const r = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
      if (r.ok) return await r.json().catch(() => ({}));
      return null;
    } catch (e) { return null; }
  }
  return out;
}

async function renderTimer() {
  if (state.timer._rendering) return;
  state.timer._rendering = true;
  try {
    const t = state.timer;
    state.settings = NoorStore.getSettings();
    state.projects = NoorStore.getProjects();
    t.apiProjects = (await apiFetch('/api/projects')) || [];
    /* تحديد تلقائي لأول مشروع له مهام إن لم يُختر مشروع بعد */
    if (!t.project_id && !t.projectSel && state.projects.length) {
      const withTasks = state.projects.find((p) => p.tasks && p.tasks.length > 0);
      if (withTasks) {
        t.project_id = withTasks.id;
        t.projectSel = String(withTasks.id);
        try { NoorStore.updateSettings({ timer_project_id: withTasks.id, timer_project_sel: String(withTasks.id) }); } catch (e) {}
      }
    }
    const sessions = NoorStore.getSessions({ from: todayISO(), to: todayISO() });
    const work = sessions.filter((s) => s.mode !== 'break');
    const workMin = work.reduce((a, s) => a + s.minutes, 0);
    if (t.mode === 'focus') t.mode = 'countdown';
    if (!t.running && t.total <= 0) {
      if (t.mode === 'pomodoro' || t.mode === 'countdown') t.total = t.left = (t.focusMin || 25) * 60;
      else if (t.mode === 'short_break' || t.mode === 'long_break') t.total = t.left = modeMin(t.mode) * 60;
      else t.total = t.left = 0;
    }
    /* مصدر واحد للمشاريع: القائمة المحلية — خيارات api تُضاف فقط إن لم تكن موجودة (بيانات خادم فقط) */
    const selProj = (() => {
      const v = String(t.projectSel || '');
      if (v.startsWith('api:')) return t.apiProjects.find((p) => String(p.id) === String(v.slice(4))) || null;
      const pid = Number(v);
      return state.projects.find((p) => p.id === pid) || t.apiProjects.find((p) => p.id === pid) || null;
    })();
    const isStudy = !!(selProj && String(selProj.type) === 'دراسة');
    const selProjId = selProj ? selProj.id : null;
    const materials = isStudy ? (t.materials || []) : [];
    const hasMaterial = !!(isStudy && t.materialId && t.currentMaterial);

    let projOptions = '<option value="">— بدون مشروع —</option>';
    state.projects.forEach((p) => {
      projOptions += `<option value="${p.id}" ${t.projectSel === String(p.id) ? 'selected' : ''}>${esc(p.name)}${p.type && p.type !== 'عام' ? ` (${esc(p.type)})` : ''}</option>`;
    });
    t.apiProjects.forEach((p) => {
      if (state.projects.some((x) => String(x.id) === String(p.id))) return;
      projOptions += `<option value="api:${p.id}" ${t.projectSel === 'api:' + p.id ? 'selected' : ''}>${esc(p.name)}${p.type && p.type !== 'عام' ? ` (${esc(p.type)})` : ''}</option>`;
    });

    let materialField = '';
    if (isStudy) {
      materialField = `
        <div class="field"><label>المادة</label>
          <div style="display:flex;gap:6px;align-items:center">
            <select class="input" id="timer-material" onchange="onTimerMaterialChange()" style="flex:1">
              <option value="">— اختر المادة —</option>
              ${materials.map((m) => `<option value="${m.id}" ${t.materialId === m.id ? 'selected' : ''}>${esc(m.title)}${m.duration_minutes ? ` (${m.duration_minutes} د)` : ''}</option>`).join('')}
            </select>
            <button class="btn btn-xs btn-ghost" onclick="openMaterialsModal(${selProjId})" title="إضافة وإدارة مواد هذا المشروع">⚙ المواد</button>
          </div>
        </div>`;
    }

    const html = `
      <div class="timer-wrap ${hasMaterial ? 'has-study' : ''}">
        <div class="timer-main">
          <div class="card">
            <div class="mode-tabs">
              ${TIMER_MODES.map((x) => `<button class="mode-tab ${t.mode === x.m ? 'active' : ''}" data-mode="${x.m}">${timerIcon(x.m)}<span>${x.label}</span></button>`).join('')}
            </div>
            <div class="timer-stage mode-${t.mode} ${t.running ? 'running' : ''}" id="timer-stage">
              <svg viewBox="0 0 260 260" aria-hidden="true">
                <circle class="ring-bg" cx="130" cy="130" r="112"></circle>
                <circle class="ring-fill" id="timer-ring-fill" cx="130" cy="130" r="112"></circle>
              </svg>
              <div class="timer-display" id="timer-display">${timerDisplayText()}</div>
            </div>
            <div class="timer-status">
              <span class="chip chip-proj">${timerIcon(t.mode)} ${TIMER_MODE_LABELS[t.mode] || 'مؤقت'}</span>
              ${(t.mode === 'pomodoro' || t.mode === 'short_break' || t.mode === 'long_break') ? (() => { const cn = Math.max(1, parseInt(state.settings.cycles_per_long) || 4); const done = t.cyclesDone % cn; return `<span class="cycle-dots" id="cycle-dots" title="الجلسات نحو الاستراحة الطويلة">${Array.from({ length: cn }, (_, i) => `<i class="${i < done ? 'on' : ''}"></i>`).join('')}</span>`; })() : ''}
            </div>
            <div class="timer-controls">
              <button class="btn btn-lg" id="btn-start" onclick="toggleTimer()">${t.running ? 'إيقاف مؤقت' : (t.mode === 'alarm' ? 'تفعيل المنبه' : 'ابدأ')}</button>
              <button class="btn btn-lg btn-ghost" onclick="resetTimer()">إعادة</button>
              ${(t.mode === 'countdown' || t.mode === 'pomodoro') && !t.running ? '<button class="btn btn-lg btn-ghost" onclick="finishTimer(true)">إنهاء وتسجيل</button>' : ''}
              ${(t.mode === 'short_break' || t.mode === 'long_break') ? '<button class="btn btn-lg btn-ghost" onclick="skipBreak()">تخطّي الاستراحة</button>' : ''}
              ${t.ringing ? '<button class="btn btn-lg btn-primary" onclick="stopAlarmRing()">🔇 أوقف الرنين</button>' : ''}
            </div>
            <div class="cycle-info">${cycleInfoText()}</div>
            <div class="timer-opts">
              <div class="field"><label>المشروع (اختياري)</label>
                <select class="input" id="timer-project" onchange="onTimerProjectChange()">
                  ${projOptions}
                </select>
              </div>
              ${materialField}
              ${t.mode === 'countdown' || t.mode === 'pomodoro' ? `
              <div class="field"><label>عدد الدقائق</label><input class="input" id="focus-min" type="number" min="1" value="${t.focusMin}" onchange="saveTimerFocusMin()" onblur="saveTimerFocusMin()"></div>
              <div class="field"><label>اختصارات سريعة</label><div class="day-opts">
                ${[5, 10, 15, 25, 45, 60].map((n) => `<button type="button" class="btn mini-btn" onclick="applyCountdownPreset(${n})">${n} د</button>`).join('')}
              </div></div>` : ''}
              ${t.mode === 'alarm' ? `
              <div class="field"><label>وقت المنبه</label><input class="input" id="alarm-time" type="time" value="${t.alarmHHMM || nextHalfHourStr()}" onchange="saveTimerAlarmTime()" onblur="saveTimerAlarmTime()">
                <span class="count">سي رنّ عند بلوغ هذا الوقت حتى لو غادرت الصفحة والجهاز مستيقظ</span></div>
              <p class="count">${t.ringing ? '🔔🔔 المنبه يرن الآن!' : (t.alarmArmed ? 'المنبه مسلّح وينتظر وقته…' : 'اضغط «تفعيل المنبه» بعد اختيار الوقت')}</p>` : ''}
            </div>
          </div>
          <div class="card">
            <div class="card-head"><h3 class="card-title">جلسات اليوم</h3><span class="count">${workMin} دقيقة تركيز</span></div>
            <div class="card-body" style="padding-top:6px">
              ${work.length ? work.map((s) => `
                <div class="session-row">
                  <span class="chip ${s.mode === 'pomodoro' ? 'chip-proj' : 'chip-auto'}">${s.mode === 'pomodoro' ? 'بومودورو' : 'تركيز'}</span>
                  <span>${s.pname ? esc(s.pname) : 'بدون مشروع'}</span>
                  <span class="muted">${esc(s.minutes)} دقيقة</span>
                </div>`).join('') : '<div class="empty-box"><strong>لا جلسات بعد اليوم</strong><p>ابدأ أول جلسة تركيز — ستُسجَّل هنا تلقائيًا.</p></div>'}
            </div>
          </div>
          <div class="card" id="st-card">
            <div class="card-head"><h3 class="card-title">مهام الجلسة</h3><span class="count" id="st-count"></span></div>
            <div class="card-body" style="padding-top:6px" id="st-body"></div>
          </div>
        </div>
        <div class="timer-side" id="timer-side"></div>
      </div>`;

    $('#content').innerHTML = html;
    document.querySelectorAll('.mode-tab').forEach((b) => {
      b.addEventListener('click', () => setMode(b.dataset.mode));
    });
    updateTimerRing();
    renderSessionTasks();
    renderMaterialPanel();
  } finally { state.timer._rendering = false; }
}

const TIMER_MODES = [
  { m: 'pomodoro', label: 'بومودورو' },
  { m: 'countdown', label: 'عد تنازلي' },
  { m: 'alarm', label: 'منبه' }
];
/* الاستراحتان ليستا أوضاعًا مستقلة — هما مراحل تلقائية داخل دورة البومودورو،
   وتُعرضان فقط أثناء تشغيل الدورة (انظر completeTimer) */
const TIMER_MODE_LABELS = { pomodoro: 'بومودورو', countdown: 'عد تنازلي', alarm: 'منبه', short_break: 'استراحة قصيرة', long_break: 'استراحة طويلة' };

/* أيقونات المؤقت: SVG نظيفة بأسلوب النظام (ترث لون النص) */
function timerIcon(m) {
  const s = '<svg class="tm-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  if (m === 'pomodoro') return s + '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M9 3h6"/><path d="M12 1v2"/></svg>';
  if (m === 'countdown') return s + '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  if (m === 'alarm') return s + '<path d="M6 3 L3 6"/><path d="M18 3 L21 6"/><path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7Z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>';
  if (m === 'short_break') return s + '<path d="M4 9h13v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z"/><path d="M17 10h2a2 2 0 0 1 0 4h-2"/><path d="M7 3v3M11 3v3"/></svg>';
  if (m === 'long_break') return s + '<path d="M20 14.5A8 8 0 1 1 10 4.5a6 6 0 0 0 10 10Z"/></svg>';
  return s + '<circle cx="12" cy="12" r="9"/></svg>';
}

/* تقدم الحلقة حول القرص: يمتلئ مع مرور الوقت بلون الوضع الحالي */
function updateTimerRing() {
  const el = $('#timer-ring-fill');
  if (!el) return;
  const t = state.timer;
  const C = 2 * Math.PI * 112;
  let frac = 0;
  if (t.mode === 'pomodoro' || t.mode === 'countdown' || t.mode === 'short_break' || t.mode === 'long_break') {
    const total = Math.max(1, t.total > 0 ? t.total : defaultTotal());
    const left = t.running ? Math.max(0, Math.round((t.endAt - Date.now()) / 1000)) : (t.left || total);
    frac = 1 - left / total;
    frac = Math.min(1, Math.max(0, frac));
  }
  el.style.strokeDasharray = String(C);
  el.style.strokeDashoffset = String(C * (1 - frac));
}

function ytPlaylistId(url) {
  const m = /[?&]list=([A-Za-z0-9_-]+)/i.exec(String(url || ''));
  return m ? m[1] : null;
}

function ytEmbedSrc(url, kind) {
  url = String(url || '').trim();
  if (!url) return null;
  if (kind === 'playlist') {
    const list = ytPlaylistId(url);
    return list ? 'https://www.youtube.com/embed/videoseries?list=' + encodeURIComponent(list) : null;
  }
  if (/youtube(?:-nocookie)?\.com\/embed\//i.test(url)) return url;
  const id = ytVideoId(url);
  if (id) return 'https://www.youtube.com/embed/' + id + '?rel=0';
  const embed = ytEmbedUrl(url);
  if (embed) return embed;
  return null;
}

function isPDFURL(u) {
  return /\.pdf($|\?)/i.test(String(u || '').trim());
}
function isImageURL(u) {
  return /\.(png|jpe?g|gif|webp|svg|bmp)($|\?)/i.test(String(u || '').trim());
}

async function onTimerProjectChange() {
  const v = $('#timer-project')?.value || '';
  const t = state.timer;
  t.projectSel = v;
  t.materialId = null;
  t.materials = [];
  t.currentMaterial = null;
  t.materialTasks = [];
  t.materialVideos = [];
  let matPid = null;
  if (String(v).startsWith('api:')) {
    t.apiProjectId = Number(String(v).slice(4));
    t.project_id = null;
    matPid = t.apiProjectId;
  } else {
    t.apiProjectId = null;
    t.project_id = v ? Number(v) : null;
    matPid = t.project_id;
  }
  try { NoorStore.updateSettings({ timer_project_id: t.project_id || null, timer_project_sel: v }); } catch (e) {}
  /* المادة تُحمَّل لأي مشروع دراسة سواء اختير من القائمة المحلية أو من خادم */
  const proj = state.projects.find((p) => String(p.id) === String(matPid)) || state.timer.apiProjects.find((p) => String(p.id) === String(matPid));
  if (proj && String(proj.type) === 'دراسة') {
    t.materials = (await apiFetch('/api/study_materials?project_id=' + matPid)) || [];
  }
  renderTimer();
}

async function onTimerMaterialChange() {
  const v = $('#timer-material')?.value || '';
  const t = state.timer;
  t.materialId = v ? Number(v) : null;
  t.currentMaterial = (t.materials || []).find((m) => m.id === t.materialId) || null;
  t.materialTasks = [];
  t.materialVideos = [];
  if (t.materialId) {
    const [tasks, videos] = await Promise.all([
      apiFetch('/api/material_tasks?material_id=' + t.materialId),
      apiFetch('/api/material_videos?material_id=' + t.materialId),
    ]);
    t.materialTasks = tasks || [];
    t.materialVideos = videos || [];
  }
  renderTimer();
}

async function toggleMaterialTask(id, done) {
  try {
    await apiSend('PUT', '/api/material_tasks/' + id, { done: done ? 1 : 0 });
    const task = (state.timer.materialTasks || []).find((x) => x.id === id);
    if (task) task.done = done ? 1 : 0;
    play(done ? 'success' : 'tick');
    renderMaterialPanel();
  } catch (e) {
    showToast('تعذر الحفظ', 'bad');
  }
}

function playMaterialVideo(id) {
  const v = (state.timer.materialVideos || []).find((x) => x.id === id);
  const box = $('#mt-player');
  if (!v || !box) return;
  const src = ytEmbedSrc(v.url, v.kind);
  if (src) {
    box.innerHTML = `<div class="st-video" id="mt-fs"><iframe src="${esc(src)}" title="YouTube" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen playsinline></iframe></div>
      <div style="margin-top:6px;text-align:end"><button class="btn btn-xs btn-ghost" onclick="fsToggle('mt-fs')">⛶ ملء الشاشة</button></div>`;
  } else if (v.url) {
    window.open(v.url, '_blank');
  }
}

function renderMaterialPanel() {
  const box = $('#timer-side');
  if (!box) return;
  const t = state.timer;
  const mat = t.currentMaterial;
  if (!mat) {
    box.innerHTML = '';
    return;
  }
  const tasks = t.materialTasks || [];
  const videos = t.materialVideos || [];
  const done = tasks.filter((x) => x.done).length;
  let h = `<div class="card"><div class="card-head"><h3 class="card-title">${esc(mat.title)}</h3>${mat.duration_minutes ? `<span class="count">${mat.duration_minutes} دقيقة</span>` : ''}</div><div class="card-body" style="padding-top:6px">`;
  let mainMedia = '';
  if (mat.video_url) {
    const vsrc = ytEmbedSrc(mat.video_url);
    if (vsrc) mainMedia = `<div class="mt-media"><div class="st-video" id="mt-mat-fs"><iframe src="${esc(vsrc)}" title="فيديو المادة" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen playsinline></iframe></div><div style="margin-top:4px;text-align:end"><button class="btn btn-xs btn-ghost" onclick="fsToggle('mt-mat-fs')">⛶ ملء الشاشة</button></div></div>`;
    else mainMedia = `<div class="mt-media"><a class="btn btn-xs" href="${esc(mat.video_url)}" target="_blank" rel="noopener">🎬 فتح رابط الفيديو</a></div>`;
  } else if (mat.pdf_url || mat.url) {
    const u = assetUrl(mat.pdf_url || mat.url);
    if (isPDFURL(u)) mainMedia = `<div class="mt-media"><iframe class="mt-pdf" src="${esc(u)}" title="PDF" loading="lazy"></iframe></div>`;
    else if (isImageURL(u)) mainMedia = `<div class="mt-media"><img class="mt-img" src="${esc(u)}" alt="${esc(mat.title)}" loading="lazy"></img></div>`;
    else mainMedia = `<div class="mt-media"><a class="btn btn-xs" href="${esc(u)}" target="_blank" rel="noopener">فتح الملف</a></div>`;
  } else if (mat.file) {
    const mf = assetUrl(mat.file);
    if (isPDFURL(mf)) mainMedia = `<div class="mt-media"><iframe class="mt-pdf" src="${esc(mf)}" title="${esc(mat.file_name || 'ملف')}" loading="lazy"></iframe></div>`;
    else mainMedia = `<div class="mt-media"><a class="btn btn-xs" href="${esc(mf)}" target="_blank" rel="noopener">📖 فتح الملف: ${esc(mat.file_name || 'ملف مرفق')}</a></div>`;
  }
  if (mainMedia) h += mainMedia;
  h += `<div class="st-sec">مهام المادة — ${done}/${tasks.length}</div>`;
  h += `<div class="st-list">` + (tasks.length ? tasks.map((x) => `
    <div class="st-row ${x.done ? 'st-done' : ''}">
      <button class="task-check" onclick="toggleMaterialTask(${x.id}, ${x.done ? 0 : 1})" title="${x.done ? 'تراجع' : 'إنجاز'}">${x.done ? '✓' : ''}</button>
      <span class="st-text">${esc(x.title)}</span>
    </div>`).join('') : '<div class="empty-box"><p>لا مهام لهذه المادة.</p></div>') + `</div>`;
  h += `<div class="st-sec">فيديوهات المادة — ${videos.length}</div>`;
  h += `<div class="st-list">` + (videos.length ? videos.map((v, i) => {
    if (ytEmbedSrc(v.url, v.kind)) {
      return `<div class="st-src-item"><button class="btn btn-xs" onclick="playMaterialVideo(${v.id})">▶ تشغيل ${i + 1}</button> <span class="muted">${v.kind === 'playlist' ? 'قائمة' : 'فيديو'}</span></div>`;
    }
    return `<div class="st-src-item"><a class="btn btn-xs" href="${esc(v.url)}" target="_blank" rel="noopener">فتح الرابط ${i + 1}</a></div>`;
  }).join('') : '<div class="empty-box"><p>لا فيديوهات لهذه المادة.</p></div>') + `</div>`;
  h += `<div id="mt-player"></div>`;
  h += `</div></div>`;
  box.innerHTML = h;
}

/* ===== إدارة المواد: واجهة كاملة لإضافة المواد ومهامها وفيديوهاتها (متعددة الروابط) ===== */
let _matsProjectId = null;

async function openMaterialsModal(projectId) {
  _matsProjectId = Number(projectId);
  openModal('📚 مواد المشروع الدراسي', '<div id="mats-body"><div class="loading">…جارٍ التحميل</div></div>');
  await renderMaterialsBody();
}

async function renderMaterialsBody() {
  const box = $('#mats-body');
  if (!box) return;
  const mats = (await apiFetch('/api/study_materials')) || [];
  const mine = mats.filter((m) => String(m.project_id) === String(_matsProjectId));
  const withDetails = await Promise.all(mine.map(async (m) => {
    const [tasks, videos] = await Promise.all([
      apiFetch('/api/material_tasks?material_id=' + m.id),
      apiFetch('/api/material_videos?material_id=' + m.id),
    ]);
    return { ...m, tasks: tasks || [], videos: videos || [] };
  }));
  let h = `
    <div class="st-add" style="margin-bottom:14px">
      <input class="input" id="mat-new-title" placeholder="اسم المادة (مثال: الفصل الأول — الميكانيكا)" onkeydown="if(event.key==='Enter'){event.preventDefault();matsAddMaterial()}">
      <button class="btn" onclick="matsAddMaterial()">+ مادة</button>
    </div>
    <details style="margin-bottom:14px;padding:10px;background:var(--bg);border:var(--border-w) solid var(--border-light)">
      <summary style="cursor:pointer;font-weight:700;font-size:var(--fs-sm)">⚙ خيارات المادة المتقدمة (مدة + فيديو + ملف)</summary>
      <div style="padding-top:10px;display:flex;flex-direction:column;gap:8px">
        <div class="field-row">
          <div class="field" style="flex:0 0 120px"><label>المدة (دقائق)</label><input class="input" id="mat-new-duration" type="number" min="1" placeholder="اختياري"></div>
        </div>
        <div class="field"><label>رابط فيديو يوتيوب</label><input class="input" id="mat-new-video" dir="ltr" placeholder="https://youtube.com/..."></div>
        <div class="field"><label>ملف مرفق (PDF/مستند)</label>
          <div class="field-row" style="align-items:center;gap:10px">
            <input type="file" id="mat-new-file-input" style="display:none" onchange="handleProjectFile(this,'mat-new-file-name','mat-new-file-data')">
            <input type="hidden" id="mat-new-file-data" value="">
            <button class="btn btn-xs" onclick="$('#mat-new-file-input').click()">📂 اختيار ملف</button>
            <input class="input" id="mat-new-file-name" readonly placeholder="لم يُختر ملف" style="flex:1">
          </div>
        </div>
      </div>
    </details>`;
  if (!withDetails.length) {
    h += `<div class="empty-box"><strong>لا مواد بعد</strong><p>المواد هي أقسام مشروع الدراسة — كل مادة لها مهامها وفيديوهاتها الخاصة، وفي المؤقت تختار المادة لا المشروع.</p></div>`;
  }
  h += withDetails.map((m) => `
    <div class="card" style="margin-bottom:10px">
      <div class="card-head">
        <h3 class="card-title">📘 ${esc(m.title)}${m.duration_minutes ? ` <span class="count">(${m.duration_minutes} د)</span>` : ''}</h3>
        <div style="display:flex;gap:6px">
          <button class="icon-btn" onclick="matsEditMaterial(${m.id})" title="تعديل المادة">✎</button>
          <button class="icon-btn danger" onclick="matsDeleteMaterial(${m.id})" title="حذف المادة">✕</button>
        </div>
      </div>
      <div class="card-body">
        <div id="mat-player-${m.id}"></div>
        ${(m.video_url || m.file) ? `<div class="st-src" style="margin-top:6px">
          <div class="st-sec">مصادر المادة</div>
          <div class="st-src-list">
            ${m.video_url ? `<div class="st-src-item">
              ${ytEmbedSrc(m.video_url) ? `<button class="btn btn-xs" onclick="matsPlayVideo(${m.id}, null, '${jsEsc(m.video_url)}')">▶ تشغيل الفيديو</button>` : `<a class="btn btn-xs" href="${esc(m.video_url)}" target="_blank" rel="noopener">فتح رابط الفيديو</a>`}
              <span class="muted">🎬 فيديو</span>
            </div>` : ''}
            ${m.file ? `<div class="st-src-item">
              <a class="btn btn-xs" href="${esc(assetUrl(m.file))}" target="_blank" rel="noopener">📖 فتح الملف</a>
              <span class="muted">${esc(m.file_name || 'ملف مرفق')}</span>
            </div>` : ''}
          </div>
        </div>` : ''}
        <div class="st-sec">مهام المادة — ${m.tasks.filter((x) => x.done).length}/${m.tasks.length}</div>
        <div class="st-list">
          ${m.tasks.map((x) => `
            <div class="st-row ${x.done ? 'st-done' : ''}">
              <button class="task-check" onclick="matsToggleTask(${m.id}, ${x.id}, ${x.done ? 0 : 1})">${x.done ? '✓' : ''}</button>
              <span class="st-text">${esc(x.title)}</span>
              <button class="icon-btn danger" onclick="matsDeleteTask(${m.id}, ${x.id})" title="حذف">✕</button>
            </div>`).join('') || '<p class="count">لا مهام بعد</p>'}
        </div>
        <div class="st-add" style="margin-top:6px">
          <input class="input input-sm" id="mat-task-${m.id}" placeholder="مهمة جديدة…" onkeydown="if(event.key==='Enter'){event.preventDefault();matsAddTask(${m.id})}">
          <button class="btn btn-xs" onclick="matsAddTask(${m.id})">+</button>
        </div>
        <div class="st-sec" style="margin-top:10px">فيديوهات المادة — ${m.videos.length}</div>
        <div class="st-list">
          ${m.videos.map((v, i) => {
            const emb = ytEmbedSrc(v.url, v.kind);
            return `<div class="st-src-item">
              ${emb ? `<button class="btn btn-xs" onclick="matsPlayVideo(${m.id}, ${v.id})" title="تشغيل داخل النافذة">▶ تشغيل</button>` : `<a class="btn btn-xs" href="${esc(v.url)}" target="_blank" rel="noopener">فتح الرابط</a>`}
              <span class="st-text">${esc(v.title || ('فيديو ' + (i + 1)))}${v.kind === 'playlist' ? ' <span class="count">(قائمة)</span>' : ''}</span>
              <button class="icon-btn danger" onclick="matsDeleteVideo(${m.id}, ${v.id})" title="حذف">✕</button>
            </div>`;
          }).join('') || '<p class="count">لا فيديوهات بعد</p>'}
        </div>
        <div class="st-add" style="margin-top:6px">
          <input class="input input-sm" id="mat-vid-${m.id}" dir="ltr" placeholder="رابط يوتيوب (يمكن إضافة عدة روابط)" onkeydown="if(event.key==='Enter'){event.preventDefault();matsAddVideo(${m.id})}">
          <button class="btn btn-xs" onclick="matsAddVideo(${m.id})">+</button>
        </div>
      </div>
    </div>`).join('');
  box.innerHTML = h;
}

async function matsAddMaterial() {
  const inp = $('#mat-new-title');
  const title = (inp?.value || '').trim();
  if (!title) return showToast('اكتب اسم المادة', 'bad');
  const duration = Math.max(0, parseInt($('#mat-new-duration')?.value) || 0);
  const video_url = ($('#mat-new-video')?.value || '').trim();
  const file = $('#mat-new-file-data')?.value || '';
  const file_name = ($('#mat-new-file-name')?.value || '').trim();
  try {
    await apiSend('POST', '/api/study_materials', { project_id: _matsProjectId, title, type: 'subject', duration_minutes: duration, video_url, file, file_name });
    play('success');
    await renderMaterialsBody();
  } catch (e) { showToast('تعذر الحفظ', 'bad'); }
}

/* تشغيل فيديو مادة داخل نافذة المواد + زر ملء الشاشة */
async function matsPlayVideo(mid, vid, directUrl) {
  const box = $('#mat-player-' + mid);
  if (!box) return;
  let v = null;
  let src = null;
  if (directUrl) {
    src = ytEmbedSrc(directUrl);
  } else if (vid) {
    const rows = (await apiFetch('/api/material_videos?material_id=' + mid)) || [];
    v = rows.find((x) => x.id === vid);
    if (v) src = ytEmbedSrc(v.url, v.kind);
  }
  play('click');
  if (src) {
    box.innerHTML = `<div class="st-video" id="mat-fs-${mid}"><iframe src="${esc(src)}" title="YouTube" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen playsinline></iframe></div>
      <div style="margin:6px 0 10px;text-align:end"><button class="btn btn-xs btn-ghost" onclick="fsToggle('mat-fs-${mid}')">⛶ ملء الشاشة</button></div>`;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else if (v && v.url) {
    window.open(v.url, '_blank');
  }
}

async function matsDeleteMaterial(mid) {
  if (!confirm('حذف هذه المادة وكل مهامها وفيديوهاتها؟')) return;
  try {
    await apiSend('DELETE', '/api/study_materials/' + mid);
    play('tick');
    await renderMaterialsBody();
  } catch (e) { showToast('تعذر الحذف', 'bad'); }
}

async function matsEditMaterial(mid) {
  const mats = (await apiFetch('/api/study_materials')) || [];
  const m = mats.find((x) => String(x.id) === String(mid));
  if (!m) return;
  openModal('✎ تعديل المادة', `
    <div class="field"><label>اسم المادة</label><input class="input" id="med-title" value="${esc(m.title)}"></div>
    <div class="field-row">
      <div class="field" style="flex:0 0 150px"><label>المدة (دقائق)</label><input class="input" id="med-duration" type="number" min="1" value="${m.duration_minutes || ''}"></div>
    </div>
    <div class="field"><label>رابط فيديو يوتيوب</label><input class="input" id="med-video" dir="ltr" value="${esc(m.video_url || '')}" placeholder="https://youtube.com/..."></div>
    <div class="field"><label>ملف مرفق</label>
      <div class="field-row" style="align-items:center;gap:10px">
        <input type="file" id="med-file-input" style="display:none" onchange="handleProjectFile(this,'med-file-name','med-file-data')">
        <input type="hidden" id="med-file-data" value="${esc(m.file || '')}">
        <button class="btn btn-xs" onclick="$('#med-file-input').click()">📂 اختيار ملف</button>
        <input class="input" id="med-file-name" readonly value="${esc(m.file_name || '')}" placeholder="لم يُختر ملف" style="flex:1">
      </div>
      ${m.file ? '<span class="count">✓ ملف مرفق حاليًا</span>' : ''}
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="saveMatsEdit(${mid})">حفظ</button>
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>`);
}

async function saveMatsEdit(mid) {
  const title = ($('#med-title')?.value || '').trim();
  if (!title) return showToast('اكتب اسم المادة', 'bad');
  const duration = Math.max(0, parseInt($('#med-duration')?.value) || 0);
  const video_url = ($('#med-video')?.value || '').trim();
  const file = $('#med-file-data')?.value || '';
  const file_name = ($('#med-file-name')?.value || '').trim();
  try {
    await apiSend('PUT', '/api/study_materials/' + mid, { title, duration_minutes: duration, video_url, file, file_name });
    play('success');
    closeModal();
    await renderMaterialsBody();
  } catch (e) { showToast('تعذر الحفظ', 'bad'); }
}

async function matsAddTask(mid) {
  const inp = $('#mat-task-' + mid);
  const title = (inp?.value || '').trim();
  if (!title) return;
  try {
    await apiSend('POST', '/api/material_tasks', { material_id: mid, title });
    await renderMaterialsBody();
    setTimeout(() => { const el = $('#mat-task-' + mid); if (el) el.focus(); }, 50);
  } catch (e) { showToast('تعذر الحفظ', 'bad'); }
}

async function matsToggleTask(mid, tid, done) {
  try {
    await apiSend('PUT', '/api/material_tasks/' + tid, { done: done ? 1 : 0 });
    play(done ? 'success' : 'tick');
    await renderMaterialsBody();
  } catch (e) { showToast('تعذر الحفظ', 'bad'); }
}

async function matsDeleteTask(mid, tid) {
  try { await apiSend('DELETE', '/api/material_tasks/' + tid); await renderMaterialsBody(); } catch (e) {}
}

async function matsAddVideo(mid) {
  const inp = $('#mat-vid-' + mid);
  const url = (inp?.value || '').trim();
  if (!url) return;
  try {
    await apiSend('POST', '/api/material_videos', { material_id: mid, url, kind: /list=/.test(url) ? 'playlist' : 'video' });
    play('success');
    await renderMaterialsBody();
    setTimeout(() => { const el = $('#mat-vid-' + mid); if (el) el.focus(); }, 50);
  } catch (e) { showToast('تعذر الحفظ', 'bad'); }
}

async function matsDeleteVideo(mid, vid) {
  try { await apiSend('DELETE', '/api/material_videos/' + vid); await renderMaterialsBody(); } catch (e) {}
}

function renderSessionTasks() {
  const t = state.timer;
  const card = $('#st-card');
  if (!card) return;
  const liveFrame = $('#st-src-player iframe');
  const q = Array.isArray(t.sessionTasks) ? t.sessionTasks : (t.sessionTasks = []);
  const pid = t.project_id;
  const p = pid ? NoorStore.getProjects().find((x) => x.id === pid) : null;
  const ptPending = p ? p.tasks.filter((x) => !x.completed_at) : [];
  const ptDone = p ? p.tasks.filter((x) => x.completed_at).length : 0;
  const total = q.length + ptPending.length;
  const done = q.filter((x) => x.done).length + ptDone;
  $('#st-count').textContent = total ? `أنجزت ${done} من ${total}` : 'أضف مهام هذه الجلسة';
  const rows = [];
  if (ptPending.length) {
    rows.push(`<div class="st-sec">أهداف «${esc(p.name)}»</div>`);
    ptPending.forEach((x, i) => rows.push(`
      <div class="st-row st-proj">
        <span class="st-num">${i + 1}</span>
        <span class="st-text">${esc(x.title)}</span>
        <button class="task-check" onclick="toggleSessionProjectTask(${x.id})" title="إنجاز هذه المهمة">✓</button>
      </div>`));
  }
  const activeTask = ptPending[0];
  if (p && activeTask && activeTask.sources && activeTask.sources.length) {
    const playerHTML = liveFrame
      ? '' /* يُعاد إرفاق الفيديو الحي بعد إعادة الرسم حتى لا يتوقف التشغيل */
      : (state.timer.srcVideoId ? ytThumbHTML(state.timer.srcVideoId, state.timer.srcVideoStart || 0) : '');
    rows.push(`<div class="st-src"><div class="st-sec">مصادر «${esc(activeTask.title)}» — اضغط ▶ للتشغيل</div><div class="st-src-list">${
      activeTask.sources.map((s) => {
        if (s.type === 'video') {
          return `<div class="st-src-item"><button class="btn btn-xs" onclick="playTaskSource('${jsEsc(s.url)}')">▶ تشغيل</button> <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || 'فيديو')}</a></div>`;
        }
        return `<div class="st-src-item">📚 ${esc(s.title || 'كتاب')}${s.url ? ` — <a href="${esc(s.url)}" target="_blank" rel="noopener">فتح</a>` : ''}</div>`;
      }).join('')
    }</div><div id="st-src-player">${playerHTML}</div></div>`);
  }
  /* شاشة مزدوجة لمشاريع المكتبة: كتاب المشروع أو كورسه يُفتح بجانب المؤقت */
  else if (p && (p.video_url || (p.video_urls && p.video_urls.length) || p.file || p.link)) {
    const isVidP = p.type === 'فيديو' || p.type === 'كورس';
    const allVids = (p.video_urls && p.video_urls.length) ? p.video_urls : (p.video_url ? [p.video_url] : []);
    const srcUrl = assetUrl((isVidP ? (allVids[0] || p.file || p.link) : (p.file || p.link || allVids[0] || '')) || '');
    const vidId = ytVideoId(srcUrl);
    const playerHTML2 = liveFrame ? '' : (vidId ? ytThumbHTML(vidId, 0) : '');
    const label = p.file && !isVidP ? '📖 كتاب «' + esc(p.name) + '» — اقرأ بجانب المؤقت' : '▶️ «' + esc(p.name) + '» — شاهده بجانب المؤقت';
    const extraVids = allVids.filter((v) => v !== srcUrl);
    rows.push(`<div class="st-src"><div class="st-sec">${label}</div>
      <div class="st-src-item"><button class="btn btn-xs" onclick="playTaskSource('${jsEsc(srcUrl)}')">${p.file && !isVidP ? '📖 افتح للقراءة' : '▶ تشغيل'}</button> ${esc(p.file_name || p.name)}</div>
      ${extraVids.map((v) => {
        return `<div class="st-src-item"><button class="btn btn-xs" onclick="playTaskSource('${jsEsc(v)}')">▶ تشغيل</button> <span class="count">${esc(v)}</span></div>`;
      }).join('')}
      <div id="st-src-player">${playerHTML2}</div></div>`);
  }
  if (q.length) {
    if (ptPending.length) rows.push(`<div class="st-sec">مهام سريعة</div>`);
    q.forEach((x) => rows.push(`
      <div class="st-row ${x.done ? 'st-done' : ''}">
        <button class="task-check" onclick="toggleSessionTask(${x.id})" title="${x.done ? 'تراجع' : 'إنجاز'}">${x.done ? '✓' : ''}</button>
        <span class="st-text">${esc(x.text)}</span>
        <button class="icon-btn danger st-del" onclick="removeSessionTask(${x.id})" title="حذف">✕</button>
      </div>`));
  }
  if (!rows.length) rows.push('<div class="empty-box"><strong>لا مهام بعد</strong><p>اكتب مهمة لهذه الجلسة بالأسفل — مثل «دراسة الصفحة 1».</p></div>');
  $('#st-body').innerHTML = `
    <div class="st-list">${rows.join('')}</div>
    <div class="st-add">
      <input class="input" id="st-input" placeholder="${p ? 'اكتب مهمة لهذه الجلسة…' : 'اكتب مهمة للتركيز عليها…'}" onkeydown="if(event.key==='Enter')addSessionTask()" autocomplete="off">
      <button class="btn btn-xs" onclick="addSessionTask()">+ أضف</button>
      ${q.some((x) => x.done) ? '<button class="btn btn-xs btn-ghost" onclick="clearSessionTasks()">مسح المكتمل</button>' : ''}
    </div>`;
  if (liveFrame) {
    const box = $('#st-src-player');
    if (box && !box.querySelector('iframe')) box.insertBefore(liveFrame, box.firstChild);
  }
}

const SESSION_TASKS_KEY = 'noor_session_tasks_v1';

function loadSessionTasks() {
  try {
    const raw = localStorage.getItem(SESSION_TASKS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr)
      ? arr.filter((x) => x && typeof x.text === 'string').map((x) => ({ id: Number(x.id) || Date.now(), text: String(x.text), done: !!x.done }))
      : [];
  } catch (e) { return []; }
}

function saveSessionTasks() {
  try { localStorage.setItem(SESSION_TASKS_KEY, JSON.stringify(state.timer.sessionTasks)); }
  catch (e) { /* التخزين معطّل */ }
}

function addSessionTask() {
  const inp = $('#st-input');
  const text = inp ? inp.value.trim() : '';
  if (!text) return;
  state.timer.sessionTasks.push({ id: _nid(), text, done: false });
  saveSessionTasks();
  play('success');
  renderSessionTasks();
}

function toggleSessionTask(id) {
  const x = state.timer.sessionTasks.find((v) => v.id === id);
  if (x) {
    x.done = !x.done;
    play(x.done ? 'success' : 'tick');
    saveSessionTasks();
    renderSessionTasks();
  }
}

function removeSessionTask(id) {
  state.timer.sessionTasks = state.timer.sessionTasks.filter((v) => v.id !== id);
  saveSessionTasks();
  play('tick');
  renderSessionTasks();
}

function clearSessionTasks() {
  state.timer.sessionTasks = state.timer.sessionTasks.filter((v) => !v.done);
  saveSessionTasks();
  renderSessionTasks();
}

/* استخراج معرّف فيديو يوتيوب من أي رابط شائع:
   youtu.be، watch?v=، embed/، shorts/، live/، v/، youtube-nocookie — مع تجاهل حالة الأحرف. */
function ytVideoId(url) {
  const u = String(url || '');
  const m = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/|v\/))([A-Za-z0-9_-]{11})/i.exec(u);
  const id = m ? m[1] : null;
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}
/* وقت البدء من رابط يوتيوب: t= أو start= (بالثواني أو صيغة 1m30s) */
function ytVideoStart(url) {
  const u = String(url || '');
  const mm = /[?&]t=(\d+)m(\d+)s?/i.exec(u);
  if (mm) return parseInt(mm[1], 10) * 60 + (parseInt(mm[2], 10) || 0);
  const m = /[?&](?:t|start)=(\d+)/i.exec(u);
  return m ? Math.max(0, parseInt(m[1], 10) || 0) : 0;
}
/* صورة مصغّرة قابلة للنقر قبل التشغيل */
function ytThumbHTML(id, start, boxSel) {
  const s = start && start > 0 ? start : 0;
  const sel = boxSel ? ", '" + boxSel + "'" : '';
  return `<div class="st-video st-video-thumb" onclick="embedVideo('${id}', ${s}${sel})" title="اضغط للتشغيل"><img class="st-thumb-img" src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy" onerror="this.style.display='none'"><span class="st-video-play">▶</span></div>`;
}
function jsEsc(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
function embedVideo(id, start, boxSel) {
  id = ytVideoId('https://youtu.be/' + String(id)) || id;
  state.timer.srcVideoId = id;
  state.timer.srcVideoStart = (start && start > 0) ? start : 0;
  const box = $(boxSel || '#st-src-player');
  if (!box) return;
  box.innerHTML = '<div class="st-video"><iframe data-vid="' + id + '" src="https://www.youtube.com/embed/' + id + '?rel=0&autoplay=1' + (state.timer.srcVideoStart ? '&start=' + state.timer.srcVideoStart : '') + '" title="YouTube" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen playsinline></iframe></div>';
}
function playTaskSource(url) {
  var box = $('#st-src-player');
  if (!box) return;
  var id = ytVideoId(url);
  if (id) {
    var start = ytVideoStart(url);
    state.timer.srcVideoId = id;
    state.timer.srcVideoStart = start;
    box.innerHTML = ytThumbHTML(id, start);
  } else if (url) {
    /* الشاشة المزدوجة: الكتب PDF والروابط القابلة للتضمين تُعرض داخل المؤقت */
    state.timer.srcVideoId = null;
    box.innerHTML = '<iframe class="st-pdf-frame" src="' + esc(url) + '" title="مصدر المهمة"></iframe>'
      + '<a class="count" style="display:inline-block;margin-top:4px" href="' + esc(url) + '" target="_blank" rel="noopener">فتح خارجيًا ↗</a>';
  }
}

function toggleSessionProjectTask(ptid) {
  try {
    const pt = NoorStore.toggleProjectTask(ptid);
    play(pt.completed_at ? 'success' : 'tick');
    renderSessionTasks();
  } catch (err) { showToast(err.message, 'bad'); }
}

async function setMode(m) {
  const t = state.timer;
  /* الانتقال بين الأوضاع حر دائمًا: يوقف الجاري ويسجّل ما مضى منه تلقائيًا */
  stopAlarmRing();
  if (t.running || t.alarmArmed) { try { await finishTimer(true); } catch (e) { console.error('finishTimer:', e); } }
  t.mode = m === 'focus' ? 'countdown' : m;
  t.running = false;
  t.alarmArmed = false;
  clearInterval(t.iv);
  if (t.mode === 'pomodoro' || t.mode === 'countdown') {
    const v = Math.max(1, parseInt($('#focus-min')?.value) || t.focusMin || 25);
    t.total = t.left = v * 60;
  } else if (t.mode === 'short_break' || t.mode === 'long_break') {
    t.total = t.left = modeMin(t.mode) * 60;
  } else {
    t.total = t.left = 0;
  }
  saveTimerMode();
  renderTimer();
}

function toggleTimer() {
  const t = state.timer;
  if (t.ringing) return stopAlarmRing();
  if (t.running) {
    t.left = Math.max(0, Math.round((t.endAt - Date.now()) / 1000));
    t.running = false;
    clearInterval(t.iv);
    $('#btn-start').textContent = 'متابعة';
    return;
  }
  if (t.mode === 'countdown' || t.mode === 'pomodoro') {
    const v = Math.max(1, parseInt($('#focus-min')?.value) || t.focusMin || 25);
    t.focusMin = v;
    /* متابعة بعد إيقاف مؤقت: لا نعيد ضبط المدة — نحترم الوقت المتبقي المحفوظ */
    if (t.total <= 0 || t.left <= 0) t.total = t.left = v * 60;
  }
  if (t.mode === 'alarm') {
    const v = ($('#alarm-time')?.value || '').trim();
    if (!v) return showToast('اختر وقت المنبه أولًا', 'bad');
    t.alarmHHMM = v;
    t.alarmTarget = alarmTargetFromDate(v).getTime();
    t.left = Math.max(1, Math.round((t.alarmTarget - Date.now()) / 1000));
    t.total = t.left;
    t.alarmArmed = true;
    play('tick');
    showToast(`سُلّح المنبه عند ${v}`);
    startRun();
    renderTimer();
    return;
  }
  startRun();
}

function startRun() {
  const t = state.timer;
  if (t.left <= 0) { if (t.total <= 0) t.total = defaultTotal(); t.left = t.total; }
  t.endAt = Date.now() + t.left * 1000;
  t.running = true;
  t.iv = setInterval(tick, 250);
  $('#btn-start').textContent = 'إيقاف مؤقت';
}

function tick() {
  const t = state.timer;
  let left;
  if (t.mode === 'alarm' && t.alarmArmed && t.alarmTarget) {
    left = Math.max(0, Math.round((t.alarmTarget - Date.now()) / 1000));
  } else {
    left = Math.max(0, Math.round((t.endAt - Date.now()) / 1000));
  }
  t.left = left;
  const disp = $('#timer-display');
  if (disp) disp.textContent = timerDisplayText();
  updateTimerRing();
  if (left <= 0) {
    t.running = false;
    clearInterval(t.iv);
    if (t.mode === 'alarm' && t.alarmArmed) {
      t.alarmArmed = false;
      startRing();
      notifyAlarm();
      if (state.page === 'timer') renderTimer().catch(function () {});
    } else {
      completeTimer();
    }
  }
}

async function logSession(mode, minutes) {
  const sel = $('#timer-project')?.value;
  let project_id = null;
  if (sel && !String(sel).startsWith('api:')) {
    project_id = Number(sel);
  } else {
    project_id = state.timer.project_id || null;
  }
  if (project_id && !NoorStore.getProjects().some((p) => p.id === project_id)) project_id = null;
  NoorStore.addSession({ mode, minutes, project_id, date: todayISO() });
}

async function completeTimer() {
  const t = state.timer;
  const minutes = Math.max(1, Math.round(t.total / 60));
  try {
    if (t.mode === 'pomodoro' || t.mode === 'countdown') {
      await logSession(t.mode, minutes);
      if (t.mode === 'pomodoro') {
        t.cyclesDone++;
        /* دورة بومودورو تلقائية: كل N جلسات (مُخصّص) استراحة طويلة، وإلا قصيرة — وتبدأ وحدها */
        const cyc = Math.max(1, parseInt(NoorStore.getSettings().cycles_per_long) || 4);
        const nm = (t.cyclesDone % cyc === 0) ? 'long_break' : 'short_break';
        play('success');
        showToast(`جلسة ${minutes} دقيقة مكتملة (${t.cyclesDone}) — ${nm === 'long_break' ? 'استراحة طويلة' : 'استراحة قصيرة'} بدأت تلقائيًا`);
        t.mode = nm;
        t.total = t.left = modeMin(nm) * 60;
        startRun();
        if (state.page === 'timer') renderTimer().catch(function () {});
        return;
      }
      play('success');
      showToast(`انتهى العد التنازلي (${minutes} د) وسُجّل`);
      t.total = t.left = Math.max(1, t.focusMin || 25) * 60;
    } else if (t.mode === 'short_break' || t.mode === 'long_break') {
      play('success');
      showToast('انتهت الاستراحة — بومودورو جديد بدأ تلقائيًا');
      t.mode = 'pomodoro';
      t.total = t.left = Math.max(1, t.focusMin || 25) * 60;
      startRun();
      if (state.page === 'timer') renderTimer().catch(function () {});
      return;
    } else {
      showToast('انتهى الوقت');
    }
    t.running = false;
    if (state.page === 'timer') renderTimer().catch(function () {});
  } catch (err) { showToast(err.message, 'bad'); }
}

async function finishTimer(manual) {
  const t = state.timer;
  if (t.running) {
    t.left = Math.max(0, Math.round((t.endAt - Date.now()) / 1000));
    t.running = false;
    clearInterval(t.iv);
  }
  if (t.mode === 'alarm') { t.alarmArmed = false; stopAlarmRing(); resetTimer(); renderTimer(); return; }
  const elapsedMin = Math.round((t.total - t.left) / 60);
  const isWork = t.mode === 'pomodoro' || t.mode === 'countdown';
  if (manual) {
    if (isWork && elapsedMin >= 1) {
      try {
        await logSession(t.mode, elapsedMin);
        showToast(`سُجلت ${elapsedMin} دقيقة`);
        if (t.mode === 'pomodoro') t.cyclesDone++;
      } catch (err) { showToast(err.message, 'bad'); }
    } else if (isWork) {
      showToast('لم يمضِ وقت كافٍ للتسجيل', 'bad');
    }
  }
  resetTimer();
  renderTimer();
}

function resetTimer() {
  const t = state.timer;
  stopAlarmRing();
  t.running = false;
  t.alarmArmed = false;
  clearInterval(t.iv);
  if (t.mode === 'short_break' || t.mode === 'long_break') t.total = t.left = modeMin(t.mode) * 60;
  else if (t.mode === 'alarm') t.total = t.left = 0;
  else t.total = t.left = Math.max(1, t.focusMin || 25) * 60;
  const disp = $('#timer-display');
  if (disp) disp.textContent = timerDisplayText();
  updateTimerRing();
}

/* حفظ إعدادات المؤقت فورًا عند تغيير الحقول */
function saveTimerFocusMin() {
  const v = parseInt($('#focus-min')?.value) || 25;
  state.timer.focusMin = v;
  try { NoorStore.updateSettings({ pomodoro_min: v }); } catch (e) {}
}
function saveTimerAlarmTime() {
  state.timer.alarmHHMM = ($('#alarm-time')?.value || '').trim();
  try { NoorStore.updateSettings({ timer_alarm_time: state.timer.alarmHHMM }); } catch (e) {}
}
function saveTimerMode() {
  try { NoorStore.updateSettings({ timer_mode: state.timer.mode, timer_focus_min: state.timer.focusMin }); } catch (e) {}
}
/* تخطّي الاستراحة الحالية والعودة فورًا إلى جلسة بومودورو جاهزة (دون تسجيل الاستراحة) */
function skipBreak() {
  const t = state.timer;
  if (t.mode !== 'short_break' && t.mode !== 'long_break') return;
  t.mode = 'pomodoro';
  t.running = false;
  clearInterval(t.iv);
  t.total = t.left = Math.max(1, t.focusMin || 25) * 60;
  renderTimer();
}

/* ===== أدوات الأوضاع ===== */
function defaultTotal() {
  const t = state.timer;
  if (t.mode === 'short_break' || t.mode === 'long_break') return modeMin(t.mode) * 60;
  return Math.max(1, t.focusMin || 25) * 60;
}

function timerDisplayText() {
  const t = state.timer;
  if (t.ringing) return 'حان الوقت!';
  if (t.mode === 'alarm') {
    if (t.running && t.alarmTarget) return fmt(Math.max(0, Math.round((t.alarmTarget - Date.now()) / 1000)));
    if (t.alarmHHMM) return t.alarmHHMM;
    return '--:--';
  }
  if (t.running) return fmt(Math.max(0, Math.round((t.endAt - Date.now()) / 1000)));
  return fmt(t.left || defaultTotal());
}

function cycleInfoText() {
  const t = state.timer;
  if (t.mode === 'pomodoro') {
    const cn = Math.max(1, parseInt(state.settings.cycles_per_long) || 4);
    const toLong = cn - (t.cyclesDone % cn);
    return (t.cyclesDone > 0 ? `أكملت ${t.cyclesDone} جلسة — ` : '') + `الاستراحة الطويلة بعد ${toLong} جلسات · الاستراحات تبدأ وحدها`;
  }
  if (t.mode === 'countdown') return 'عد تنازلي بسيط بأي مدة تحددها — يُسجَّل تلقائيًا في جلسات اليوم';
  if (t.mode === 'short_break') return 'بعد الاستراحة يبدأ بومودورو جديد تلقائيًا';
  if (t.mode === 'long_break') return 'استراحة طويلة مستحقة — خذ نفسًا عميقًا';
  if (t.mode === 'alarm') return 'منبه لوقت محدد من اليوم — لا يُسجَّل كجلسة تركيز';
  return '';
}

function nextHalfHourStr() {
  const d = new Date();
  d.setSeconds(0, 0);
  if (d.getMinutes() < 30) d.setMinutes(30); else { d.setMinutes(0); d.setHours(d.getHours() + 1); }
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function alarmTargetFromDate(hhmm) {
  const parts = String(hhmm).split(':').map(Number);
  const d = new Date();
  d.setHours(parts[0] || 0, parts[1] || 0, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

function applyCountdownPreset(n) {
  const t = state.timer;
  stopAlarmRing();
  t.focusMin = n;
  const inp = $('#focus-min'); if (inp) inp.value = n;
  if (t.mode !== 'pomodoro' && t.mode !== 'countdown') t.mode = 'countdown';
  t.running = false;
  clearInterval(t.iv);
  t.total = t.left = n * 60;
  play('tick');
  renderTimer();
}

let _ringIv = null;
function startRing() {
  const t = state.timer;
  t.ringing = true;
  play('alert');
  clearInterval(_ringIv);
  _ringIv = setInterval(function () { play('alert'); }, 2000);
}
function stopAlarmRing() {
  const t = state.timer;
  if (!t.ringing && !_ringIv) return;
  t.ringing = false;
  clearInterval(_ringIv);
  _ringIv = null;
}
function notifyAlarm() {
  showToast('حان وقت المنبه!', 'good');
  try {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') new Notification('نُور — المنبه', { body: 'حان الوقت المحدد' });
      else if (Notification.permission === 'default') Notification.requestPermission();
    }
  } catch (e) {}
}

/* ===== الإحصائيات ===== */
async function renderStats() {
  const st = NoorStore.stats();
  state.stats = st;
  if (state.yearSel == null) state.yearSel = NoorStore.yearIndex(NoorStore.todayStr());
  const ys = NoorStore.yearStats(state.yearSel);
  const projects = NoorStore.getProjects();
  const colorOf = (pid) => { const p = projects.find((x) => x.id === pid); return p && p.color ? p.color : NOOR_ACCENT; };
  const habits = NoorStore.getSimpleHabits();
  const today = NoorStore.todayStr();
  const RING_C = (2 * Math.PI * 42).toFixed(1);
  const ringOffset = (RING_C * (1 - Math.min(100, ys.pct) / 100)).toFixed(1);

  /* === الشريط العلوي: إحصائيات سريعة مدمجة أفقياً === */
  const kpiStrip = `
    <div class="dash-kpis">
      <div class="dash-kpi">
        <span class="dk-num">${st.pct}%</span><span class="dk-label">إنجاز الأسبوع</span>
        <div class="dk-bar"><div class="dk-fill" style="width:${Math.min(100,st.pct)}%"></div></div>
      </div>
      <div class="dash-kpi">
        <span class="dk-num">${st.tasks_done}<small>/${st.tasks_total}</small></span><span class="dk-label">مهام المنجزة</span>
        <div class="dk-bar"><div class="dk-fill" style="width:${st.tasks_pct}%"></div></div>
      </div>
      <div class="dash-kpi">
        <span class="dk-num">${(st.focus_min/60).toFixed(1)}<small>س</small></span><span class="dk-label">تركيز هذا الأسبوع</span>
        <div class="dk-bar"><div class="dk-fill" style="width:${Math.min(100,st.pct)}%"></div></div>
      </div>
      <div class="dash-kpi">
        <span class="dk-num">${st.avg_focus_min}<small>د</small></span><span class="dk-label">متوسط يومي</span>
        <div class="dk-bar"><div class="dk-fill" style="width:${Math.min(100,st.daily_target_min?Math.round(st.avg_focus_min/st.daily_target_min*100):0)}%"></div></div>
      </div>
    </div>`;

  /* === الشبكة الشهرية: عادات × أيام (خانات مربعية) === */
  const habitRows = habits.slice(0, 15);
  const daysInMonth = new Date(NoorStore.yearIndex(today), NoorStore.monthIndex ? NoorStore.monthIndex(today) + 1 : (new Date().getMonth()+1), 0).getDate();
  const curMonth = today.substring(0, 7);
  let monthGrid = '';
  if (habitRows.length) {
    /* رؤوس الأيام */
    let dayHeaders = '';
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = curMonth + '-' + String(d).padStart(2, '0');
      const dow = new Date(ds).getDay();
      const isWeekend = dow === 5 || dow === 6;
      dayHeaders += `<div class="mg-h ${isWeekend?'wk':''}">${d}</div>`;
    }
    /* صفوف العادات */
    const habitRowsHTML = habitRows.map((h) => {
      let cells = '';
      let done = 0, total = 0;
      const allowed = [];
      try { allowed.push(...JSON.parse(h.allowed_days || '[]')); } catch(e){}
      const dayKeys = ['sun','mon','tue','wed','thu','fri','sat'];
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = curMonth + '-' + String(d).padStart(2, '0');
        const dow = dayKeys[new Date(ds).getDay()];
        const isFuture = ds > today;
        if (allowed.length && allowed.indexOf(dow) < 0) {
          cells += '<div class="mg-c na"></div>';
        } else if (isFuture) {
          cells += '<div class="mg-c fu"></div>';
        } else {
          total++;
          const doneFlag = NoorStore.isSimpleHabitDone(h.id, ds);
          if (doneFlag) done++;
          cells += `<div class="mg-c ${doneFlag?'dn':'nd'}" onclick="toggleSimpleHabitDone(${h.id},'${ds}',${!doneFlag});renderStats()" title="${esc(h.title)} — ${ds}"></div>`;

        }
      }
      const pct = total ? Math.round(done/total*100) : 0;
      return `<div class="mg-row"><div class="mg-name" title="${esc(h.title)}">${esc(h.title)}</div><div class="mg-cells">${cells}</div><div class="mg-pct">${pct}%</div><div class="mg-done">${done}/${total}</div></div>`;
    }).join('');
    monthGrid = `
    <div class="card dash-card full">
      <div class="dash-card-head"><h3>🗓 الشبكة الشهرية — العادات والأداء اليومي</h3><span class="count">${habitRows.length} عادة · ${daysInMonth} يوم</span></div>
      <div class="dash-card-body">
        <div class="mg-wrap">
          <div class="mg-header"><div class="mg-name">العادة</div><div class="mg-cells">${dayHeaders}</div><div class="mg-pct">%</div><div class="mg-done">✓</div></div>
          ${habitRowsHTML}
        </div>
      </div>
    </div>`;
  }

  /* === رسم بياني شريطي: أداء الأسبوع (ساعات التركيز) === */
  const weeklyBars = st.days.map((d) => {
    const h = Math.min(100, d.pct);
    const cls = d.ok === true ? 'ok' : (d.ok === false ? 'bad' : 'mid');
    return `<div class="wb-col"><div class="wb-track"><div class="wb-fill ${cls}" style="height:${h}%"></div></div><div class="wb-day">${d.label}</div><div class="wb-val">${d.focus_min}د</div></div>`;
  }).join('');

  /* === الإحصاءات الشاملة مع الرسم الدائري === */
  const totalGoal = (st.daily_target_min || 180) * 7;
  const totalActual = st.focus_min;
  const totalLeft = Math.max(0, totalGoal - totalActual);
  const overallPct = totalGoal > 0 ? Math.min(100, Math.round(totalActual / totalGoal * 100)) : 0;

  /* === أفضل العادات + أفضل المشاريع === */
  const topHabits = habits.slice(0, 10).map((h, i) => {
    let done = 0, total = 0;
    const allowed = [];
    try { allowed.push(...JSON.parse(h.allowed_days || '[]')); } catch(e){}
    const dayKeys = ['sun','mon','tue','wed','thu','fri','sat'];
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = curMonth + '-' + String(d).padStart(2, '0');
      const dow = dayKeys[new Date(ds).getDay()];
      if (ds > today) continue;
      if (allowed.length && allowed.indexOf(dow) < 0) continue;
      total++;
      if (NoorStore.isSimpleHabitDone(h.id, ds)) done++;
    }
    const pct = total ? Math.round(done/total*100) : 0;
    return `<div class="th-row"><span class="th-rank">${i+1}</span><span class="th-name">${esc(h.title)}</span><div class="th-bar"><div class="th-fill" style="width:${pct}%"></div></div><span class="th-pct">${pct}%</span></div>`;
  }).join('');

  /* === جدول التحليل: أهداف × أداء === */
  const analysisGoals = ys.goals.length ? ys.goals.map((g) => {
    return `<tr><td><span class="goal-ic small" style="background:${esc(g.color)||NOOR_ACCENT}">${esc(g.icon||'◎')}</span> ${esc(g.title)}</td><td>${g.expected}</td><td>${g.done}</td><td>${Math.max(0,g.expected-g.done)}</td><td><div class="at-bar"><div class="at-fill" style="width:${g.pct}%;background:${esc(g.color)||NOOR_ACCENT}"></div></div></td><td>${g.pct}%</td></tr>`;
  }).join('') : '<tr><td colspan="6" class="muted">لا أهداف بعد</td></tr>';

  /* === عرض المكافأة أو الجملة التشجيعية === */
  const rewardOrSentence = st.reward.achieved
    ? `<div class="dash-reward">🎁 حان وقت المكافأة! — ${esc((st.desires.find((x)=>x.achieved)||{}).text || 'تجاوزت العتبة')}</div>`
    : `<div class="dash-sentence">${esc(st.sentence)}</div>`;

  $('#content').innerHTML = `
    <div class="page-head">
      <div>
        <h2 class="page-title">الإحصائيات</h2>
        <p class="page-sub">أسبوعك يبدأ ${fmtDateAr(st.week_start)} — ${st.focus_min} دقيقة تركيز — ${st.elapsed_days} من 7 أيام</p>
      </div>
      <div class="page-actions">
        ${yearSelect('stats-year', state.yearSel, 'goStatsYear(this.value)')}
      </div>
    </div>

    ${rewardOrSentence}
    ${kpiStrip}

    <div class="dash">
      ${monthGrid}

      <div class="dash-row-2">
        <div class="card dash-card">
          <div class="dash-card-head"><h3>📊 الأداء اليومي</h3></div>
          <div class="dash-card-body"><div class="wb-wrap">${weeklyBars}</div></div>
        </div>
        <div class="card dash-card">
          <div class="dash-card-head"><h3>🎯 الإحصاءات الشاملة</h3></div>
          <div class="dash-card-body">
            <div class="dash-overview">
              <div class="dash-ring-wrap">
                <svg class="ring" viewBox="0 0 96 96" width="96" height="96"><circle cx="48" cy="48" r="42"></circle><circle class="fg" cx="48" cy="48" r="42" style="stroke-dasharray:${RING_C};stroke-dashoffset:${ringOffset}"></circle></svg>
                <div class="ring-label">${ys.pct}%</div>
              </div>
              <div class="dash-ov-stats">
                <div class="dov-row"><span class="dov-label">الهدف</span><span class="dov-val">${totalGoal}</span></div>
                <div class="dov-row"><span class="dov-label">المنجز</span><span class="dov-val">${totalActual}</span></div>
                <div class="dov-row"><span class="dov-label">المتبقي</span><span class="dov-val">${totalLeft}</span></div>
                <div class="dov-row"><span class="dov-label">الأسبوع</span><span class="dov-val">${st.pct}%</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="dash-row-2">
        <div class="card dash-card">
          <div class="dash-card-head"><h3>🏆 أفضل العادات</h3><span class="count">${habits.length} عادة</span></div>
          <div class="dash-card-body">${topHabits || '<div class="empty-box">لا عادات بعد</div>'}</div>
        </div>
        <div class="card dash-card">
          <div class="dash-card-head"><h3>📋 جدول التحليل — الأهداف والأداء</h3></div>
          <div class="dash-card-body">
            <table class="dash-table">
              <thead><tr><th>الهدف</th><th>Goal</th><th>Actual</th><th>Left</th><th>Progress</th><th>%</th></tr></thead>
              <tbody>${analysisGoals}</tbody>
            </table>
          </div>
        </div>
      </div>

      ${desiresStrip(st)}

      <div class="dash-row-2">
        <div class="card dash-card">
          <div class="dash-card-head"><h3>📊 توزيع العمل العميق</h3><span class="count">${st.deep.total_min} دقيقة على ${st.deep.byProject.length} مسارات</span></div>
          <div class="dash-card-body">${st.deep.byProject.length ? st.deep.byProject.map((p) => `<div class="proj-bar-row"><span class="proj-name">${esc(p.name)}</span><div class="bar-track"><div class="bar-fill" style="width:${p.pct}%;background:${esc(colorOf(p.project_id))}"></div></div><span class="proj-pct">${p.minutes} د · ${p.pct}%</span></div>`).join('') : '<div class="empty-box"><strong>لا جلسات مسجلة</strong></div>'}</div>
        </div>
        <div class="card dash-card">
          <div class="dash-card-head"><h3>🎯 المنظور السنوي — السنة ${ys.year}</h3></div>
          <div class="dash-card-body">${ys.goals.length ? ys.goals.map((g) => `<div class="an-row"><span class="goal-ic small" style="background:${esc(g.color)||NOOR_ACCENT}">${esc(g.icon||'◎')}</span><span class="an-label">${esc(g.title)}</span><span class="an-bar"><span class="an-fill" style="width:${g.pct}%;background:${esc(g.color)||NOOR_ACCENT}"></span></span><span class="an-val">${g.done}/${g.expected} · ${g.pct}%</span></div>`).join('') : '<div class="empty-box">لا أهداف</div>'}</div>
        </div>
      </div>
    </div>`;
}

async function goStatsYear(v) {
  state.yearSel = Number(v);
  await renderStats();
}

function yearSelect(id, value, onchange) {
  const maxY = Math.max(6, NoorStore.yearIndex(NoorStore.todayStr()) + 2);
  return `<select class="input input-auto" id="${id}" onchange="${onchange}">
    ${Array.from({ length: maxY }, (_, i) => i + 1).map((y) => `<option value="${y}" ${y === value ? 'selected' : ''}>السنة ${y}</option>`).join('')}
  </select>`;
}

function weekGrid(st) {
  return `
    <div class="week-grid">
      ${st.days.map((d) => {
        const future = d.date > st.date;
        const cls = [
          d.isToday ? 'is-today' : '',
          d.ok === false ? 'bad' : (d.ok === true ? 'good' : 'neutral'),
          future ? 'is-future' : ''
        ].filter(Boolean).join(' ');
        const flag = d.isToday ? 'اليوم' : (future ? '—' : (d.ok === false ? '✗' : (d.ok === true ? '✓' : '·')));
        const filled = future ? 0 : Math.min(100, d.pct);
        return `
        <div class="day-cell ${cls}">
          <div class="day-flag">${flag}</div>
          <div class="day-name">${d.label}</div>
          <div class="day-min">${future ? '—' : `${d.focus_min} د`}</div>
          <div class="day-bar"><i style="width:${filled}%"></i></div>
        </div>`;
      }).join('')}
    </div>
    <p class="count week-note">✓ تجاوز اليوم ${st.daily_threshold}% من الهدف اليومي</p>`;
}

/* شريط الرغبات المختصر: شريط تقدم واحد بدل تكرار الأشرطة لكل رغبة */
/* الجوائز المأخوذة هذا الأسبوع — تُصفَّر تلقائيًا مع بداية أسبوع جديد.
   بداية الأسبوع تُشتق محليًا (اثنين) ولا نعتمد على حمولة إحصائيات قد تغيب */
function rewardClaimsKey() {
  const t = todayISO();
  const d = new Date(t + 'T00:00:00Z');
  const off = (d.getUTCDay() + 6) % 7; /* الاثنين = 0 */
  const ws = new Date(d.getTime() - off * 86400000).toISOString().slice(0, 10);
  return 'noor_reward_claims_' + ws;
}
function claimedDesireIds() {
  try { return JSON.parse(localStorage.getItem(rewardClaimsKey()) || '[]'); } catch (e) { return []; }
}
async function claimReward(id) {
  const st = state.stats;
  const d = st.desires.find((x) => x.id === id);
  if (!d) return;
  if (!rewardsUnlockedToday()) return showToast('🌴 الجوائز تُفتح في يوم العطلة فقط — واصل العطاء حتى عطلتك!', 'bad');
  if (st.tasks_pct < Number(d.target_pct)) return showToast('لم تبلغ النسبة المطلوبة لهذه الجائزة بعد — واصل العطاء!', 'bad');
  const ids = claimedDesireIds();
  if (ids.includes(id)) return showToast('أخذت هذه الجائزة هذا الأسبوع بالفعل', 'bad');
  ids.push(id);
  try { localStorage.setItem(rewardClaimsKey(), JSON.stringify(ids)); } catch (e) {}
  play('success');
  showToast('🎁 مبروك! استمتع بجائزتك دون تأنيب');
  await renderStats();
}

function desiresStrip(st) {
  const d = st.desires;
  const claimed = claimedDesireIds();
  const unlocked = rewardsUnlockedToday();
  return `
    <div class="card">
      <div class="card-head">
        <h3 class="card-title">رغباتي الكبرى</h3>
        <div class="card-actions">
          <span class="count">إنجاز المهام ${st.tasks_pct}% · ${unlocked ? 'يوم العطلة — يمكنك أخذ كل جائزة بلغت نسبتها 🎁' : 'الجوائز تُفتح في يوم عطلتك القادم'}</span>
          <button class="icon-btn" onclick="openDesireModal()" title="إضافة رغبة">+</button>
        </div>
      </div>
      <div class="card-body card-body-tight">
        <div class="bar-track desire-track"><div class="bar-fill ${st.reward.achieved ? 'green' : ''}" style="width:${Math.min(100, st.tasks_pct)}%"></div><span class="bar-mark" style="inset-inline-start:${Math.min(100, st.reward.threshold)}%"></span></div>
        ${d.length ? d.map((x) => {
          const need = Number(x.target_pct);
          const pctOk = st.tasks_pct >= need;
          const canClaim = pctOk && unlocked;
          const isClaimed = claimed.includes(x.id);
          const lockTitle = !pctOk
            ? `تحتاج ${need}% — أنت عند ${st.tasks_pct}%`
            : `بلغت النسبة — يُفتح الزر في يوم عطلتك`;
          return `
          <div class="desire-line${isClaimed ? ' achieved' : ''}">
            <span class="desire-line-text">${esc(x.text)}</span>
            ${isClaimed ? '<span class="chip chip-ok">🎁 أُخذت هذا الأسبوع</span>'
              : `<button class="btn btn-sm${canClaim ? '' : ' btn-ghost'}" ${canClaim ? `onclick="claimReward(${x.id})" title="استحقاق متحقق"` : `disabled title="${lockTitle}"`}>🎁 أخذ الجائزة (${need}%)</button>`}
            <span class="desire-line-actions">
              <button class="icon-btn" onclick="openDesireModal(${x.id})" title="تعديل">✎</button>
              <button class="icon-btn danger" onclick="archiveDesire(${x.id})" title="أرشفة">✕</button>
            </span>
          </div>`;
        }).join('') : '<p class="count">لا رغبات بعد — حدد رغبة ونسبتها المطلوبة، ويُفعّل زر الجائزة تلقائيًا عند تحقيقها في يوم العطلة.</p>'}
      </div>
    </div>`;
}

function openDesireModal(id) {
  const d = id ? state.stats.desires.find((x) => x.id === id) : null;
  openModal(d ? 'تعديل الرغبة' : 'رغبة كبيرة جديدة', `
    <div class="field"><label>نص الرغبة</label><textarea class="input" id="dr-text" rows="3" placeholder="مثال: أريد أن أشاهد الفيلم الفلاني هذا الأسبوع">${d ? esc(d.text) : ''}</textarea></div>
    <div class="field"><label>نسبة الإنجاز المطلوبة مقابل فعلها (%)</label><input class="input" id="dr-pct" type="number" min="1" max="100" value="${d ? esc(d.target_pct) : 80}"></div>
    <p class="count">القاعدة: اتعب نفسك حتى تتجاوز هذه النسبة، ثم استمتع بالرغبة دون تأنيب.</p>
    <div class="modal-actions">
      <button class="btn" onclick="saveDesire(${d ? d.id : 'null'})">${d ? 'حفظ' : 'إضافة'}</button>
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>`);
}

async function saveDesire(id) {
  const text = $('#dr-text').value.trim();
  if (!text) return showToast('اكتب نص الرغبة', 'bad');
  const target_pct = Math.min(100, Math.max(1, parseInt($('#dr-pct').value) || 80));
  try {
    if (id) NoorStore.updateDesire(id, { text, target_pct });
    else NoorStore.addDesire(text, target_pct);
    closeModal();
    play('success');
    showToast('تم الحفظ');
    await renderStats();
  } catch (err) { showToast(err.message, 'bad'); }
}

async function archiveDesire(id) {
  if (!confirm('أرشفة هذه الرغبة؟')) return;
  try {
    play('tick');
    NoorStore.archiveDesire(id);
    showToast('تمت الأرشفة');
    await renderStats();
  } catch (err) { showToast(err.message, 'bad'); }
}

/* ===== الأرشيف ===== */
async function renderArchive() {
  const isHist = state.archiveMode === 'history';
  $('#content').innerHTML = `
    <div class="page-head">
      <div>
        <h2 class="page-title">الأرشيف</h2>
        <p class="page-sub">${isHist ? 'تاريخك يومًا بيوم — اضغط على أي مربع لعرض كل ما أدخلته في ذلك اليوم' : 'كل ما أنجزته أو أرشفته، لا يُحذف نهائيًا'}</p>
      </div>
    </div>
    <div class="jmodes" style="margin-bottom:14px">
      <button class="jmode${!isHist ? ' on' : ''}" onclick="setArchiveMode('list')">📋 القائمة</button>
      <button class="jmode${isHist ? ' on' : ''}" onclick="setArchiveMode('history')">🗓 التاريخ</button>
    </div>
    ${isHist ? renderArchiveHistory() : renderArchiveList()}`;
  if (isHist) requestAnimationFrame(() => {
    const tc = document.querySelector('.hist-cell.today');
    if (tc) tc.scrollIntoView({ block: 'center', inline: 'center' });
  });
}

function renderArchiveList() {
  const items = NoorStore.getArchive(state.archiveFilter);
  const hasAnyFilter = String(state.archiveFilter.q || '').trim() || state.archiveFilter.type !== 'all' || String(state.archiveFilter.year || '');
  const emptyHTML = hasAnyFilter
    ? '<div class="empty-box"><strong>لا نتائج مطابقة</strong><p>جرّب كلمة بحث أقصر أو أزل الفلاتر.</p><button class="btn btn-ghost" onclick="clearArchiveFilters()">مسح الفلاتر</button></div>'
    : '<div class="empty-box"><strong>الأرشيف فارغ — وهذا جميل</strong><p>كل ما تنجزه أو تؤرشفه لاحقًا يظهر هنا ولا يُحذف نهائيًا. ابدأ يومك من قسم المهام.</p></div>';
  return `
    <div class="archive-filters">
      <input class="input" id="arc-q" placeholder="ابحث..." value="${esc(state.archiveFilter.q)}" oninput="debouncedArchiveSearch()">
      <select class="input" id="arc-type" onchange="setArchiveFilter('type', this.value)">
        <option value="all" ${state.archiveFilter.type === 'all' ? 'selected' : ''}>كل الأنواع</option>
        <option value="مهمة" ${state.archiveFilter.type === 'مهمة' ? 'selected' : ''}>مهام يومية</option>
        <option value="مهمة مشروع" ${state.archiveFilter.type === 'مهمة مشروع' ? 'selected' : ''}>مهام مشاريع</option>
        <option value="عادة" ${state.archiveFilter.type === 'عادة' ? 'selected' : ''}>عادات</option>
        <option value="مشروع" ${state.archiveFilter.type === 'مشروع' ? 'selected' : ''}>مشاريع</option>
        <option value="تدوينة" ${state.archiveFilter.type === 'تدوينة' ? 'selected' : ''}>تدوينات</option>
      </select>
      <select class="input" id="arc-year" onchange="setArchiveFilter('year', this.value)">
        <option value="">كل السنوات</option>
        ${archiveYears().map((y) => `<option value="${y}" ${String(state.archiveFilter.year) === String(y) ? 'selected' : ''}>${y}</option>`).join('')}
      </select>
    </div>
    <div class="archive-list" id="archive-list">
      ${items.length ? items.map(archiveRow).join('') : emptyHTML}
    </div>`;
}

function clearArchiveFilters() {
  state.archiveFilter = { q: '', type: 'all', year: '' };
  renderArchive();
}

function setArchiveMode(m) {
  state.archiveMode = m;
  renderArchive();
}

/* ===== وضع التاريخ: مربع لكل يوم يشبه خريطة جوجل — كل مربع يوم وكل تفاصيله داخله ===== */
function renderArchiveHistory() {
  const years = archiveYears();
  if (state.archiveHistYear == null) state.archiveHistYear = Number(todayISO().slice(0, 4));
  const y = state.archiveHistYear;
  const from = y + '-01-01', to = y + '-12-31';
  const today = todayISO();
  const map = {};
  NoorStore.historyRange(from, to).forEach((d) => { map[d.date] = d; });
  const months = [];
  const startMonth = (y === Number(today.slice(0, 4))) ? Number(today.slice(5, 7)) : 1;
  for (let mi = 0; mi < 12; mi++) {
    const m = ((startMonth - 1 + mi) % 12) + 1;
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const firstWd = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const cells = [];
    for (let i = 0; i < firstWd; i++) cells.push('<div class="card hist-cell empty"></div>');
    for (let d = 1; d <= dim; d++) {
      const ds = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const day = map[ds];
      const total = day ? day.total : 0;
      const future = ds > today;
      const level = total === 0 ? 0 : (total <= 2 ? 1 : (total <= 5 ? 2 : (total <= 10 ? 3 : 4)));
      cells.push(`<div class="card hist-cell${future ? ' future' : ''} l${level}${ds === today ? ' today' : ''}" onclick="openDayHistory('${ds}')" title="${ds} — ${total} نشاط${future ? ' (مستقبل)' : ''}">${d}</div>`);
    }
    months.push(`<div class="hist-month"><h4>${MONTH_NAMES[m - 1]}</h4><div class="hist-cells">${cells.join('')}</div></div>`);
  }
  return `
    <div class="hist-head">
      <button class="btn btn-ghost" onclick="shiftHistYear(-1)">‹ السنة السابقة</button>
      <select class="input" id="hist-year" style="max-width:110px" onchange="setHistYear(Number(this.value))">
        ${years.map((yy) => `<option value="${yy}" ${yy === y ? 'selected' : ''}>${yy}</option>`).join('')}
      </select>
      <button class="btn btn-ghost" onclick="shiftHistYear(1)">السنة التالية ›</button>
      <button class="btn btn-ghost" onclick="goNearestDay()" title="ينقلك لأول يوم فيه محتوى">📌 أقرب يوم</button>
      <button class="btn btn-ghost" onclick="goToday()">اليوم</button>
    </div>
    <div class="hist-legend">
      <span class="count">النشاط:</span>
      <span class="hist-sq l0" title="لا نشاط">0</span>
      <span class="hist-sq l1" title="1-2">1</span>
      <span class="hist-sq l2" title="3-5">3</span>
      <span class="hist-sq l3" title="6-10">7</span>
      <span class="hist-sq l4" title="11+">12+</span>
      <span class="count" style="margin-inline-start:10px">مهام منجزة · جلسات تركيز · تدوينات · أفكار · مشاريع منجزة/مؤرشفة</span>
    </div>
    <div class="hist-grid">${months.join('')}</div>`;
}

function shiftHistYear(delta) {
  state.archiveHistYear = (state.archiveHistYear || Number(todayISO().slice(0, 4))) + delta;
  renderArchive();
}

function setHistYear(y) {
  state.archiveHistYear = y;
  renderArchive();
}

function addDaysISO(ds, n) {
  const d = new Date(ds + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function goToday() {
  state.archiveHistYear = Number(todayISO().slice(0, 4));
  renderArchive();
  openDayHistory(todayISO());
}
function goNearestDay() {
  const t = todayISO();
  const fwd = NoorStore.historyRange(t, addDaysISO(t, 730));
  let ds = null;
  if (fwd.length) ds = fwd[0].date;
  else {
    const back = NoorStore.historyRange(addDaysISO(t, -730), t);
    if (back.length) ds = back[back.length - 1].date;
  }
  if (!ds) return showToast('لا يوجد أي يوم فيه محتوى بعد', 'bad');
  state.archiveHistYear = Number(ds.slice(0, 4));
  renderArchive();
  openDayHistory(ds);
}

function openDayHistory(ds) {
  const day = NoorStore.getDayHistory(ds);
  const fmt = fmtDateAr(ds);
  const sec = [];
  if (day.tasks.length) sec.push(`<div class="dh-sec"><h4>المهام (${day.tasks.length})</h4>${day.tasks.map((t) => `<div class="dh-item"><span class="dh-ic">${t.done ? '✓' : '🗄'}</span><span>${esc(t.title)}</span>${t.project_name ? `<span class="count"> · ${esc(t.project_name)}</span>` : ''}${!t.done ? `<span class="count"> · ${t.archived ? 'أُرشفت' : 'لم تُنجز'}</span>` : ''}</div>`).join('')}</div>`);
  const projMap = {};
  day.tasks.concat(day.sessions).forEach((x) => { if (x.project_id != null && !projMap[x.project_id]) projMap[x.project_id] = x.project_name || 'مشروع'; });
  const pids = Object.keys(projMap).map(Number);
  if (pids.length) sec.push(`<div class="dh-sec"><h4>مشاريع اليوم (${pids.length})</h4>${pids.map((pid) => `<div class="dh-item" style="cursor:pointer" onclick="openProjectFromDay(${pid})" title="عرض المشروع"><span class="dh-ic">📂</span><span>${esc(projMap[pid])}</span><span class="count" style="margin-inline-start:auto">👁</span></div>`).join('')}</div>`);
  if (day.sessions.length) sec.push(`<div class="dh-sec"><h4>جلسات (${day.minutes} دقيقة تركيز)</h4>${day.sessions.map((s) => `<div class="dh-item"><span class="dh-ic">⏱</span><span>${s.minutes} دقيقة — ${s.mode === 'break' ? 'استراحة' : 'تركيز'}</span>${s.pname ? `<span class="count"> · ${esc(s.pname)}</span>` : ''}</div>`).join('')}</div>`);
  if (day.feelings && day.feelings.length) sec.push(`<div class="dh-sec"><h4>المشاعر (${day.feelings.length})</h4>${day.feelings.map((f) => `<div class="dh-item"><span class="dh-ic">💭</span><span>${esc(f.text)}</span></div>`).join('')}</div>`);
  if (day.decisions && day.decisions.length) sec.push(`<div class="dh-sec"><h4>القرارات (${day.decisions.length})</h4>${day.decisions.map((x) => `<div class="dh-item"><span class="dh-ic">⚖️</span><span>${esc(x.text)}</span></div>`).join('')}</div>`);
  if (day.experiences && day.experiences.length) sec.push(`<div class="dh-sec"><h4>تجارب ودروس (${day.experiences.length})</h4>${day.experiences.map((x) => `<div class="dh-item"><span class="dh-ic">🌱</span><span>${esc(x.text)}</span>${x.category_name ? `<span class="chip chip-xs">${esc(x.category_name)}</span>` : ''}</div>`).join('')}</div>`);
  if (day.answers && day.answers.length) sec.push(`<div class="dh-sec"><h4>إجابات يوميات اليوم (${day.answers.length})</h4>${day.answers.map((a) => { const q = (NoorStore.getJournalQuestions() || []).find((x) => String(x.id) === String(a.questionId)); return `<div class="dh-item"><span class="dh-ic">❓</span><div><strong style="display:block;font-size:var(--fs-sm)">${q ? esc(q.text) : 'سؤال #' + esc(a.questionId)}</strong><span>${esc(a.answer)}</span></div></div>`; }).join('')}</div>`);
  const postSections = [
    { key: 'معرفة', ic: '📖', list: day.posts.filter((p) => p.space === 'knowledge') },
    { key: 'ذكريات', ic: '🧠', list: day.posts.filter((p) => p.space === 'awareness' && p.sub === 'mem') },
    { key: 'يوميات', ic: '📔', list: day.posts.filter((p) => p.space === 'awareness' && p.sub === 'diary') },
    { key: 'تدوينات', ic: '📝', list: day.posts.filter((p) => !(p.space === 'knowledge' || (p.space === 'awareness' && (p.sub === 'mem' || p.sub === 'diary')))) }
  ];
  postSections.forEach((g) => {
    if (!g.list.length) return;
    sec.push(`<div class="dh-sec"><h4>${g.key} (${g.list.length})</h4>${g.list.map((p) => `<div class="dh-item" style="cursor:pointer" onclick="event.stopPropagation();openPostDetails(${p.id})" title="عرض التفاصيل"><span class="dh-ic">${g.ic}</span><span>${esc(p.title)}</span><span class="count" style="margin-inline-start:auto">👁</span></div>`).join('')}</div>`);
  });
  if (day.notes.length) sec.push(`<div class="dh-sec"><h4>الأفكار (${day.notes.length})</h4>${day.notes.map((n) => `<div class="dh-item"><span class="dh-ic">💡</span><span>${esc(n.text)}</span></div>`).join('')}</div>`);
  if (day.projects.length) sec.push(`<div class="dh-sec"><h4>مشاريع منجزة (${day.projects.length})</h4>${day.projects.map((p) => `<div class="dh-item" style="cursor:pointer" onclick="event.stopPropagation();openArchivedProject(${p.id})" title="عرض المشروع"><span class="dh-ic">✅</span><span>${esc(p.name)}</span>${p.type !== 'عام' ? `<span class="chip chip-xs">${esc(p.type)}</span>` : ''}<span class="count" style="margin-inline-start:auto">👁</span></div>`).join('')}</div>`);
  if (day.archived.length) sec.push(`<div class="dh-sec"><h4>أُرشفت (${day.archived.length})</h4>${day.archived.map((a) => `<div class="dh-item${a.type === 'مشروع' ? '" style="cursor:pointer" onclick="event.stopPropagation();openArchivedProject(' + a.id + ')' : ''}" title="${a.type === 'مشروع' ? 'عرض المشروع' : ''}"><span class="dh-ic">🗄</span><span>${esc(a.name)}</span><span class="chip chip-xs">${esc(a.type)}</span>${a.type === 'مشروع' ? '<span class="count" style="margin-inline-start:auto">👁</span>' : ''}</div>`).join('')}</div>`);
  var files = [];
  day.tasks.forEach(function(t) { if (t.file) files.push({ name: t.file_name || 'مرفق مهمة', url: t.file, ic: '📎' }); });
  day.projects.forEach(function(p) { if (p.file) files.push({ name: p.file_name || 'مرفق مشروع', url: p.file, ic: '📁' }); });
  day.posts.forEach(function(p) { if (p.media && p.media.length) p.media.forEach(function(m) { files.push({ name: 'مرفق تدوينة', url: m, ic: '🖼️' }); }); });
  day.archived.forEach(function(a) { if (a.file) files.push({ name: a.file_name || 'مرفق مؤرشف', url: a.file, ic: '🗄️' }); });
  if (files.length) sec.push('<div class="dh-sec"><h4>الملفات المرفقة (' + files.length + ')</h4>' + files.map(function(f) { return '<div class="dh-item"><span class="dh-ic">' + f.ic + '</span><a href="' + esc(f.url) + '" target="_blank" rel="noopener" download="' + esc(f.name) + '">' + esc(f.name) + '</a></div>'; }).join('') + '</div>');
  openModal(fmt, sec.join('') || '<div class="empty-box"><strong>لا نشاط</strong><p>لم تُدخل أي شيء في هذا اليوم.</p></div>');
}

function archiveRow(it) {
  const typeCls = it.type === 'مشروع' ? 'chip-prio' : (it.type === 'عادة' ? 'chip-warn' : (it.type === 'تدوينة' ? 'chip-proj' : 'chip-proj'));
  const isProject = it.type === 'مشروع';
  const isPost = it.type === 'تدوينة';
  const clickable = isProject || isPost;
  const openFn = isProject ? `openArchivedProject(${it.id})` : `openArchivedPost(${it.id})`;
  const canRestore = it.archived_at && it.type !== 'نداء';
  return `
    <div class="card archive-row" ${clickable ? `onclick="${openFn}" style="cursor:pointer"` : ''}>
      <div class="archive-main">
        <span class="chip ${typeCls}">${esc(it.type)}</span>
        <div class="goal-title">
          <h4>${esc(it.title)}</h4>
          <span class="count">${fmtDateAr(it.date)}${it.project_name ? ' · ' + esc(it.project_name) : ''}</span>
        </div>
      </div>
      <div class="archive-actions">
        ${clickable ? `<button class="btn btn-sm" onclick="event.stopPropagation();${openFn}">👁 التفاصيل</button>` : ''}
        ${canRestore ? `<button class="btn btn-sm" onclick="event.stopPropagation();restoreArchivedEntity('${esc(it.type)}', ${it.id})">↩ استرجاع</button>` : ''}
      </div>
    </div>`;
}

/* عرض تفاصيل مشروع مؤرشف: الغلاف والملخص والمهام كلها — من الأرشيف */
function openArchivedProject(id) {
  const p = NoorStore.getProjectById(id);
  if (!p) return showToast('المشروع غير موجود', 'bad');
  const pts = NoorStore.getProjectTasksAll(id);
  const pt = projectType(p.type);
  const isMedia = p.type !== 'عام';
  const daysLabel = p.days.length === 7 ? 'كل الأيام' : p.days.map((d) => DAY_NAMES[d]).join('، ');
  const doneTasks = pts.filter((x) => x.completed_at).length;
  const mediaHead = isMedia ? `
    <div class="lib-detail">
      ${p.cover ? `<div class="lib-detail-cover"><img src="${cachedCover(p.cover)}" alt="" loading="lazy" onerror="this.closest('.lib-detail-cover').style.display='none'"></div>` : ''}
      <div class="lib-detail-body">
        ${p.author ? `<div class="lib-detail-author">${esc(p.author)}</div>` : ''}
        ${p.rating > 0 ? `<div class="lib-detail-rating">${starsHTML(p.rating)}</div>` : ''}
        ${p.summary ? `<div class="lib-detail-summary">${esc(p.summary)}</div>` : ''}
      </div>
    </div>` : '';
  openModal((p.archived_at ? '🗄 مشروع مؤرشف: ' : '📂 مشروع مكتمل: ') + p.name, `
    <div class="project-detail-head">
      <span class="goal-ic small" style="background:${esc(p.color) || NOOR_ACCENT}">${isMedia ? pt.icon : '📁'}</span>
      <div class="pd-info">
        <strong>${esc(p.name)}</strong>
        ${p.type !== 'عام' ? `<span class="chip chip-xs">${pt.icon} ${esc(pt.title)}</span>` : ''}
        <span class="count">${p.completed_at ? 'أُنجز في ' + fmtDateAr(String(p.completed_at).slice(0, 10)) : 'أُرشف'} · الأيام المسموحة: ${esc(daysLabel)} · أسبوع ${p.week}${p.weeks > 1 ? `-${p.week + p.weeks - 1}` : ''}</span>
        ${p.notes ? `<p class="pd-notes">${esc(p.notes)}</p>` : ''}
      </div>
    </div>
    ${mediaHead}
    ${projectFileLinkHTML(p)}
    <h4 class="card-title" style="font-size:15px;margin:10px 0 6px">المهام (${doneTasks}/${pts.length} منجزة)</h4>
    <div class="pt-list">
      ${pts.length ? pts.map((t, idx) => `
        <div class="settings-item project" style="align-items:flex-start;flex-direction:column;gap:6px">
          <div style="display:flex;align-items:center;gap:8px;width:100%">
            <span class="item-type">${t.completed_at ? '✓' : String(idx + 1)}</span>
            <span class="item-title">${esc(t.title)}</span>
            <span class="item-meta">${t.completed_at ? 'منجزة' : 'لم تُنجز'}${t.hours > 0 ? ` · ⏱ ${t.hours} ساعة` : ''}</span>
          </div>
          ${t.desc ? `<div class="count" style="padding-inline-start:34px">${esc(t.desc)}</div>` : ''}
          ${t.sources && t.sources.length ? `<div class="count" style="padding-inline-start:34px">المصادر: ${t.sources.map((s) => {
            const openUrl = s.type === 'video' ? (ytEmbedSrc(s.url, s.kind) || s.url) : s.url;
            return `${s.type === 'video' ? '🎬' : '📚'} ${esc(s.title || '')}${s.url ? ` — <a href="${esc(openUrl)}" target="_blank" rel="noopener">${s.type === 'video' ? 'فتح/تشغيل' : 'فتح'}</a>` : ''}`;
          }).join(' · ')}</div>` : ''}
        </div>`).join('') : '<div class="empty-box"><strong>لا مهام</strong></div>'}
    </div>
    <div class="modal-actions">
      ${p.completed_at && !p.archived_at ? `<button class="btn btn-sm" onclick="closeModal();toggleCompleteProject(${p.id})">↺ إلغاء الإنجاز</button>` : ''}
      <button class="btn btn-ghost" onclick="closeModal()">إغلاق</button>
    </div>`);
}

function openProjectFromDay(pid) {
  const p = NoorStore.getProjectById(pid);
  if (!p) return showToast('المشروع غير موجود', 'bad');
  if (p.archived_at) openArchivedProject(pid);
  else openProjectTasksModal(pid);
}

/* عرض تدوينة مؤرشف من الأرشيف: كامل النص دون تحرير */
function openArchivedPost(id) {
  const p = NoorStore.getPostAny(id);
  if (!p) return showToast('التدوينة غير موجودة', 'bad');
  const m = POST_SPACES.find((x) => x.key === p.space) || {};
  const isLib = p.space === 'knowledge';
  const libHead = isLib && p.sub !== 'exp' && (p.cover || p.author || p.rating > 0) ? `
    <div class="lib-detail">
      ${p.cover ? `<div class="lib-detail-cover"><img src="${cachedCover(p.cover)}" alt="" loading="lazy" onerror="this.closest('.lib-detail-cover').style.display='none'"></div>` : ''}
      <div class="lib-detail-body">
        ${p.author ? `<div class="lib-detail-author">${esc(p.sub === 'video' ? 'الاسم' : 'المؤلف')}: ${esc(p.author)}</div>` : ''}
        ${p.rating > 0 ? `<div class="lib-detail-rating">${starsHTML(p.rating)}</div>` : ''}
      </div>
    </div>` : '';
  openModal(`${m.icon || '📝'} ${esc(p.title)}`, `
    <div class="field" style="flex-direction:row;align-items:center;gap:8px;flex-wrap:wrap">
      <span class="chip jchip">${esc(jTypeIcon(p.space, p.sub))} ${esc(jTypeTitle(p.space, p.sub) || m.title || p.space || 'تدوينة')}</span>
      ${p.completed_at ? '<span class="chip chip-ok">مكتمل ✓</span>' : ''}
      ${p.archived_at ? '<span class="chip chip-auto">أُرشفت 🗄</span>' : ''}
    </div>
    ${libHead}
    ${postBodyHTML(p)}
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">إغلاق</button>
    </div>`);
}

function archiveYears() {
  const ys = new Set();
  NoorStore.getArchive({}).forEach((it) => {
    const y = String(it.date || '').slice(0, 4);
    if (y.length === 4 && y >= '2000') ys.add(y);
  });
  ys.add(todayISO().slice(0, 4));
  return [...ys].map(Number).sort((a, b) => a - b);
}

function setArchiveFilter(k, v) {
  state.archiveFilter[k] = v;
  renderArchive();
}

let archiveSearchTimer = null;
function debouncedArchiveSearch() {
  clearTimeout(archiveSearchTimer);
  const pg = state.page;
  archiveSearchTimer = setTimeout(() => {
    if (state.page !== pg) return;
    state.archiveFilter.q = $('#arc-q').value;
    renderArchive();
  }, 250);
}

async function restoreArchiveItem(id) {
  try {
    NoorStore.restoreTask(id);
    showToast('أُعيدت المهمة إلى يومها');
    await renderArchive();
  } catch (err) { showToast(err.message, 'bad'); }
}

async function restoreArchivedEntity(type, id) {
  try {
    const fns = {
      'مشروع': () => NoorStore.restoreProject(id),
      'مهمة مشروع': () => NoorStore.restoreProjectTask(id),
      'هدف': () => NoorStore.restoreGoal(id),
      'قيمة': () => NoorStore.restoreValue(id),
      ' مشروع فرعي': () => NoorStore.restoreSubgoal(id),
      'عادة': () => NoorStore.restoreHabit(id),
      'فكرة': () => NoorStore.restoreNote(id),
      'تدوينة': () => NoorStore.restorePost(id),
      'رغبة': () => NoorStore.restoreDesire(id),
      'مهمة': () => NoorStore.restoreTask(id)
    };
    if (fns[type]) fns[type]();
    else return showToast('نوع غير مدعوم للاستعادة', 'bad');
    showToast('تمت الاستعادة');
    await renderArchive();
  } catch (err) { showToast(err.message, 'bad'); }
}

/* ===== شريط الحالة الجانبي ===== */
async function updateSidebarStatus() {
  try {
    const st = NoorStore.stats();
    const today = st.days.find((d) => d.isToday);
    const ok = today && today.pct >= st.daily_threshold;
    $('#statusDot').className = 'status-dot' + (ok ? ' connected' : '');
    $('#statusText').textContent = today
      ? `اليوم: ${today.focus_min} د — ${today.pct}%` + (ok ? ' ✓' : '')
      : '—';
  } catch {}
}

/* ===== النظرة: أصبحت مدمجة في أسفل الإحصائيات (Dashboard) كعنصر توسّعي ===== */
async function renderVision() {
  $('#content').innerHTML = `
    <div class="page-head">
      <div>
        <h2 class="page-title">النظرة</h2>
        <p class="page-sub">من أنت ولماذا تعمل — ثم أهدافك من الآن حتى نهاية خطتك</p>
      </div>
      <button class="btn btn-lg" onclick="openNoteModal()">+ فكرة عشوائية</button>
    </div>
    ${visionBodyHTML()}`;
}

/* مصدر الأرقام الواحد للنظرة — تستهلكه اللوحة العلوية والخط الزمني والتقرير كلها من هنا */
function visionStats() {
  const s = NoorStore.getSettings();
  const goals = NoorStore.getGoals();
  const today = NoorStore.todayStr();
  const curYear = NoorStore.yearIndex(today);
  const planYears = Math.max(1, Math.round(Number(s.plan_years) || 20));
  const maxYear = Math.max(planYears, curYear, goals.reduce(function (m, g) { return Math.max(m, ...((g.years && g.years.length) ? g.years : [g.year || 1])); }, 1));
  const values = (s.values || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
  const yearsCovered = [];
  const yearsGap = [];
  for (let y = 1; y <= maxYear; y++) {
    const has = NoorStore.activeGoalsForYear(y).length > 0 || goals.some(function (g) { return ((g.years && g.years.length) ? g.years : [g.year]).indexOf(y) >= 0; });
    (has ? yearsCovered : yearsGap).push(y);
  }
  let done = 0, expected = 0;
  for (let y = 1; y <= maxYear; y++) { const ys = NoorStore.yearStats(y); done += ys.done; expected += ys.expected; }
  const progPct = expected ? Math.round((done / expected) * 100) : 0;
  const active = goals.filter(function (g) { return !NoorStore.goalIsCompleted(g); }).length;
  const completed = goals.length - active;
  let planDay = null;
  try {
    const ps = NoorStore.planStart();
    if (ps) planDay = Math.max(1, Math.round((new Date(today + 'T00:00:00Z') - new Date(String(ps).slice(0, 10) + 'T00:00:00Z')) / 86400000) + 1);
  } catch (e) {}
  return { s, goals, curYear, maxYear, values, yearsCovered, yearsGap, progPct, active, completed, planDay };
}

/* اللوحة العلوية للنظرة: حلقة الإنجاز الكلي + أرقام الأساس — أول ما تقع عليه العين */
function visionHeroHTML(st) {
  const R = 42, C = (2 * Math.PI * R).toFixed(1);
  const off = (C * (1 - Math.min(100, st.progPct) / 100)).toFixed(1);
  return ''
    + '<div class="vn-hero">'
    + '<div class="card vn-hero-ring">'
      + '<div class="ring-wrap"><svg class="ring" viewBox="0 0 96 96" width="96" height="96" aria-hidden="true">'
      + '<circle cx="48" cy="48" r="' + R + '"></circle>'
      + '<circle class="fg" cx="48" cy="48" r="' + R + '" style="stroke-dasharray:' + C + ';stroke-dashoffset:' + off + '"></circle></svg>'
      + '<div class="ring-label">' + st.progPct + '%</div></div>'
      + '<div class="vn-hero-info"><strong class="vn-hero-t">إنجاز الخطة كاملة</strong>'
      + '<span class="count">' + st.active + ' هدف نشط · ' + st.completed + ' مكتمل</span>'
      + (st.planDay ? '<span class="chip chip-warn">اليوم ' + st.planDay + ' من رحلتك</span>' : '')
      + '</div></div>'
    + '<div class="vn-hero-grid">'
      + vnStat(st.values.length, '💎', 'قيم معرّفة')
      + vnStat(st.goals.length, '🎯', 'إجمالي الأهداف')
      + vnStat(st.maxYear, '📅', 'مدى الخطة (سنة)')
      + vnStat(st.yearsCovered.length + ' / ' + st.maxYear, '🧭', 'تغطية السنوات')
    + '</div></div>';
  function vnStat(n, ic, l) { return '<div class="analysis-stat"><span class="as-num">' + n + '</span><span class="as-label">' + ic + ' ' + l + '</span></div>'; }
}

/* الخط الزمني المرئي لسنوات الخطة — مربع لكل سنة */
function visionTimelineHTML(st) {
  let yline = '';
  for (let y = 1; y <= st.maxYear; y++) {
    const ok = st.yearsCovered.indexOf(y) >= 0;
    yline += '<div class="ycell ' + (ok ? 'ok' : 'gap') + (y === st.curYear ? ' cur' : '') + '" title="السنة ' + y + (ok ? ' — لها أهداف ✓' : ' — بلا أهداف بعد') + '">' + y + '</div>';
  }
  return '<h4 class="insight-h">الخط الزمني <span class="count">— الأخضر له أهداف، الفارغ بانتظار التخطيط، والإطار السميك موقعك الحالي</span></h4><div class="yline">' + yline + '</div>';
}

/* محتوى النظرة الكامل: اللوحة العلوية ← الهوية ← عشوائيات ← الخط الزمني ← الهرم */
function visionBodyHTML() {
  const s = NoorStore.getSettings();
  const today = NoorStore.todayStr();
  const curYear = NoorStore.yearIndex(today);
  const goals = NoorStore.getGoals();
  const notes = NoorStore.getNotes();
  const st = visionStats();
  const planYears = Math.max(1, Math.round(Number(s.plan_years) || 20));
  const maxGoalYear = goals.reduce((m, g) => Math.max(m, ...(g.years && g.years.length ? g.years : [g.year || 1])), 1);
  const maxYear = Math.max(planYears, curYear, maxGoalYear);

  let hier = '';
  const scheduleCache = {};
  const scheduleOf = (gid) => (scheduleCache[gid] = scheduleCache[gid] || NoorStore.branchSchedule(gid));
  for (let y = 1; y <= maxYear; y++) {
    const ys = NoorStore.yearStats(y);
    const activeIds = {};
    NoorStore.activeGoalsForYear(y).forEach((g) => { activeIds[g.id] = 1; });
    const yearGoals = goals.filter((g) => (g.years && g.years.length ? g.years : [g.year]).indexOf(y) >= 0);
    const carried = [];
    goals.forEach((g) => {
      if ((g.years && g.years.length ? g.years : [g.year]).indexOf(y) >= 0) return;
      scheduleOf(g.id).forEach((s) => { if (s.startYear <= y && s.endYear >= y) carried.push({ g: g, s: s }); });
    });
    const RING_C = (2 * Math.PI * 18).toFixed(1);
    const ringOff = (RING_C * (1 - Math.min(100, ys.pct) / 100)).toFixed(1);
    const stateCls = y === curYear ? 'cur open' : ('collapsed ' + (y < curYear ? 'past' : 'future'));
    const yearChip = y === curYear ? '<span class="chip chip-warn">أنت هنا</span>' : (y < curYear && ys.pct >= 100 ? '<span class="chip chip-done">✅ اكتملت</span>' : '');
    hier += `
      <div class="yh ${stateCls}">
        <div class="yh-head" onclick="toggleYh(this)" title="${y === curYear ? 'طي السنة' : 'فتح السنة'}">
          <div class="yh-ring">
            <svg class="ring" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
              <circle class="bg" cx="24" cy="24" r="18"></circle>
              <circle class="fg" cx="24" cy="24" r="18" style="stroke-dasharray:${RING_C};stroke-dashoffset:${ringOff}"></circle>
            </svg>
            <div class="ring-label">${ys.pct}%</div>
          </div>
          <div class="yh-info">
            <strong class="yh-title">السنة ${y} ${yearChip}</strong>
            <span class="count">${ys.done} من ${ys.expected} وحدة · ${yearGoals.length} هدف</span>
            <div class="yh-mini"><span class="an-bar"><span class="an-fill" style="width:${ys.pct}%;${ys.pct >= 100 ? 'background:var(--green)' : ''}"></span></span></div>
          </div>
          <span class="yh-chev" aria-hidden="true"></span>
          <button class="btn btn-xs" onclick="event.stopPropagation();openGoalModalForYear(${y})">+ هدف</button>
        </div>
        ${yearGoals.length ? `<div class="yh-body">${yearGoals.map((g) => {
          const state = activeIds[g.id] ? 'active' : (NoorStore.goalIsCompleted(g) ? 'done' : 'waiting');
          const branches = state === 'active' ? scheduleOf(g.id).filter((s) => s.startYear <= y && s.endYear >= y) : [];
          return goalNode(g, ys, branches, state);
        }).join('')}</div>` : '<div class="yh-empty">لا أهداف لهذه السنة بعد — أضف أول هدف.</div>'}
        ${carried.length ? `<div class="yh-branches"><span class="chip chip-proj">فروع ممتدة لهذه السنة:</span>${carried.map(({ g, s }) => `<span class="chip" title="${esc(g.title)}">🧭 ${esc(s.title)} — ${s.weeks} أسبوع</span>`).join('')}</div>` : ''}
      </div>`;
  }

  return `
    ${visionHeroHTML(st)}
    <div class="vision-grid">
      <div class="card">
        <div class="card-head"><h3 class="card-title">🧍 من أنا</h3><button class="btn btn-xs" onclick="saveVisionField('who_am_i','v-who')">حفظ</button></div>
        <div class="card-body"><textarea class="input" id="v-who" rows="3" placeholder="من أنت؟ ماذا تحب؟ ماذا تريد أن تكون؟">${esc(s.who_am_i)}</textarea></div>
      </div>
      <div class="card">
        <div class="card-head"><h3 class="card-title">🔭 المنظور</h3><button class="btn btn-xs" onclick="saveVisionField('vision','v-vision')">حفظ</button></div>
        <div class="card-body"><textarea class="input" id="v-vision" rows="3" placeholder="صورتك الكبرى: أين تريد أن تصل بعد سنوات؟">${esc(s.vision)}</textarea></div>
      </div>
      <div class="card">
        <div class="card-head"><h3 class="card-title">💎 القيم</h3><button class="btn btn-xs" onclick="saveVisionField('values','v-values')">حفظ</button></div>
        <div class="card-body">
          <textarea class="input" id="v-values" rows="3" placeholder="قيمك التي تحكم قراراتك — قيمة في كل سطر">${esc(s.values)}</textarea>
          ${st.values.length ? '<div class="val-chips">' + st.values.map((v) => '<span class="chip">' + esc(v) + '</span>').join('') + '</div>' : ''}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h3 class="card-title">عشوائيات — أفكار الأهداف</h3><span class="count">${notes.length} فكرة</span></div>
      <div class="card-body">
        <div class="st-add">
          <input class="input" id="idea-input" placeholder="اكتب فكرتك هنا ثم اضغط Enter…" onkeydown="if(event.key==='Enter'){event.preventDefault();addIdeaNow()}">
          <button class="btn" onclick="addIdeaNow()">إضافة فكرة</button>
        </div>
        ${notes.length ? notes.map((n) => `
          <div class="note-item">
            <span class="note-text">${esc(n.text)}</span>
            <button class="icon-btn danger" onclick="archiveNoteItem(${n.id})" title="حذف">✕</button>
          </div>`).join('') : '<div class="empty-box"><strong>لا أفكار بعد</strong><p>اكتب فكرتك في الحقل أعلاه واضغط Enter — اجمع هنا أي فكرة أو رغبة عابرة تخص أهدافك.</p></div>'}
      </div>
    </div>

    <div class="card vn-timeline">${visionTimelineHTML(st)}</div>

    <h3 class="card-title mt vision-hier-title">سنوات الخطة — السنة ← الأهداف ← المشاريع ← المهام</h3>
    <div class="card vn-years"><div class="vision-hier">${hier}</div></div>
`;
}

function toggleYh(btn) {
  const yh = btn.closest('.yh');
  if (!yh) return;
  yh.classList.toggle('collapsed');
  yh.classList.toggle('open');
}

function goalDurationLabel(g) {
  const dur = g.duration_years || 1;
  const dt = g.duration_type || 'weeks';
  if (dt === 'months') return dur + ' ' + (dur === 1 ? 'شهر' : 'أشهر');
  if (dt === 'quarters') {
    if (dur === 1) return 'ربع سنة';
    if (dur === 2) return 'نصف سنة';
    if (dur === 3) return 'ثلاثة أرباع سنة';
    return dur + ' أرباع سنة';
  }
  return dur + ' ' + (dur === 1 ? 'سنة' : 'سنوات');
}

function goalNode(g, ys, activeBranches, revealState) {
  const gs = ys.goals.find((x) => x.id === g.id) || { pct: 0, done: 0, expected: 0 };
  const done = revealState === 'done' || NoorStore.goalIsCompleted(g);
  const waiting = revealState === 'waiting';
  const projects = NoorStore.getProjects().filter((p) => p.goal_id === g.id)
    .sort((a, b) => (a.priority || 1) - (b.priority || 1) || a.id - b.id);
  const completedProjects = projects.filter((p) => p.completed_at);
  const activeProjects = projects.filter((p) => !p.completed_at);
  const currentProject = activeProjects[0] || null;
  const recurring = recurringHabitsForGoal(g.id);
  const habitsCount = NoorStore.getSubgoals(g.id)
    .reduce((a, sg) => a + NoorStore.getHabits({ subgoal_id: sg.id }).length, 0);
  const branchLine = activeBranches && activeBranches.length
    ? `<div class="gn-habits">${activeBranches.map((s) => `<span class="chip">🧭 ${esc(s.title)} — ${s.weeks} أسبوع</span>`).join('')}</div>`
    : '';
  const stateLine = done
    ? '<span class="chip chip-done">✅ مكتمل</span>'
    : (waiting ? '<span class="chip chip-warn" title="يُفتح بعد إكمال الهدف السابق لنفس القيمة">⏳ بانتظار دوره</span>' : '');
  const durLabel = goalDurationLabel(g);
  const detailsHTML = g.details
    ? `<div class="gn-details" title="${esc(g.details)}">${esc(g.details.length > 80 ? g.details.slice(0, 80) + '…' : g.details)}</div>`
    : '';
  return `
    <div class="goal-node${waiting ? ' goal-waiting' : ''}${done ? ' goal-done' : ''}">
      <div class="gn-head">
        <span class="goal-ic small" style="background:${esc(g.color) || NOOR_ACCENT}">${esc(g.icon || '◎')}</span>
        <span class="gn-title">${esc(g.title)}</span>
        ${stateLine}
        <span class="gn-dur chip">${durLabel}</span>
        <span class="gn-val">${gs.done}/${gs.expected} · ${gs.pct}%</span>
        <div class="gn-actions">
          <button class="icon-btn" onclick="toggleGoalComplete(${g.id})" title="${done ? 'إلغاء الإكمال' : 'إكمال الهدف — يفتح الهدف التالي لنفس القيمة'}">${done ? '↩️' : '✅'}</button>
          <button class="btn btn-xs btn-ghost" onclick="openProjectForGoal(${g.id})" title="إضافة مشروع">+ مشروع</button>
          <button class="icon-btn" onclick="openGoalModal(${g.id})" title="تعديل">✎</button>
          <button class="icon-btn danger" onclick="archiveGoalItem(${g.id})" title="أرشفة">✕</button>
        </div>
      </div>
      <div class="an-bar gn-bar"><span class="an-fill" style="width:${gs.pct}%;background:${esc(g.color) || NOOR_ACCENT}"></span></div>
      <div class="gn-body">
        ${detailsHTML}
        ${branchLine}
        ${completedProjects.map((p) => projectNode(g, p)).join('')}
        ${currentProject ? projectNode(g, currentProject, activeProjects.length - 1) : ''}
        ${recurring.map(recurringHabitRow).join('')}
        ${!projects.length && !recurring.length ? '<div class="ghint">لا مشاريع بعد — أضف أول مشروع.</div>' : ''}
        ${habitsCount ? `<div class="gn-habits"><span class="chip chip-warn">${habitsCount} عادة أسبوعية</span></div>` : ''}
      </div>
    </div>`;
}

function projectNode(g, p, nextCount) {
  const doneTasks = p.tasks.filter((t) => t.completed_at).length;
  const nextChip = p.completed_at ? '' : (nextCount > 0 ? '<span class="chip chip-warn" title="يُنجز أولاً — يليه ' + nextCount + ' مشروع">التالي</span>' : '');
  return `
    <div class="project-node">
      <div class="pn-head">
        <span class="item-ic">${p.completed_at ? '✅' : '📂'}</span>
        <span class="pn-title ${p.completed_at ? 'done' : ''}">${esc(p.name)}</span>
        ${nextChip}
        <span class="count">${doneTasks}/${p.tasks.length} مهمة · أسبوع ${p.week}${p.weeks > 1 ? `-${p.week + p.weeks - 1}` : ''} · أولوية ${p.priority}</span>
        <div class="pn-actions">
          <button class="icon-btn" onclick="openProjectTaskModal(${p.id})" title="إضافة مهمة">+</button>
          <button class="icon-btn" onclick="openProjectTasksModal(${p.id})" title="مهام المشروع">☰</button>
          <button class="icon-btn" onclick="openProjectModal(${p.id})" title="تعديل">✎</button>
          <button class="icon-btn danger" onclick="archiveProject(${p.id})" title="أرشفة">✕</button>
        </div>
      </div>
      ${p.tasks.length ? `<div class="pn-tasks">
        ${p.tasks.map((t, i) => `
          <div class="task-node ${t.completed_at ? 'done' : ''}">
            <span class="tn-idx">${t.completed_at ? '✓' : i + 1}</span>
            <span class="tn-title">${esc(t.title)}</span>
            <div class="pn-actions">
              <button class="icon-btn" onclick="openProjectTaskModal(${p.id}, ${t.id})" title="تعديل">✎</button>
              <button class="icon-btn danger" onclick="archiveProjectTask(${t.id})" title="أرشفة">✕</button>
            </div>
          </div>`).join('')}
      </div>` : '<div class="ghint" style="padding:4px 10px">لا مهام بعد — أضف أول مهمة.</div>'}
    </div>`;
}

function openGoalModalForYear(year) {
  state.yearSel = Math.max(1, Math.round(year) || 1);
  openGoalModal(null);
}

/* ===== قسم الأهداف: القيم ← الأهداف ← الفروع ← المشاريع — قائمة بسيطة قابلة للطي ===== */
function claritySectionHTML() {
  const values = NoorStore.getValues();
  const goals = NoorStore.getGoals();
  if (!values.length && !goals.length) {
    return `
      <div class="empty-box">
        <strong>لا قيم بعد</strong>
        <p>أضف قيمة أولى (مثل: رياضي، غني، عالِم) وستظهر أهدافها تحتها في قائمة أنيقة.</p>
        <button class="btn" onclick="openValueModal(null)" style="margin-top:10px">+ أضف أول قيمة</button>
      </div>`;
  }
  const chains = values.map(clarityValueNode).join('');
  const loose = goals.filter((g) => !g.value_id).map(clarityGoalNode).join('');
  return `
    <div class="clx-toolbar">
      <p class="count">القيمة ← الهدف ← الفرع ← المشروع — انقر على أي صف لفتح تفاصيله</p>
      <button class="btn btn-sm" onclick="openValueModal(null)">+ قيمة</button>
    </div>
    ${chains}
    ${loose ? `
      <div class="clx-value">
        <div class="clx-row clx-value-row">
          <span class="clx-chev">▸</span>
          <span class="goal-ic small" style="background:var(--ink-4)">◆</span>
          <span class="clx-title">أهداف بدون قيمة</span>
          <span class="count">من إدخالات سابقة — اربطها بقيمة من زر التعديل</span>
          <span class="clx-actions"><span class="count">${loose.length}</span></span>
        </div>
        <div class="clx-body" style="display:none">${loose}</div>
      </div>` : ''}`;
}

function clarityValueNode(v) {
  const goals = NoorStore.getGoalsByValue(v.id);
  return `
    <div class="clx-value">
      <div class="clx-row clx-value-row" data-id="${v.id}" onclick="toggleClx(this)">
        <span class="clx-chev">▸</span>
        <span class="goal-ic small" style="background:${esc(v.color) || NOOR_ACCENT}">${esc(v.icon || '◆')}</span>
        <span class="clx-title">${esc(v.title)}</span>
        <span class="count">${goals.length} ${goals.length === 1 ? 'هدف' : 'أهداف'}</span>
        <span class="clx-actions" onclick="event.stopPropagation()">
          <button class="btn btn-xs" onclick="openGoalModal(null, ${v.id})">+ هدف</button>
          <button class="icon-btn" onclick="openValueModal(${v.id})" title="تعديل">✎</button>
          <button class="icon-btn danger" onclick="archiveValueItem(${v.id})" title="أرشفة">✕</button>
        </span>
      </div>
      <div class="clx-body" style="display:none">
        ${goals.length ? goals.map(clarityGoalNode).join('') : '<div class="clx-hint">لا أهداف لهذه القيمة بعد — أضف أول هدف.</div>'}
      </div>
    </div>`;
}

function clarityGoalNode(g) {
  const subs = NoorStore.getSubgoals(g.id);
  const projects = NoorStore.getProjects().filter((p) => p.goal_id === g.id && !p.subgoal_id);
  const recurring = recurringHabitsForGoal(g.id);
  const done = NoorStore.goalIsCompleted(g);
  const ordered = projects.slice().sort((a, b) => (a.priority || 1) - (b.priority || 1) || a.id - b.id);
  const completed = ordered.filter((p) => p.completed_at);
  const active = ordered.filter((p) => !p.completed_at);
  const current = active[0] || null;
  const nextCount = Math.max(0, active.length - 1);
  const hasBody = subs.length || projects.length || recurring.length;
  const durLabel = goalDurationLabel(g);
  const detailsLine = g.details ? `<span class="count" style="margin-inline-start:6px" title="${esc(g.details)}">${esc(g.details.length > 40 ? g.details.slice(0, 40) + '…' : g.details)}</span>` : '';
  return `
    <div class="clx-goal">
      <div class="clx-row clx-goal-row" onclick="toggleClx(this)">
        <span class="clx-chev">▸</span>
        <span class="goal-ic small" style="background:${esc(g.color) || NOOR_ACCENT}">${esc(g.icon || '◎')}</span>
        <span class="clx-title${done ? ' clx-done' : ''}">${esc(g.title)}</span>
        <span class="count">${durLabel} · ${clarityYearsLabel(g)}${done ? ' · ✅ مكتمل' : ''}</span>
        ${detailsLine}
        <span class="clx-actions" onclick="event.stopPropagation()">
          <button class="btn btn-xs" onclick="openProjectForGoal(${g.id})" title="المهمة الفرعية هي مشروع كامل مرتبط بالهدف">+ مهمة فرعية (مشروع)</button>
          <button class="btn btn-xs btn-ghost" onclick="openProjectForGoal(${g.id})" title="إضافة مشروع مباشر">+ مشروع</button>
          <button class="icon-btn" onclick="toggleGoalComplete(${g.id})" title="${done ? 'إلغاء الإكمال' : 'إكمال الهدف'}">${done ? '↩️' : '✅'}</button>
          <button class="icon-btn" onclick="openGoalModal(${g.id})" title="تعديل">✎</button>
          <button class="icon-btn danger" onclick="archiveGoalItem(${g.id})" title="أرشفة">✕</button>
        </span>
      </div>
      <div class="clx-body" style="display:none">
        ${subs.map(claritySubNode).join('')}
        ${completed.map(clarityProjectNode).join('')}
        ${current ? clarityProjectNode(current, nextCount) : ''}
        ${recurring.map(recurringHabitRow).join('')}
        ${!hasBody ? '<div class="clx-hint">لا فروع ولا مشاريع بعد — أضف فرعًا أو مشروعًا مباشرًا.</div>' : ''}
      </div>
    </div>`;
}

function claritySubNode(s) {
  const projects = NoorStore.getProjects().filter((p) => p.subgoal_id === s.id);
  return `
    <div class="clx-sub">
      <div class="clx-row clx-sub-row" onclick="toggleClx(this)">
        <span class="clx-chev">▸</span>
        <span class="item-ic">🧭</span>
        <span class="clx-title">${esc(s.title)}</span>
        <span class="count">أولوية ${s.priority} · ${s.weeks} ${s.weeks === 1 ? 'أسبوع' : 'أسابيع'}</span>
        <span class="clx-actions" onclick="event.stopPropagation()">
          <button class="btn btn-xs" onclick="openProjectModal(null, ${s.id}, ${s.goal_id})">+ مشروع</button>
          <button class="icon-btn" onclick="openSubgoalModal(${s.goal_id}, ${s.id})" title="تعديل">✎</button>
          <button class="icon-btn danger" onclick="archiveSubgoalItem(${s.id})" title="أرشفة">✕</button>
        </span>
      </div>
      <div class="clx-body" style="display:none">
        ${projects.length ? projects.map(clarityProjectNode).join('') : '<div class="clx-hint">لا مشاريع في هذا الفرع بعد.</div>'}
      </div>
    </div>`;
}

function clarityProjectNode(p, nextCount) {
  const t = projectType(p.type || 'عام');
  const doneTasks = (p.tasks || []).filter((x) => x.completed_at).length;
  const nextChip = p.completed_at ? '' : (nextCount > 0 ? '<span class="chip chip-warn" title="يُنجز أولاً — يليه ' + nextCount + ' مشروع">التالي</span>' : '');
  return `
    <div class="clx-project">
      <span class="item-ic">${p.completed_at ? '✅' : '📂'}</span>
      <span class="clx-title ${p.completed_at ? 'done' : ''}">${esc(p.name)}</span>
      ${nextChip}
      <span class="count">${esc(t.title || p.type || 'عام')} · أسبوع ${p.week}${p.weeks > 1 ? '–' + (p.week + p.weeks - 1) : ''} · ${doneTasks}/${(p.tasks || []).length} مهمة · أولوية ${p.priority}</span>
      <span class="clx-actions">
        <button class="btn btn-xs" onclick="openProjectTaskModal(${p.id})" title="إضافة مهمة">+ مهمة</button>
        <button class="icon-btn" onclick="openProjectModal(${p.id})" title="تعديل">✎</button>
        <button class="icon-btn danger" onclick="archiveProject(${p.id})" title="أرشفة">✕</button>
      </span>
    </div>`;
}

/* العادات المتكررة المرتبطة بالهدف (من طبقة noor_local_api) */
function recurringHabitsForGoal(goalId) {
  try {
    const db = _lsDB();
    return (db.habits || []).filter((h) => h.active !== 0 && Number(h.goal_id) === Number(goalId));
  } catch (e) { return []; }
}

function recurringHabitRow(h) {
  const days = parseHabitDayNumbers(h.allowed_days);
  const daysLabel = days.length ? (days.length === 7 ? 'كل الأيام' : days.map((d) => DAY_NAMES[d]).join('، ')) : '';
  return `
    <div class="clx-project">
      <span class="item-ic">🔁</span>
      <span class="clx-title">${esc(h.title)}</span>
      <span class="chip chip-auto">عادة متكررة</span>
      <span class="count">${h.minutes ? h.minutes + ' د / مرة' : ''}${daysLabel ? ' · ' + daysLabel : ''}${((h.video_urls && h.video_urls.length) || h.video_url) ? ' · 🎬 فيديو' + ((h.video_urls && h.video_urls.length > 1) ? 'ات (' + h.video_urls.length + ')' : '') : ''}</span>
      <span class="clx-actions">
        <button class="icon-btn" onclick="openRecurringHabitModal(${h.id})" title="تعديل">✎</button>
        <button class="icon-btn danger" onclick="deleteRecurringHabit(${h.id})" title="إيقاف العادة">✕</button>
      </span>
    </div>`;
}

async function deleteRecurringHabit(id) {
  if (!confirm('إيقاف هذه العادة المتكررة؟ سيُحذف سجلها من مهامك اليومية.')) return;
  try {
    await apiSend('DELETE', '/api/habits/' + id);
    play('tick');
    showToast('أُوقفت العادة');
    if (state.page === 'journal') await renderJournal();
    else if (state.page === 'vision') await renderVision();
    else if (state.page === 'stats') await renderStats();
  } catch (e) { showToast(e.message, 'bad'); }
}

/* تعديل عادة متكررة مستقلة: العنوان/الدقائق/الأيام/الفيديو/الهدف */
function openRecurringHabitModal(id) {
  let h = null;
  try {
    const db = _lsDB();
    h = (db.habits || []).find((x) => String(x.id) === String(id)) || null;
  } catch (e) { h = null; }
  if (!h) return showToast('العادة غير موجودة', 'bad');
  const days = parseHabitDayNumbers(h.allowed_days);
  const goals = NoorStore.getGoals();
  openModal('تعديل العادة المتكررة', `
    <div class="field"><label>اسم العادة</label><input class="input" id="rh-title" value="${esc(h.title)}"></div>
    <div class="field"><label>وصف العادة (اختياري)</label><textarea class="input" id="rh-notes" rows="2">${esc(h.notes || '')}</textarea></div>
    <div class="field"><label>روابط يوتيوب (اختياري، يمكن إضافة عدة روابط)</label>
      <div id="rh-videos-list">
        ${(h.video_urls && h.video_urls.length ? h.video_urls : [h.video_url || '']).map((v, i) => `
          <div class="field-row" style="align-items:center;margin-bottom:4px" id="rh-vid-row-${i}">
            <input class="input" id="rh-video-${i}" dir="ltr" value="${esc(v || '')}" placeholder="https://youtube.com/…" style="flex:1">
            <button type="button" class="icon-btn danger" onclick="document.getElementById('rh-vid-row-${i}').remove();renumberRHVideos()" title="إزالة الرابط">✕</button>
          </div>`).join('')}
      </div>
      <button type="button" class="btn btn-xs btn-ghost" onclick="addRHVideoField()" style="margin-top:4px">+ أضف رابط فيديو آخر</button>
    </div>
    <div class="field-row">
      <div class="field" style="flex:1"><label>دقائق تقريبًا لكل مرة</label><input class="input" id="rh-minutes" type="number" min="1" value="${h.minutes || 20}"></div>
      <div class="field" style="flex:1"><label>المدة المتوقعة (أسابيع)</label><input class="input" id="rh-weeks" type="number" min="1" value="${h.weeks || 12}"></div>
    </div>
    <div class="field"><label>الأيام المسموحة (تظهر فيها العادة في مهامك)</label>
      <div class="day-pick">
        ${DAY_NAMES.map((d, i) => `<label class="day-opt"><input type="checkbox" name="rh-day" value="${i}" ${days.includes(i) ? 'checked' : ''}>${d}</label>`).join('')}
      </div>
    </div>
    <div class="field"><label>الهدف (اختياري — يظهر تحت الهدف في هرم الأهداف)</label>
      <select class="input" id="rh-goal">
        <option value="">— بدون ربط هدف —</option>
        ${goals.map((g) => `<option value="${g.id}" ${Number(h.goal_id) === g.id ? 'selected' : ''}>${esc(g.title)} (سنة ${g.year})</option>`).join('')}
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="saveRecurringHabit(${h.id})">حفظ</button>
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>`);
}

function addRHVideoField() {
  const list = $('#rh-videos-list');
  if (!list) return;
  const idx = list.querySelectorAll('.field-row').length;
  const row = document.createElement('div');
  row.className = 'field-row';
  row.style.cssText = 'align-items:center;margin-bottom:4px';
  row.id = 'rh-vid-row-' + idx;
  row.innerHTML = `<input class="input" id="rh-video-${idx}" dir="ltr" value="" placeholder="https://youtube.com/…" style="flex:1"><button type="button" class="icon-btn danger" onclick="this.closest('.field-row').remove();renumberRHVideos()" title="إزالة الرابط">✕</button>`;
  list.appendChild(row);
  row.querySelector('input').focus();
}
function renumberRHVideos() {
  const list = $('#rh-videos-list');
  if (!list) return;
  list.querySelectorAll('.field-row').forEach((r, i) => {
    r.id = 'rh-vid-row-' + i;
    const inp = r.querySelector('input');
    if (inp) inp.id = 'rh-video-' + i;
  });
}
function collectRHVideoUrls() {
  const list = $('#rh-videos-list');
  if (!list) return [];
  const urls = [];
  list.querySelectorAll('input[id^="rh-video-"]').forEach((inp) => {
    const v = (inp.value || '').trim();
    if (v) urls.push(v);
  });
  return urls;
}

async function saveRecurringHabit(id) {
  const title = ($('#rh-title').value || '').trim();
  if (!title) return showToast('أدخل اسم العادة', 'bad');
  const days = [...document.querySelectorAll('input[name="rh-day"]:checked')].map((c) => Number(c.value));
  if (!days.length) return showToast('اختر يومًا مسموحًا واحدًا على الأقل', 'bad');
  const goal_id = $('#rh-goal').value ? Number($('#rh-goal').value) : null;
  const video_urls = collectRHVideoUrls();
  try {
    await apiSend('PUT', '/api/habits/' + id, {
      title,
      notes: ($('#rh-notes').value || '').trim(),
      video_url: video_urls[0] || '',
      video_urls: video_urls,
      minutes: Math.max(1, parseInt($('#rh-minutes').value) || 20),
      weeks: Math.max(1, parseInt($('#rh-weeks').value) || 12),
      allowed_days: days,
      goal_id
    });
    closeModal();
    play('success');
    showToast('حُفظت العادة');
    if (state.page === 'journal') await renderJournal();
    else if (state.page === 'vision') await renderVision();
    else if (state.page === 'stats') await renderStats();
  } catch (e) { showToast(e.message, 'bad'); }
}

function clarityYearsLabel(g) {
  return `السنوات ${g.years && g.years.length ? g.years.join('–') : g.year} · مدة ${g.duration_years} ${g.duration_years == 1 ? 'سنة' : 'سنوات'}`;
}

/* فتح/طي صف في قسم الأهداف (الجدول الذي يليه هو الـ clx-body) */
function toggleClx(el) {
  const body = el.nextElementSibling;
  if (!body || !body.classList.contains('clx-body')) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  el.classList.toggle('open', !open);
}

/* قسم التوزيع: توزيع فروع كل هدف على السنين — الأولوية تحدد الترتيب والمدة تحدد مدى التغطية */
function openProjectForGoal(goalId) {
  openProjectModal(null, null, goalId);
}

async function saveVisionField(field, inputId) {
  const val = $('#' + inputId).value;
  try {
    const updates = {};
    updates[field] = val;
    NoorStore.updateSettings(updates);
    state.settings = NoorStore.getSettings();
    play('success');
    showToast('تم الحفظ');
  } catch (err) { showToast(err.message, 'bad'); }
}

/* إعادة عرض محتوى النظرة في صفحتها المستقلة */
async function refreshOverview() {
  if (state.page === 'vision') await renderVision();
}

function openNoteModal() {
  openModal('فكرة جديدة', `
    <div class="field"><label>الفكرة</label><textarea class="input" id="nt-text" rows="3" placeholder="أي فكرة أو رغبة تخص أهدافك"></textarea></div>
    <div class="modal-actions">
      <button class="btn" onclick="saveNote()">إضافة</button>
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>`);
}

async function saveNote() {
  const text = $('#nt-text').value.trim();
  if (!text) return showToast('اكتب الفكرة', 'bad');
  try {
    NoorStore.addNote(text);
    closeModal();
    play('success');
    showToast('أُضيفت الفكرة');
    await refreshOverview();
  } catch (err) { showToast(err.message, 'bad'); }
}

async function archiveNoteItem(id) {
  if (!confirm('حذف هذه الفكرة؟')) return;
  try {
    play('tick');
    NoorStore.archiveNote(id);
    await refreshOverview();
  } catch (err) { showToast(err.message, 'bad'); }
}

async function addIdeaNow() {
  const inp = $('#idea-input');
  if (!inp) return;
  const text = inp.value.trim();
  if (!text) return showToast('اكتب الفكرة أولاً', 'bad');
  try {
    NoorStore.addNote(text);
    play('success');
    showToast('أُضيفت الفكرة');
    await refreshOverview();
  } catch (err) { showToast(err.message, 'bad'); }
}

/* ===== التدوين الشامل ===== */
const POST_SPACES = [
  { key: 'awareness',   icon: '🧠', color: '#4A7C59', title: 'مساحة الوعي الذاتي',   desc: 'مشاعرك، أهدافك، قراراتك، ويومياتك — لتفريغ الضغط النفسي وفهم الذات', placeholder: 'كيف أشعر الآن؟ ماذا أريد؟ أي قرار أفكر فيه؟',
    types: [ { key: 'feel', icon: '💭', title: 'مشاعر' }, { key: 'goal', icon: '🎯', title: 'أهداف' }, { key: 'decide', icon: '⚖️', title: 'قرارات' }, { key: 'diary', icon: '📔', title: 'يوميات' } ] },
  { key: 'projects',    icon: '📚', color: NOOR_ACCENT, title: 'مساحة المشاريع',        desc: 'خطوات أي عمل يطول تنفيذه (كورس، رحلة، وظيفة) مع تتبع الإنجاز', placeholder: 'مثال: كورس لغة، رحلة علمية، وظيفة جديدة…',
    types: [ { key: 'course', icon: '🎓', title: 'كورس' }, { key: 'trip', icon: '✈️', title: 'رحلة' }, { key: 'job', icon: '🏢', title: 'وظيفة جديدة' } ] },
  { key: 'knowledge',   icon: '📖', color: '#8A5A9E', title: 'مساحة تجميع المعرفة',   desc: 'خلاصة ما تتعلمه من الكتب والفيديوهات والتجارب للرجوع إليه سريعًا', placeholder: 'خلاصة كتاب، درس من فيديو، تجربة حياتية…',
    types: [ { key: 'book', icon: '📕', title: 'كتب' }, { key: 'video', icon: '🎬', title: 'فيديوهات' }, { key: 'exp', icon: '🧭', title: 'تجارب حياتية' } ] }
];

function loadSpaceTypes() {
  try { return JSON.parse(localStorage.getItem('noor.spaceTypes') || '{}'); } catch (e) { return {}; }
}

function getSpaceTypes(space) {
  const saved = loadSpaceTypes()[space];
  if (saved && Array.isArray(saved) && saved.length) return saved;
  const m = POST_SPACES.find((x) => x.key === space);
  return m ? m.types : [];
}

function jTypeIcon(space, sub) {
  const t = getSpaceTypes(space).find((x) => x.key === sub);
  return t ? t.icon : (POST_SPACES.find((x) => x.key === space) || {}).icon || '📖';
}

function jTypeTitle(space, sub) {
  const t = getSpaceTypes(space).find((x) => x.key === sub);
  return t ? t.title : '';
}

function typeOptions(space, sel) {
  const types = getSpaceTypes(space);
  const def = types.length ? types[0].key : '';
  return types.map((t) => `<option value="${esc(t.key)}"${t.key === (sel || def) ? ' selected' : ''}>${esc(t.icon)} ${esc(t.title)}</option>`).join('');
}

let journalMode = 'sections';
function setJournalMode(m) {
  journalMode = m;
  if (state.page === 'journal') renderJournal().catch(function (e) { showToast('خطأ: ' + e.message, 'bad'); console.error(e); });
}

let journalSpace = null;
let journalSub = null;
function setJournalSpace(k) {
  journalSpace = k;
  journalSub = null;
  if (state.page === 'journal') renderJournal().catch(function (e) { showToast('خطأ في التنقل: ' + e.message, 'bad'); console.error(e); });
}

function setJournalSub(k) {
  journalSub = k;
  if (state.page === 'journal') renderJournal().catch(function (e) { showToast('خطأ في التنقل: ' + e.message, 'bad'); console.error(e); });
}

function isDailyPost(p) {
  return !!p && p.space === 'awareness' && p.sub === 'diary' && String(p.title || '').startsWith('يوميات ');
}
function isExpPost(p) {
  return !!p && p.space === 'knowledge' && p.sub === 'exp' && String(p.title || '').startsWith('تجارب ');
}

function renderDailyPostHTML(p) {
  if (!isDailyPost(p)) return '';
  const answers = parseDailyText(p.text);
  let html = '';
  DAILY_SECTIONS.forEach((s) => {
    const v = (answers[s.key] || '').trim();
    if (!v) return;
    html += `
      <div class="dj-preview">
        <div class="dj-preview-head">${s.icon} ${s.title}</div>
        <ul class="dj-qs">${s.qs.map((q) => `<li>${esc(q)}</li>`).join('')}</ul>
        <div class="dj-preview-ans">${esc(v)}</div>
      </div>`;
  });
  return html || '<p class="count">لا إجابات مكتوبة بعد.</p>';
}

function renderExpPostHTML(p) {
  if (!isExpPost(p)) return '';
  const answers = parseDailyText(p.text);
  let html = '';
  DAILY_EXP_SECTIONS.forEach((s) => {
    const v = (answers[s.key] || '').trim();
    if (!v) return;
    html += `
      <div class="dj-preview">
        <div class="dj-preview-head">${s.title}</div>
        <div class="dj-preview-ans">${esc(v)}</div>
      </div>`;
  });
  return html || '<p class="count">لا إجابات مكتوبة بعد.</p>';
}

function postBodyHTML(p) {
  const guided = renderDailyPostHTML(p) || renderExpPostHTML(p);
  if (guided) return `<div class="dj-scroll">${guided}</div>`;
  return p.text ? `<div class="post-detail-text">${esc(p.text)}</div>` : '<p class="count">لا يوجد نص مكتوب.</p>';
}

/* ===== اليوميات: أسئلة مرشدة يومية ===== */
const DAILY_SECTIONS = [
  { key: 'core',    icon: '🔑', title: 'الأسئلة الأساسية', qs: ['كيف كان يومي بشكل عام؟ صِفه بجملة أو جملتين.', 'ما أهم حدث وقع اليوم، ولماذا كان الأهم؟', 'ما الشعور الغالب علي اليوم، ومن أين جاء؟', 'ما الفكرة التي شغلت بالي أكثر من غيرها؟', 'جملة واحدة تلخص يومي بأكمله.'] },
  { key: 'moment',  icon: '📸', title: 'لحظة اليوم / الصورة', qs: ['هل حدث اليوم موقف أو منظر أو جملة سمعتها تركت أثرًا فيّ؟ صفه بالتفصيل.', 'لو التقطت صورة واحدة تلخص يومي، ماذا ستكون؟', 'ما الذي رأيته أو سمعته اليوم وبقي عالقًا في ذهني؟'] },
  { key: 'feel',    icon: '❤️', title: 'المشاعر', qs: ['هل شعرت بالفرح اليوم؟ ما الذي أثاره تحديدًا؟', 'هل شعرت بالقلق أو التوتر؟ من أين جاء هذا الشعور؟', 'ما شعور لم أتوقع أن أشعر به اليوم؟', 'لو كان يومي لونًا، أي لون سيكون ولماذا؟', 'هل عبّرت عن مشاعري لأحد اليوم أم احتفظت بها لنفسي؟'] },
  { key: 'think',   icon: '💭', title: 'الأفكار والتأملات', qs: ['هل تعلمت شيئًا جديدًا اليوم عن نفسي أو عن العالم؟', 'ما سؤال يدور في ذهني الآن ولم أجد له جوابًا بعد؟', 'هل غيّرت رأيي في شيء ما اليوم؟', 'ما الفكرة التي أتمنى لو توقفت عندها أكثر؟'] },
  { key: 'mem',     icon: '🧠', title: 'الذكريات', qs: ['هل ذكّرني شيء اليوم بذكرى قديمة؟ ولماذا عادت الآن؟', 'من الشخص الذي فكرت فيه اليوم دون سبب واضح؟', 'لو قارنت هذا اليوم بيوم مشابه في الماضي، ما الذي تغيّر فيّ؟'] },
  { key: 'grat',    icon: '🙏', title: 'الامتنان', qs: ['ما ثلاثة أشياء — كبيرة أو صغيرة — أشعر بالامتنان لها اليوم؟', 'من الشخص الذي جعل يومي أفضل، وكيف؟', 'ما أمر بسيط مررت به دون أن أنتبه لقيمته؟'] },
  { key: 'grow',    icon: '🌱', title: 'النمو والدروس', qs: ['ما الدرس أو النصيحة التي أعطيتها لنفسي اليوم؟', 'لو استطعت تغيير تصرف واحد قمت به اليوم، ماذا سيكون؟', 'ما الذي أفخر بأنني فعلته اليوم مهما كان صغيرًا؟', 'هل واجهت خوفًا أو ترددًا اليوم؟ كيف تعاملت معه؟'] },
  { key: 'people',  icon: '👥', title: 'الناس من حولي', qs: ['من قابلت اليوم وترك أثرًا في نفسي ولو بسيطًا؟', 'هل كانت هناك محادثة اليوم ما زالت تتردد في ذهني؟', 'هل قلت أو فعلت شيئًا اليوم أتمنى لو غيّرته مع أحدهم؟'] },
  { key: 'night',   icon: '🌙', title: 'لختام اليوم', qs: ['ما الذي أتطلع إليه غدًا؟', 'كيف أريد أن أشعر عندما أستيقظ غدًا؟', 'ماذا أريد أن أتذكر من هذا اليوم بعد سنوات؟'] }
];

const DAILY_EXP_SECTIONS = [
  { key: 'new',      title: 'تجارب جديدة', desc: 'ما جرّبته لأول مرة أو خرجت فيه عن الروتين' },
  { key: 'lessons',  title: 'دروس من المواقف والأخطاء', desc: 'ماذا تعلمت من خطأ أو موقف' },
  { key: 'people',   title: 'ملاحظات عن الناس من حولي', desc: 'تصرفاتهم وردود أفعالهم' },
  { key: 'patterns', title: 'الأنماط المتكررة', desc: 'ما يتكرر في نفسي أو في من حولي' },
  { key: 'scenes',   title: 'مشاهد ومواقف كشفت لي شيئًا', desc: 'دروس في التعامل مع الحياة والناس' },
  { key: 'words',    title: 'الكلمات وأسلوب الحديث', desc: 'تعابير وطرق كلام لافتة' },
  { key: 'follow',   title: 'تصرفات أقتدي بها', desc: 'صفات وسلوكيات أعجبتني عند الآخرين' },
  { key: 'avoid',    title: 'تصرفات أتجنبها', desc: 'ما لا أريد تكراره بعد رؤية أثره' }
];

function parseDailyText(text) {
  const map = {};
  if (!text) return map;
  let cur = null;
  text.split('\n').forEach((line) => {
    const m = /^@([\w-]+)@$/.exec(line.trim());
    if (m) { cur = m[1]; map[cur] = ''; return; }
    if (cur) map[cur] = (map[cur] ? map[cur] + '\n' : '') + line;
  });
  return map;
}

function openPostDetails(id) {
  const p = NoorStore.getPostAny(id);
  if (!p) return showToast('التدوينة غير موجودة', 'bad');
  const m = POST_SPACES.find((x) => x.key === p.space) || {};
  const isProj = p.space === 'projects';
  const isLib = p.space === 'knowledge';
  const total = p.steps.length;
  const done = p.steps.filter((s) => s.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const date = fmtDateAr(String(p.updated_at || p.created_at || '').split('T')[0]);
  const libHead = isLib && p.sub !== 'exp' ? `
    <div class="lib-detail">
      ${p.cover ? `<div class="lib-detail-cover"><img src="${cachedCover(p.cover)}" alt="" loading="lazy" onerror="this.closest('.lib-detail-cover').style.display='none'"></div>` : ''}
      <div class="lib-detail-body">
        ${p.author ? `<div class="lib-detail-author">${esc(p.sub === 'video' ? 'الاسم' : 'المؤلف')}: ${esc(p.author)}</div>` : ''}
        ${p.rating > 0 ? `<div class="lib-detail-rating">${starsHTML(p.rating)}</div>` : ''}
      </div>
    </div>` : '';
  openModal(`${m.icon || '📝'} ${esc(p.title)}`, `
    <div class="field" style="flex-direction:row;align-items:center;gap:8px;flex-wrap:wrap">
      ${p.sub ? `<span class="chip jchip">${esc(jTypeIcon(p.space, p.sub))} ${esc(jTypeTitle(p.space, p.sub))}</span>` : ''}
      ${p.completed_at ? '<span class="chip chip-ok">مكتمل ✓</span>' : ''}
      ${p.archived_at ? '<span class="chip chip-auto">أُرشفت 🗄</span>' : ''}
      ${date ? `<span class="count">${date}</span>` : ''}
    </div>
    ${libHead}
    ${postBodyHTML(p)}
    ${isProj ? `
      <div class="jprog big"><div class="an-bar"><span class="an-fill" style="width:${pct}%;background:${m.color || NOOR_ACCENT}"></span></div><span class="gn-val">${done}/${total} خطوة · ${pct}%</span></div>
      <div class="jsteps" id="detail-steps">
        ${p.steps.length ? p.steps.map((s, i) => `
          <label class="jstep${s.done ? ' done' : ''}" style="cursor:pointer">
            <input type="checkbox"${s.done ? ' checked' : ''} onchange="togglePostStep(${p.id},${i})">
            <span class="jstep-text">${esc(s.text)}</span>
            <button class="icon-btn danger" onclick="removePostStep(${p.id},${i})" title="حذف">✕</button>
          </label>`).join('') : '<p class="count">لا خطوات بعد — أضف أول خطوة.</p>'}
      </div>
      <div class="st-add">
        <input class="input" id="js-input" placeholder="خطوة جديدة…" onkeydown="if(event.key==='Enter'){event.preventDefault();addPostStep(${p.id})}">
        <button class="btn" onclick="addPostStep(${p.id})">إضافة خطوة</button>
      </div>` : ''}
    ${p.space === 'commitments' ? `
      <div class="modal-actions">
        <button class="btn" onclick="togglePostDone(${p.id})">${p.completed_at ? '↺ إعادة فتح' : '✓ تم الالتزام'}</button>
      </div>` : ''}
    <div class="modal-actions">
      ${p.archived_at ? '' : `<button class="btn" onclick="closeModal();openJournalModal('${p.space}', ${p.id})">✎ تحرير</button>`}
      <button class="btn btn-ghost" onclick="closeModal()">إغلاق</button>
    </div>`);
}

function openJournalModal(space, id, preSub) {
  const m = POST_SPACES.find((x) => x.key === space) || POST_SPACES[0];
  const p = id ? NoorStore.getPost(id) : null;
  const isLib = space === 'knowledge';
  const initSub = p ? p.sub : (preSub || (getSpaceTypes(space).length ? getSpaceTypes(space)[0].key : ''));
  const mediaFields = isLib ? `<div id="post-media-fields">${knowledgeMediaFields(initSub, p)}</div>` : '';
  openModal(`${p ? 'تحرير تدوينة' : 'تدوينة جديدة'} — ${m.title}`, `
    <input type="hidden" id="post-space" value="${space}">
    <input type="hidden" id="post-id" value="${p ? p.id : ''}">
    <div class="field"><label>القسم</label>
      <select class="input" id="post-sub" onchange="onJournalSubChange()">${typeOptions(space, initSub)}</select>
    </div>
    <div class="field"><label>العنوان</label><input class="input" id="post-title" value="${p ? esc(p.title) : ''}" placeholder="عنوان التدوينة"></div>
    ${mediaFields}
    <div class="field"><label>${isLib ? 'الملخص / المحتوى' : 'التدوين'}</label><textarea class="input" id="post-text" rows="7" placeholder="${esc(m.placeholder)}">${p ? esc(p.text) : ''}</textarea></div>
    <div class="modal-actions">
      <button class="btn" onclick="saveJournalPost()">حفظ</button>
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>`);
}

/* حقول الوسائط (مؤلف/تقييم/غلاف) تظهر للكتب والفيديوهات فقط — التجارب مجرد كتابة */
function knowledgeMediaFields(sub, p) {
  if (sub !== 'book' && sub !== 'video') return '';
  const isVideo = sub === 'video';
  return `
    <div class="field-row">
      <div class="field"><label>${isVideo ? 'الاسم' : 'المؤلف'}</label><input class="input" id="post-author" value="${p ? esc(p.author) : ''}" placeholder="${isVideo ? 'القناة / المتحدث' : 'اسم المؤلف'}"></div>
      <div class="field"><label>التقييم (من 5 نجوم)</label>${starInputHTML(p ? p.rating : 0)}</div>
    </div>
    <div class="field"><label>صورة الغلاف (اختياري)</label>
      <div class="field-row" style="align-items:center;gap:10px">
        <input type="file" id="post-cover-file" accept="image/*" style="display:none" onchange="handleCoverFile(this,'post-cover')">
        <button class="btn btn-xs" onclick="$('#post-cover-file').click()">📂 صورة من الجهاز</button>
        <input class="input" id="post-cover" value="${p ? esc(p.cover) : ''}" placeholder="أو رابط صورة" dir="ltr" style="flex:1">
      </div>
    </div>`;
}

function onJournalSubChange() {
  const sub = $('#post-sub').value;
  const idEl = $('#post-id');
  const p = idEl && idEl.value ? NoorStore.getPost(Number(idEl.value)) : null;
  const el = $('#post-media-fields');
  if (el) el.innerHTML = knowledgeMediaFields(sub, p);
}

async function saveJournalPost() {
  const idEl = $('#post-id');
  const id = idEl && idEl.value ? Number(idEl.value) : null;
  const space = $('#post-space').value;
  const title = $('#post-title').value.trim();
  const text = $('#post-text').value.trim();
  if (!title) return showToast('عنوان التدوينة مطلوب', 'bad');
  const subEl = $('#post-sub');
  const sub = subEl ? subEl.value : null;
  try {
    const data = { space, title, text };
    if (sub) data.sub = sub;
    if ($('#post-cover')) data.cover = $('#post-cover').value.trim();
    if ($('#post-author')) data.author = $('#post-author').value.trim();
    if ($('#star-val')) data.rating = Number($('#star-val').value || 0);
    if (id) NoorStore.updatePost(id, data);
    else NoorStore.addPost(data);
    closeModal();
    play('success');
    showToast('تم حفظ التدوينة');
    if (state.page === 'journal') await renderJournal();
  } catch (err) { showToast(err.message, 'bad'); }
}

async function togglePostDone(id) {
  const p = NoorStore.getPost(id);
  if (!p) return;
  try {
    NoorStore.updatePost(id, { completed_at: !p.completed_at });
    play(!p.completed_at ? 'success' : 'tick');
    if (state.page === 'journal') await renderJournal();
    openPostDetails(id);
  } catch (err) { showToast(err.message, 'bad'); }
}

async function addPostStep(id) {
  const inp = $('#js-input');
  const text = (inp && inp.value.trim()) || '';
  if (!text) return showToast('اكتب الخطوة', 'bad');
  try {
    const p = NoorStore.getPost(id);
    const steps = (p.steps || []).concat([{ text, done: false }]);
    NoorStore.updatePost(id, { steps });
    play('success');
    openPostDetails(id);
    if (state.page === 'journal') await renderJournal();
  } catch (err) { showToast(err.message, 'bad'); }
}

async function togglePostStep(id, idx) {
  try {
    const p = NoorStore.getPost(id);
    const steps = (p.steps || []).map((s, i) => (i === idx ? Object.assign({}, s, { done: !s.done }) : s));
    NoorStore.updatePost(id, { steps });
    play(steps[idx].done ? 'success' : 'tick');
    openPostDetails(id);
    if (state.page === 'journal') await renderJournal();
  } catch (err) { showToast(err.message, 'bad'); }
}

async function removePostStep(id, idx) {
  try {
    const p = NoorStore.getPost(id);
    const steps = (p.steps || []).map((s, i) => i === idx ? Object.assign({}, s, { archived: true }) : s);
    NoorStore.updatePost(id, { steps });
    play('tick');
    openPostDetails(id);
    if (state.page === 'journal') await renderJournal();
  } catch (err) { showToast(err.message, 'bad'); }
}

/* ===== الإعدادات ===== */
async function openSettings() {
  const s = NoorStore.getSettings();
  const goals = NoorStore.getGoals();
  const life = NoorStore.hasLifePlan() ? `بدأت الرحلة في ${fmtDateAr(NoorStore.lifeStart())} — السنة الآن ${NoorStore.yearIndex(NoorStore.todayStr())}` : 'لم تبدأ الرحلة بعد — ابدأ بأهداف حياتك من صفحة المهام';
  const curFreeze = NoorStore.freezeInfo();
  
  // محرر الهرم حسب السنة المختارة (يملأ renderHierarchy الحاوية #hier-body)
  const planYears = Math.max(1, Math.round(Number(s.plan_years) || 20));
  const selYear = Math.max(1, Math.min(Math.round(Number(state.yearSel) || 1), Math.max(planYears, NoorStore.yearIndex(NoorStore.todayStr()))));

  openModal('الإعدادات', `
    <div class="settings-zone">
      <h4>أهداف الحياة والهرم</h4>
      <p class="count">${esc(life)} · السنة = ${NoorStore.yearWeeks()} أسبوعًا</p>
      <div class="zone-actions">
        <select class="input" id="hier-year" style="width:auto" onchange="renderHierarchy()">
          ${Array.from({ length: planYears }, (_, i) => i + 1).map((y) => `<option value="${y}" ${y === selYear ? 'selected' : ''}>السنة ${y}</option>`).join('')}
        </select>
        <button class="btn btn-sm" onclick="openGoalModalForYear(Number($('#hier-year').value))">+ هدف جديد لهذه السنة</button>
      </div>
      <div class="hierarchy-settings" id="hier-body"></div>
    </div>
    <hr>
    <div class="settings-grid">
      <div class="field"><label>أسابيع السنة (توزيع الأهداف)</label><input class="input" id="s-year-weeks" type="number" min="4" max="52" value="${+s.year_weeks}"></div>
      <div class="field"><label>الهدف الأسبوعي (ساعات)</label><input class="input" id="s-weekly" type="number" min="1" step="0.5" value="${(+s.weekly_target_min / 60).toFixed(1)}"></div>
      <div class="field"><label>الهدف اليومي (ساعات)</label><input class="input" id="s-daily" type="number" min="0.5" step="0.5" value="${(+s.daily_target_min / 60).toFixed(1)}"></div>
      <div class="field"><label>نسبة اليوم المنجز (%)</label><input class="input" id="s-daily-thr" type="number" min="1" max="100" value="${+s.daily_threshold}"></div>
      <div class="field"><label>نسبة المكافأة الأسبوعية (من إنجاز المهام %)</label><input class="input" id="s-reward" type="number" min="1" max="100" value="${+s.reward_threshold}"></div>
      <div class="field"><label>مدة بومودورو (دقائق)</label><input class="input" id="s-pomodoro" type="number" min="1" value="${+s.pomodoro_min}"></div>
      <div class="field"><label>الاستراحة القصيرة (دقائق)</label><input class="input" id="s-short" type="number" min="1" value="${+s.short_break_min}"></div>
      <div class="field"><label>الاستراحة الطويلة (دقائق)</label><input class="input" id="s-long" type="number" min="1" value="${+s.long_break_min}"></div>
      <div class="field"><label>بومودورو قبل الاستراحة الطويلة</label><input class="input" id="s-cycles" type="number" min="1" value="${+s.cycles_per_long}"></div>
      <div class="field"><label>🌴 يوم العطلة الدوري (كل كم يوم؟ 0=معطل)</label><input class="input" id="s-rest-every" type="number" min="0" max="30" value="${+s.rest_day_every}"></div>
      <div class="field" style="grid-column:1/-1"><label>أفق التخطيط (عدد سنوات)</label><input class="input" id="s-plan-years" type="number" min="1" max="50" value="${+s.plan_years}"></div>
      <div class="field" style="grid-column:1/-1"><label>من أنا</label><textarea class="input" id="s-who" rows="2">${esc(s.who_am_i)}</textarea></div>
      <div class="field" style="grid-column:1/-1"><label>المنظور</label><textarea class="input" id="s-vision" rows="2">${esc(s.vision)}</textarea></div>
      <div class="field" style="grid-column:1/-1"><label>القيم</label><textarea class="input" id="s-values" rows="2">${esc(s.values)}</textarea></div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="saveSettings()">حفظ الإعدادات</button>
    </div>
    <hr>
    <div class="settings-zone">
      <h4>كسر الحواجز — عناصر «كسر الحدود»</h4>
      <p class="count">كل 3 أيام عمل يظهر تحدي «كسر الحدود» ليومٍ واحد فقط، ويُختار عنصره بالتسلسل من هذه القائمة (يرجع للأول بعد الأخيرة). إن لم تُنجزه في يومه يعود معك في الدورة التالية.</p>
      <div class="zone-actions">
        <input class="input" id="bar-title" placeholder="مثال: التحدث بجرأة" style="flex:1;min-width:150px">
        <input class="input" id="bar-category" placeholder="فئة (اختياري)" style="width:110px">
        <button class="btn btn-sm" onclick="addBarrierTask()">+ إضافة</button>
      </div>
      <div id="barrier-zone"></div>
    </div>
    <hr>
    <div class="settings-zone">
      <h4>كسر الحواجز — المهام التي تُكسر فيها الحدود</h4>
      <p class="count">يختار النظام مهمة مختلفة من هذه القائمة يوم كسر الحدود (بالتسلسل الدائري دون تكرار فوري) وتظهر مع مهام اليوم.</p>
      <div class="zone-actions">
        <input class="input" id="bar-host-title" placeholder="مثال: تحدث باللغة الإنجليزية" style="flex:1;min-width:150px">
        <button class="btn btn-sm" onclick="addBarrierHost()">+ إضافة</button>
      </div>
      <div id="barrier-host-zone"></div>
    </div>
    <hr>
    <div class="settings-zone">
      <h4>🧱 مرحلة التأسيس (وضع الجمود)</h4>
      <p class="count">فترة تملأ فيها النظام بأهدافك وقيمك وعاداتك وروتينك — لا تُحتسب أيامها ضمن تتبّع الإنجاز، ويبدأ الاحتساب فعليًا بعد انتهائها. اضغط لتحديد المدة.</p>
      <div class="field" style="grid-column:1/-1;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="s-freeze-on" ${curFreeze ? 'checked' : ''}> تفعيل مرحلة التأسيس</label>
        <span class="count">المدة (بالأيام):</span>
        <input class="input" id="s-freeze-days" type="number" min="1" max="365" style="width:90px" value="${curFreeze ? curFreeze.days : 14}">
        ${curFreeze ? `<span class="tag gold">متبقٍ ${NoorStore.freezeRemaining(NoorStore.todayStr())} يومًا (حتى ${fmtDateAr(curFreeze.end)})</span>` : ''}
      </div>
      <div class="zone-actions">
        <button class="btn btn-sm btn-ghost" onclick="openFreezeQuick()">⚡ ضبط سريع: 14 / 30 / 90 يومًا</button>
        ${curFreeze ? `<button class="btn btn-sm btn-ghost" onclick="stopFreeze()">⏹ إنهاء مرحلة التأسيس الآن</button>` : ''}
      </div>
    </div>
    <hr>
    <div class="settings-zone">
      <h4>💾 البيانات والنسخ الاحتياطي</h4>
      <div style="margin-bottom:10px;display:flex;align-items:center;gap:10px">
        <span class="count">النسخ الاحتياطي التلقائي على السيرفر:</span>
        <button class="btn btn-sm btn-ghost" id="auto-backup-btn" onclick="toggleAutoBackup()">جاري التحقق…</button>
        <span class="count" id="auto-backup-status"></span>
      </div>
      <div class="zone-actions">
        <button class="btn btn-ghost" onclick="downloadBackup()">↓ تحميل نسخة</button>
        <button class="btn btn-ghost" onclick="document.getElementById('restore-file').click()">↑ استعادة نسخة</button>
        <input type="file" id="restore-file" accept="application/json" class="hidden" onchange="doRestore(event)">
        <button class="btn btn-ghost" onclick="doArchiveAll()">📦 أرشفة شاملة (تحمّل نسخة + أرشفة)</button>
        <button class="btn btn-danger" onclick="doReset()">⟲ إعادة ضبط الإعدادات فقط</button>
      </div>
    </div>
    <hr>
    <div class="settings-zone reset-zone" style="border:var(--border-w-strong) solid var(--danger);background:var(--red-soft)">
      <h4 style="color:var(--danger);display:flex;align-items:center;gap:8px">⚠️ <span>إعادة ضبط المصنع (Factory Reset)</span></h4>
      <p class="count" style="color:var(--ink-3);margin-bottom:12px">
        <strong>هذا الإجراء لا يُلغى:</strong> يحذف <u>كل شيء</u> — المشاريع، المهام، الأرشيف، اليوميات، المشاعر، القرارات، التجارب، العادات، الأهداف، القيم، إعدادات المؤقت، كل شيء.
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <label style="display:flex;align-items:center;gap:6px;font-size:var(--fs-sm)"><input type="checkbox" id="reset-confirm-backup"> أخذ نسخة احتياطية كاملة قبل الحذف (مُوصى به بشدة)</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:var(--fs-sm)"><input type="checkbox" id="reset-confirm-download"> تحميل النسخة كملف JSON على جهازك</label>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <label style="display:flex;align-items:center;gap:6px;font-size:var(--fs-sm);color:var(--danger)"><input type="checkbox" id="reset-confirm-final" required> <strong>أفهم تماماً — احذف كل بياناتي نهائياً</strong></label>
      </div>
      <div class="zone-actions">
        <button class="btn btn-danger" id="factory-reset-btn" onclick="factoryReset()" disabled style="opacity:0.5">🗑️ تنفيذ إعادة ضبط المصنع</button>
      </div>
      <p class="count" style="margin-top:8px;font-size:var(--fs-xs)">✅ ضع علامة على كل مربعات التأكيد أعلاه لتفعيل الزر</p>
    </div>`);
  renderHierarchy();
  renderBarrierZone();
  renderBarrierHostZone();
  loadBackupStatus();
  /* مستمعي التأكيد لإعادة ضبط المصنع */
  ['reset-confirm-backup', 'reset-confirm-download', 'reset-confirm-final'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', factoryResetUIUpdate);
  });
  factoryResetUIUpdate();
}

/* ===== عرض هرم السنة المختارة داخل الإعدادات ===== */
function renderHierarchy() {
  const body = $('#hier-body');
  if (!body) return;
  const year = Math.max(1, Math.round(Number($('#hier-year')?.value)) || 1);
  const goals = NoorStore.getGoals().filter((g) => g.year === year);
  let html = '';
  for (const g of goals) {
    const subs = NoorStore.getSubgoals(g.id);
    let subHtml = '';
    if (subs.length) {
      for (const sub of subs) {
        const habits = NoorStore.getHabits({ subgoal_id: sub.id });
        const projects = NoorStore.getProjects().filter((p) => p.subgoal_id === sub.id);
        let itemsHtml = '';
        if (habits.length) {
          itemsHtml += habits.map((h) => `
            <div class="settings-item habit">
              <span class="item-type">${esc(h.icon || '●')}</span>
              <span class="item-title">${esc(h.title)}</span>
              <span class="item-meta">${h.minutes} د · أسبوع ${h.week}${h.weeks > 1 ? `-${h.week + h.weeks - 1}` : ''}</span>
              <div class="item-actions">
                <button class="icon-btn" onclick="openHabitModal(${sub.id}, ${h.id})">✎</button>
                <button class="icon-btn danger" onclick="archiveHabitItem(${h.id})">✕</button>
              </div>
            </div>`).join('');
        }
        if (projects.length) {
          itemsHtml += projects.map((p) => `
            <div class="settings-item project">
              <span class="item-type">${esc(projectType(p.type).icon)}</span>
              <span class="item-title">${esc(p.name)}${p.type !== 'عام' ? ` <span class="chip chip-xs">${esc(projectType(p.type).title)}</span>` : ''}${p.rating > 0 ? ' ' + starsHTML(p.rating) : ''}</span>
              <span class="item-meta">أسبوع ${p.week}${p.weeks > 1 ? `-${p.week + p.weeks - 1}` : ''} · ${p.project_tasks_count} مهمة · أولوية ${p.priority}</span>
              <div class="item-actions">
                <button class="icon-btn" onclick="openProjectTasksModal(${p.id})" title="مهام المشروع">☰</button>
                <button class="icon-btn" onclick="openProjectModal(${p.id})">✎</button>
                <button class="icon-btn danger" onclick="archiveProject(${p.id})">✕</button>
              </div>
            </div>`).join('');
        }
        subHtml += `
          <div class="settings-subgoal open">
            <div class="subgoal-header" onclick="this.parentElement.classList.toggle('open')">
              <span class="subgoal-toggle">▼</span>
              <span class="subgoal-title">${esc(sub.title)}</span>
              <span class="subgoal-meta">أسبوع ${sub.week} · ${habits.length} عادة · ${projects.length} مشروع</span>
              <div class="subgoal-actions" onclick="event.stopPropagation()">
                <button class="icon-btn" onclick="openSubgoalModal(${g.id}, ${sub.id})">✎</button>
                <button class="icon-btn danger" onclick="archiveSubgoalItem(${sub.id})">✕</button>
              </div>
            </div>
            <div class="subgoal-items">${itemsHtml || '<p class="count">لا عادات أو مشاريع بعد</p>'}</div>
            <div class="subgoal-add">
              <button class="btn btn-xs" onclick="openHabitModal(${sub.id})">+ عادة</button>
              <button class="btn btn-xs" onclick="openProjectModal(null, ${sub.id})">+ مشروع</button>
            </div>
          </div>`;
      }
    }
    html += `
      <div class="settings-goal open">
        <div class="goal-header" onclick="this.parentElement.classList.toggle('open')">
          <span class="goal-toggle">▼</span>
          <span class="goal-ic small" style="background:${esc(g.color) || NOOR_ACCENT}">${esc(g.icon || '◎')}</span>
          <span class="goal-title">${esc(g.title)}</span>
          <span class="goal-meta">سنة ${g.year} · ${subs.length} مجموعة</span>
          <div class="goal-actions" onclick="event.stopPropagation()">
            <button class="icon-btn" onclick="openGoalModal(${g.id})">✎</button>
            <button class="icon-btn danger" onclick="archiveGoalItem(${g.id})">✕</button>
          </div>
        </div>
        <div class="goal-subgoals">${subHtml || '<p class="count">لا مهام فرعية بعد — أضف أول مشروع فرعي</p>'}</div>
        <div class="goal-add">
          <button class="btn btn-xs" onclick="openProjectForGoal(${g.id})">+ مهمة فرعية (مشروع كامل)</button>
          <button class="btn btn-xs" onclick="openProjectForGoal(${g.id})">+ مشروع مباشر</button>
        </div>
      </div>`;
  }
  body.innerHTML = html || '<p class="count">لا أهداف لهذه السنة — أضف هدفًا جديدًا من الأعلى.</p>';
}

async function saveSettings() {
  try {
    NoorStore.updateSettings({
      year_weeks: Math.min(52, Math.max(4, parseInt($('#s-year-weeks').value) || 52)),
      weekly_target_min: Math.round((parseFloat($('#s-weekly').value) || 20) * 60),
      daily_target_min: Math.round((parseFloat($('#s-daily').value) || 3) * 60),
      daily_threshold: Math.min(100, Math.max(1, parseInt($('#s-daily-thr').value) || 50)),
      reward_threshold: Math.min(100, Math.max(1, parseInt($('#s-reward').value) || 80)),
      pomodoro_min: Math.max(1, parseInt($('#s-pomodoro').value) || 25),
      short_break_min: Math.max(1, parseInt($('#s-short').value) || 5),
      long_break_min: Math.max(1, parseInt($('#s-long').value) || 15),
      cycles_per_long: Math.max(1, parseInt($('#s-cycles').value) || 4),
      rest_day_every: Math.min(30, Math.max(0, parseInt($('#s-rest-every') ? $('#s-rest-every').value : 0) || 0)),
      plan_years: Math.min(50, Math.max(1, parseInt($('#s-plan-years').value) || 20)),
      who_am_i: $('#s-who').value,
      vision: $('#s-vision').value,
      values: $('#s-values').value
    });
    /* وضع التأسيس (الجمود): عند التفعيل يبدأ من اليوم ولا تُحتسب أيامه ضمن التتبع */
    try {
      const fOn = !!(document.getElementById('s-freeze-on') && document.getElementById('s-freeze-on').checked);
      const fDays = Math.max(0, Math.round(parseInt((document.getElementById('s-freeze-days') || {}).value || 0) || 0));
      const curF = NoorStore.freezeInfo();
      let fStart = curF ? curF.start : '';
      if (fOn && fDays > 0) {
        if (!curF || !NoorStore.inFreeze(NoorStore.todayStr())) fStart = NoorStore.todayStr();
      } else { fStart = ''; }
      NoorStore.updateSettings({ freeze_start: fStart, freeze_days: (fOn && fDays > 0) ? fDays : 0 });
    } catch (e) {}
    state.settings = NoorStore.getSettings();
    closeModal();
    play('success');
    showToast('تم حفظ الإعدادات');
  } catch (err) { showToast(err.message, 'bad'); }
}

/* ===== مرحلة التأسيس (الجمود) ===== */
function openFreezeQuick() {
  openModal('⚡ ضبط مرحلة التأسيس', `
    <p class="count" style="margin-bottom:12px">اختر مدة مرحلة التأسيس — تبدأ من اليوم، ولا تُحتسب أيامها ضمن تتبّع الإنجاز. اصنع فيها أساسك: أهدافك، عاداتك، وروتينك.</p>
    <div class="modal-actions">
      <button class="btn" onclick="applyFreeze(14)">١٤ يومًا</button>
      <button class="btn" onclick="applyFreeze(30)">٣٠ يومًا</button>
      <button class="btn" onclick="applyFreeze(90)">٩٠ يومًا</button>
    </div>`);
}
function applyFreeze(days) {
  NoorStore.updateSettings({ freeze_start: NoorStore.todayStr(), freeze_days: days });
  closeModal(); play('success');
  showToast('بدأت مرحلة التأسيس — ' + days + ' يومًا (لا تُحتسب ضمن التتبع)');
  openSettings(); renderTasks();
}
function stopFreeze() {
  NoorStore.updateSettings({ freeze_start: '', freeze_days: 0 });
  closeModal(); play('tick');
  showToast('انتهت مرحلة التأسيس — بدأ الاحتساب الآن');
  openSettings(); renderTasks();
}

function downloadBackup() {
  const obj = NoorStore.dump();
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'noor-backup-' + todayISO() + '.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
}

async function doRestore(e) {
  const f = e.target.files[0];
  if (!f) return;
  if (!confirm('الاستعادة ستحذف كل البيانات الحالية وتستبدلها بمحتويات الملف. متابعة؟')) return;
  try {
    const obj = JSON.parse(await f.text());
    NoorStore.restore(obj);
    showToast('تمت الاستعادة بنجاح');
    closeModal();
    await go('tasks');
  } catch (err) { showToast('فشلت الاستعادة: ' + err.message, 'bad'); }
}

async function doReset() {
  if (!confirm('سيتم إعادة ضبط الإعدادات فقط — جميع بياناتك (المهام، المشاريع، الأرشيف، اليوميات) ستبقى كما هي.')) return;
  try {
    NoorStore.updateSettings({ timer_mode: 'pomodoro', timer_focus_min: '25', timer_project_id: '', timer_project_sel: '', freeze_start: '', freeze_days: '0', cycles_per_long: '4' });
    showToast('تم إعادة ضبط الإعدادات — بياناتك سليمة');
    closeModal();
    openSettings();
  } catch (err) { showToast(err.message, 'bad'); }
}

/* ===== إعادة ضبط المصنع الاحترافية ===== */
function factoryResetUIUpdate() {
  const backup = $('#reset-confirm-backup');
  const download = $('#reset-confirm-download');
  const final = $('#reset-confirm-final');
  const btn = $('#factory-reset-btn');
  if (backup && download && final && btn) {
    const ready = backup.checked && download.checked && final.checked;
    btn.disabled = !ready;
    btn.style.opacity = ready ? '1' : '0.5';
  }
}

async function factoryReset() {
  const backup = $('#reset-confirm-backup');
  const download = $('#reset-confirm-download');
  const final = $('#reset-confirm-final');
  if (!backup || !download || !final || !backup.checked || !download.checked || !final.checked) {
    return showToast('يجب تأكيد كل الخيارات أولاً', 'bad');
  }
  play('click');
  /* 1) أخذ نسخة احتياطية كاملة */
  const fullBackup = NoorStore.dump();
  const backupData = JSON.stringify(fullBackup, null, 2);
  const backupObj = {
    version: '2.0',
    timestamp: new Date().toISOString(),
    appVersion: 'noor-' + (document.querySelector('script[src*="app.js"]')?.src?.match(/v=(\d+)/)?.[1] || 'unknown'),
    data: fullBackup
  };
  const backupStr = JSON.stringify(backupObj, null, 2);
  /* 2) تحميل الملف تلقائياً */
  if (download.checked) {
    const blob = new Blob([backupStr], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'noor-factory-reset-backup-' + todayISO() + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }
  /* 3) حفظ في localStorage كنسخة "factory-reset-last" للاستعادة السريعة */
  try { localStorage.setItem('noor_factory_reset_backup', backupStr); } catch (e) {}
  /* 4) تنفيذ الحذف الكامل */
  try {
    NoorStore.factoryReset();
    showToast('✅ تمت إعادة ضبط المصنع — النظام فارغ الآن');
    play('success');
  } catch (e) {
    showToast('خطأ أثناء الحذف: ' + e.message, 'bad');
    return;
  }
  closeModal();
  setTimeout(() => { go('tasks'); }, 300);
}

/* استعادة من نسخة إعادة ضبط المصنع */
async function restoreFactoryResetBackup() {
  const raw = localStorage.getItem('noor_factory_reset_backup');
  if (!raw) return showToast('لا توجد نسخة احتياطية من إعادة ضبط المصنع', 'bad');
  if (!confirm('الاستعادة ستحذف كل البيانات الحالية وتستبدلها بنسخة "إعادة ضبط المصنع" الأخيرة. متابعة؟')) return;
  try {
    const obj = JSON.parse(raw);
    if (obj.data) {
      NoorStore.restore(obj.data);
      showToast('✅ تمت استعادة نسخة إعادة ضبط المصنع');
      closeModal();
      await go('tasks');
    } else {
      showToast('صيغة النسخة الاحتياطية غير صالحة', 'bad');
    }
  } catch (e) { showToast('فشلت الاستعادة: ' + e.message, 'bad'); }
}

async function doArchiveAll() {
  if (!confirm('⚠ سيتم أرشفة كل البيانات وتحميل نسخة احتياطية. لن يُحذف شيء — يمكنك استعادته من الأرشيف.')) return;
  if (!confirm('تأكيد أخير: أرشفة شاملة + تحميل نسخة احتياطية؟')) return;
  try {
    const backup = NoorStore.dump();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'noor-backup-' + todayISO() + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    NoorStore.archiveAll();
    showToast('تمت الأرشفة الشاملة — تحمّلت نسخة احتياطية');
    closeModal();
    await go('tasks');
  } catch (err) { showToast(err.message, 'bad'); }
}

async function loadBackupStatus() {
  try {
    const r = await fetch('/api/backup-status');
    const d = await r.json();
    const btn = $('#auto-backup-btn');
    const st = $('#auto-backup-status');
    if (btn) btn.textContent = d.enabled ? 'تعطيل' : 'تفعيل';
    if (st) st.textContent = d.enabled ? '✓ مفعّل — نسخ يومي + كل 12 ساعة' : '✗ معطّل — لا توجد نسخ تلقائية';
  } catch (_) {
    const btn = $('#auto-backup-btn');
    if (btn) btn.textContent = 'غير متاح';
  }
}

async function toggleAutoBackup() {
  try {
    const r = await fetch('/api/backup-toggle', { method: 'POST' });
    const d = await r.json();
    showToast(d.enabled ? 'تم تفعيل النسخ الاحتياطي التلقائي' : 'تم تعطيل النسخ الاحتياطي التلقائي');
    loadBackupStatus();
  } catch (e) { showToast('خطأ في الاتصال بالسيرفر', 'bad'); }
}

/* ===== النافذة العامة ===== */
let _modalReturnFocus = null;
function openModal(title, bodyHtml) {
  play('open');
  try { _modalReturnFocus = document.activeElement; } catch (e) {}
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = bodyHtml;
  $('#modalOverlay').classList.add('open');
  document.documentElement.classList.add('modal-open'); /* قفل تمرير الخلفية */
  const first = $('#modalBody input, #modalBody textarea, #modalBody select');
  if (first) setTimeout(() => first.focus(), 50);
}
function closeModal() {
  /* خطافات الإغلاق: حفظ جلسات القراءة/مسودات اليوميات قبل مسح المحتوى — كل مسارات الخروج تمر من هنا */
  try {
    const hooks = [...modalCloseHooks];
    modalCloseHooks.length = 0;
    for (const h of hooks) if (typeof h === 'function') h();
  } catch (e) {}
  $('#modalOverlay').classList.remove('open');
  document.documentElement.classList.remove('modal-open');
  $('#modalBody').innerHTML = '';
  try { if (_modalReturnFocus && typeof _modalReturnFocus.focus === 'function') _modalReturnFocus.focus(); } catch (e) {}
  _modalReturnFocus = null;
}
const modalCloseHooks = [];

function toggleSidebar() {
  document.body.classList.toggle('hide-sidebar');
  var hidden = document.body.classList.contains('hide-sidebar');
  try { localStorage.setItem('noor_hide_sidebar', hidden ? '1' : '0'); } catch (e) {}
}

/* قفل النافذة الواحدة: نافذتان تكتبان نفس مفاتيح التخزين فتسرقان تعديلات بعضهما —
   أول نافذة تحجز القفل، والثانية تُوقف بلوحة تنبيه بدل أن تدمّر البيانات */
function installTabLock() {
  try {
    if (!navigator.locks || !navigator.locks.request) return;
    navigator.locks.request('noor-single-tab', { ifAvailable: true }, (lock) => {
      if (lock) return new Promise((res) => { window.addEventListener('pagehide', res, { once: true }); });
      const ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#3a2a12;color:#ffd9a0;border-bottom:2px solid #000;padding:10px 14px;font-family:inherit;font-size:13px;display:flex;gap:10px;align-items:center;justify-content:center';
      ov.innerHTML = '<span style="font-size:20px">🔒</span><span><strong>نُور مفتوح في نافذة أخرى</strong> — افتح نافذة واحدة حتى لا تضيع تعديلاتك.</span><button onclick="this.parentNode.remove()" style="margin-inline-start:auto;background:#7a1f1f;color:#fff;border:1px solid #000;padding:4px 10px;cursor:pointer;font-family:inherit">إغلاق التنبيه</button>';
      document.body.appendChild(ov);
      return;
    }).catch(() => {});
  } catch (e) {}
}

/* تبديل إنجاز عادة بسيطة من الشبكة الشهرية في الإحصائيات */
function toggleSimpleHabitDone(habitId, ds, done) {
  try {
    NoorStore.toggleSimpleHabitDone(habitId, ds, done ? 1 : 0);
    play(done ? 'success' : 'tick');
  } catch (e) { showToast(e.message, 'bad'); }
}

/* ===== الإقلاع ===== */
function tickClock() {
  const el = $('#top-clock');
  if (!el) return;
  el.textContent = new Intl.DateTimeFormat('ar-u-nu-latn', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
}

async function init() {
  try { if (localStorage.getItem('noor_hide_sidebar') === '1') document.body.classList.add('hide-sidebar'); } catch (e) {}
  /* الخلود أولًا: ترحيل القوائم، ثم كشف الخادم واستعادة أحدث نسخة قبل أي عرض */
  _migrateLegacyLists();
  globalThis.NoorTypedAnswerHook = _typedAnswerToStore;
  installTabLock();
  Bridge.install();
  /* إعادة رسم الصفحة الحالية بعد استعادة لقطة أحدث من الخادم (بلا صوت تنقّل) */
  Bridge.afterPull = () => { try { refreshCurrentPage().catch((e) => console.error('[noor] إعادة العرض بعد السحب:', e)); } catch (e) {} };
  /* كشف الخادم والمزامنة في الخلفية — لا ننتظرهما قبل عرض الواجهة كي لا يبدو التطبيق بطيئًا */
  Bridge.detect().then(() => Bridge.reconcile()).catch((e) => console.error('[noor] فشل المزامنة عند الإقلاع:', e));
  syncSoundButton();
  $('#top-date').textContent = fmtDateAr(todayISO());
  tickClock();
  setInterval(tickClock, 1000);
  document.querySelectorAll('.nav-item').forEach((b) => {
    b.addEventListener('click', () => go(b.dataset.page));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    /* حماية المسودات: لا يغلق Esc أثناء الكتابة في حقل فيه نص */
    const a = document.activeElement;
    const typing = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable);
    if (typing && String(a.value || '').trim()) return;
    closeModal();
  });
  let _modalDownOnBackdrop = false;
$('#modalOverlay').addEventListener('mousedown', (e) => { _modalDownOnBackdrop = (e.target === e.currentTarget); });
$('#modalOverlay').addEventListener('click', (e) => {
  /* لا تُغلق إن بدأ الضغط داخل المحتوى أو كان المستخدم يحدد نصًا */
  if (!_modalDownOnBackdrop || e.target !== e.currentTarget) return;
  const sel = window.getSelection ? String(window.getSelection() || '') : '';
  if (sel.trim().length > 0) return;
  closeModal();
  _modalDownOnBackdrop = false;
});
  const fm = $('#fabMenu');
  if (fm) fm.innerHTML = fabMenuHTML();
  document.addEventListener('click', (e) => {
    const wrap = $('#fabWrap');
    if (wrap && wrap.classList.contains('open') && !wrap.contains(e.target)) closeFabMenu();
  });
  state.timer.sessionTasks = loadSessionTasks();
  try {
    state.settings = NoorStore.getSettings();
    state.projects = NoorStore.getProjects();
    /* استعادة إعدادات المؤقت المحفوظة */
    if (state.settings.timer_mode) state.timer.mode = state.settings.timer_mode;
    if (state.settings.timer_focus_min) state.timer.focusMin = Math.max(1, parseInt(state.settings.timer_focus_min) || 25);
    if (state.settings.timer_alarm_time) state.timer.alarmHHMM = state.settings.timer_alarm_time;
    if (state.settings.timer_project_id) state.timer.project_id = Number(state.settings.timer_project_id);
    if (state.settings.timer_project_sel) state.timer.projectSel = state.settings.timer_project_sel;
    preloadCovers();
    /* لا نلقي خطة مجهزة تلقائيًا على المستخدم — النظام يبدأ نظيفًا ويبني المستخدم خطته بنفسه */
    await go('tasks');
  } catch (e) {
    $('#content').innerHTML = `<div class="error-box">تعذر التشغيل: ${esc(e.message)}</div>`;
  }
}

function seedFitnessPlan() {
  const existing = NoorStore.getGoals();
  if (existing.some((g) => g.title && g.title.includes('ملاكمة + كاليسثنكس'))) {
    return false;
  }
  const BASE = Date.now();
  const SEED_PROJECTS = [
    { name: 'ملاكمة', icon: '🥊', tasks: ['إحماء (10 دقائق)', 'تمارين اللكم الأساسية (5 جولات)', 'تمارين الساقين والدوران', 'تمارين المرونة والإطالة'] },
    { name: 'كاليسثنكس', icon: '💪', tasks: ['تمارين الضغط (4×20)', 'تمارين السحب (4×12)', 'تمارين البطن (4×25)', 'قفزات السكوات (4×15)'] },
    { name: 'مصارعة', icon: '⚔️', tasks: ['إحماء ومفاوضة (10 دقائق)', 'تدريب تقني على الرسمة', 'تدريب خفيف (مارتبة)', 'تمارين قوة الإمساك'] },
    { name: 'باركور', icon: '🏃‍♂️', tasks: ['إحماء حركي (10 دقائق)', 'تمارين التسلق والقفز', 'أرضيات وقفزات تقنية', 'تحليل الحركة وتسجيل التقدم'] },
    { name: 'مواي تاي', icon: '🥋', tasks: ['إحماء مع تدريبات الحركات', 'تدريب اللكم والركل', 'تمارين الساقين والتوازن', 'تدريب التغلغل والاحتكاك القريب'] },
    { name: 'سباحة', icon: '🏊', tasks: ['إحماء بحري', 'تدريب الأربع ضربات الأساسية', 'تدريب السرعة والمسافات', 'تمارين التنفس تحت الماء'] },
    { name: 'ركوب خيل', icon: '🐴', tasks: ['إعداد الحصان', 'تدريب الزوايا والانطلاق', 'تدريب التحكم بالسرعة', 'تدريب الشجاعة والثقة بالنفس'] },
    { name: 'مصارعة وباركور', icon: '⚔️', tasks: ['إحماء متكامل (15 دقيقة)', 'تدريب مصارعة (4 جولات)', 'تمارين باركور (قفز وتسلق)', 'إعادة هدوء وإطالة'] },
  ];

  function findOrCreateProject(name, icon, goalId, taskTitles, priority) {
    const proj = NoorStore.addProject({
      name, type: 'عادة', goal_id: goalId, color: '#A03030',
      days: [0,1,2,3,4,5,6], priority, week: 1, weeks: 52,
      notes: 'مشروع تدريب رياضي — يظهر كعادة يومية'
    });
    taskTitles.forEach((t, i) => {
      NoorStore.addProjectTask(proj.id, { title: t, days: [0,1,2,3,4,5,6], sort: i });
    });
    return proj;
  }

  function findOrCreateGoal(title, icon, weeks, details, projectDefs) {
    const g = NoorStore.addGoal({
      title, icon, color: '#A03030', year: NoorStore.yearIndex(NoorStore.todayStr()),
      duration_type: 'months', weeks: Math.round(weeks / 4.33),
      details, value_id: null
    });
    projectDefs.forEach((pd, i) => {
      findOrCreateProject(pd.name, pd.icon, g.id, pd.tasks, i + 1);
    });
    return g;
  }

  const stage1 = [
    { name: 'ملاكمة', icon: '🥊', tasks: SEED_PROJECTS[0].tasks },
    { name: 'كاليسثنكس', icon: '💪', tasks: SEED_PROJECTS[1].tasks },
  ];
  const stage2 = [
    { name: 'مصارعة', icon: '⚔️', tasks: SEED_PROJECTS[2].tasks },
    { name: 'باركور', icon: '🏃‍♂️', tasks: SEED_PROJECTS[3].tasks },
    { name: 'كاليسثنكس', icon: '💪', tasks: SEED_PROJECTS[1].tasks },
    { name: 'ملاكمة', icon: '🥊', tasks: SEED_PROJECTS[0].tasks },
  ];
  const stage3 = [
    { name: 'سباحة', icon: '🏊', tasks: SEED_PROJECTS[5].tasks },
    { name: 'ركوب خيل', icon: '🐴', tasks: SEED_PROJECTS[6].tasks },
    { name: 'مصارعة', icon: '⚔️', tasks: SEED_PROJECTS[2].tasks },
    { name: 'ملاكمة', icon: '🥊', tasks: SEED_PROJECTS[0].tasks },
    { name: 'مواي تاي', icon: '🥋', tasks: SEED_PROJECTS[4].tasks },
    { name: 'كاليسثنكس', icon: '💪', tasks: SEED_PROJECTS[1].tasks },
  ];
  const stage4 = [
    { name: 'مصارعة وباركور', icon: '⚔️', tasks: SEED_PROJECTS[7].tasks },
    { name: 'مواي تاي', icon: '🥋', tasks: SEED_PROJECTS[4].tasks },
    { name: 'ملاكمة', icon: '🥊', tasks: SEED_PROJECTS[0].tasks },
    { name: 'سباحة', icon: '🏊', tasks: SEED_PROJECTS[5].tasks },
    { name: 'ركوب خيل', icon: '🐴', tasks: SEED_PROJECTS[6].tasks },
    { name: 'كاليسثنكس', icon: '💪', tasks: SEED_PROJECTS[1].tasks },
  ];

  findOrCreateGoal('المرحلة الأولى — ملاكمة + كاليسثنكس', '🥊', 78, 'الفرع الأول (سنة ونصف): تطوير أساسيات الملاكمة والكاليسثنكس', stage1);
  findOrCreateGoal('المرحلة الثانية — مصارعة + باركور', '⚔️', 52, '4 أيام مصارعة، يومان ملاكمة، يوم راحة — الأساس هو المصارعة والباركور', stage2);
  findOrCreateGoal('المرحلة الثالثة — السباحة والركوب', '🐴', 52, '3 أشهر تركيز على السباحة ثم 9 أشهر تركيز على ركوب الخيل مع تناوب الفروع القتالية', stage3);
  findOrCreateGoal('المرحلة النهائية — نمط الحياة الدائم', '🏆', 52, 'التسلسل الدائم: 4+4+2+2 مع تناوب الجولات بين المواي تاي والملاكمة والسباحة وركوب الخيل', stage4);

  return true;
}

/* البوابة تحقن السكربتات بعد اكتمال التحليل — لا نعتمد على DOMContentLoaded وحده.
   ونؤجّل التنفيذ لمهمة واحدة كي لا يقع init() داخل مرحلة TDZ أثناء تقييم الملف نفسه. */
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else setTimeout(init, 0);

/* =====================================================================
   التّدوين الشامل — نسخة الخادم (SQLite عبر /api)
   المساحات الثلاث: الوعي الذاتي، تجميع المعرفة، المشاريع
   (المحتوى العاطفي يُخزَّن في مساحة «الوعي الذاتي» والأفكار في «المشاريع»)
   ===================================================================== */
const JOURNAL_SPACES = [
  { key: 'awareness',   icon: '🧠', color: '#4A7C59', title: 'مساحة الوعي الذاتي',   desc: 'مشاعرك، قراراتك، أفكارك، ويومياتك — لتفريغ الضغط النفسي وفهم الذات' },
  { key: 'knowledge',   icon: '📖', color: '#8A5A9E', title: 'مساحة تجميع المعرفة',   desc: 'خلاصة ما تتعلمه من الكتب والفيديوهات والتجارب للرجوع إليه سريعًا' },
  { key: 'projects',    icon: '📚', color: NOOR_ACCENT, title: 'مساحة المشاريع',        desc: 'المشاريع المكتملة (status=done) مصنّفة حسب نوعها' }
];

/* فلاتر أقسام المساحات (الكتب/الفيديو/الكورسات/التجارب) */
const spaceFilters = { awareness: 'all', projects: 'all', knowledge: 'all' };

/* تحميل بيانات مساحات التّدوين دفعة واحدة */
async function loadJournalBase() {
  const [feelings, decisions, experiences, cats, projects, goalsGrouped, goalsByYear] = await Promise.all([
    apiFetch('/api/journal/feelings'),
    apiFetch('/api/journal/decisions'),
    apiFetch('/api/life-experiences'),
    apiFetch('/api/experience-categories'),
    apiFetch('/api/projects'),
    apiFetch('/api/goals/grouped'),
    apiFetch('/api/goals/by-year')
  ]);
  state.journalSrv.feelings = feelings || [];
  state.journalSrv.decisions = decisions || [];
  state.journalSrv.experiences = experiences || [];
  state.journalSrv.cats = cats || [];
  state.journalSrv.projects = projects || [];
  state.journalSrv.goalsGrouped = goalsGrouped || [];
  state.journalSrv.goalsByYear = goalsByYear || [];
}

async function ensureJournalToday(date) {
  const d = date || todayISO();
  const st = await apiFetch('/api/journal/state?date=' + encodeURIComponent(d));
  if (st) state.journalSrv.today = st;
  return st;
}

/* هل أُكملت يوميات اليوم؟ تُستخدم في صفحة المهام (علامة ✓) */
function dailyJournalPost(date) {
  const d = date || todayISO();
  const t = state.journalSrv && state.journalSrv.today;
  if (t && t.date === d && t.total > 0 && t.answered >= t.total) return { id: 'journal-today', date: d };
  return null;
}

/* ===== إدارة الأفكار من قسم الوعي الذاتي ===== */
async function addIdeaFromJournal() {
  const titleEl = $('#idea-title-input');
  const textEl = $('#idea-text-input');
  const title = titleEl ? titleEl.value.trim() : '';
  const text = textEl ? textEl.value.trim() : '';
  if (!title) return showToast('اكتب عنوان الفكرة', 'bad');
  try {
    NoorStore.addPost({ space: 'knowledge', title, text, tags: ['idea'] });
    play('success');
    showToast('تمت إضافة الفكرة');
    await renderJournal();
  } catch (e) { showToast(e.message, 'bad'); }
}

function editIdea(id) {
  const allPosts = NoorStore.getPosts ? NoorStore.getPosts() : [];
  const p = allPosts.find((x) => x.id === id);
  if (!p) return;
  openModal('✏️ تعديل الفكرة', `
    <input class="input" id="idea-edit-title" value="${esc(p.title || '')}" placeholder="عنوان الفكرة…" style="margin-bottom:8px">
    <textarea class="input" id="idea-edit-text" rows="3" placeholder="تفاصيل الفكرة…" style="resize:vertical">${esc(p.text || '')}</textarea>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
      <button class="btn" onclick="saveIdeaEdit(${id})">حفظ</button>
    </div>`);
}

async function saveIdeaEdit(id) {
  const title = ($('#idea-edit-title') || {}).value || '';
  const text = ($('#idea-edit-text') || {}).value || '';
  if (!title.trim()) return showToast('العنوان مطلوب', 'bad');
  try {
    NoorStore.updatePost(id, { title: title.trim(), text: text.trim() });
    play('success');
    showToast('تم تحديث الفكرة');
    closeModal();
    await renderJournal();
  } catch (e) { showToast(e.message, 'bad'); }
}

async function deleteIdea(id) {
  if (!confirm('حذف هذه الفكرة؟')) return;
  try {
    NoorStore.archivePost(id);
    play('tick');
    showToast('تم حذف الفكرة');
    await renderJournal();
  } catch (e) { showToast(e.message, 'bad'); }
}

async function renderJournal() {
  try {
    await Promise.all([loadJournalBase(), ensureJournalToday()]);
    const body = journalMode === 'timeline' ? await renderJournalTimeline() : renderJournalSections();
    $('#content').innerHTML = `
    <div class="page-head">
      <div>
        <h2 class="page-title">التدوين الشامل</h2>
        <p class="page-sub">المساحة الداخلية (أفكارك) والمساحة الخارجية (ما تتعلمه من العالم)</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost" onclick="openJournalQuestionsManager()" title="عدّل أسئلة اليوميات">إدارة أسئلة اليوميات</button>
        <button class="btn btn-lg" onclick="openDailyJournal()" title="دوّن مشاعرك وأسئلة اليوم">📔 يوميات اليوم</button>
        <button class="btn btn-lg" onclick="openQuickExperience()">🧭 كتابة تجربة</button>
      </div>
    </div>
    <div class="jmodes">
      <button class="jmode${journalMode === 'sections' ? ' on' : ''}" onclick="setJournalMode('sections')">🗂 المساحات</button>
      <button class="jmode${journalMode === 'timeline' ? ' on' : ''}" onclick="setJournalMode('timeline')">📅 التاريخ</button>
    </div>
    ${body}`;
  } catch (e) {
    console.error('renderJournal error:', e);
    $('#content').innerHTML = '<div class="error-box">خطأ في عرض التدوين: ' + esc(e.message) + '</div>';
  }
}

function renderJournalSections() {
  if (!journalSpace) return renderSpacesOverview();
  if (journalSpace === 'all') return renderAllView();
  if (!journalSub) return renderSpaceView(journalSpace);
  return renderSubView(journalSpace, journalSub);
}

/* شريط التبويبات: مبدّل المساحات (يظهر داخل «الكل» فقط) */
function spacesTabsHTML(activeKey) {
  const counts = journalCounts();
  const totalCount = counts.awareness + counts.knowledge + counts.projects;
  return `
    <div class="journal-spaces-tabs">
      <div class="jmodes">
        ${JOURNAL_SPACES.map((m) => `
          <button class="jmode${activeKey === m.key ? ' on' : ''}" onclick="setJournalSpace('${m.key}')" title="${esc(m.desc)}">${m.icon} ${m.title.replace('مساحة ', '')} <span class="count">${counts[m.key]}</span></button>`).join('')}
        <button class="jmode${activeKey === 'all' ? ' on' : ''}" onclick="setJournalSpace('all')" title="كل المساحات في صفحة واحدة">🗂 الكل <span class="count">${totalCount}</span></button>
      </div>
    </div>`;
}

/* عدادات المساحات — مصدر واحد بدل الحساب المكرر */
function journalCounts() {
  const s = state.journalSrv;
  const doneBook = s.projects.filter((p) => p.status === 'done' && (p.type === 'كتاب' || p.type === 'فيديو' || p.type === 'كورس')).length;
  const doneAll = s.projects.filter((p) => p.status === 'done').length;
  return {
    awareness: s.feelings.length + s.decisions.length,
    knowledge: doneBook + s.experiences.length,
    projects: doneAll
  };
}

/* نظرة المساحات: بطاقات مليئة بأسلوب بطاقة المشروع — أيقونة مربعة + عدّادات حبرية + شريط يوميات */
function renderSpacesOverview() {
  const t = state.journalSrv.today || { answered: 0, total: 0 };
  const s = state.journalSrv;
  const doneBook = s.projects.filter((p) => p.status === 'done' && (p.type === 'كتاب' || p.type === 'فيديو' || p.type === 'كورس')).length;
  const doneAll = s.projects.filter((p) => p.status === 'done').length;
  const activeAll = s.projects.filter((p) => p.status !== 'done').length;
  const nFeel = s.feelings.length;
  const nDec = s.decisions.length;
  const nExp = s.experiences.length;
  const counts = journalCounts();
  const totalCount = counts.awareness + counts.knowledge + counts.projects;
  const dayPct = t.total > 0 ? Math.round((t.answered / t.total) * 100) : 0;
  const cards = [
    ...JOURNAL_SPACES.map((m) => ({ key: m.key, icon: m.icon, title: m.title, desc: m.desc, color: m.color, count: counts[m.key] })),
    { key: 'all', icon: '🗂', title: 'كل المساحات', desc: 'كل الأقسام في صفحة واحدة', color: '#111111', count: totalCount }
  ];
  const content = {
    awareness: {
      stats: `<span class="dense-stat"><b>${nFeel}</b> مشاعر</span><span class="dense-stat"><b>${nDec}</b> قرارات</span>`,
      prog: t.total > 0 ? `
        <div class="space-prog">
          <div class="an-row">
            <span class="an-label">يوميات اليوم</span>
            <span class="an-bar"><i class="an-fill" style="width:${dayPct}%"></i></span>
            <span class="an-val">${t.answered}/${t.total}</span>
          </div>
        </div>` : ''
    },
    knowledge: {
      stats: `<span class="dense-stat"><b>${doneBook}</b> كتب/محتوى</span><span class="dense-stat"><b>${nExp}</b> تجارب</span>`,
      prog: ''
    },
    projects: {
      stats: `<span class="dense-stat"><b>${doneAll}</b> منجز</span><span class="dense-stat"><b>${activeAll}</b> نشط</span>`,
      prog: ''
    },
    all: {
      stats: `<span class="dense-stat"><b>${counts.awareness}</b> وعي</span><span class="dense-stat"><b>${counts.knowledge}</b> معرفة</span><span class="dense-stat"><b>${counts.projects}</b> مشاريع</span>`,
      prog: ''
    }
  };
  return `
    <div class="spaces-grid">
      ${cards.map((m) => {
        const c = m.count;
        return `
        <div class="card space-card" style="--box-color:${m.color}" onclick="setJournalSpace('${m.key}')">
          <div class="pcard-top">
            <div class="item-ic">${m.icon}</div>
            <div class="item-body">
              <div class="item-title">${m.title}</div>
              <div class="item-sub">${esc(m.desc)}</div>
            </div>
          </div>
          <div class="pcard-tags">
            <span style="display:flex;gap:6px;flex-wrap:wrap">${content[m.key].stats}</span>
            <span class="count">${c} ${c === 1 ? 'عنصر' : 'عناصر'}</span>
          </div>
          ${content[m.key].prog}
          <div class="pcard-actions" style="justify-content:space-between;align-items:center">
            <span class="muted" style="font-size:var(--fs-xs)">اضغط لعرض القسم</span>
            <button class="btn btn-xs btn-ghost" onclick="event.stopPropagation();setJournalSpace('${m.key}')">ادخل القسم ‹</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

/* عرض الكل: كل المساحات في صفحة واحدة — التبويبات هنا فقط كمبدّل */
function renderAllView() {
  return spacesTabsHTML('all') + JOURNAL_SPACES.map((m) => journalSections(m.key).map((x) => x.html).join('')).join('');
}

/* أقسام المساحة: شبكة بطاقات صغيرة → الضغط يفتح القسم */
function renderSpaceView(key) {
  const m = JOURNAL_SPACES.find((x) => x.key === key) || JOURNAL_SPACES[0];
  /* مساحة المعرفة تُعرض كمكتبة واحدة مباشرة (كما في النسخة السابقة) */
  if (key === 'knowledge') {
    return `
      <button class="btn btn-ghost" onclick="setJournalSpace(null)">→ العودة للمساحات</button>
      <div class="card jcard mt" style="--box-color:${m.color}">
        <div class="card-head"><span class="item-ic">${m.icon}</span><h3 class="card-title">${m.title}</h3><span class="count">${esc(m.desc)}</span></div>
        <div class="card-body">${renderKnowledgeView(m)}</div>
      </div>`;
  }
  const secs = journalSections(key);
  return `
    <button class="btn btn-ghost" onclick="setJournalSpace(null)">→ العودة للمساحات</button>
    <div class="sec-grid" style="margin-top:14px">
      ${secs.map((sc) => `
        <button class="card sec-card" onclick="setJournalSub('${sc.key}')" title="${esc(sc.desc)}">
          <span class="sec-ic">${sc.icon}</span>
          <span class="sec-body">
            <span class="sec-title">${sc.title}</span>
            <span class="sec-sub">${esc(sc.desc)}</span>
          </span>
          <span class="sec-num">${sc.count}</span>
        </button>`).join('')}
    </div>`;
}

/* عرض قسم واحد داخل المساحة */
function renderSubView(key, subKey) {
  const m = JOURNAL_SPACES.find((x) => x.key === key) || JOURNAL_SPACES[0];
  const sec = journalSections(key).find((x) => x.key === subKey);
  if (!sec) return renderSpaceView(key);
  return `
    <button class="btn btn-ghost" onclick="setJournalSub(null)">→ العودة لأقسام ${m.title}</button>
    ${sec.html}`;
}

/* تعريف أقسام كل مساحة: بطاقة صغيرة (sec-grid) + محتواها الكامل */
function journalSections(key) {
  const m = JOURNAL_SPACES.find((x) => x.key === key) || JOURNAL_SPACES[0];
  const s = state.journalSrv;
  const t = s.today || { answered: 0, total: 0 };
  const secs = [];

  if (key === 'awareness') {
    secs.push({
      key: 'diary', icon: '📔', title: 'يوميات اليوم', desc: 'سؤال في كل مرة', count: t.total ? t.answered + '/' + t.total : 0,
      html: diarySectionHTML(m)
    });
    secs.push({
      key: 'feelings', icon: '💭', title: 'المشاعر', desc: 'فهم مزاجك', count: s.feelings.length,
      html: feelingsSectionHTML(m)
    });
    secs.push({
      key: 'decisions', icon: '⚖️', title: 'القرارات', desc: 'حسم الاختيارات', count: s.decisions.length,
      html: decisionsSectionHTML(m)
    });
    secs.push({
      key: 'goals', icon: '🎯', title: 'الأهداف والقيم', desc: 'هرم أهدافك', count: NoorStore.getValues().length + NoorStore.getGoals().length,
      html: goalsSectionHTML(m)
    });
    const allPosts = NoorStore.getPosts ? NoorStore.getPosts() : [];
    const ideas = allPosts.filter((p) => p.space === 'knowledge' && p.tags && p.tags.includes('idea') && !p.archived_at);
    const ideasHTML = `
      <div style="margin-bottom:14px">
        <input class="input" id="idea-title-input" placeholder="عنوان الفكرة…" style="margin-bottom:6px">
        <textarea class="input" id="idea-text-input" rows="2" placeholder="تفاصيل الفكرة (اختياري)…" style="margin-bottom:6px;resize:vertical"></textarea>
        <button class="btn" onclick="addIdeaFromJournal()">💡 إضافة فكرة</button>
      </div>
      ${ideas.length ? ideas.map((p) => `
        <div class="journal-item" style="border-left: 3px solid ${m.color}; margin-bottom: 8px; padding: 10px 12px; background: var(--bg-card);">
          <div style="display:flex;justify-content:space-between;align-items:start">
            <div style="font-weight: 700; margin-bottom: 4px;">${esc(p.title || 'فكرة')}</div>
            <div style="display:flex;gap:4px">
              <button class="icon-btn" onclick="editIdea(${p.id})" title="تعديل" style="font-size:13px">✏️</button>
              <button class="icon-btn danger" onclick="deleteIdea(${p.id})" title="حذف" style="font-size:13px">✕</button>
            </div>
          </div>
          ${p.text ? `<div style="color: var(--text-muted); font-size: var(--fs-base); white-space: pre-wrap;">${esc(p.text)}</div>` : ''}
          <div style="color: var(--text-muted); font-size: var(--fs-sm); margin-top: 6px;">${p.date || ''}</div>
        </div>`).join('') : '<div class="count" style="text-align:center">لا أفكار بعد — أضف أول فكرة أعلاه</div>'}`;
    secs.push({
      key: 'ideas', icon: '💡', title: 'أفكار وأجوبة', desc: 'أفكارك المحفوظة', count: ideas.length,
      html: ideasHTML
    });
  }

  if (key === 'knowledge') {
    const doneProj = s.projects.filter((p) => p.status === 'done');
    const byType = (type) => doneProj.filter((p) => p.type === type);
    [['books', '📕', 'الكتب', 'ما أكملته منها', 'كتاب'], ['videos', '🎬', 'الفيديوهات', 'ما تعلمته منها', 'فيديو'], ['courses', '🎓', 'الكورسات', 'مساراتك المكتملة', 'كورس']].forEach(([sk, ic, tt, ds, type]) => {
      const items = byType(type);
      secs.push({
        key: sk, icon: ic, title: tt, desc: ds, count: items.length,
        html: mediaSectionCard(m, ic, tt, items.length, items.map((p) => jnProjectCard(m, p)).join(''))
      });
    });
    secs.push({
      key: 'experiences', icon: '🧭', title: 'التجارب', desc: 'من اليوميات والعيش', count: s.experiences.length,
      html: mediaSectionCard(m, '🧭', 'التجارب', s.experiences.length, s.experiences.map(jnExpCard).join(''))
    });
  }

  if (key === 'projects') {
    const done = s.projects.filter((p) => p.status === 'done');
    const groups = {};
    done.forEach((p) => { const k = p.type || 'عام'; (groups[k] = groups[k] || []).push(p); });
    Object.keys(groups).sort().forEach((k) => {
      secs.push({
        key: 'type-' + k, icon: projectType(k).icon, title: k, desc: 'مشاريع مكتملة', count: groups[k].length,
        html: projectsSectionCard(m, k, groups[k])
      });
    });
    if (!secs.length) {
      secs.push({
        key: 'none', icon: '📚', title: 'لا مشاريع مكتملة', desc: 'أكمل مشاريعك لتظهر هنا', count: 0,
        html: '<div class="empty-box"><strong>لا مشاريع مكتملة بعد</strong><p>المشاريع بحالة status=done ستظهر هنا مصنّفة حسب نوعها.</p></div>'
      });
    }
  }

  return secs;
}

/* ===== مساحة تجميع المعرفة: مشاريع مكتملة (كتاب/فيديو/كورس) + تجارب في مكتبة واحدة ===== */
function renderKnowledgeView(m) {
  const s = state.journalSrv;
  const doneProj = s.projects.filter((p) => p.status === 'done' && (p.type === 'كتاب' || p.type === 'فيديو' || p.type === 'كورس'));
  const exp = s.experiences;
  const f = spaceFilters.knowledge || 'all';
  const items = [
    ...doneProj.map((p) => ({ kind: 'proj', type: p.type, proj: p })),
    ...exp.map((e) => ({ kind: 'exp', type: 'exp', exp: e }))
  ];
  const filtered = f === 'all' ? items : items.filter((it) => it.type === f || (f === 'exp' && it.kind === 'exp'));
  return `
    <div class="jfilter" id="jf-knowledge">
      ${[['all', 'الكل'], ['كتاب', '📕 كتب'], ['فيديو', '🎬 فيديوهات'], ['كورس', '🎓 كورسات'], ['exp', '🧭 تجارب']].map(([k, l]) =>
        `<button type="button" class="jtab${f === k ? ' on' : ''}" data-k="${k}" onclick="jnFilterSpace('knowledge', '${k}')">${l}</button>`).join('')}
    </div>
    ${filtered.length ? `
      <div class="lib-grid" style="margin-top:10px">
        ${filtered.map((it) => it.kind === 'proj' ? jnProjectCard(m, it.proj) : jnExpCard(it.exp)).join('')}
      </div>`
      : '<div class="empty-box" style="margin-top:10px"><strong>لا محتوى في هذا القسم بعد</strong><p>أكمل كتبًا أو فيديوهات أو كورسات، أو سجّل تجاربك من «كتابة تجربة» أو نهاية يوميات اليوم.</p></div>'}`;
}

function jnFilterSpace(space, k) {
  spaceFilters[space] = k;
  if (state.page === 'journal') renderJournal().catch(function (e) { console.error(e); });
}

function mediaSectionCard(m, icon, title, count, inner) {
  return `
    <div class="card mt cl-card" style="--box-color:${m.color}">
      <div class="card-head"><span class="item-ic">${icon}</span><h3 class="card-title">${title}</h3><span class="count">${count} ${count === 1 ? 'عنصر' : 'عناصر'}</span></div>
      <div class="card-body">
        ${inner ? `<div class="lib-grid">${inner}</div>` : '<p class="count">لا محتوى في هذا القسم بعد.</p>'}
      </div>
    </div>`;
}

function projectsSectionCard(m, type, items) {
  return `
    <div class="card mt cl-card" style="--box-color:${m.color}">
      <div class="card-head"><span class="item-ic">${projectType(type).icon}</span><h3 class="card-title">${type}</h3><span class="count">${items.length} ${items.length === 1 ? 'مشروع' : 'مشاريع'}</span></div>
      <div class="card-body" style="padding-top:6px">
        ${items.map((p) => `
          <div class="jentry" style="padding:10px;margin-bottom:6px;cursor:pointer" onclick="openProjectTasksModal(${p.id})" title="عرض المشروع">
            <div class="jentry-head">
              <span class="jtitle">${esc(p.name)}</span>
              ${p.completed_at ? `<span class="count">${fmtDateAr(String(p.completed_at).slice(0, 10))}</span>` : ''}
            </div>
            ${p.summary ? `<div class="jtext">${esc(p.summary.length > 100 ? p.summary.slice(0, 100) + '…' : p.summary)}</div>` : ''}
          </div>`).join('')}
      </div>
    </div>`;
}

/* ===== مساحة الوعي الذاتي: يوميات اليوم + المشاعر + القرارات + الأهداف ===== */
function diarySectionHTML(m) {
  const s = state.journalSrv;
  const t = s.today || { answered: 0, total: 0 };
  const complete = t.total > 0 && t.answered >= t.total;
  return `
    <div class="card mt cl-card" style="--box-color:${m.color}">
      <div class="card-head">
        <h3 class="card-title">📔 يوميات اليوم</h3>
        <span class="count">${t.total ? t.answered + '/' + t.total + ' سؤال' : 'لا أسئلة بعد'}</span>
      </div>
      <div class="card-body">
        ${t.total === 0
          ? '<p class="count">لا توجد أسئلة — أضف أسئلتك من «إدارة أسئلة اليوميات» أو ابدأ مباشرة وأجب عن الأسئلة الافتراضية.</p>'
          : complete
            ? '<p class="count">أكملت يوميات اليوم ✓ — أعد فتحها لتحديثها أو أضف تجاربك.</p>'
            : `<p class="count">لديك ${t.total - t.answered} سؤالًا بانتظارك — سؤال واحد في كل مرة ويُحفظ الجواب فورًا.</p>`}
        <div class="zone-actions">
          <button class="btn" onclick="openDailyJournal()">${complete ? 'أعد فتح يوميات اليوم' : '📔 أكمل يوميات اليوم'}</button>
        </div>
      </div>
    </div>`;
}

function feelingsSectionHTML(m) {
  const s = state.journalSrv;
  const feelHTML = s.feelings.length ? s.feelings.map((it) => `
    <div class="jday-item jday-feel">
      <div style="display:flex;justify-content:space-between;align-items:start">
        <div class="jday-q">💭 شعور</div>
        <div><button class="icon-btn danger" onclick="delJournalFeeling(${it.id})" title="حذف" style="font-size:13px">✕</button></div>
      </div>
      <div class="jday-a">${esc(it.text)}</div>
      <div style="font-size:var(--fs-sm);color:var(--text-muted);margin-top:4px">${fmtDateAr(it.date)}</div>
    </div>`).join('') : '<p class="count">لا مشاعر مكتوبة بعد.</p>';
  return `
    <div class="card mt cl-card" style="--box-color:${m.color}">
      <div class="card-head"><h3 class="card-title">💭 المشاعر</h3><span class="count">${s.feelings.length}</span></div>
      <div class="card-body">
        <div class="st-add">
          <input class="input" id="feel-input" placeholder="كيف أشعر الآن؟" onkeydown="if(event.key==='Enter'){addJournalFeeling()}">
          <button class="btn" onclick="addJournalFeeling()">إضافة</button>
        </div>
        <div style="margin-top:10px">${feelHTML}</div>
      </div>
    </div>`;
}

function decisionsSectionHTML(m) {
  const s = state.journalSrv;
  const decideHTML = s.decisions.length ? s.decisions.map((it) => `
    <div class="jentry" style="padding:10px;margin-bottom:6px">
      <div class="jentry-head">
        <span class="count">${fmtDateAr(it.date)}</span>
        <div class="gn-actions"><button class="icon-btn danger" onclick="delJournalDecision(${it.id})" title="حذف">✕</button></div>
      </div>
      <div class="jtext">${esc(it.text)}</div>
    </div>`).join('') : '<p class="count">لا قرارات مكتوبة بعد.</p>';
  return `
    <div class="card mt cl-card" style="--box-color:${m.color}">
      <div class="card-head"><h3 class="card-title">⚖️ القرارات</h3><span class="count">${s.decisions.length}</span></div>
      <div class="card-body">
        <div class="st-add">
          <input class="input" id="decide-input" placeholder="أي قرار أفكر فيه؟" onkeydown="if(event.key==='Enter'){addJournalDecision()}">
          <button class="btn" onclick="addJournalDecision()">إضافة</button>
        </div>
        <div style="margin-top:10px">${decideHTML}</div>
      </div>
    </div>`;
}

function goalsSectionHTML(m) {
  const v = state.journalSrv.goalsView || 'clarity';
  const tabs = `
    <div class="jmodes" style="margin:0 0 12px">
      <button class="jmode${v === 'clarity' ? ' on' : ''}" onclick="setGoalsView('clarity')">🗂 الأهداف والقيم</button>
      <button class="jmode${v === 'grouped' ? ' on' : ''}" onclick="setGoalsView('grouped')">🏗 التجميع</button>
      <button class="jmode${v === 'byyear' ? ' on' : ''}" onclick="setGoalsView('byyear')">📆 بالسنوات</button>
    </div>`;
  const body = v === 'clarity'
    ? claritySectionHTML()
    : (v === 'grouped' ? goalsGroupedHTML(state.journalSrv) : goalsByYearHTML(state.journalSrv));
  return `
    <div class="card mt cl-card" style="--box-color:${m.color}">
      <div class="card-head"><h3 class="card-title">🎯 الأهداف والقيم</h3><span class="count">${NoorStore.getValues().length} ${NoorStore.getValues().length === 1 ? 'قيمة' : 'قيم'} · ${NoorStore.getGoals().length} هدف</span></div>
      <div class="card-body">
        ${tabs}
        ${body}
      </div>
    </div>`;
}

/* ===== الأهداف والقيم: منظور تجميع الأهداف (هرمي: قيمة → أهداف → مشاريع) ===== */
function goalsGroupedHTML(s) {
  const data = s.goalsGrouped || [];
  if (!data.length) return '<div class="empty-box"><strong>لا قيم بعد</strong><p>أضف قيمك وأهدافك، ثم اربط مشاريعك بها، وستظهر هنا هرميًا.</p></div>';
  return data.map((v) => `
    <div style="margin-bottom:14px">
      <div class="jentry-head" style="gap:6px">
        <span class="item-ic" style="background:${v.color || 'var(--accent)'};color:var(--white);font-size:var(--fs-xs)">قيمة</span>
        <span class="jtitle">${esc(v.name)}</span>
        <span class="count">أولوية ${v.priority_rank || 0}</span>
      </div>
      ${v.goals.length ? v.goals.map((g) => `
        <div style="margin:6px 0 0 18px;padding:8px;border:1px solid var(--border-light);background:var(--paper)">
          <div class="jentry-head">
            <span class="jtitle">${esc(g.title)}</span>
            <span class="chip ${g.status === 'done' ? 'chip-ok' : ''}">${g.status === 'done' ? '✓ منجز' : 'جاري'}</span>
            ${g.start_year ? `<span class="count">${g.start_year}–${g.end_year || '…'}</span>` : ''}
          </div>
          ${g.projects.length ? (() => {
            const ordered = g.projects.slice().sort((a, b) => (a.priority || 1) - (b.priority || 1) || a.id - b.id);
            const completed = ordered.filter((p) => p.status === 'done');
            const active = ordered.filter((p) => p.status !== 'done');
            const current = active[0] || null;
            const rows = [];
            completed.forEach((p) => rows.push(`
              <div class="jentry" style="padding:4px 0;border-bottom:none">
                <div class="jentry-head">
                  <span>✅ ${esc(p.name)}</span>
                  <span class="count">انتهى${p.duration_days != null ? ' · ' + p.duration_days + ' يوم' : ''}</span>
                </div>
              </div>`));
            if (current) rows.push(`
              <div class="jentry" style="padding:4px 0;border-bottom:none">
                <div class="jentry-head">
                  <span>◻ ${esc(current.name)}</span>
                  ${active.length > 1 ? '<span class="chip chip-warn" title="يُنجز أولاً — يليه ' + (active.length - 1) + ' مشروع">التالي</span>' : ''}
                  <span class="count">جاري · أولوية ${current.priority || 1}</span>
                </div>
              </div>`);
            if (!rows.length) rows.push('<p class="count" style="margin:6px 0 0 0">لا مشاريع مرتبطة بهذا الهدف.</p>');
            return rows.join('');
          })() : '<p class="count" style="margin:6px 0 0 0">لا مشاريع مرتبطة بهذا الهدف.</p>'}
        </div>`).join('') : '<p class="count" style="margin:6px 0 0 18px">لا أهداف لهذه القيمة.</p>'}
    </div>`).join('');
}

/* ===== الأهداف والقيم: منظور فرز الأهداف على السنين ===== */
function goalsByYearHTML(s) {
  const years = s.goalsByYear || [];
  if (!years.length) return '<div class="empty-box"><strong>لا أهداف بسنوات بعد</strong><p>أضف أهدافًا بسنوات (start_year → end_year) وستظهر هنا مرتبة حسب أولوية قيمها.</p></div>';
  const selYear = s.goalsYear != null ? s.goalsYear : currentYear();
  if (!years.some((x) => x.year === selYear)) s.goalsYear = years[0].year;
  const cur = years.find((x) => x.year === s.goalsYear) || years[0];
  const yearTabs = years.map((x) => `
    <button class="jmode${x.year === cur.year ? ' on' : ''}" onclick="setGoalsYear(${x.year})">${x.year}</button>`).join('');
  const items = cur.items || [];
  const listHTML = items.length ? items.map((it) => `
    <div class="jentry" style="padding:8px 10px;margin-bottom:6px">
      <div class="jentry-head">
        <span class="jtitle">${esc(it.value.name)}</span>
        <span class="jtext">${esc(it.goal.title)}</span>
        <span class="chip ${it.goal.status === 'done' ? 'chip-ok' : ''}">${it.goal.status === 'done' ? 'منجز' : 'جاري'}</span>
        <button class="icon-btn" title="تعليم كمنجز" onclick="setGoalStatus(${it.goal.id}, 'done')">✓</button>
      </div>
      ${it.goal.start_year ? `<span class="count">${it.goal.start_year}–${it.goal.end_year || '…'} · أولوية ${it.value.priority_rank || 0}</span>` : ''}
    </div>`).join('') : '<p class="count">لا أهداف نشطة هذه السنة.</p>';
  return `
    <div class="jmodes" style="flex-wrap:wrap;gap:6px">${yearTabs}</div>
    <div style="margin-top:10px">${listHTML}</div>
    <p class="count" style="margin-top:8px;display:block">إذا تعارض هدفان من نفس القيمة في السنة، يظهر الأسبق (order_index)، وعند تعليمه منجزًا يظهر التالي تلقائيًا.</p>`;
}

function currentYear() {
  try { return Math.max(1, Math.round(Number(NoorStore.yearIndex(todayISO())) || 1)); }
  catch (e) { return 1; }
}

function setGoalsView(v) {
  state.journalSrv.goalsView = v;
  if (state.page === 'journal') renderJournal().catch((e) => showToast('خطأ: ' + e.message, 'bad'));
}

function setGoalsYear(y) {
  state.journalSrv.goalsYear = Number(y);
  if (state.page === 'journal') renderJournal().catch((e) => showToast('خطأ: ' + e.message, 'bad'));
}

async function setGoalStatus(id, status) {
  try {
    await apiSend('PUT', '/api/goals/' + id, { completed_at: status === 'done' ? new Date().toISOString() : null });
    play('success');
    state.journalSrv.goalsByYear = (await apiFetch('/api/goals/by-year')) || [];
    if (state.page === 'journal') await renderJournal();
  } catch (e) { showToast(e.message, 'bad'); }
}



async function addJournalFeeling() {
  const inp = $('#feel-input');
  const text = (inp && inp.value.trim()) || '';
  if (!text) return showToast('اكتب مشاعرك', 'bad');
  try {
    const r = await apiSend('POST', '/api/journal/feelings', { date: todayISO(), text });
    play('success');
    inp.value = '';
    if (r) state.journalSrv.feelings.unshift(r);
    if (state.page === 'journal') await renderJournal();
  } catch (e) { showToast(e.message, 'bad'); }
}
async function delJournalFeeling(id) {
  if (!confirm('حذف هذا الشعور؟')) return;
  try { await apiSend('DELETE', '/api/journal/feelings/' + id); play('tick'); if (state.page === 'journal') await renderJournal(); }
  catch (e) { showToast(e.message, 'bad'); }
}
async function addJournalDecision() {
  const inp = $('#decide-input');
  const text = (inp && inp.value.trim()) || '';
  if (!text) return showToast('اكتب القرار', 'bad');
  try {
    const r = await apiSend('POST', '/api/journal/decisions', { date: todayISO(), text });
    play('success');
    inp.value = '';
    if (r) state.journalSrv.decisions.unshift(r);
    if (state.page === 'journal') await renderJournal();
  } catch (e) { showToast(e.message, 'bad'); }
}
async function delJournalDecision(id) {
  if (!confirm('حذف هذا القرار؟')) return;
  try { await apiSend('DELETE', '/api/journal/decisions/' + id); play('tick'); if (state.page === 'journal') await renderJournal(); }
  catch (e) { showToast(e.message, 'bad'); }
}

/* ===== يوميات اليوم — سؤال واحد في كل مرة ===== */
async function openDailyJournal() {
  const date = todayISO();
  const st = await ensureJournalToday(date);
  if (!st) return showToast('تعذّر تحميل اليوميات', 'bad');
  if (!st.questions.length) { openDailyExpOnly(st); return; }
  const cur = st.questions.findIndex((q) => !q.answer.trim());
  state.journalWiz = { date, questions: st.questions, idx: Math.max(0, cur), answered: st.answered };
  renderJournalWiz();
}

function renderJournalWiz() {
  const w = state.journalWiz;
  const q = w.questions[w.idx];
  const last = w.idx >= w.questions.length - 1;
  const filled = !!q.answer.trim();
  const pct = Math.round(((w.idx + (filled ? 1 : 0)) / w.questions.length) * 100);
  openModal('📔 يوميات اليوم', `
    <div class="wiz-progress"><span class="wiz-pct" style="width:${pct}%"></span></div>
    <div class="count" style="text-align:center;margin:4px 0 10px">سؤال ${w.idx + 1} من ${w.questions.length} — ${pct}%</div>
    <h3 class="wiz-q">${esc(q.text)}</h3>
    ${q.type === 'idea' ? '<div class="success-banner" style="margin-bottom:10px;font-size:var(--fs-sm)">💡 إجابتك ستُحفظ تلقائيًا كفكرة في قسم الأفكار</div>' : ''}
    <textarea class="input dj-ta" id="wiz-answer" rows="4" placeholder="اكتب إجابتك هنا…">${esc(q.answer)}</textarea>
    <p class="count" style="text-align:center">الجواب يُحفظ فورًا عند الانتقال — يمكنك تخطي أي سؤال.</p>
    <div class="modal-actions">
      ${w.idx > 0 ? '<button class="btn btn-ghost" onclick="wizPrev()">→ السابق</button>' : ''}
      <button class="btn btn-lg" onclick="wizNext()">${last ? 'إنهاء ← تجارب اليوم' : 'حفظ والتالي ←'}</button>
    </div>`);
  const ta = $('#wiz-answer');
  if (ta) ta.focus();
  /* الإغلاق المفاجئ (ESC/✕/الخلفية) يغرق مسودة الجواب الحالي قبل مسح المحتوى */
  modalCloseHooks.length = 0;
  modalCloseHooks.push(() => { try { if ($('#wiz-answer')) wizSaveCurrent(); } catch (e) {} });
}

async function wizSaveCurrent() {
  const w = state.journalWiz;
  const q = w.questions[w.idx];
  const ta = $('#wiz-answer');
  const val = ((ta && ta.value) || '').trim();
  const wasFilled = !!q.answer.trim();
  if (val !== q.answer) {
    try {
      await apiSend('PUT', '/api/journal/answers', { date: w.date, question_id: q.id, answer_text: val });
    } catch (e) { showToast(e.message, 'bad'); return false; }
    /* إذا كان نوع السؤال "فكرة" والإجابة غير فارغة → احفظ كفكرة في الأفكار */
    if (q.type === 'idea' && val) {
      try {
        NoorStore.addPost({ space: 'knowledge', title: q.text.slice(0, 100), text: val, tags: ['idea'] });
      } catch (e) { /* تجاهل الخطأ */ }
    }
  }
  q.answer = val;
  if (state.journalSrv.today && state.journalSrv.today.date === w.date) {
    const qq = state.journalSrv.today.questions.find((x) => x.id === q.id);
    if (qq) qq.answer = val;
    state.journalSrv.today.answered = state.journalSrv.today.questions.filter((x) => x.answer.trim()).length;
  }
  return true;
}

async function wizNext() {
  const w = state.journalWiz;
  if (!(await wizSaveCurrent())) return;
  if (w.idx >= w.questions.length - 1) { wizExperiences(); return; }
  w.idx++;
  renderJournalWiz();
}

async function wizPrev() {
  if (!(await wizSaveCurrent())) return;
  state.journalWiz.idx = Math.max(0, state.journalWiz.idx - 1);
  renderJournalWiz();
}

/* آخر خطوة في اليوميات: مربع «أي تجارب تعلمتها اليوم؟» */
async function wizExperiences() {
  const w = state.journalWiz;
  const exps = (await apiFetch('/api/life-experiences')) || [];
  const todayExps = exps.filter((e) => String(e.created_at || '').slice(0, 10) === w.date);
  openModal('📔 يوميات اليوم — تجارب اليوم', `
    <div class="success-banner">✓ أكملت أسئلة اليوميات — 100%</div>
    <div class="field">
      <label>🧭 أي تجارب تعلمتها اليوم؟</label>
      <p class="count">كل تجربة تُكتب هنا تُحفظ تلقائيًا في «مساحة تجميع المعرفة» كتجربة حياة (source=journal). اكتب واحدة ثم اضغط «إضافة».</p>
      <div class="st-add">
        <input class="input" id="wiz-exp" placeholder="مثال: تعلمت أن الصبر يفتح أبوابًا…" style="flex:1" onkeydown="if(event.key==='Enter'){wizExpAdd()}">
        <button class="btn" onclick="wizExpAdd()">إضافة</button>
      </div>
    </div>
    <div id="wiz-exp-list">
      ${todayExps.length ? todayExps.map((e) => `<div class="jentry" style="padding:8px;margin-bottom:6px"><div class="jtext">${esc(e.text)}</div></div>`).join('') : '<p class="count">لم تُسجَّل تجارب اليوم بعد.</p>'}
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeJournalWiz()">إنهاء اليوميات ✓</button>
    </div>`);
}

async function wizExpAdd() {
  const inp = $('#wiz-exp');
  const text = (inp && inp.value.trim()) || '';
  if (!text) return showToast('اكتب التجربة أولاً', 'bad');
  try {
    const r = await apiSend('POST', '/api/life-experiences', { text, source: 'journal' });
    play('success');
    showToast('حُفظت التجربة ✓');
    inp.value = '';
    if (r) {
      state.journalSrv.experiences.unshift(r);
      const list = $('#wiz-exp-list');
      if (list) list.insertAdjacentHTML('afterbegin', `<div class="jentry" style="padding:8px;margin-bottom:6px"><div class="jtext">${esc(r.text)}</div></div>`);
    }
  } catch (e) { showToast(e.message, 'bad'); }
}

async function closeJournalWiz() {
  closeModal();
  play('success');
  showToast('أكملت يوميات اليوم ✓');
  await ensureJournalToday(state.journalWiz ? state.journalWiz.date : todayISO());
  if (state.page === 'journal') await renderJournal();
  else if (state.page === 'tasks') await renderTasks();
}

function openDailyExpOnly(st) {
  state.journalWiz = { date: st.date, questions: [], idx: 0 };
  wizExperiences();
}

function jnProjectCard(m, p) {
  const t = projectType(p.type);
  const tcls = p.type === 'كتاب' ? ' t-book' : p.type === 'فيديو' ? ' t-video' : p.type === 'كورس' ? ' t-course' : '';
  return `
    <div class="lib-card${tcls}" onclick="openProjectTasksModal(${p.id})" title="عرض المشروع">
      <div class="lib-cover lib-cover-empty"><span class="lib-type">${t.icon}</span></div>
      <div class="lib-body">
        <div class="lib-title">${esc(p.name)}</div>
        ${p.rating > 0 ? `<div class="lib-rating">${starsHTML(p.rating)}</div>` : ''}
        ${p.summary ? `<div class="lib-summary">${esc(p.summary.length > 90 ? p.summary.slice(0, 90) + '…' : p.summary)}</div>` : ''}
        <div class="lib-foot">
          <span class="chip jchip">${t.icon} ${esc(t.title)}</span>
          ${p.completed_at ? `<span class="chip chip-ok">مكتمل ✓</span>` : ''}
        </div>
      </div>
    </div>`;
}

function jnExpCard(e) {
  return `
    <div class="jday-item jday-exp">
      <div style="display:flex;justify-content:space-between;align-items:start">
        <div class="jday-q">🧭 ${e.category_name ? esc(e.category_name) : 'تجربة'}${e.source === 'journal' ? ' <span style="color:var(--text-muted);font-weight:400">(من اليوميات)</span>' : ''}</div>
        <div style="display:flex;gap:4px">
          <button class="icon-btn" onclick="editExperience(${e.id})" title="تعديل" style="font-size:13px">✏️</button>
          <button class="icon-btn danger" onclick="deleteExperience(${e.id})" title="حذف" style="font-size:13px">✕</button>
        </div>
      </div>
      <div class="jday-a">${esc(e.text)}</div>
      <div style="font-size:var(--fs-sm);color:var(--text-muted);margin-top:4px">${e.created_at ? fmtDateAr(String(e.created_at).slice(0, 10)) : ''}</div>
    </div>`;
}

async function editExperience(id) {
  const e = state.journalSrv.experiences.find((x) => x.id === id);
  if (!e) return;
  const cats = (await apiFetch('/api/experience-categories')) || [];
  openModal('تعديل التجربة', `
    <div class="field"><label>التجربة</label><textarea class="input" id="exp-edit-text" rows="3">${esc(e.text)}</textarea></div>
    <div class="field"><label>التصنيف</label>
      <select class="input" id="exp-edit-cat">
        <option value="">بدون تصنيف</option>
        ${cats.map((c) => `<option value="${c.id}"${e.category_id === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="saveExperienceEdit(${e.id})">حفظ</button>
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>`);
}

async function saveExperienceEdit(id) {
  const text = ($('#exp-edit-text') && $('#exp-edit-text').value.trim()) || '';
  if (!text) return showToast('اكتب التجربة', 'bad');
  const category_id = $('#exp-edit-cat').value || null;
  try {
    const r = await apiSend('PUT', '/api/life-experiences/' + id, { text, category_id });
    const i = state.journalSrv.experiences.findIndex((x) => x.id === id);
    if (i >= 0) state.journalSrv.experiences[i] = r;
    play('success');
    closeModal();
    if (state.page === 'journal') await renderJournal();
  } catch (e) { showToast(e.message, 'bad'); }
}

async function deleteExperience(id) {
  if (!confirm('حذف هذه التجربة؟')) return;
  try {
    await apiSend('DELETE', '/api/life-experiences/' + id);
    play('tick');
    state.journalSrv.experiences = state.journalSrv.experiences.filter((x) => x.id !== id);
    if (state.page === 'journal') await renderJournal();
  } catch (e) { showToast(e.message, 'bad'); }
}

/* ===== الخط الزمني ===== */
async function renderJournalTimeline() {
  const tl = await apiFetch('/api/journal/timeline');
  if (!tl) return '<div class="empty-box"><strong>لا بيانات بعد</strong></div>';
  const days = {};
  const ensure = (d) => (days[d] = days[d] || { entries: [], feelings: [], decisions: [], experiences: [] });
  (tl.entries || []).forEach((e) => ensure(e.date).entries.push(e));
  (tl.feelings || []).forEach((f) => ensure(f.date).feelings.push(f));
  (tl.decisions || []).forEach((dc) => ensure(dc.date).decisions.push(dc));
  (tl.experiences || []).forEach((x) => ensure(x.date).experiences.push(x));
  const keys = Object.keys(days).sort().reverse();
  if (!keys.length) return '<div class="empty-box"><strong>لا تدوينات بعد</strong><p>ابدأ يومياتك أو أضف مشاعر أو قرارات أو تجارب لتظهر هنا مرتبة حسب اليوم.</p></div>';
  return `
    <div class="tl">
      ${keys.map((d) => {
        const g = days[d];
        const n = g.entries.length + g.feelings.length + g.decisions.length + g.experiences.length;
        const done = (g.entries[0] || {}).answered;
        const total = (g.entries[0] || {}).total;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        const chips = [];
        if (g.entries.length) chips.push(`<span class="tl-chip">✍️ ${g.entries.length}</span>`);
        if (g.feelings.length) chips.push(`<span class="tl-chip">💭 ${g.feelings.length}</span>`);
        if (g.decisions.length) chips.push(`<span class="tl-chip">⚖️ ${g.decisions.length}</span>`);
        if (g.experiences.length) chips.push(`<span class="tl-chip">🌱 ${g.experiences.length}</span>`);
        const prog = done != null && total > 0 ? `
          <div class="tl-progress" title="يوميات اليوم ${done}/${total}">
            <div class="an-bar"><i class="an-fill" style="width:${pct}%"></i></div>
          </div>` : '';
        return `
        <button class="card tl-row" style="--box-color:var(--accent)" onclick="journalDayView('${d}')">
          <span class="mini-ic">📔</span>
          <span class="tl-body">
            <span class="tl-main">
              <span class="tl-date">${fmtDateAr(d)}</span>
              ${done != null && total > 0 ? `<span class="dense-stat">يوميات <b>${done}/${total}</b></span>` : ''}
            </span>
            <span class="tl-sub">${chips.length ? chips.join('') : '<span class="muted">سجل اليوم</span>'}</span>
          </span>
          ${prog}
          <span class="count">${n} ${n === 1 ? 'إدخال' : 'إدخالات'}</span>
          <span class="tl-arrow">‹</span>
        </button>`;
      }).join('')}
    </div>`;
}

async function journalDayView(date) {
  const tl = await apiFetch('/api/journal/timeline');
  if (!tl) return showToast('تعذّر التحميل', 'bad');
  const day = { entries: [], feelings: [], decisions: [], experiences: [] };
  (tl.entries || []).forEach((e) => { if (e.date === date) day.entries.push(e); });
  (tl.feelings || []).forEach((f) => { if (f.date === date) day.feelings.push(f); });
  (tl.decisions || []).forEach((dc) => { if (dc.date === date) day.decisions.push(dc); });
  (tl.experiences || []).forEach((x) => { if (x.date === date) day.experiences.push(x); });
  let html = '';
  if (day.entries.length) {
    const st = await ensureJournalToday(date);
    const qs = (st && st.questions || []).filter((q) => q.answer.trim());
    if (qs.length) {
      html += `<div class="jday-section"><h4 style="margin:0 0 10px;font-size:15px">📔 إجابات يوميات اليوم (${day.entries[0].answered}/${day.entries[0].total})</h4>`;
      qs.forEach((q) => {
        const isIdea = q.type === 'idea';
        html += `<div class="jday-item${isIdea ? ' jday-idea' : ''}">
          <div class="jday-q">${isIdea ? '💡' : '❓'} ${esc(q.text)}</div>
          <div class="jday-a">${esc(q.answer)}</div>
          ${isIdea ? '<div style="margin-top:6px;font-size:var(--fs-sm);color:var(--purple)">💡 محفوظة أيضًا في قسم الأفكار</div>' : ''}
        </div>`;
      });
      html += `</div>`;
    }
  }
  (day.feelings || []).forEach((f) => { html += `<div class="jday-item jday-feel"><div class="jday-q">💭 مشاعر</div><div class="jday-a">${esc(f.text)}</div></div>`; });
  (day.decisions || []).forEach((dc) => { html += `<div class="jday-item jday-dec"><div class="jday-q">⚖️ قرار</div><div class="jday-a">${esc(dc.text)}</div></div>`; });
  (day.experiences || []).forEach((x) => { html += `<div class="jday-item jday-exp"><div class="jday-q">🧭 تجربة${x.source === 'journal' ? ' (من اليوميات)' : ''}</div><div class="jday-a">${esc(x.text)}</div></div>`; });
  openModal('كل ما كتبته في ' + fmtDateAr(date), `
    <div class="dj-scroll">${html || '<p class="count">لا إدخالات في هذا اليوم.</p>'}</div>
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">إغلاق</button></div>`);
}

/* ===== إدارة أسئلة اليوميات ===== */
async function openJournalQuestionsManager() {
  const qs = (await apiFetch('/api/journal/questions')) || [];
  const typeLabel = (t) => t === 'idea' ? '💡 فكرة' : '📝 عادي';
  openModal('إدارة أسئلة اليوميات', `
    <p class="count">الأسئلة تُعرض في «يوميات اليوم» سؤالًا واحدًا في كل مرة. لكل سؤال نوع:<br>
    <strong>📝 عادي</strong> — يُحفظ كسؤال يوميات عادي<br>
    <strong>💡 فكرة</strong> — إجابته تُحفظ تلقائيًا كفكرة في قسم «أفكار وأجوبة»</p>
    <div id="jq-list">
      ${qs.length ? qs.map((q, i) => `
        <div class="jentry" style="padding:8px;margin-bottom:6px">
          <div class="jq-row">
            <span class="jtitle">${esc(q.text)}</span>
            <span class="count" style="margin:0 6px;font-size:var(--fs-sm)">${typeLabel(q.type)}</span>
            <div class="gn-actions">
              <button class="icon-btn" onclick="toggleQuestionType(${q.id}, '${q.type === 'idea' ? 'normal' : 'idea'}')" title="تغيير النوع">${q.type === 'idea' ? '📝' : '💡'}</button>
              <button class="icon-btn" ${i === 0 ? 'disabled' : ''} onclick="moveJournalQuestion(${q.id}, -1)">↑</button>
              <button class="icon-btn" ${i === qs.length - 1 ? 'disabled' : ''} onclick="moveJournalQuestion(${q.id}, 1)">↓</button>
              <button class="icon-btn danger" onclick="deleteJournalQuestion(${q.id})">✕</button>
            </div>
          </div>
        </div>`).join('') : '<p class="count">لا أسئلة — ألصق أسئلتك بالأسفل.</p>'}
    </div>
    <div class="field">
      <label>إضافة جماعية — كل سطر سؤال (pertanyaan)</label>
      <textarea class="input" id="jq-input" rows="6" placeholder="كيف كان يومي بشكل عام؟
ما أهم حدث وقع اليوم؟
ما الشعور الغالب علي اليوم؟" onkeydown="if(event.key==='Enter'&&event.ctrlKey){event.preventDefault();addJournalQuestions()}"></textarea>
    </div>
    <div class="field" style="margin-top:8px">
      <label>نوع الأسئلة المُضافة</label>
      <select class="input" id="jq-type">
        <option value="normal">📝 عادي (سؤال يوميات)</option>
        <option value="idea">💡 فكرة (تنتقل لقسم الأفكار)</option>
      </select>
    </div>
    <div class="st-add">
      <button class="btn btn-lg" onclick="addJournalQuestions()">+ إضافة كل الأسئلة</button>
    </div>
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">إغلاق</button></div>`);
}

async function toggleQuestionType(id, newType) {
  try {
    await apiSend('PUT', '/api/journal/questions/' + id, { type: newType });
    play('tick');
    showToast(newType === 'idea' ? 'الآن إجابته تُحفظ كفكرة' : 'الآن إجابته سؤال عادي');
    openJournalQuestionsManager();
  } catch (e) { showToast(e.message, 'bad'); }
}

async function addJournalQuestions() {
  const inp = $('#jq-input');
  const typeEl = $('#jq-type');
  const qType = typeEl ? typeEl.value : 'normal';
  const raw = (inp && inp.value) || '';
  const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (!lines.length) return showToast('اكتب سؤالًا واحدًا على الأقل في كل سطر', 'bad');
  let added = 0, failed = 0;
  for (const text of lines) {
    try {
      const r = await apiSend('POST', '/api/journal/questions', { text, type: qType });
      if (r) added++; else failed++;
    } catch (e) { failed++; }
  }
  if (added) { play('success'); showToast('أُضيف ' + added + ' سؤالًا بنجاح' + (failed ? ' — وفشل ' + failed : ''), failed ? 'bad' : 'ok'); }
  else showToast('تعذر الإضافة — تحقق من الاتصال', 'bad');
  openJournalQuestionsManager();
}

async function moveJournalQuestion(id, dir) {
  if (_reorderBusy) return;
  _reorderBusy = true;
  try {
    const qs = (await apiFetch('/api/journal/questions')) || [];
    const idx = qs.findIndex((q) => q.id === id);
    const j = idx + dir;
    if (idx === -1 || j < 0 || j >= qs.length) return;
    const ids = qs.map((q) => q.id);
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    for (let i = 0; i < ids.length; i++) await apiSend('PUT', '/api/journal/questions/' + ids[i], { order_index: i + 1 });
    openJournalQuestionsManager();
  } catch (e) { showToast(e.message, 'bad'); }
  finally { _reorderBusy = false; }
}

async function deleteJournalQuestion(id) {
  if (!confirm('حذف هذا السؤال؟')) return;
  try {
    await apiSend('DELETE', '/api/journal/questions/' + id);
    play('tick');
    openJournalQuestionsManager();
  } catch (e) { showToast(e.message, 'bad'); }
}

/* ===== كتابة تجربة سريعة (زر عائم خارج التدوين) ===== */
async function openQuickExperience() {
  const cats = (await apiFetch('/api/experience-categories')) || [];
  state.journalSrv.cats = cats;
  openModal('🧭 كتابة تجربة', `
    <div class="field"><label>التجربة</label>
      <textarea class="input" id="exp-text" rows="3" placeholder="مثال: اليوم تعلمت أن…"></textarea>
    </div>
    <div class="field"><label>التصنيف</label>
      <select class="input" id="exp-cat">
        <option value="">بدون تصنيف</option>
        ${cats.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
        <option value="__new">+ تصنيف جديد…</option>
      </select>
    </div>
    <div class="field" id="exp-new-cat-wrap" style="display:none"><label>اسم التصنيف الجديد</label><input class="input" id="exp-new-cat" placeholder="مثال: العلاقات"></div>
    <div class="modal-actions">
      <button class="btn" onclick="saveQuickExperience()">حفظ التجربة</button>
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>`);
  const sel = $('#exp-cat');
  if (sel) sel.addEventListener('change', function () {
    const wrap = $('#exp-new-cat-wrap');
    if (wrap) wrap.style.display = this.value === '__new' ? 'block' : 'none';
  });
  const ta = $('#exp-text');
  if (ta) ta.focus();
}

async function saveQuickExperience() {
  const text = ($('#exp-text') && $('#exp-text').value.trim()) || '';
  if (!text) return showToast('اكتب التجربة', 'bad');
  let cat = ($('#exp-cat') && $('#exp-cat').value) || '';
  try {
    if (cat === '__new') {
      const name = ($('#exp-new-cat') && $('#exp-new-cat').value.trim()) || '';
      if (!name) return showToast('اسم التصنيف مطلوب', 'bad');
      const c = await apiSend('POST', '/api/experience-categories', { name });
      cat = c ? String(c.id) : '';
    }
    const r = await apiSend('POST', '/api/life-experiences', { text, category_id: cat ? Number(cat) : null, source: 'manual' });
    play('success');
    showToast('تم حفظ التجربة ✓');
    if (r) state.journalSrv.experiences.unshift(r);
    closeModal();
  } catch (e) { showToast(e.message, 'bad'); }
}

/* ===== الإضافة السريعة (زر عائم + قائمة منبثقة: 11 خياراً) ===== */
const QUICK_ADD_OPTIONS = [
  { key: 'task',       ic: '✅', t: 'مهمة اليوم',   d: 'أضف مهمة لليوم' },
  { key: 'habit',      ic: '🔁', t: 'عادة جديدة',   d: 'عادة تتكرر' },
  { key: 'project',    ic: '📁', t: 'مشروع',        d: 'مشروع تركيز' },
  { key: 'journal',    ic: '📔', t: 'تدوينة يومية', d: 'دوّن عن يومك' },
  { key: 'idea',       ic: '💡', t: 'فكرة جديدة',   d: 'دوّن فكرة أو إجابة' },
  { key: 'experience', ic: '🧭', t: 'كتابة تجربة',  d: 'تجربة تعلمتها' },
  { key: 'book',       ic: '📚', t: 'كتاب + ملخص',  d: 'كتاب بتقييم وملخص' },
  { key: 'value',      ic: '💎', t: 'قيمة عليا',    d: 'قيمة أساسية' },
  { key: 'goal',       ic: '🎯', t: 'هدف سنوي',     d: 'هدف كبير' },
  { key: 'note',       ic: '📋', t: 'إضافة معلومة', d: 'فائدة سريعة' },
  { key: 'feeling',    ic: '💭', t: 'تفريغ المشاعر', d: 'فضفضة سريعة دون ترك شاشتك' },
  { key: 'library',    ic: '📖', t: 'المكتبة الشخصية', d: 'قفز لقسم المكتبة المعزول' }
];

function fabMenuHTML() {
  return QUICK_ADD_OPTIONS.map((o) => `
    <button class="fab-item" onclick="pickQuickAdd('${o.key}')">
      <span class="fab-item-ic">${o.ic}</span>
      <span class="fab-item-body"><span class="fm-t">${o.t}</span><span class="fm-d">${o.d}</span></span>
    </button>`).join('');
}

function toggleFabMenu() {
  const wrap = $('#fabWrap');
  if (!wrap) return;
  const open = wrap.classList.toggle('open');
  const btn = $('#fabMain');
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function closeFabMenu() {
  const wrap = $('#fabWrap');
  if (wrap) wrap.classList.remove('open');
  const btn = $('#fabMain');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function pickQuickAdd(key) {
  closeFabMenu();
  quickAddForm(key);
}

/* إعادة فتح القائمة بعد إغلاق نافذة النموذج */
function backToFabMenu() {
  closeModal();
  const wrap = $('#fabWrap');
  if (wrap) wrap.classList.add('open');
}

function quickAddForm(key) {
  if (key === 'experience') { openQuickExperience(); return; }
  if (key === 'note') { closeFabMenu(); openNoteModal(); return; }
  if (key === 'feeling') { quickAddFeelingForm(); return; }
  if (key === 'library') { closeFabMenu(); go('library'); return; }
  const opt = QUICK_ADD_OPTIONS.find((o) => o.key === key);
  const goals = NoorStore.getGoals();
  const week = NoorStore.weekInYear(NoorStore.todayStr());
  const weeks = NoorStore.yearWeeks();
  const values = NoorStore.getValues();
  const projects = NoorStore.getProjects();
  const back = `<div class="qa-back"><button class="btn btn-ghost" onclick="backToFabMenu()">← كل الخيارات</button></div>`;
  let body = '';
  if (key === 'task') {
    body = `
      <div class="field"><label>عنوان المهمة</label><input class="input" id="qa-title" placeholder="مثال: قراءة 20 صفحة"></div>
      <div class="field"><label>وصف (اختياري)</label><textarea class="input" id="qa-desc" rows="2"></textarea></div>
      <div class="field"><label>المشروع (اختياري)</label>
        <select class="input" id="qa-project"><option value="">— بدون مشروع —</option>
        ${projects.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select>
      </div>`;
  } else if (key === 'habit') {
    const firstGoal = goals[0] || null;
    const subs = firstGoal ? NoorStore.getSubgoals(firstGoal.id) : [];
    body = `
      <div class="field"><label>اسم العادة</label><input class="input" id="qa-title" placeholder="مثال: صلاة الفجر"></div>
      <div class="field"><label>الهدف</label>
        <select class="input" id="qa-goal" onchange="quickHabitSubs()">
          <option value="">— اختر هدفًا —</option>
          ${goals.map((g) => `<option value="${g.id}">${esc(g.title)}</option>`).join('')}
        </select></div>
      <div class="field"><label>المهمة الفرعية (الأسبوع)</label>
        <select class="input" id="qa-subgoal">
          ${subs.length ? subs.map((s) => `<option value="${s.id}">${esc(s.title)} (أسبوع ${s.week})</option>`).join('') : '<option value="">اختر هدفًا أولًا</option>'}
        </select></div>
      <div class="field"><label>الدقائق</label><input class="input" type="number" id="qa-minutes" value="5" min="0"></div>
      <div class="field"><label>أيام الأسبوع</label>
        <div class="day-pick" id="qa-habit-days">
          ${['أحد','اثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'].map((dn, i) => `<label class="day-opt"><input type="checkbox" value="${i}" checked>${dn}</label>`).join('')}
        </div></div>`;
  } else if (key === 'project') {
    body = `
      <div class="field"><label>اسم المشروع</label><input class="input" id="qa-title" placeholder="مثال: مشروع إتقان اللغة"></div>
      <div class="field"><label>النوع</label>
        <select class="input" id="qa-type">
          ${PROJECT_TYPES.map((t) => `<option value="${t.key}">${t.icon} ${t.title}</option>`).join('')}
        </select></div>
      <div class="field"><label>ملاحظات (اختياري)</label><textarea class="input" id="qa-desc" rows="2"></textarea></div>`;
  } else if (key === 'journal') {
    body = `
      <div class="field"><label>اليوم</label><input class="input" type="date" id="qa-date" value="${todayISO()}"></div>
      <div class="field"><label>نص يومك</label><textarea class="input" id="qa-text" rows="4" placeholder="ماذا فعلت اليوم؟ مشاعرك؟"></textarea></div>`;
  } else if (key === 'idea') {
    body = `
      <div class="field"><label>الفكرة</label><input class="input" id="qa-title" placeholder="مثال: منهج تعلم جديد"></div>
      <div class="field"><label>الإجابة أو التفاصيل (اختياري)</label><textarea class="input" id="qa-text" rows="3" placeholder="اشرح فكرتك…"></textarea></div>`;
  } else if (key === 'book') {
    body = `
      <div class="field"><label>عنوان الكتاب</label><input class="input" id="qa-title" placeholder="مثال: العادات الذرية"></div>
      <div class="field"><label>المؤلف (اختياري)</label><input class="input" id="qa-author"></div>
      <div class="field"><label>التقييم (من 5)</label><input class="input" type="number" id="qa-rating" min="0" max="5" step="1"></div>
      <div class="field"><label>الملخص</label><textarea class="input" id="qa-summary" rows="4" placeholder="أهم الأفكار المستخلصة…"></textarea></div>`;
  } else if (key === 'value') {
    body = `
      <div class="field"><label>عنوان القيمة</label><input class="input" id="qa-title" placeholder="مثال: الصدق"></div>
      <div class="field"><label>أيقونة (اختياري)</label><input class="input" id="qa-icon" placeholder="مثال: 🌟"></div>`;
  } else if (key === 'goal') {
    body = `
      <div class="field"><label>عنوان الهدف</label><input class="input" id="qa-title" placeholder="مثال: إتقان البرمجة"></div>
      <div class="field"><label>القيمة المرتبطة</label>
        <select class="input" id="qa-value"><option value="">— بدون قيمة —</option>
        ${values.map((v) => `<option value="${v.id}">${esc(v.title)}</option>`).join('')}</select></div>
      <div class="field"><label>أيقونة (اختياري)</label><input class="input" id="qa-icon" placeholder="مثال: 🎯"></div>`;
  }
  openModal(`${opt.ic} ${opt.t}`, `${back}${body}
    <div class="modal-actions">
      <button class="btn" onclick="saveQuickAdd('${key}')">إضافة</button>
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>`);
}

function quickHabitSubs() {
  const gid = Number(($('#qa-goal') && $('#qa-goal').value) || 0);
  const sel = $('#qa-subgoal');
  if (!sel) return;
  const subs = gid ? NoorStore.getSubgoals(gid) : [];
  sel.innerHTML = subs.length
    ? subs.map((s) => `<option value="${s.id}">${esc(s.title)} (أسبوع ${s.week})</option>`).join('')
    : '<option value="">لا توجد مهام فرعية</option>';
}

/* تفريغ المشاعر السريع — نافذة صغيرة دون مغادرة الشاشة الحالية */
function quickAddFeelingForm() {
  openModal('💭 تفريغ المشاعر والأفكار', `
    <p class="count" style="margin-bottom:10px">اكتب ما يضغط عليك الآن — التفريغ يحوّل الضغط إلى صفاء. سيبقى سجلّك محفوظًا في مساحة الوعي.</p>
    <div class="field"><textarea class="input" id="qa-feel-text" rows="5" placeholder="كيف أشعر الآن؟ ماذا يقلقني؟ ماذا أريد؟"></textarea></div>
    <div class="modal-actions">
      <button class="btn" onclick="saveQuickFeeling()">تفريغ الآن</button>
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>`);
  requestAnimationFrame(() => { const t = $('#qa-feel-text'); if (t) t.focus(); });
}

async function saveQuickFeeling() {
  const text = ($('#qa-feel-text') && $('#qa-feel-text').value.trim()) || '';
  if (!text) return showToast('اكتب شيئًا أولًا', 'bad');
  try {
    await apiSend('POST', '/api/journal/feelings', { date: todayISO(), text });
    closeModal(); play('success'); showToast('تم التفريغ — أُحفظ في مساحة الوعي');
  } catch (e) { showToast(e.message, 'bad'); }
}

async function saveQuickAdd(key) {
  const val = (id) => ($('#' + id) && $('#' + id).value.trim()) || '';
  const valN = (id) => Number($('#' + id) && $('#' + id).value);
  try {
    if (key === 'task') {
      const title = val('qa-title');
      if (!title) return showToast('عنوان المهمة مطلوب', 'bad');
      NoorStore.addTask({ title, desc: val('qa-desc'), project_id: val('qa-project') || null });
    } else if (key === 'habit') {
      const title = val('qa-title');
      const subgoal_id = Number(($('#qa-subgoal') && $('#qa-subgoal').value) || 0);
      if (!title) return showToast('اسم العادة مطلوب', 'bad');
      if (!subgoal_id) return showToast('اختر الهدف والمهمة الفرعية', 'bad');
      const days = Array.from(document.querySelectorAll('#qa-habit-days input:checked')).map((c) => Number(c.value));
      if (!days.length) return showToast('اختر يومًا واحدًا على الأقل', 'bad');
      NoorStore.addHabit({
        subgoal_id, title, days,
        minutes: Math.max(0, valN('qa-minutes') || 0),
        week: NoorStore.weekInYear(NoorStore.todayStr()),
        weeks: NoorStore.yearWeeks()
      });
    } else if (key === 'project') {
      const name = val('qa-title');
      if (!name) return showToast('اسم المشروع مطلوب', 'bad');
      NoorStore.addProject({ name, notes: val('qa-desc'), type: val('qa-type') || 'عام', days: [0,1,2,3,4,5,6], week: NoorStore.weekInYear(NoorStore.todayStr()), weeks: NoorStore.yearWeeks(), priority: 99 });
    } else if (key === 'journal') {
      const date = ($('#qa-date') && $('#qa-date').value) || todayISO();
      const text = val('qa-text');
      if (!text) return showToast('اكتب نص اليومية أولًا', 'bad');
      NoorStore.addPost({ space: 'awareness', title: 'يومية ' + date, text, date });
    } else if (key === 'idea') {
      const title = val('qa-title');
      const text = val('qa-text');
      if (!title && !text) return showToast('اكتب فكرتك أولًا', 'bad');
      NoorStore.addPost({ space: 'knowledge', title: title || 'فكرة', text, date: todayISO(), tags: ['idea'] });
    } else if (key === 'book') {
      const name = val('qa-title');
      if (!name) return showToast('عنوان الكتاب مطلوب', 'bad');
      NoorStore.addProject({ name, type: 'كتاب', author: val('qa-author'), rating: Math.min(5, Math.max(0, valN('qa-rating') || 0)), summary: val('qa-summary'), days: [0,1,2,3,4,5,6], week: NoorStore.weekInYear(NoorStore.todayStr()), weeks: NoorStore.yearWeeks(), priority: 99 });
    } else if (key === 'value') {
      const title = val('qa-title');
      if (!title) return showToast('عنوان القيمة مطلوب', 'bad');
      NoorStore.addValue({ title, icon: val('qa-icon') || '◆', color: '', priority: 1 });
    } else if (key === 'goal') {
      const title = val('qa-title');
      if (!title) return showToast('عنوان الهدف مطلوب', 'bad');
      const year = NoorStore.yearIndex(NoorStore.todayStr());
      NoorStore.addGoal({ title, icon: val('qa-icon') || '🎯', color: '', year, years: [year], duration_years: 1, value_id: val('qa-value') || null });
    }
    play('success');
    showToast('تمت الإضافة ✓');
    closeModal();
    refreshQuickAddView();
  } catch (e) { showToast(e.message, 'bad'); }
}

function refreshQuickAddView() {
  const page = state.page;
  if (page === 'tasks') renderTasks();
  else if (page === 'journal') renderJournal();
  else if (page === 'projects') renderProjects();
  else if (page === 'vision' || page === 'stats') refreshGoalsViews();
  else if (page === 'archive') renderArchive();
  else if (page === 'timer') renderTimer();
  else if (page === 'library') renderLibrary();
}

/* ===== هوية v3: عنوان الصفحة يظهر مرة واحدة (الترويسة العلوية هي المرجع) ===== */
(function dedupePageTitle() {
  const header = document.getElementById('page-title');
  const content = document.getElementById('content');
  if (!header || !content) return;
  let busy = false;
  const run = () => {
    if (busy) return; busy = true;
    const t = (header.textContent || '').trim();
    content.querySelectorAll('.page-head .page-title').forEach((el) => {
      el.classList.toggle('is-dup', (el.textContent || '').trim() === t);
    });
    busy = false;
  };
  if (window.MutationObserver) {
    const mo = new MutationObserver(run);
    mo.observe(content, { childList: true });
    mo.observe(header, { childList: true, characterData: true, subtree: true });
  }
  run();
})();
