/* Noor secure authentication bootstrap.
 * The browser authenticates with the same-origin Worker API and unlocks the
 * encryption key locally. No password, encryption key, or service secret is
 * stored in browser storage or shipped in the source bundle.
 */
(function () {
  'use strict';

  var STATUS_URL = '/api/auth/status';
  var lockState = { setupRequired: false, offline: false, busy: false };
  var $ = function (id) { return document.getElementById(id); };

  function msg(text, bad) {
    var el = $('lockMsg');
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !text;
    el.classList.toggle('is-error', !!bad);
  }

  function setBusy(busy) {
    lockState.busy = !!busy;
    var button = $('lockSubmit');
    if (button) {
      button.disabled = lockState.busy;
      button.textContent = lockState.busy
        ? 'جارٍ التحقق…'
        : (lockState.setupRequired ? 'إنشاء الحساب المشفّر' : 'دخول آمن');
    }
  }

  function configureView(setupRequired, offline) {
    lockState.setupRequired = !!setupRequired;
    lockState.offline = !!offline;
    var heading = $('lockTitle');
    var subtitle = $('lockSub');
    var email = $('lockEmail');
    var password = $('lockInput');
    var confirmWrap = $('lockConfirmWrap');
    var confirm = $('lockConfirm');
    var label = $('lockPasswordLabel');
    var hint = $('lockHint');
    var status = $('lockMode');
    if (heading) heading.textContent = setupRequired ? 'تهيئة خزنتك الخاصة' : 'مرحباً بعودتك';
    if (subtitle) subtitle.textContent = setupRequired
      ? 'أنشئ حسابك الأول. لا تُرسل بيانات خطتك إلا بعد فتح التشفير.'
      : 'تسجيل دخول حقيقي مع تشفير للبيانات داخل جهازك.';
    if (label) label.textContent = 'عبارة المرور';
    if (email) email.autocomplete = setupRequired ? 'email' : 'username';
    if (password) password.autocomplete = setupRequired ? 'new-password' : 'current-password';
    if (confirmWrap) confirmWrap.hidden = !setupRequired;
    if (confirm) confirm.required = !!setupRequired;
    if (hint) hint.textContent = offline
      ? 'وضع محلي: ستفتح النسخة المشفّرة المحفوظة على هذا الجهاز، وتنتظر المزامنة عودة الاتصال.'
      : setupRequired
        ? 'استخدم 14 محرفاً على الأقل. هذه العبارة تحمي الحساب ومفتاح تشفير البيانات.'
        : 'مفتاح التشفير لا يُحفظ مكشوفاً. أعد إدخال عبارة المرور في كل جلسة جديدة.';
    if (status) status.textContent = offline
      ? 'نسخة محلية مشفّرة — الخادم غير متاح'
      : setupRequired
        ? 'الخطوة الأولى: إنشاء الحساب'
        : 'الاتصال بالحساب المحمي';
    setBusy(false);
  }

  function validPassword(password) {
    return typeof password === 'string' && password.length >= 14 && password.length <= 128 && !/^\s+$/.test(password);
  }

  async function apiPost(path, body) {
    var response = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    var result = await response.json().catch(function () { return {}; });
    if (!response.ok || !result.ok) {
      var error = new Error(result.error || 'تعذر إكمال العملية');
      error.code = result.code || '';
      error.status = response.status;
      throw error;
    }
    return result;
  }

  function addScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error('تعذر تحميل مكوّن نُور: ' + src)); };
      document.body.appendChild(script);
    });
  }

  async function boot(snapshot) {
    if (snapshot) {
      window.NOOR_BOOT_SNAPSHOT = snapshot;
      try { window.NoorSecurity.restoreVolatile(snapshot.client_state || {}); } catch (_) {}
    } else {
      window.NOOR_BOOT_SNAPSHOT = null;
    }
    window.NOOR_CLOUD_MODE = true;
    var overlay = $('noorLock');
    if (overlay) overlay.remove();
    document.body.classList.add('noor-unlocked');

    await addScript('js/store.js?v=cloud-secure-1');
    await addScript('js/app.js?v=cloud-secure-1');
    window.NOOR_APP_READY = true;
    mountAccountControls();
    if (window.NOOR_OFFLINE) {
      updateSyncBadge('وضع محلي — المزامنة تنتظر الاتصال', 'warn');
    }
  }

  function updateSyncBadge(text, kind) {
    var statusText = $('statusText');
    var dot = $('statusDot');
    if (statusText) statusText.textContent = text;
    if (dot) {
      dot.classList.toggle('connected', kind === 'ok');
      dot.classList.toggle('warn', kind === 'warn');
    }
  }

  function mountAccountControls() {
    var host = $('noor-account-control');
    if (!host) return;
    host.hidden = false;
    var btn = $('noor-account-button');
    var menu = $('noor-account-menu');
    var mail = $('noor-account-email');
    var email = window.NoorSecurity.getEmail();
    if (mail) mail.textContent = email || 'الحساب الخاص';
    if (btn && menu) {
      btn.onclick = function () { menu.hidden = !menu.hidden; };
      document.addEventListener('click', function (event) {
        if (!host.contains(event.target)) menu.hidden = true;
      });
    }
    var change = $('noor-change-password');
    var logout = $('noor-logout');
    if (change) change.onclick = function () { if (menu) menu.hidden = true; openPasswordDialog(); };
    if (logout) logout.onclick = function () { if (menu) menu.hidden = true; logoutNow(); };
    bindPasswordDialog();
  }

  function openPasswordDialog() {
    var dialog = $('noor-security-dialog');
    var form = $('noor-password-form');
    var status = $('noor-password-status');
    if (form) form.reset();
    if (status) { status.textContent = ''; status.classList.remove('error'); }
    if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
    else if (dialog) dialog.setAttribute('open', '');
  }

  var passwordDialogBound = false;
  function bindPasswordDialog() {
    if (passwordDialogBound) return;
    var form = $('noor-password-form');
    var dialog = $('noor-security-dialog');
    if (!form) return;
    passwordDialogBound = true;
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var current = $('noor-current-password').value;
      var next = $('noor-new-password').value;
      var confirm = $('noor-confirm-password').value;
      var status = $('noor-password-status');
      var button = $('noor-password-submit');
      if (next !== confirm) {
        status.textContent = 'عبارتا المرور الجديدتان غير متطابقتين.';
        status.classList.add('error');
        return;
      }
      if (!validPassword(next)) {
        status.textContent = 'استخدم عبارة مرور جديدة لا تقل عن 14 محرفاً.';
        status.classList.add('error');
        return;
      }
      button.disabled = true;
      status.textContent = 'جارٍ تحديث حماية الحساب…';
      status.classList.remove('error');
      try {
        await window.NoorSecurity.changePassword(current, next);
        status.textContent = 'تم تغيير كلمة المرور. تبقى بياناتك مشفّرة بالمفتاح نفسه.';
        form.reset();
        setTimeout(function () { if (dialog && dialog.open) dialog.close(); }, 1200);
      } catch (error) {
        status.textContent = error.message || 'تعذر تغيير كلمة المرور.';
        status.classList.add('error');
      } finally {
        button.disabled = false;
      }
    });
    var close = $('noor-password-close');
    if (close) close.onclick = function () { if (dialog && dialog.open) dialog.close(); else if (dialog) dialog.removeAttribute('open'); };
  }

  async function logoutNow() {
    try {
      if (!window.NOOR_OFFLINE) {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
      }
    } catch (_) {}
    location.reload();
  }

  async function setupAccount(email, password) {
    var preparation = await window.NoorSecurity.prepareSetup(password);
    var result = await apiPost('/api/auth/setup', {
      email: email,
      password: password,
      wrap_salt: preparation.wrap_salt,
      wrapped_key: preparation.wrapped_key
    });
    window.NoorSecurity.activate(
      preparation.key,
      result.email,
      result.wrap_salt,
      result.wrapped_key,
      result.revision || 0,
      true
    );
    window.NoorSecurity.setVaultMeta(result.email, result.wrap_salt, result.wrapped_key, result.revision || 0);
    window.NOOR_OFFLINE = false;
    window.NoorSecurity.setOnline(true);
    await boot(null);
  }

  async function loginOnline(email, password) {
    var result = await apiPost('/api/auth/login', { email: email, password: password });
    await window.NoorSecurity.unlockFromPassword(password, {
      email: result.email,
      wrap_salt: result.wrap_salt,
      wrapped_key: result.wrapped_key,
      revision: result.revision || 0
    }, true);
    window.NoorSecurity.setVaultMeta(result.email, result.wrap_salt, result.wrapped_key, result.revision || 0);
    window.NOOR_OFFLINE = false;
    window.NoorSecurity.setOnline(true);
    await boot(null);
  }

  async function loginOffline(email, password) {
    var meta = window.NoorSecurity.getVaultMeta();
    if (!meta || String(meta.email).toLowerCase() !== email) throw new Error('لا توجد خزنة مشفّرة لهذا الحساب على هذا الجهاز.');
    await window.NoorSecurity.unlockFromPassword(password, meta, false);
    var snapshot = await window.NoorSecurity.readEncryptedCache();
    if (!snapshot || snapshot.format !== 'noor-secure-v1' || !snapshot.data) {
      throw new Error('لا توجد نسخة محلية مشفّرة قابلة للاستعادة.');
    }
    window.NOOR_OFFLINE = true;
    window.NoorSecurity.setOnline(false);
    await boot(snapshot);
  }

  async function submit(event) {
    event.preventDefault();
    if (lockState.busy) return;
    var email = String($('lockEmail').value || '').trim().toLowerCase();
    var password = String($('lockInput').value || '');
    var confirm = String(($('lockConfirm') || {}).value || '');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return msg('أدخل بريداً إلكترونياً صالحاً.', true);
    if (lockState.setupRequired && !validPassword(password)) return msg('استخدم عبارة مرور لا تقل عن 14 محرفاً.', true);
    if (!lockState.setupRequired && !password) return msg('أدخل عبارة المرور.', true);
    if (lockState.setupRequired && password !== confirm) return msg('عبارتا المرور غير متطابقتين.', true);

    setBusy(true);
    msg('');
    try {
      if (lockState.setupRequired) {
        await setupAccount(email, password);
        return;
      }
      try {
        await loginOnline(email, password);
      } catch (error) {
        if (error && error.status) throw error;
        await loginOffline(email, password);
      }
    } catch (error) {
      msg(error.message || 'تعذر فتح نُور. تحقق من الاتصال والبيانات.', true);
      setBusy(false);
    }
  }

  async function start() {
    var form = $('lockForm');
    if (form) form.addEventListener('submit', submit);
    var status;
    try {
      var response = await fetch(STATUS_URL, { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('auth_api_unavailable');
      status = await response.json();
      if (!status || !status.ok) throw new Error('auth_api_unavailable');
      window.NoorSecurity.installEphemeralStorage({ preserveLegacy: !!status.setup_required });
      configureView(!!status.setup_required, false);
    } catch (_) {
      window.NoorSecurity.installEphemeralStorage({ preserveLegacy: false });
      var meta = window.NoorSecurity.getVaultMeta();
      configureView(false, true);
      if (!meta) {
        msg('خدمة الحساب غير متاحة بعد. افتح النسخة المنشورة على Cloudflare بعد اكتمال إعدادها.', true);
      } else {
        msg('الخادم غير متاح. أدخل عبارة المرور لفتح النسخة المشفّرة المحلية.', false);
      }
      return;
    }
    var email = $('lockEmail');
    var meta = window.NoorSecurity.getVaultMeta();
    if (email && meta && meta.email && !status.setup_required) email.value = meta.email;
    var password = $('lockInput');
    if (password) password.focus();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
