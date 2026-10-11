/* نُور — بوابة الدخول (مستخدم واحد)
   تمنع تحميل الواجهة والبيانات ما لم يُدخل الرمز الصحيح.
   الغيّر من هنا: */
(function () {
  var CFG = {
    enabled: true,
    /* SHA-256 للرمز (حرف-sensitive). ولّد رمزًا جديدًا بأمر:
       node -e "console.log(require('crypto').createHash('sha256').update('رمزك هنا','utf8').digest('hex'))" */
    passSha256: '43d998f7250ec60051b1e0b13acdf29f7394441680f17d54aa48fc40b29345d0',
    seedUrl: 'data/seed.json',
    storeSrc: 'js/store.js?v=19',
    appSrc: 'js/app.js?v=91',
    flag: 'noor_unlocked'
  };

  if (!CFG.enabled) { boot(); return; }

  var $ = function (s) { return document.querySelector(s); };

  function unlocked() {
    try { return sessionStorage.getItem(CFG.flag) === '1'; } catch (e) { return false; }
  }

  function markUnlocked() {
    try { sessionStorage.setItem(CFG.flag, '1'); } catch (e) {}
  }

  function sha256(text) {
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
        var bytes = new Uint8Array(buf), hex = '';
        for (var i = 0; i < bytes.length; i++) hex += ('0' + bytes[i].toString(16)).slice(-2);
        return hex;
      });
    }
    /* احتياط: SHA-256 خالص بـ JS لسياقات بلا crypto.subtle (مثل file://) */
    return Promise.resolve(sha256Pure(text));
  }

  function sha256Pure(str) {
    var K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    var bytes = [], i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) { bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63)); }
      else { bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
    }
    var l = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (i = 7; i >= 0; i--) bytes.push((l / Math.pow(2, i * 8)) & 0xff);

    var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    var w = new Array(64);
    function rr(x, n) { return (x >>> n) | (x << (32 - n)); }
    for (i = 0; i < bytes.length; i += 64) {
      var j;
      for (j = 0; j < 16; j++) w[j] = (bytes[i + j*4] << 24) | (bytes[i + j*4+1] << 16) | (bytes[i + j*4+2] << 8) | bytes[i + j*4+3];
      for (j = 16; j < 64; j++) {
        var s0 = rr(w[j-15], 7) ^ rr(w[j-15], 18) ^ (w[j-15] >>> 3);
        var s1 = rr(w[j-2], 17) ^ rr(w[j-2], 19) ^ (w[j-2] >>> 10);
        w[j] = (w[j-16] + s0 + w[j-7] + s1) >>> 0;
      }
      var a=H[0],b=H[1],c0=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
      for (j = 0; j < 64; j++) {
        var S1 = rr(e,6) ^ rr(e,11) ^ rr(e,25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[j] + w[j]) >>> 0;
        var S0 = rr(a,2) ^ rr(a,13) ^ rr(a,22);
        var maj = (a & b) ^ (a & c0) ^ (b & c0);
        var t2 = (S0 + maj) >>> 0;
        h=g; g=f; f=e; e=(d + t1) >>> 0; d=c0; c0=b; b=a; a=(t1 + t2) >>> 0;
      }
      H[0]=(H[0]+a)>>>0; H[1]=(H[1]+b)>>>0; H[2]=(H[2]+c0)>>>0; H[3]=(H[3]+d)>>>0;
      H[4]=(H[4]+e)>>>0; H[5]=(H[5]+f)>>>0; H[6]=(H[6]+g)>>>0; H[7]=(H[7]+h)>>>0;
    }
    return H.map(function (x) { return ('00000000' + x.toString(16)).slice(-8); }).join('');
  }

  function seedIfEmpty() {
    var hasData = false;
    try { hasData = !!localStorage.getItem('noor_db_v1'); } catch (e) { return Promise.resolve(); }
    if (hasData) return Promise.resolve();
    return fetch(CFG.seedUrl, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (snap) {
      var poll = function () {
        if (window.NoorStore && typeof NoorStore.restore === 'function') {
          try { NoorStore.restore(snap); return true; } catch (e) { console.error('[noor] فشل تجهيز البيانات:', e); return false; }
        }
        return false;
      };
      if (poll()) return true;
      return new Promise(function (res) {
        var t = setInterval(function () { if (poll()) { clearInterval(t); res(true); } }, 40);
        setTimeout(function () { clearInterval(t); res(false); }, 4000);
      });
    }).catch(function (e) {
      console.warn('[noor] تعذّر تحميل البيانات المبدئية:', e);
      return false;
    });
  }

  function boot() {
    var el = document.getElementById('noorLock');
    if (el) el.remove();
    try { document.body.classList.add('noor-unlocked'); } catch (e) {}
    var s1 = document.createElement('script');
    s1.src = CFG.storeSrc; s1.async = false;
    document.body.appendChild(s1);
    s1.onload = function () {
      var ready = function () {
        var s2 = document.createElement('script');
        s2.src = CFG.appSrc; s2.async = false;
        document.body.appendChild(s2);
      };
      if (unlocked()) seedIfEmpty().then(ready, ready);
      else ready();
    };
  }

  function fail(msg) {
    var box = document.getElementById('lockMsg');
    if (box) { box.textContent = msg; box.hidden = false; }
  }

  function bind() {
    var form = document.getElementById('lockForm');
    var input = document.getElementById('lockInput');
    if (!form || !input) return;
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var val = input.value || '';
      if (!val) { fail('أدخل الرمز أولًا'); return; }
      sha256(val).then(function (hex) {
        if (hex === CFG.passSha256) {
          markUnlocked();
          var el = document.getElementById('noorLock');
          if (el) el.classList.add('noor-lock--out');
          setTimeout(function () { boot(); }, 180);
        } else {
          fail('الرمز غير صحيح');
          input.value = '';
          input.focus();
          var wrap = document.getElementById('lockCard');
          if (wrap) { wrap.classList.remove('noor-lock--shake'); void wrap.offsetWidth; wrap.classList.add('noor-lock--shake'); }
        }
      });
    });
  }

  function start() {
    if (unlocked()) { boot(); return; }
    bind();
    var input = document.getElementById('lockInput');
    if (input) input.focus();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
