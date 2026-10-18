'use strict';

const SESSION_COOKIE = 'noor_session';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const PASSWORD_MIN_LENGTH = 14;
const MAX_JSON_BYTES = 12 * 1024 * 1024;
const MAX_FILE_BYTES = 20 * 1024 * 1024; // KV values are capped below 25 MiB
const PBKDF2_ITERATIONS = 310000;
const EMBEDDED_ASSETS = null;
const EMBEDDED_MIME = {
  'index.html': 'text/html; charset=utf-8',
  'css/style.css': 'text/css; charset=utf-8',
  'css/planner.css': 'text/css; charset=utf-8',
  'css/glass.css': 'text/css; charset=utf-8',
  'js/security.js': 'text/javascript; charset=utf-8',
  'js/lock.js': 'text/javascript; charset=utf-8',
  'js/store.js': 'text/javascript; charset=utf-8',
  'js/app.js': 'text/javascript; charset=utf-8',
  'js/planner.js': 'text/javascript; charset=utf-8',
  'js/source-rules.js': 'text/javascript; charset=utf-8'
};

function securityHeaders(extra) {
  return Object.assign({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cache-Control': 'no-store'
  }, extra || {});
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: securityHeaders(Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers || {}))
  });
}

function fail(message, status, code) {
  return json({ ok: false, error: message, code: code || 'request_failed' }, status || 400);
}

function hex(bytes) {
  return Array.from(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
}

function fromHex(text) {
  if (typeof text !== 'string' || !/^(?:[a-f0-9]{2})+$/i.test(text)) throw new Error('invalid_hex');
  const out = new Uint8Array(text.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(text.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function equalConstantTime(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i % (a.length || 1)) || 0) ^ (b.charCodeAt(i % (b.length || 1)) || 0);
  return diff === 0;
}

function randomHex(size) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return hex(bytes);
}

function randomToken() {
  return randomHex(32);
}

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return hex(new Uint8Array(digest));
}

async function passwordHash(password, saltHex) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt: fromHex(saltHex),
    iterations: PBKDF2_ITERATIONS,
    hash: 'SHA-256'
  }, key, 256);
  return hex(new Uint8Array(bits));
}

function passwordValid(password) {
  return typeof password === 'string' &&
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= 128 &&
    !/^\s+$/.test(password);
}

function validEmail(email) {
  return typeof email === 'string' &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validWrappedKey(salt, wrapped) {
  return typeof salt === 'string' && /^[a-f0-9]{32}$/i.test(salt) &&
    wrapped && typeof wrapped === 'object' &&
    typeof wrapped.iv === 'string' && /^[a-zA-Z0-9_-]{16,32}$/.test(wrapped.iv) &&
    typeof wrapped.ciphertext === 'string' && wrapped.ciphertext.length >= 40 &&
    wrapped.ciphertext.length <= 512 &&
    /^[a-zA-Z0-9_-]+$/.test(wrapped.ciphertext);
}

function validEncryptedPayload(value) {
  return value && typeof value === 'object' &&
    value.encrypted === true &&
    value.v === 1 &&
    typeof value.iv === 'string' && /^[a-zA-Z0-9_-]{16,32}$/.test(value.iv) &&
    typeof value.ciphertext === 'string' &&
    value.ciphertext.length >= 16 &&
    value.ciphertext.length <= 16 * 1024 * 1024 &&
    /^[a-zA-Z0-9_-]+$/.test(value.ciphertext);
}

function cookieToken(request) {
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === SESSION_COOKIE) return part.slice(idx + 1).trim();
  }
  return '';
}

function sessionCookie(token) {
  return SESSION_COOKIE + '=' + token + '; Path=/; Max-Age=' + SESSION_TTL_SECONDS + '; HttpOnly; Secure; SameSite=Strict';
}

function clearedCookie() {
  return SESSION_COOKIE + '=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict';
}

