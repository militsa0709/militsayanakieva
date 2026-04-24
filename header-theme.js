/**
 * .site-nav reads [data-theme] under the menu: light | warm | dark.
 * Reverse DOM walk so later sections win when rects overlap the probe.
 */
(function () {
  if (window.__siteNavThemeBound) return;
  window.__siteNavThemeBound = true;

  var rafId = 0;

  function getSiteNav() {
    return document.querySelector(".site-nav");
  }

  function clamp(x, lo, hi) {
    return Math.max(lo, Math.min(hi, x));
  }

  function normalizeTheme(raw) {
    var t = String(raw || "light").toLowerCase();
    if (t === "dark") return "dark";
    if (t === "warm") return "warm";
    return "light";
  }

  function themeAtProbe(x, probeY) {
    var list = document.querySelectorAll("[data-theme]");
    var i;
    for (i = list.length - 1; i >= 0; i--) {
      var el = list[i];
      var r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && probeY >= r.top && probeY <= r.bottom) {
        return normalizeTheme(el.getAttribute("data-theme"));
      }
    }
    return "light";
  }

  function readTheme() {
    var nav = getSiteNav();
    if (!nav) return "light";

    var nr = nav.getBoundingClientRect();
    if (nr.height < 2) return "light";

    var menu = nav.querySelector(".menu") || nav.querySelector(".masthead__nav");
    var box = menu ? menu.getBoundingClientRect() : nr;

    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    var probeY = clamp(Math.floor(nr.bottom + 10), 0, Math.max(0, vh - 1));

    var w = window.innerWidth || document.documentElement.clientWidth || 0;
    var x = Math.round(clamp(box.left + box.width * 0.5, 4, Math.max(5, w - 5)));
    return themeAtProbe(x, probeY);
  }

  function applyTheme() {
    var nav = getSiteNav();
    if (!nav) return;
    var theme = readTheme();
    nav.classList.remove("nav--on-light", "nav--on-warm", "nav--on-dark");
    nav.classList.add("nav--on-" + theme);
  }

  function scheduleApply() {
    if (rafId) return;
    rafId = requestAnimationFrame(function () {
      rafId = 0;
      applyTheme();
    });
  }

  function init() {
    applyTheme();
    requestAnimationFrame(applyTheme);

    window.addEventListener("scroll", scheduleApply, { passive: true });
    window.addEventListener("resize", scheduleApply, { passive: true });
    window.addEventListener("load", function () {
      applyTheme();
      requestAnimationFrame(applyTheme);
    });

    if (window.visualViewport) {
      window.visualViewport.addEventListener("scroll", scheduleApply, { passive: true });
      window.visualViewport.addEventListener("resize", scheduleApply, { passive: true });
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(applyTheme).catch(function () {});
    }

    try {
      var mo = new MutationObserver(scheduleApply);
      mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    } catch (e) {
      /* ignore */
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
