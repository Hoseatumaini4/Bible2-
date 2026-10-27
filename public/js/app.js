(function () {
  "use strict";

  var SEC = 1000, MIN = 60000, HR = 3600000, DAY = 86400000;

  /* Vipimo vya muda: kila kipimo kina sehemu yake (safu) kwenye kadi ya "Mstari mpya kila". */
  var IV_UNITS = {
    s:  { title: "Sekunde", ms: SEC,       one: "sekunde", many: "sekunde", presets: [1, 5, 10, 30] },
    m:  { title: "Dakika",  ms: MIN,       one: "dakika",  many: "dakika",  presets: [1, 5, 10, 20, 30] },
    h:  { title: "Saa",     ms: HR,        one: "saa",     many: "saa",     presets: [1, 3, 6, 12] },
    d:  { title: "Siku",    ms: DAY,       one: "siku",    many: "siku",    presets: [1, 2, 3] },
    w:  { title: "Wiki",    ms: 7 * DAY,   one: "wiki",    many: "wiki",    presets: [1, 2] },
    mo: { title: "Miezi",   ms: 30 * DAY,  one: "mwezi",   many: "miezi",   presets: [1, 3, 6] },
    y:  { title: "Miaka",   ms: 365 * DAY, one: "mwaka",   many: "miaka",   presets: [1] }
  };
  var IV_ORDER = ["s", "m", "h", "d", "w", "mo", "y"];
  var MAX_N = 999;

  // Herufi za Unicode zenye mtindo (zinabaki zikiwa nzuri hata ukibandika kwenye SMS/WhatsApp)
  var STYLES = {
    script:     { name: "Mkono",        up: 0x1D4D0, lo: 0x1D4EA },
    bolditalic: { name: "Nzito iliyoinama", up: 0x1D468, lo: 0x1D482 },
    fraktur:    { name: "Kale",         up: 0x1D56C, lo: 0x1D586 },
    serifbold:  { name: "Nzito",        up: 0x1D400, lo: 0x1D41A },
    sansbold:   { name: "Nzito safi",   up: 0x1D5D4, lo: 0x1D5EE },
    plain:      { name: "Kawaida (SMS fupi)" }
  };
  var STYLE_ORDER = ["script", "bolditalic", "fraktur", "serifbold", "sansbold", "plain"];
  var HUES = [42, 330, 200, 150, 350, 48, 280, 24, 170, 215, 100, 260, 190, 12, 300];

  var $ = function (id) { return document.getElementById(id); };
  var V = window.VERSES || {};
  var LABELS = window.THEME_LABELS || {};
  var keys = Object.keys(V).filter(function (k) { return V[k] && V[k].length; });
  var MIX = "mix";
  var themeKeys = [MIX].concat(keys);
  LABELS[MIX] = "Mchanganyiko";

  /* ---------- Hifadhi (localStorage, salama) ---------- */
  var mem = {};
  function load() {
    try { return JSON.parse(localStorage.getItem("mistari_v2")) || {}; } catch (e) { return mem; }
  }
  function save() {
    mem = state;
    try { localStorage.setItem("mistari_v2", JSON.stringify(state)); } catch (e) {}
  }
  var state = load();
  state.starts = state.starts || {};
  state.style = STYLES[state.style] ? state.style : "script";
  if (typeof state.adorn !== "boolean") state.adorn = true;
  state.greeting = state.greeting || "";
  state.sign = state.sign || "";
  state.iv = state.iv && IV_UNITS[state.iv.u] ? state.iv : { n: 20, u: "m" };
  state.iv.n = Math.min(MAX_N, Math.max(1, Math.floor(Number(state.iv.n)) || 20));
  state.theme = themeKeys.indexOf(state.theme) >= 0 ? state.theme : MIX;

  /* ---------- Mwonekano (usiku/mchana) ---------- */
  var root = document.documentElement;
  var lightQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : { matches: false };
  function applyMode() { if (state.mode) root.setAttribute("data-mode", state.mode); else root.removeAttribute("data-mode"); }
  applyMode();
  $("modeBtn").onclick = function () {
    var isLight = state.mode ? state.mode === "light" : lightQuery.matches;
    state.mode = isLight ? "dark" : "light";
    save(); applyMode();
  };

  if (!keys.length) { $("setup").classList.remove("hidden"); registerSW(); return; }

  /* ---------- Muda ---------- */
  function ivMs(iv) { return (iv || state.iv).n * IV_UNITS[(iv || state.iv).u].ms; }
  function noun(u, n) { return n === 1 ? IV_UNITS[u].one : IV_UNITS[u].many; }
  function ivText(iv) { return noun(iv.u, iv.n) + " " + iv.n; }

  // Mstari wa nafasi k. "Mchanganyiko": kila hatua ya muda huhamia tunda linalofuata.
  // Mistari huzunguka ikiisha, kwa hiyo haikomi hata kwa sekunde 1.
  function verseAt(theme, k) {
    var list, th;
    if (theme !== MIX) {
      list = V[theme];
      return { theme: theme, v: list[k % list.length] };
    }
    var T = keys.length;
    th = keys[k % T]; list = V[th];
    return { theme: th, v: list[Math.floor(k / T) % list.length] };
  }
  function startOf(theme, now) {
    if (!state.starts[theme]) { state.starts[theme] = now; save(); }
    return state.starts[theme];
  }
  function latestK(theme, now) {
    return Math.floor(Math.max(0, now - startOf(theme, now)) / ivMs());
  }

  /* ---------- Zana ndogo ---------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fmt(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var d = Math.floor(s / 86400); s -= d * 86400;
    var h = Math.floor(s / 3600); s -= h * 3600;
    var m = Math.floor(s / 60); s -= m * 60;
    var t = (h > 0 || d > 0 ? pad(h) + ":" : "") + pad(m) + ":" + pad(s);
    return d > 0 ? d + " siku " + t : t;
  }
  function hueOf(theme) { var i = keys.indexOf(theme); return HUES[(i < 0 ? 0 : i) % HUES.length]; }

  var toastTimer;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 1800);
  }

  function copyText(text) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", "");
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
      toast(ok ? "Imenakiliwa" : "Imeshindikana kunakili");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast("Imenakiliwa"); }, fallback);
    } else { fallback(); }
  }

  /* ---------- Herufi za mtindo na ujumbe ---------- */
  function stylize(text) {
    var s = STYLES[state.style];
    if (!s || !s.up) return text;
    var out = "";
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (c >= 65 && c <= 90) out += String.fromCodePoint(s.up + c - 65);
      else if (c >= 97 && c <= 122) out += String.fromCodePoint(s.lo + c - 97);
      else out += text.charAt(i);
    }
    return out;
  }
  function ascii(t) {
    return t.replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
            .replace(/[–—]/g, "-").replace(/…/g, "...");
  }
  function buildMessage(v) {
    var plain = state.style === "plain";
    var blocks = [];
    var g = state.greeting.trim();
    if (g) blocks.push(stylize(plain ? ascii(g) : g));
    if (!plain && state.adorn) blocks.push("✝");
    var body = plain ? ascii(v.t) : v.t;
    blocks.push((plain ? '"' : "“") + stylize(body) + (plain ? '"' : "”"));
    var tail = (plain ? "- " : "— ") + stylize(v.r) + "\n" + stylize("Biblia Takatifu");
    var sg = state.sign.trim();
    if (sg) tail += "\n" + (plain ? "- " : "~ ") + stylize(plain ? ascii(sg) : sg);
    blocks.push(tail);
    return blocks.join("\n\n");
  }
  function smsSegments(msg) {
    var gsm = /^[\x20-\x7E\n\r]*$/.test(msg);
    var n = msg.length; // UTF-16: herufi za mtindo huhesabiwa mbili
    if (gsm) return { n: n, seg: n <= 160 ? 1 : Math.ceil(n / 153), ucs: false };
    return { n: n, seg: n <= 70 ? 1 : Math.ceil(n / 67), ucs: true };
  }
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
              (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  /* ---------- Hali ya kuonyesha ---------- */
  var theme = state.theme;
  var viewIdx = null;      // null = mstari mpya zaidi
  var lastK = -1;
  var histLimit = 20;

  function currentK(kLatest) {
    if (viewIdx === null) return kLatest;
    return Math.max(0, Math.min(viewIdx, kLatest));
  }

  /* ---------- Mada (chips) ---------- */
  function renderChips() {
    var nav = $("themes");
    nav.innerHTML = "";
    themeKeys.forEach(function (k) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "chip";
      b.textContent = LABELS[k] || k;
      b.setAttribute("aria-pressed", k === theme ? "true" : "false");
      b.onclick = function () {
        theme = k; state.theme = k; save();
        viewIdx = null; histLimit = 20; lastK = -1;
        renderChips(); tick(true);
        var act = nav.querySelector('[aria-pressed="true"]');
        if (act && act.scrollIntoView) act.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
      };
      nav.appendChild(b);
    });
  }

  /* ---------- Kadi ya muda: kila kipimo kwenye sehemu yake ---------- */
  function sameIv(a, b) { return a.u === b.u && a.n === b.n; }
  function renderIntervals() {
    var box = $("ivGroups");
    box.innerHTML = "";
    IV_ORDER.forEach(function (u) {
      var g = document.createElement("div"); g.className = "iv-group";
      var t = document.createElement("span"); t.className = "iv-title"; t.textContent = IV_UNITS[u].title;
      var chips = document.createElement("div"); chips.className = "iv-chips";
      IV_UNITS[u].presets.forEach(function (n) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "iv-chip"; b.textContent = n;
        b.setAttribute("aria-label", ivText({ n: n, u: u }));
        b.setAttribute("aria-pressed", sameIv(state.iv, { n: n, u: u }) ? "true" : "false");
        b.onclick = function () { setInterval_({ n: n, u: u }); };
        chips.appendChild(b);
      });
      g.appendChild(t); g.appendChild(chips); box.appendChild(g);
    });
    $("ivNow").textContent = "Sasa: kila " + ivText(state.iv);
  }
  function setInterval_(iv) {
    var now = Date.now(), oldMs = ivMs();
    var newMs = ivMs(iv);
    // Hifadhi nafasi ya sasa ya kila mada, anza hesabu ya muda mpya
    Object.keys(state.starts).forEach(function (k) {
      var kCur = Math.floor(Math.max(0, now - state.starts[k]) / oldMs);
      state.starts[k] = now - kCur * newMs;
    });
    state.iv = iv; save();
    renderIntervals();
    $("ivNum").value = iv.n; $("ivUnit").value = iv.u;
    lastK = -1; tick(true);
    toast("Mstari mpya kila " + ivText(iv));
  }
  function initIntervalForm() {
    var sel = $("ivUnit");
    sel.innerHTML = "";
    IV_ORDER.forEach(function (u) {
      var o = document.createElement("option");
      o.value = u; o.textContent = IV_UNITS[u].title;
      sel.appendChild(o);
    });
    sel.value = state.iv.u;
    $("ivNum").value = state.iv.n;
    $("ivNum").max = MAX_N;
    $("ivSet").onclick = function () {
      var n = Math.floor(Number($("ivNum").value));
      if (!(n >= 1)) { toast("Andika namba kuanzia 1"); return; }
      if (n > MAX_N) n = MAX_N;
      setInterval_({ n: n, u: $("ivUnit").value });
    };
    $("ivNum").onkeydown = function (e) { if (e.key === "Enter") $("ivSet").click(); };
  }

  /* ---------- Kadi ya mstari ---------- */
  function renderVerse(animate) {
    var now = Date.now();
    var kLatest = latestK(theme, now);
    var k = currentK(kLatest);
    var item = verseAt(theme, k);
    var cur = item.v;
    var ms = ivMs();

    root.style.setProperty("--hue", hueOf(item.theme));
    ["verseCard", "composer", "timerCard", "intervalCard"].forEach(function (id) { $(id).classList.remove("hidden"); });
    $("themeLabel").textContent = LABELS[item.theme] || item.theme;
    $("counter").textContent = (theme === MIX ? "Mchanganyiko · " : "") + "Mstari " + (k + 1);
    $("verseText").textContent = cur.t;
    $("verseRef").textContent = cur.r;
    var vc = $("verseCard");
    vc.setAttribute("aria-live", ms < MIN ? "off" : "polite");
    if (animate && ms >= 5 * SEC) {
      vc.classList.remove("fade-in"); void vc.offsetWidth; vc.classList.add("fade-in");
    }

    $("prevBtn").disabled = k <= 0;
    $("nextBtn").disabled = k >= kLatest;
    $("latestBtn").classList.toggle("hidden", k >= kLatest);

    var msg = buildMessage(cur);
    $("preview").textContent = msg;
    var info = smsSegments(msg);
    $("smsNote").textContent = info.ucs
      ? "Herufi za mtindo huchukua nafasi mbili kila moja: SMS hii ni takriban " + info.seg +
        ". WhatsApp haina kikomo. Chagua \"Kawaida\" kwa SMS fupi."
      : "SMS hii ni takriban " + info.seg + (info.seg === 1 ? "." : " (ujumbe mrefu hugawanywa).");

    $("copyBtn").onclick = function () { copyText(msg); };
    $("smsBtn").href = "sms:" + (isIOS ? "&" : "?") + "body=" + encodeURIComponent(msg);
    $("waBtn").href = "https://wa.me/?text=" + encodeURIComponent(msg);
    if (navigator.share) {
      $("shareBtn").classList.remove("hidden");
      $("shareBtn").onclick = function () { navigator.share({ text: msg }).catch(function () {}); };
    }
    renderHistory(kLatest);
  }

  function renderHistory(kLatest) {
    var h = $("history");
    h.innerHTML = "";
    var shown = 0;
    for (var i = kLatest; i >= 0 && shown < histLimit; i--, shown++) {
      (function (index) {
        var it = verseAt(theme, index);
        var v = it.v;
        var d = document.createElement("div"); d.className = "item";
        var t = document.createElement("div"); t.className = "t"; t.textContent = v.t;
        var r = document.createElement("div"); r.className = "r";
        r.textContent = (LABELS[it.theme] || it.theme) + " · " + v.r;
        var row = document.createElement("div"); row.className = "row";
        var c = document.createElement("button"); c.type = "button"; c.textContent = "Nakili";
        c.onclick = function () { copyText(buildMessage(v)); };
        var o = document.createElement("button"); o.type = "button"; o.textContent = "Fungua";
        o.onclick = function () {
          viewIdx = index; renderVerse(true);
          window.scrollTo({ top: 0, behavior: "smooth" });
        };
        row.appendChild(c); row.appendChild(o);
        d.appendChild(t); d.appendChild(r); d.appendChild(row);
        h.appendChild(d);
      })(i);
    }
    $("historyBox").classList.toggle("hidden", kLatest < 1);
    $("moreBtn").classList.toggle("hidden", kLatest + 1 <= histLimit);
  }

  /* ---------- Chaguo la herufi ---------- */
  function renderStyles() {
    var box = $("styles");
    box.innerHTML = "";
    STYLE_ORDER.forEach(function (k) {
      var saved = state.style;
      state.style = k;
      var sample = k === "plain" ? "Aa" : stylize("Aa");
      state.style = saved;
      var b = document.createElement("button");
      b.type = "button"; b.className = "sty";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", k === state.style ? "true" : "false");
      b.innerHTML = '<span class="sample"></span><span class="nm"></span>';
      b.firstChild.textContent = sample;
      b.lastChild.textContent = STYLES[k].name;
      b.onclick = function () { state.style = k; save(); renderStyles(); renderVerse(false); };
      box.appendChild(b);
    });
  }

  /* ---------- Saa ---------- */
  function tick(force) {
    var now = Date.now();
    var ms = ivMs();
    var kLatest = latestK(theme, now);

    if (force || kLatest !== lastK) {
      var grew = lastK !== -1 && kLatest > lastK && viewIdx === null;
      lastK = kLatest;
      renderVerse(grew || force === true);
      if (grew && ms >= MIN) toast("Mstari mpya umefunguka");
    }

    var into = (now - state.starts[theme]) % ms;
    $("countdown").textContent = fmt(ms - into);
    var bar = $("barFill");
    bar.style.transition = ms <= 60 * SEC ? "none" : "";
    bar.style.width = Math.min(100, (into / ms) * 100).toFixed(2) + "%";
    bar.parentNode.setAttribute("aria-valuenow", Math.round((into / ms) * 100));
    var info = "Mstari mpya kila " + ivText(state.iv) + " · umefungua " + (kLatest + 1);
    if (theme === MIX) {
      var nx = verseAt(MIX, kLatest + 1).theme;
      info += " · linalofuata: " + (LABELS[nx] || nx);
    }
    $("unlockInfo").textContent = info;
  }

  /* ---------- Vitufe na vidhibiti ---------- */
  $("prevBtn").onclick = function () {
    var kLatest = latestK(theme, Date.now());
    viewIdx = Math.max(0, currentK(kLatest) - 1); renderVerse(true);
  };
  $("nextBtn").onclick = function () {
    var kLatest = latestK(theme, Date.now());
    var i = currentK(kLatest) + 1;
    viewIdx = i >= kLatest ? null : i; renderVerse(true);
  };
  $("latestBtn").onclick = function () { viewIdx = null; renderVerse(true); };
  $("moreBtn").onclick = function () { histLimit += 20; renderVerse(false); };
  $("resetBtn").onclick = function () {
    if (!window.confirm("Anza upya mada hii? Historia yake itaanza upya.")) return;
    state.starts[theme] = Date.now(); save();
    viewIdx = null; histLimit = 20; lastK = -1; tick(true);
  };
  $("greeting").value = state.greeting;
  $("signoff").value = state.sign;
  $("adorn").checked = state.adorn;
  $("greeting").oninput = function () { state.greeting = this.value; save(); renderVerse(false); };
  $("signoff").oninput = function () { state.sign = this.value; save(); renderVerse(false); };
  $("adorn").onchange = function () { state.adorn = this.checked; save(); renderVerse(false); };

  document.addEventListener("keydown", function (e) {
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (e.key === "ArrowLeft") $("prevBtn").click();
    if (e.key === "ArrowRight") $("nextBtn").click();
  });

  /* ---------- Usakinishaji (PWA) na offline ---------- */
  var deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); deferredPrompt = e;
    $("installBtn").classList.remove("hidden");
  });
  $("installBtn").onclick = function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function () { deferredPrompt = null; $("installBtn").classList.add("hidden"); });
  };
  window.addEventListener("appinstalled", function () { $("installBtn").classList.add("hidden"); toast("Imesakinishwa"); });

  var standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone;
  if (isIOS && !standalone && !state.iosTipClosed) $("iosTip").classList.remove("hidden");
  $("iosTipClose").onclick = function () { state.iosTipClosed = true; save(); $("iosTip").classList.add("hidden"); };

  function registerSW() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").then(function () {
        return navigator.serviceWorker.ready;
      }).then(function () {
        var b = $("offlineBadge"); if (b) b.classList.remove("hidden");
      }).catch(function () {});
    });
  }

  /* ---------- Anza ---------- */
  renderChips();
  renderIntervals();
  initIntervalForm();
  renderStyles();
  tick(true);
  setInterval(function () { tick(false); }, 250);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) tick(false); });
  registerSW();
})();