function jsonRequest(request) {
  const ct = (request.headers.get('Content-Type') || '').toLowerCase();
  return ct.indexOf('application/json') === 0;
}

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  if (origin) {
    try { if (new URL(origin).origin !== new URL(request.url).origin) return false; }
    catch (_) { return false; }
  }
  if (fetchSite === 'cross-site') return false;
  return true;
}

async function readJson(request) {
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > MAX_JSON_BYTES) throw new Error('body_too_large');
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_JSON_BYTES) throw new Error('body_too_large');
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text);
}

async function findSession(request, env) {
  const token = cookieToken(request);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    'SELECT s.token_hash, s.user_id, s.expires_at, u.email, u.wrap_salt, u.wrapped_key ' +
    'FROM noor_sessions s JOIN noor_users u ON u.id = s.user_id ' +
    'WHERE s.token_hash = ? AND s.expires_at > ?'
  ).bind(tokenHash, now).first();
  if (!row) return null;
  return { id: row.user_id, email: row.email, wrap_salt: row.wrap_salt, wrapped_key: row.wrapped_key, token_hash: row.token_hash };
}

async function createSession(userId, env) {
  const token = randomToken();
  const tokenHash = await sha256(token);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    'INSERT INTO noor_sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(tokenHash, userId, now, now + SESSION_TTL_SECONDS).run();
  return { token: token, cookie: sessionCookie(token) };
}

async function recordFailedLogin(env, email, ip) {
  const now = Math.floor(Date.now() / 1000);
  const bucketHash = await sha256('login|' + email + '|' + ip);
  const old = await env.DB.prepare('SELECT attempts, window_start, blocked_until FROM noor_auth_limits WHERE id = ?')
    .bind(bucketHash).first();

  let attempts = 1;
  let windowStart = now;
  let blockedUntil = 0;
  if (old && now - Number(old.window_start) < 600) {
    attempts = Number(old.attempts) + 1;
    windowStart = Number(old.window_start);
    blockedUntil = Number(old.blocked_until || 0);
  }
  if (attempts >= 5) blockedUntil = now + 900;

  await env.DB.prepare(
    'INSERT INTO noor_auth_limits (id, attempts, window_start, blocked_until) VALUES (?, ?, ?, ?) ' +
    'ON CONFLICT(id) DO UPDATE SET attempts = excluded.attempts, window_start = excluded.window_start, blocked_until = excluded.blocked_until'
  ).bind(bucketHash, attempts, windowStart, blockedUntil).run();
  return blockedUntil > now;
}

async function isRateLimited(env, email, ip) {
  const key = await sha256('login|' + email + '|' + ip);
  const row = await env.DB.prepare('SELECT blocked_until FROM noor_auth_limits WHERE id = ?').bind(key).first();
  return !!(row && Number(row.blocked_until) > Math.floor(Date.now() / 1000));
}

async function clearFailedLogins(env, email, ip) {
  const key = await sha256('login|' + email + '|' + ip);
  await env.DB.prepare('DELETE FROM noor_auth_limits WHERE id = ?').bind(key).run();
}

async function noUsers(env) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM noor_users').first();
  return Number(row && row.n || 0) === 0;
}

async function authStatus(request, env) {
  const setupRequired = await noUsers(env);
  const user = await findSession(request, env);
  return json({
    ok: true,
    setup_required: setupRequired,
    authenticated: !!user,
    email: user ? user.email : null
  });
}

