(function (root) {
  'use strict';

  var META_KEY = 'noor_vault_meta_v1';
  var CACHE_KEY = 'noor_encrypted_cache_v1';
  var PBKDF2_ITERATIONS = 310000;
  var dataKey = null;
  var revision = 0;
  var accountEmail = '';
  var online = false;
  var storageInstalled = false;
  var volatile = new Map();
  var native = {};
  var persistentKeys = new Set([META_KEY, CACHE_KEY, 'noor.sound', 'noor_hide_sidebar']);
  var internalKeys = new Set(['noor_dirty', 'noor_last_change', 'noor_unlocked']);
  var syncTimer = null;

  function encode64(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + 0x8000, bytes.length)));
    }
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function decode64(value) {
    var s = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function bytesToHex(bytes) {
    return Array.from(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  function hexToBytes(text) {
    if (typeof text !== 'string' || !/^(?:[a-f0-9]{2})+$/i.test(text)) throw new Error('invalid_salt');
    var bytes = new Uint8Array(text.length / 2);
    for (var i = 0; i < bytes.length; i++) bytes[i] = parseInt(text.slice(i * 2, i * 2 + 2), 16);
    return bytes;
  }

  function randomBytes(size) {
    var bytes = new Uint8Array(size);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  async function derivePasswordKey(password, saltHex) {
    var material = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey({
      name: 'PBKDF2',
      salt: hexToBytes(saltHex),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  async function wrapKeyForPassword(key, password) {
    var salt = randomBytes(16);
    var iv = randomBytes(12);
    var saltHex = bytesToHex(salt);
    var wrappingKey = await derivePasswordKey(password, saltHex);
    var raw = await crypto.subtle.exportKey('raw', key);
    var encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, wrappingKey, raw);
    return {
      wrap_salt: saltHex,
      wrapped_key: { iv: encode64(iv), ciphertext: encode64(new Uint8Array(encrypted)) }
    };
  }

  async function unwrapKey(password, saltHex, wrapped) {
    var wrappingKey = await derivePasswordKey(password, saltHex);
    var raw = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: decode64(wrapped.iv) },
      wrappingKey,
      decode64(wrapped.ciphertext)
    );
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  }

  async function createAccountKey(password) {
    var key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    var wrapped = await wrapKeyForPassword(key, password);
    return { key: key, wrap_salt: wrapped.wrap_salt, wrapped_key: wrapped.wrapped_key };
  }

  async function encryptBytes(bytes) {
    if (!dataKey) throw new Error('vault_locked');
    var iv = randomBytes(12);
    var encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, dataKey, bytes);
    return { iv: encode64(iv), ciphertext: new Uint8Array(encrypted) };
  }

  async function decryptBytes(iv, bytes) {
    if (!dataKey) throw new Error('vault_locked');
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode64(iv) }, dataKey, bytes);
  }

  async function encryptPayload(value) {
    var bytes = new TextEncoder().encode(JSON.stringify(value));
    var encrypted = await encryptBytes(bytes);
    return { encrypted: true, v: 1, iv: encrypted.iv, ciphertext: encode64(encrypted.ciphertext) };
  }

  async function decryptPayload(envelope) {
    if (!envelope || envelope.encrypted !== true || envelope.v !== 1) throw new Error('invalid_envelope');
    var bytes = await decryptBytes(envelope.iv, decode64(envelope.ciphertext));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function actualGet(key) {
    try { return native.get.call(root.localStorage, key); } catch (_) { return null; }
  }
  function actualSet(key, value) {
    try { native.set.call(root.localStorage, key, String(value)); return true; } catch (_) { return false; }
  }
  function actualRemove(key) {
    try { native.remove.call(root.localStorage, key); } catch (_) {}
  }

  function installEphemeralStorage(options) {
    if (storageInstalled || !root.localStorage || !root.Storage) return;
    options = options || {};
    var proto = root.Storage.prototype;
    native.get = proto.getItem;
    native.set = proto.setItem;
    native.remove = proto.removeItem;
    native.clear = proto.clear;
    native.key = proto.key;
    var legacy = new Map();

    try {
      for (var i = 0; i < root.localStorage.length; i++) {
        var key = root.localStorage.key(i);
        if (key !== null) {
          if (options.preserveLegacy && !persistentKeys.has(key)) {
            var value = actualGet(key);
            if (value !== null) legacy.set(key, value);
          }
        }
      }
    } catch (_) {}

    volatile = legacy;
    proto.getItem = function (key) {
      key = String(key);
      if (this !== root.localStorage) return native.get.call(this, key);
      if (persistentKeys.has(key)) return native.get.call(this, key);
      return volatile.has(key) ? volatile.get(key) : null;
    };
    proto.setItem = function (key, value) {
      key = String(key);
      value = String(value);
      if (this !== root.localStorage) return native.set.call(this, key, value);
      if (persistentKeys.has(key)) return native.set.call(this, key, value);
      volatile.set(key, value);
      if (!internalKeys.has(key) && root.NOOR_APP_READY && typeof root.NoorPersistHook === 'function') {
        clearTimeout(syncTimer);
        syncTimer = setTimeout(function () {
          try { if (typeof root.NoorPersistHook === 'function') root.NoorPersistHook(); } catch (_) {}
        }, 280);
      }
    };
    proto.removeItem = function (key) {
      key = String(key);
      if (this !== root.localStorage) return native.remove.call(this, key);
      if (persistentKeys.has(key)) return native.remove.call(this, key);
      volatile.delete(key);
      if (!internalKeys.has(key) && root.NOOR_APP_READY && typeof root.NoorPersistHook === 'function') {
        clearTimeout(syncTimer);
        syncTimer = setTimeout(function () {
          try { if (typeof root.NoorPersistHook === 'function') root.NoorPersistHook(); } catch (_) {}
        }, 280);
      }
    };
    proto.clear = function () {
      if (this !== root.localStorage) return native.clear.call(this);
      volatile.clear();
      Array.from(persistentKeys).forEach(function (key) { actualRemove(key); });
    };
    storageInstalled = true;
  }

  function isPersistentKey(key) { return persistentKeys.has(String(key)); }

  function exportVolatile() {
    var out = {};
    volatile.forEach(function (value, key) {
      if (key === 'noor_db_v1' || internalKeys.has(key) || isPersistentKey(key)) return;
      out[key] = value;
    });
    return out;
  }

  function restoreVolatile(state) {
    if (!state || typeof state !== 'object') return;
    Object.keys(state).forEach(function (key) {
      if (!isPersistentKey(key) && !internalKeys.has(key) && typeof state[key] === 'string') {
        volatile.set(key, state[key]);
      }
    });
  }

  function snapshotForSync() {
    if (!root.NoorStore || typeof root.NoorStore.dump !== 'function') throw new Error('store_not_ready');
    return {
      format: 'noor-secure-v1',
      data: root.NoorStore.dump(),
      client_state: exportVolatile()
    };
  }

  async function makeSyncEnvelope() {
    var snap = snapshotForSync();
    var encrypted = await encryptPayload(snap);
    rememberEncrypted(encrypted, revision, true);
    return encrypted;
  }

  function rememberEncrypted(envelope, nextRevision, pending) {
    revision = Number.isSafeInteger(Number(nextRevision)) ? Number(nextRevision) : revision;
    var record = {
      format: 'noor-local-cache-v1',
      email: accountEmail,
      revision: revision,
      pending: !!pending,
      saved_at: new Date().toISOString(),
      payload: envelope
    };
    actualSet(CACHE_KEY, JSON.stringify(record));
    saveVaultMeta();
  }

  function getEncryptedCacheInfo() {
    var raw = actualGet(CACHE_KEY);
    try {
      var record = JSON.parse(raw || 'null');
      if (!record || record.format !== 'noor-local-cache-v1' || record.email !== accountEmail) return null;
      return { revision: Number(record.revision || 0), pending: !!record.pending, saved_at: record.saved_at || null };
    } catch (_) { return null; }
  }

  async function readEncryptedCache() {
    var raw = actualGet(CACHE_KEY);
    if (!raw) return null;
    try {
      var record = JSON.parse(raw);
      if (!record || record.format !== 'noor-local-cache-v1' || !record.payload || record.email !== accountEmail) return null;
      var snapshot = await decryptPayload(record.payload);
      revision = Number(record.revision || 0);
      return snapshot;
    } catch (_) { return null; }
  }

  function saveVaultMeta() {
    if (!accountEmail || !wrapSalt || !wrappedKey) return;
    actualSet(META_KEY, JSON.stringify({
      format: 'noor-vault-meta-v1',
      email: accountEmail,
      wrap_salt: wrapSalt,
      wrapped_key: wrappedKey,
      revision: revision
    }));
  }

  var wrapSalt = '';
  var wrappedKey = null;

  function setVaultMeta(email, salt, wrapped, nextRevision) {
    accountEmail = String(email || '').toLowerCase();
    wrapSalt = String(salt || '');
    wrappedKey = wrapped;
    if (Number.isSafeInteger(Number(nextRevision))) revision = Number(nextRevision);
    saveVaultMeta();
  }

  function getVaultMeta() {
    var raw = actualGet(META_KEY);
    try {
      var item = JSON.parse(raw || 'null');
      return item && item.format === 'noor-vault-meta-v1' ? item : null;
    } catch (_) { return null; }
  }

  async function prepareSetup(password) {
    var result = await createAccountKey(password);
    return {
      wrap_salt: result.wrap_salt,
      wrapped_key: result.wrapped_key,
      key: result.key
    };
  }

  function activate(key, email, salt, wrapped, nextRevision, isOnline) {
    dataKey = key;
    accountEmail = String(email || '').toLowerCase();
    wrapSalt = String(salt || '');
    wrappedKey = wrapped;
    revision = Number.isSafeInteger(Number(nextRevision)) ? Number(nextRevision) : 0;
    online = !!isOnline;
    saveVaultMeta();
  }

  async function unlockFromPassword(password, meta, isOnline) {
    var key = await unwrapKey(password, meta.wrap_salt, meta.wrapped_key);
    activate(key, meta.email, meta.wrap_salt, meta.wrapped_key, meta.revision, isOnline);
    return key;
  }

  async function changePassword(currentPassword, newPassword) {
    if (!dataKey) throw new Error('vault_locked');
    var wrapped = await wrapKeyForPassword(dataKey, newPassword);
    var response = await fetch('/api/auth/password', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
        wrap_salt: wrapped.wrap_salt,
        wrapped_key: wrapped.wrapped_key
      })
    });
    var result = await response.json().catch(function () { return {}; });
    if (!response.ok || !result.ok) throw new Error(result.error || 'تعذر تغيير كلمة المرور');
    wrapSalt = wrapped.wrap_salt;
    wrappedKey = wrapped.wrapped_key;
    saveVaultMeta();
    return result;
  }

  function purgeLegacyPlaintext() {
    if (!native.remove || !root.localStorage) return;
    try {
      var keys = [];
      for (var i = 0; i < root.localStorage.length; i++) {
        var key = root.localStorage.key(i);
        if (key !== null && !persistentKeys.has(key)) keys.push(key);
      }
      keys.forEach(actualRemove);
    } catch (_) {}
  }

  function getRevision() { return revision; }
  function setRevision(value) { if (Number.isSafeInteger(Number(value)) && Number(value) >= 0) revision = Number(value); }
  function setOnline(value) { online = !!value; }
  function isOnline() { return online; }
  function isUnlocked() { return !!dataKey; }

  root.updateNoorCloudStatus = function (text, kind) {
    var statusText = root.document && root.document.getElementById('statusText');
    var dot = root.document && root.document.getElementById('statusDot');
    if (statusText) statusText.textContent = text || '';
    if (dot) {
      dot.classList.toggle('connected', kind === 'ok');
      dot.classList.toggle('warn', kind === 'warn');
    }
  };

  root.NoorSecurity = {
    installEphemeralStorage: installEphemeralStorage,
    prepareSetup: prepareSetup,
    unlockFromPassword: unlockFromPassword,
    activate: activate,
    encryptPayload: encryptPayload,
    decryptPayload: decryptPayload,
    makeSyncEnvelope: makeSyncEnvelope,
    snapshotForSync: snapshotForSync,
    rememberEncrypted: rememberEncrypted,
    readEncryptedCache: readEncryptedCache,
    getEncryptedCacheInfo: getEncryptedCacheInfo,
    setVaultMeta: setVaultMeta,
    getVaultMeta: getVaultMeta,
    exportVolatile: exportVolatile,
    restoreVolatile: restoreVolatile,
    purgeLegacyPlaintext: purgeLegacyPlaintext,
    changePassword: changePassword,
    getRevision: getRevision,
    setRevision: setRevision,
    setOnline: setOnline,
    isOnline: isOnline,
    isUnlocked: isUnlocked,
    encryptFile: async function (file) {
      var bytes = file instanceof ArrayBuffer ? new Uint8Array(file) : new Uint8Array(await file.arrayBuffer());
      return encryptBytes(bytes);
    },
    decryptFile: async function (iv, bytes) { return new Uint8Array(await decryptBytes(iv, bytes)); },
    getEmail: function () { return accountEmail; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
