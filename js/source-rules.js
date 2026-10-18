(function (root) {
  'use strict';

  var TRACKING_KEYS = [
    'fbclid', 'gclid', 'dclid', 'mc_cid', 'mc_eid', 'igshid',
    'si', 'feature', 'pp', 'ref_src', 'ref_url'
  ];
  var VIDEO_HOSTS = [
    'youtube.com', 'youtu.be', 'vimeo.com', 'twitch.tv',
    'tiktok.com', 'dailymotion.com'
  ];
  var COURSE_HOSTS = [
    'coursera.org', 'udemy.com', 'edx.org', 'skillshare.com',
    'khanacademy.org', 'udacity.com'
  ];
  var EXTENSIONS = {
    pdf: 'PDF',
    epub: 'كتاب',
    mobi: 'كتاب',
    azw: 'كتاب',
    azw3: 'كتاب',
    mp3: 'صوت',
    wav: 'صوت',
    m4a: 'صوت',
    aac: 'صوت',
    ogg: 'صوت',
    mp4: 'فيديو',
    webm: 'فيديو',
    mov: 'فيديو',
    m4v: 'فيديو'
  };
  var STOP_WORDS = new Set([
    'من', 'إلى', 'الى', 'عن', 'في', 'على', 'مع', 'هذا', 'هذه', 'ذلك',
    'التي', 'الذي', 'كيف', 'ما', 'ماذا', 'هو', 'هي', 'أن', 'ان', 'و',
    'او', 'أو', 'ثم', 'بعد', 'قبل', 'عند', 'كل', 'كتاب', 'فيديو',
    'شرح', 'مقدمة', 'دليل', 'the', 'and', 'for', 'with', 'from',
    'this', 'that', 'how', 'what', 'into', 'your', 'book', 'video',
    'guide', 'introduction', 'course', 'lesson'
  ]);

  function hostnameMatches(host, domains) {
    return domains.some(function (domain) {
      return host === domain || host.slice(-(domain.length + 1)) === '.' + domain;
    });
  }

  function normalizeUrl(raw) {
    var parsed;
    try {
      parsed = new URL(String(raw || '').trim());
    } catch (_) {
      return '';
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';

    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if ((parsed.protocol === 'https:' && parsed.port === '443') ||
        (parsed.protocol === 'http:' && parsed.port === '80')) {
      parsed.port = '';
    }
    parsed.username = '';
    parsed.password = '';
    parsed.hash = '';

    Array.from(parsed.searchParams.keys()).forEach(function (key) {
      var lower = key.toLowerCase();
      if (lower.indexOf('utm_') === 0 || TRACKING_KEYS.indexOf(lower) !== -1) {
        parsed.searchParams.delete(key);
      }
    });

    if (hostnameMatches(parsed.hostname, ['youtube.com']) &&
        /^\/watch\/?$/.test(parsed.pathname)) {
      var videoId = parsed.searchParams.get('v');
      if (videoId) {
        parsed.search = '';
        parsed.searchParams.set('v', videoId);
      }
    }

    if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    parsed.searchParams.sort();
    return parsed.toString();
  }

  function extensionOf(nameOrUrl) {
    var value = String(nameOrUrl || '').split(/[?#]/)[0];
    var match = value.match(/\.([a-z0-9]{1,8})$/i);
    return match ? match[1].toLowerCase() : '';
  }

  function classifySource(input) {
    var source = typeof input === 'string' ? { url: input } : (input || {});
    var rawUrl = String(source.url || source.href || '').trim();
    var normalizedUrl = normalizeUrl(rawUrl);
    var mime = String(source.mimeType || source.mime || '').split(';')[0].trim().toLowerCase();
    var name = String(source.fileName || source.name || source.title || '').trim();
    var ext = extensionOf(source.fileName || source.name || rawUrl);
    var parsed = null;
    try { if (normalizedUrl) parsed = new URL(normalizedUrl); } catch (_) {}
    var host = parsed ? parsed.hostname : '';
    var type = '';
    var reason = '';
    var confidence = 'high';

    if (source.manualType) {
      type = String(source.manualType).trim();
      reason = 'نوع اختاره المستخدم';
      confidence = 'user';
    } else if (mime === 'application/pdf' || ext === 'pdf') {
      type = 'PDF';
      reason = 'نوع الملف أو امتداده PDF';
    } else if (mime.indexOf('audio/') === 0 || ['mp3', 'wav', 'm4a', 'aac', 'ogg'].indexOf(ext) !== -1) {
      type = 'صوت';
      reason = 'نوع الملف صوتي';
    } else if (mime.indexOf('video/') === 0 || ['mp4', 'webm', 'mov', 'm4v'].indexOf(ext) !== -1) {
      type = 'فيديو';
      reason = 'نوع الملف مرئي';
    } else if (['epub', 'mobi', 'azw', 'azw3'].indexOf(ext) !== -1) {
      type = 'كتاب';
      reason = 'امتداد كتاب إلكتروني معروف';
    } else if (parsed && hostnameMatches(host, VIDEO_HOSTS)) {
      type = 'فيديو';
      reason = 'الرابط على منصة فيديو معروفة';
    } else if (parsed && hostnameMatches(host, COURSE_HOSTS)) {
      type = 'كورس';
      reason = 'الرابط على منصة تعليمية معروفة';
      confidence = 'medium';
    } else if (parsed && /\/(course|courses|lesson|lessons|learn|playlist|curriculum)(\/|$)/i.test(parsed.pathname)) {
      type = 'كورس';
      reason = 'مسار الرابط يوحي بمحتوى تعليمي';
      confidence = 'medium';
    } else if (normalizedUrl) {
      type = 'صفحة ويب';
      reason = 'رابط ويب صالح، ولم تتطابق قاعدة أكثر تحديداً';
      confidence = 'medium';
    } else {
      type = 'رابط';
      reason = rawUrl ? 'الرابط غير صالح أو يستخدم بروتوكولاً غير مسموح' : 'لا يوجد رابط أو نوع ملف كافٍ للتصنيف';
      confidence = 'low';
    }

    return {
      originalUrl: rawUrl,
      normalizedUrl: normalizedUrl,
      title: name,
      mimeType: mime,
      extension: ext,
      type: type,
      confidence: confidence,
      reason: reason,
      needsReview: confidence === 'low' || confidence === 'medium',
      sourceKey: normalizedUrl ? 'url:' + normalizedUrl : ''
    };
  }

  function normalizeText(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }

  function tokens(text) {
    return normalizeText(text).split(/\s+/).filter(function (word) {
      return word.length >= 2 && !STOP_WORDS.has(word);
    });
  }

  function sourceKey(input) {
    var result = classifySource(input);
    if (result.normalizedUrl) return 'url:' + result.normalizedUrl;

    var source = typeof input === 'string' ? { url: input } : (input || {});
    var name = normalizeText(source.fileName || source.name || source.title || '');
    var size = Number(source.size || source.bytes || 0);
    var mime = String(source.mimeType || source.mime || '').split(';')[0].toLowerCase();
    if (!name || !size) return '';
    return 'file-hint:' + name + '|' + size + '|' + mime;
  }

  function findDuplicateCandidates(candidate, existingItems) {
    var candidateKey = sourceKey(candidate);
    if (!candidateKey) return [];

    return (Array.isArray(existingItems) ? existingItems : []).reduce(function (matches, item) {
      var itemKey = sourceKey(item);
      if (itemKey && itemKey === candidateKey) {
        matches.push({
          id: item.id == null ? null : item.id,
          title: String(item.title || item.name || ''),
          strength: candidateKey.indexOf('url:') === 0 ? 'exact-url' : 'metadata-hint',
          reason: candidateKey.indexOf('url:') === 0
            ? 'الرابط المعياري مطابق'
            : 'الاسم والحجم والنوع متطابقة؛ يلزم تأكيد المستخدم'
        });
      }
      return matches;
    }, []);
  }

  function suggestLinks(source, goals, projects) {
    var sourceWords = new Set(tokens(source && (source.title || source.name || source.url)));
    if (!sourceWords.size) return [];

    var candidates = [];
    [
      { kind: 'project', rows: projects },
      { kind: 'goal', rows: goals }
    ].forEach(function (group) {
      (Array.isArray(group.rows) ? group.rows : []).forEach(function (item) {
        if (!item || item.archived_at || item.archived) return;
        var title = String(item.name || item.title || '');
        var itemWords = new Set(tokens(title));
        var overlap = [];
        sourceWords.forEach(function (word) {
          if (itemWords.has(word)) overlap.push(word);
        });
        if (!overlap.length) return;

        var denominator = Math.max(sourceWords.size, itemWords.size);
        var score = denominator ? Math.round((overlap.length / denominator) * 100) : 0;
        if (score < 25 && overlap.every(function (word) { return word.length < 5; })) return;

        candidates.push({
          kind: group.kind,
          id: item.id == null ? null : item.id,
          title: title,
          score: score,
          matchedTerms: overlap,
          reason: 'اقتراح آلي مبني على الكلمات المشتركة في العناوين فقط',
          requiresApproval: true
        });
      });
    });

    return candidates.sort(function (a, b) {
      return b.score - a.score || a.title.localeCompare(b.title);
    }).slice(0, 3);
  }

  var api = {
    normalizeUrl: normalizeUrl,
    classifySource: classifySource,
    sourceKey: sourceKey,
    findDuplicateCandidates: findDuplicateCandidates,
    suggestLinks: suggestLinks,
    normalizeText: normalizeText,
    tokens: tokens
  };

  root.NoorSourceRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