async function authSetup(request, env) {
  if (!sameOrigin(request)) return fail('طلب غير مسموح', 403, 'origin_rejected');
  if (!jsonRequest(request)) return fail('نوع الطلب غير صالح', 415);
  let body;
  try { body = await readJson(request); } catch (e) { return fail('تعذر قراءة البيانات', 400); }

  const email = String(body.email || '').trim().toLowerCase();
  const password = body.password;
  if (!validEmail(email)) return fail('البريد الإلكتروني غير صالح', 400);
  if (!passwordValid(password)) return fail('استخدم عبارة مرور لا تقل عن 14 محرفاً', 400, 'weak_password');
  if (!validWrappedKey(body.wrap_salt, body.wrapped_key)) return fail('تعذر إنشاء مفتاح التشفير المحلي', 400);

  if (!(await noUsers(env))) return fail('تم إعداد الحساب مسبقاً؛ استخدم تسجيل الدخول', 409, 'setup_complete');
  if (typeof env.NOOR_SETUP_TOKEN !== 'string' || !env.NOOR_SETUP_TOKEN) {
    return fail('بوابة التأسيس الأولى غير مهيأة بعد', 503, 'setup_gate_unconfigured');
  }
  if (!equalConstantTime(String(body.setup_token || ''), env.NOOR_SETUP_TOKEN)) {
    return fail('رمز التهيئة لمرة واحدة غير صحيح', 403, 'invalid_setup_token');
  }

  const pwSalt = randomHex(16);
  const pwHash = await passwordHash(password, pwSalt);
  try {
    await env.DB.prepare(
      'INSERT INTO noor_users (id, email, password_salt, password_hash, wrap_salt, wrapped_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind('owner', email, pwSalt, pwHash, body.wrap_salt, JSON.stringify(body.wrapped_key), new Date().toISOString()).run();
  } catch (_) {
    return fail('تم إنشاء الحساب بالفعل أو البريد غير متاح', 409, 'setup_race');
  }

  const session = await createSession('owner', env);
  return json({
    ok: true,
    email: email,
    wrap_salt: body.wrap_salt,
    wrapped_key: body.wrapped_key,
    revision: 0
  }, 200, { 'Set-Cookie': session.cookie });
}

async function authLogin(request, env) {
  if (!sameOrigin(request)) return fail('طلب غير مسموح', 403, 'origin_rejected');
  if (!jsonRequest(request)) return fail('نوع الطلب غير صالح', 415);
  let body;
  try { body = await readJson(request); } catch (_) { return fail('تعذر قراءة البيانات', 400); }

  const email = String(body.email || '').trim().toLowerCase();
  const password = body.password;
  if (!validEmail(email) || typeof password !== 'string' || password.length > 128) {
    return fail('بيانات الدخول غير صحيحة', 401, 'invalid_credentials');
  }

  const ip = await sha256(request.headers.get('CF-Connecting-IP') || 'unknown-client');
  if (await isRateLimited(env, email, ip)) return fail('محاولات كثيرة. انتظر 15 دقيقة ثم أعد المحاولة.', 429, 'rate_limited');

  const row = await env.DB.prepare(
    'SELECT id, email, password_salt, password_hash, wrap_salt, wrapped_key FROM noor_users WHERE email = ?'
  ).bind(email).first();

  const providedHash = await passwordHash(password, row ? row.password_salt : randomHex(16));
  if (!row || !equalConstantTime(providedHash, row.password_hash)) {
    await recordFailedLogin(env, email, ip);
    return fail('البريد أو كلمة المرور غير صحيحة', 401, 'invalid_credentials');
  }

  await clearFailedLogins(env, email, ip);
  const session = await createSession(row.id, env);
  const snap = await env.DB.prepare('SELECT revision FROM noor_snapshots WHERE user_id = ?').bind(row.id).first();
  return json({
    ok: true,
    email: row.email,
    wrap_salt: row.wrap_salt,
    wrapped_key: JSON.parse(row.wrapped_key),
    revision: Number(snap && snap.revision || 0)
  }, 200, { 'Set-Cookie': session.cookie });
}

async function authLogout(request, env) {
  if (!sameOrigin(request)) return fail('طلب غير مسموح', 403, 'origin_rejected');
  const token = cookieToken(request);
  if (token) {
    const hash = await sha256(token);
    await env.DB.prepare('DELETE FROM noor_sessions WHERE token_hash = ?').bind(hash).run();
  }
  return json({ ok: true }, 200, { 'Set-Cookie': clearedCookie() });
}

async function authPassword(request, env) {
  if (!sameOrigin(request)) return fail('طلب غير مسموح', 403, 'origin_rejected');
  if (!jsonRequest(request)) return fail('نوع الطلب غير صالح', 415);
  const user = await findSession(request, env);
  if (!user) return fail('انتهت الجلسة. سجّل الدخول مجدداً.', 401, 'auth_required');

  let body;
  try { body = await readJson(request); } catch (_) { return fail('تعذر قراءة البيانات', 400); }
  if (typeof body.current_password !== 'string' || typeof body.new_password !== 'string') return fail('أدخل كلمة المرور الحالية والجديدة', 400);
  if (!passwordValid(body.new_password)) return fail('اجعل كلمة المرور الجديدة 14 محرفاً على الأقل', 400, 'weak_password');
  if (body.current_password === body.new_password) return fail('اختر كلمة مرور مختلفة عن الحالية', 400);
  if (!validWrappedKey(body.wrap_salt, body.wrapped_key)) return fail('بيانات التشفير غير صالحة', 400);

  const row = await env.DB.prepare('SELECT password_salt, password_hash FROM noor_users WHERE id = ?').bind(user.id).first();
  const oldHash = await passwordHash(body.current_password, row.password_salt);
  if (!equalConstantTime(oldHash, row.password_hash)) return fail('كلمة المرور الحالية غير صحيحة', 401, 'invalid_credentials');

  const newSalt = randomHex(16);
  const newHash = await passwordHash(body.new_password, newSalt);
  await env.DB.batch([
    env.DB.prepare('UPDATE noor_users SET password_salt = ?, password_hash = ?, wrap_salt = ?, wrapped_key = ? WHERE id = ? AND password_salt = ? AND password_hash = ?')
      .bind(newSalt, newHash, body.wrap_salt, JSON.stringify(body.wrapped_key), user.id, row.password_salt, row.password_hash),
    env.DB.prepare('DELETE FROM noor_sessions WHERE user_id = ? AND token_hash <> ?')
      .bind(user.id, user.token_hash)
  ]);
  return json({ ok: true, message: 'تم تغيير كلمة المرور. أُغلقت الجلسات الأخرى.' });
}

async function requireUser(request, env) {
  return await findSession(request, env);
}

async function syncInfo(request, env, user) {
  const row = await env.DB.prepare('SELECT revision, updated_at FROM noor_snapshots WHERE user_id = ?').bind(user.id).first();
  return json({
    ok: true,
    exists: !!row,
    revision: Number(row && row.revision || 0),
    saved_at: row ? row.updated_at : null,
    db_ok: true
  });
}

async function syncGet(request, env, user) {
  const row = await env.DB.prepare('SELECT revision, payload, updated_at FROM noor_snapshots WHERE user_id = ?').bind(user.id).first();
  if (!row) return fail('لا توجد نسخة سحابية بعد', 404, 'snapshot_missing');
  let payload;
  try { payload = JSON.parse(row.payload); } catch (_) { return fail('تعذر قراءة النسخة المشفرة', 500, 'snapshot_corrupt'); }
  if (!validEncryptedPayload(payload)) return fail('النسخة لا تطابق صيغة التشفير المطلوبة', 500, 'snapshot_not_encrypted');
  return json(payload, 200, {
    'X-Noor-Revision': String(row.revision),
    'X-Noor-Saved-At': row.updated_at
  });
}

async function syncPost(request, env, user) {
  if (!sameOrigin(request)) return fail('طلب غير مسموح', 403, 'origin_rejected');
  if (!jsonRequest(request)) return fail('نوع الطلب غير صالح', 415);
  let payload;
  try { payload = await readJson(request); } catch (e) {
    return fail(e && e.message === 'body_too_large' ? 'النسخة أكبر من الحد المسموح' : 'بيانات النسخ غير صالحة', e && e.message === 'body_too_large' ? 413 : 400);
  }
  if (!validEncryptedPayload(payload)) return fail('لا تُقبل البيانات إلا بصيغة مشفرة من المتصفح', 400, 'encryption_required');

  const match = request.headers.get('If-Match');
  if (match === null || !/^\d+$/.test(match)) return fail('رقم مراجعة المزامنة مفقود', 428, 'revision_required');
  const expectedRevision = Number(match);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return fail('رقم مراجعة غير صالح', 400);

  const current = await env.DB.prepare('SELECT revision FROM noor_snapshots WHERE user_id = ?').bind(user.id).first();
  const currentRevision = Number(current && current.revision || 0);
  if (currentRevision !== expectedRevision) {
    return fail('توجد تغييرات أحدث من جهاز آخر. لم يتم استبدالها.', 409, 'revision_conflict');
  }

  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    'INSERT INTO noor_snapshots (user_id, revision, payload, updated_at) VALUES (?, 1, ?, ?) ' +
    'ON CONFLICT(user_id) DO UPDATE SET revision = noor_snapshots.revision + 1, payload = excluded.payload, updated_at = excluded.updated_at ' +
    'WHERE noor_snapshots.revision = ?'
  ).bind(user.id, JSON.stringify(payload), now, expectedRevision).run();

  if (!result.meta || Number(result.meta.changes) !== 1) {
    const latest = await env.DB.prepare('SELECT revision, updated_at FROM noor_snapshots WHERE user_id = ?').bind(user.id).first();
    return fail('توجد تغييرات أحدث من جهاز آخر. لم يتم استبدالها.', 409, 'revision_conflict');
  }
  const saved = await env.DB.prepare('SELECT revision FROM noor_snapshots WHERE user_id = ?').bind(user.id).first();
  return json({ ok: true, saved_at: now, revision: Number(saved.revision) });
}

async function uploadFile(request, env, user) {
  if (!sameOrigin(request)) return fail('طلب غير مسموح', 403, 'origin_rejected');
  if (!env.FILES) return fail('تخزين الملفات غير مربوط', 503, 'file_storage_unavailable');
  const size = Number(request.headers.get('Content-Length') || 0);
  if (size > MAX_FILE_BYTES + 32) return fail('الحد الحالي للملف المشفر 20 ميغابايت؛ فعّل تخزين R2 للملفات الأكبر', 413, 'file_too_large');
  const iv = request.headers.get('X-Noor-IV') || '';
  const requestedMime = (request.headers.get('X-Noor-Mime') || 'application/octet-stream').trim().toLowerCase().slice(0, 120);
  const mimePattern = new RegExp('^[a-z0-9!#$&^_.+-]+/[a-z0-9!#$&^_.+-]+$');
  const mime = mimePattern.test(requestedMime) ? requestedMime : 'application/octet-stream';
  if (!/^[a-zA-Z0-9_-]{16,32}$/.test(iv)) return fail('بيانات تشفير الملف غير صالحة', 400);
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_FILE_BYTES + 32) return fail('الحد الحالي للملف المشفر 20 ميغابايت؛ فعّل تخزين R2 للملفات الأكبر', 413, 'file_too_large');
  const id = crypto.randomUUID();
  const objectKey = user.id + '/' + id;
  await env.FILES.put(objectKey, bytes, { metadata: { iv: iv, mime_type: mime, user_id: user.id, size_bytes: bytes.byteLength } });
  try {
    await env.DB.prepare('INSERT INTO noor_files (id, user_id, object_key, iv, mime_type, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, user.id, objectKey, iv, mime, bytes.byteLength, new Date().toISOString()).run();
  } catch (_) {
    await env.FILES.delete(objectKey);
    return fail('تعذر تسجيل الملف بعد رفعه', 500);
  }
  return json({ ok: true, url: '/api/files/' + id, name: 'ملف خاص', id: id });
}

async function readFile(request, env, user, id) {
  const row = await env.DB.prepare('SELECT object_key, iv, mime_type, size_bytes FROM noor_files WHERE id = ? AND user_id = ?')
    .bind(id, user.id).first();
  if (!row) return fail('الملف غير موجود', 404, 'file_not_found');
  const object = await env.FILES.get(row.object_key, 'arrayBuffer');
  if (!object) return fail('الملف غير موجود في التخزين', 404, 'file_missing');
  return new Response(object, {
    status: 200,
    headers: securityHeaders({
      'Content-Type': 'application/octet-stream',
      'X-Noor-Encrypted': '1',
      'X-Noor-IV': row.iv,
      'X-Noor-Mime': row.mime_type || 'application/octet-stream',
      'Content-Length': String(row.size_bytes),
      'Content-Disposition': 'attachment',
      'X-Content-Type-Options': 'nosniff'
    })
  });
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method === 'GET' && path === '/api/health') return json({ ok: true, db: 'connected' });
  if (request.method === 'GET' && path === '/api/auth/status') return authStatus(request, env);

  if (path.startsWith('/api/auth/')) {
    if (request.method !== 'POST') return fail('طريقة الطلب غير مدعومة', 405);
    if (path === '/api/auth/setup') return authSetup(request, env);
    if (path === '/api/auth/login') return authLogin(request, env);
    if (path === '/api/auth/logout') return authLogout(request, env);
    if (path === '/api/auth/password') return authPassword(request, env);
    return fail('المسار غير موجود', 404);
  }

  if (path.startsWith('/api/')) {
    const user = await requireUser(request, env);
    if (!user) return fail('سجّل الدخول أولاً', 401, 'auth_required');

    if (request.method === 'GET' && path === '/api/sync/info') return syncInfo(request, env, user);
    if (request.method === 'GET' && path === '/api/sync') return syncGet(request, env, user);
    if (request.method === 'POST' && path === '/api/sync') return syncPost(request, env, user);

    if (request.method === 'PUT' && path.startsWith('/api/upload/')) return uploadFile(request, env, user);
    const fileMatch = path.match(/^\/api\/files\/([0-9a-f-]{36})$/i);
    if (request.method === 'GET' && fileMatch) return readFile(request, env, user, fileMatch[1]);
    return fail('المسار غير موجود', 404);
  }

  return null;
}

function securedAssetResponse(response) {
  const headers = new Headers(response.headers);
  const extra = securityHeaders();
  Object.entries(extra).forEach(function (entry) { headers.set(entry[0], entry[1]); });
  headers.set('Content-Security-Policy',
    "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; frame-src https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.dailymotion.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: headers });
}

export default {
  async fetch(request, env, ctx) {
    try {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: securityHeaders({ 'Allow': 'GET, POST, PUT, OPTIONS' }) });
      }
      const url = new URL(request.url);
      if (url.pathname.startsWith('/api/')) {
        const response = await handleApi(request, env);
        if (response) return response;
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') return fail('طريقة الطلب غير مدعومة', 405);
      let asset;
      if (env.ASSETS) {
        asset = await env.ASSETS.fetch(request);
      } else if (EMBEDDED_ASSETS) {
        const key = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
        const selected = EMBEDDED_ASSETS[key];
        if (typeof selected !== 'string') return fail('الملف غير موجود', 404, 'asset_not_found');
        const body = request.method === 'HEAD' ? null : selected;
        asset = new Response(body, { status: 200, headers: {
          'Content-Type': EMBEDDED_MIME[key] || 'application/octet-stream',
          'Cache-Control': 'no-store'
        }});
      } else {
        return json({ ok: false, error: 'الأصول غير مربوطة' }, 503);
      }
      return securedAssetResponse(asset);
    } catch (error) {
      console.error('[noor] request failure:', error && error.message || 'unknown');
      return fail('حدث خطأ داخلي. لم يتم عرض تفاصيل الخادم.', 500, 'internal_error');
    }
  }
};
