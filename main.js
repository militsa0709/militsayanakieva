function initYear() {
  var el = document.getElementById("y");
  if (el) el.textContent = String(new Date().getFullYear());
}

function initContactForm() {
  var form = document.querySelector(".contact-form");
  if (!form) return;
  form.addEventListener("submit", function (e) {
    e.preventDefault();
  });
}

function boot() {
  initYear();
  initHeroMeshCanvas();
  initContactForm();
}

/**
 * Hero: scroll fills white grid + fades rose; when mostly dissolved → edge-to-edge fullscreen slideshow.
 */
function initHeroMeshCanvas() {
  var stack = document.querySelector(".hero__stack");
  var canvas = document.querySelector(".hero__mesh-canvas");
  var heroSection = stack && stack.closest(".hero");
  if (!stack || !heroSection || !canvas) return;

  var ctx = canvas.getContext("2d", { alpha: true });
  var COLS = 52;
  var ROWS = 36;
  var TOTAL = COLS * ROWS;
  /* Overlap dissolve: start while rose/grid still read as “hero” so no white seam */
  var CINEMATIC_START_FILL = 0.62;
  /* Lower = leave slideshow later when scrolling up → longer crossfade back to landing */
  var CINEMATIC_EXIT_FILL = 0.4;
  var SLIDE_MS = 380;
  /* Rose fade: wider band = gentler change as scroll begins */
  var HERO_FADE_FULLY_GONE = 0.88;
  var HERO_FADE_FULLY_VISIBLE = 0.42;
  var reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  /* Intrinsic pixel size per file — avoids upscaling past native resolution (sharper). */
  var SLIDES = [
    { src: "./assets/work-bus-poster.png", alt: "Symphonic Whispers bus poster", w: 1024, h: 681 },
    { src: "./assets/work-authentic-selves.png", alt: "Authentic Selves", w: 1024, h: 670 },
    { src: "./assets/work-sex-and-the-city.png", alt: "Sex and the City", w: 767, h: 1024 },
    { src: "./assets/work-symphonic-poster.png", alt: "Symphonic Whispers poster", w: 590, h: 846 },
    { src: "./assets/work-record-mockup.png", alt: "Symphonic Whispers record mockup", w: 1024, h: 731 },
  ];

  function applySlideToImg(el, slide) {
    if (!el || !slide) return;
    el.alt = slide.alt;
    /* Let CSS (100% + object-fit: cover) size slides so framing matches every viewport */
    el.removeAttribute("width");
    el.removeAttribute("height");
    el.src = slide.src;
  }

  var occupied = new Set();
  var heroImg = stack.querySelector(".hero__img");
  var cinematicEl = document.getElementById("home-cinematic");
  var imgA = cinematicEl && cinematicEl.querySelector(".home-cinematic__img--a");
  var imgB = cinematicEl && cinematicEl.querySelector(".home-cinematic__img--b");
  var liveEl = cinematicEl && cinematicEl.querySelector(".home-cinematic__live");

  var cinematicActive = false;
  var cinematicUserDismissed = false;
  var slideTimer = null;
  var slideIndex = 0;
  var useAFront = true;

  function dex(idx) {
    return { c: idx % COLS, r: (idx / COLS) | 0 };
  }

  function scrollYDoc() {
    var vv = window.visualViewport;
    return vv ? vv.pageTop : window.scrollY;
  }

  function scrollProgress() {
    var el = document.documentElement;
    var vv = window.visualViewport;
    var vh = vv && vv.height > 0 ? vv.height : window.innerHeight;
    var maxScroll = Math.max(1, el.scrollHeight - vh);
    var y = scrollYDoc();
    return Math.max(0, Math.min(1, y / maxScroll));
  }

  function measureHeroPull(main, hero) {
    var h = 0;
    var c = main.firstElementChild;
    while (c && c !== hero) {
      h += c.offsetHeight;
      c = c.nextElementSibling;
    }
    return h;
  }

  function syncHeroExpanded() {
    if (!heroSection) return;
    var main = document.getElementById("main");
    if (!main || !main.classList.contains("page--home")) return;
    var y = scrollYDoc();
    if (y > 1) {
      main.style.setProperty("--home-hero-pull", measureHeroPull(main, heroSection) + "px");
      heroSection.classList.add("hero--expanded");
      main.classList.add("page--home-hero-expanded");
    } else {
      heroSection.classList.remove("hero--expanded");
      main.classList.remove("page--home-hero-expanded");
      main.style.removeProperty("--home-hero-pull");
    }
  }

  var cell = 1;
  var offsetX = 0;
  var offsetY = 0;
  var meshW = 0;
  var meshH = 0;

  function layoutMetrics() {
    var w = heroSection.clientWidth;
    var h = heroSection.clientHeight;
    if (w < 2 || h < 2) return false;
    meshW = w;
    meshH = h;
    /* Cover the stack (like object-fit: cover) so tall/narrow viewports aren’t letterboxed */
    cell = Math.max(w / COLS, h / ROWS);
    offsetX = (w - cell * COLS) * 0.5;
    offsetY = (h - cell * ROWS) * 0.5;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  function fillCell(c, r) {
    var x = offsetX + c * cell;
    var y = offsetY + r * cell;
    ctx.fillRect(x, y, cell + 0.6, cell + 0.6);
  }

  function drawGridLines(w, h) {
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.beginPath();
    var c;
    var r;
    for (c = 0; c <= COLS; c++) {
      var gx = offsetX + c * cell + 0.5;
      ctx.moveTo(gx, offsetY);
      ctx.lineTo(gx, offsetY + ROWS * cell);
    }
    for (r = 0; r <= ROWS; r++) {
      var gy = offsetY + r * cell + 0.5;
      ctx.moveTo(offsetX, gy);
      ctx.lineTo(offsetX + COLS * cell, gy);
    }
    ctx.stroke();
  }

  function cellIntersectsView(idx) {
    var d = dex(idx);
    var x1 = offsetX + d.c * cell;
    var y1 = offsetY + d.r * cell;
    return x1 + cell > 0 && x1 < meshW && y1 + cell > 0 && y1 < meshH;
  }

  function pickRandomUnoccupied() {
    var tries;
    var idx;
    for (tries = 0; tries < 96; tries++) {
      idx = (Math.random() * TOTAL) | 0;
      if (!occupied.has(idx) && cellIntersectsView(idx)) return idx;
    }
    for (tries = 0; tries < 64; tries++) {
      idx = (Math.random() * TOTAL) | 0;
      if (!occupied.has(idx)) return idx;
    }
    var i;
    for (i = 0; i < TOTAL; i++) {
      if (!occupied.has(i)) return i;
    }
    return -1;
  }

  function growOccupiedToTarget(tg) {
    var list;
    var j;
    var idx;
    var safety;
    var batch;
    if (occupied.size > tg) {
      /* Remove at most a fraction per frame so scrolling up eases instead of popping. */
      list = Array.from(occupied);
      batch = reduceMotion
        ? list.length
        : Math.max(1, Math.ceil((occupied.size - tg) * 0.14));
      while (occupied.size > tg && batch > 0 && list.length) {
        j = (Math.random() * list.length) | 0;
        occupied.delete(list[j]);
        list.splice(j, 1);
        batch--;
      }
      return;
    }
    safety = 0;
    batch = reduceMotion
      ? TOTAL + 50
      : Math.max(1, Math.ceil((tg - occupied.size) * 0.11));
    while (occupied.size < tg && safety < TOTAL + 50 && batch > 0) {
      idx = pickRandomUnoccupied();
      if (idx < 0) break;
      occupied.add(idx);
      safety++;
      batch--;
    }
  }

  var smoothFillP = -1;
  var heroOpacitySmoothed = -1;

  function paint() {
    syncHeroExpanded();
    if (!layoutMetrics()) return;
    var w = heroSection.clientWidth;
    var h = heroSection.clientHeight;
    var rawP = scrollProgress();
    if (smoothFillP < 0) smoothFillP = rawP;
    if (reduceMotion) {
      smoothFillP = rawP;
    } else {
      var gap = rawP - smoothFillP;
      /* Scrolling down: ease in slowly at first; scrolling up: a bit quicker to follow */
      var alpha;
      if (Math.abs(gap) > 0.14) {
        alpha = gap > 0 ? 0.24 : 0.22;
      } else {
        alpha = gap > 0 ? 0.085 : 0.1;
      }
      smoothFillP += gap * alpha;
      if (Math.abs(gap) < 0.0008) smoothFillP = rawP;
    }

    var tg = Math.min(TOTAL, Math.floor(smoothFillP * TOTAL));

    ctx.clearRect(0, 0, w, h);
    drawGridLines(w, h);

    ctx.fillStyle = "#fff";
    growOccupiedToTarget(tg);

    occupied.forEach(function (idx) {
      var d = dex(idx);
      fillCell(d.c, d.r);
    });

    var heroNeedsRaf = updateHeroDissolve(smoothFillP);
    syncCinematicSlideshow(smoothFillP);

    if (
      !reduceMotion &&
      (Math.abs(rawP - smoothFillP) > 0.002 || occupied.size !== tg || heroNeedsRaf)
    ) {
      scheduleScrollPaint();
    }
  }

  function updateHeroDissolve(ratio) {
    if (!heroImg) return false;
    var o;
    if (ratio >= HERO_FADE_FULLY_GONE) o = 0;
    else if (ratio <= HERO_FADE_FULLY_VISIBLE) o = 1;
    else {
      o = (HERO_FADE_FULLY_GONE - ratio) / (HERO_FADE_FULLY_GONE - HERO_FADE_FULLY_VISIBLE);
    }
    o = Math.max(0, Math.min(1, o));
    if (heroOpacitySmoothed < 0) heroOpacitySmoothed = o;
    if (reduceMotion) {
      heroOpacitySmoothed = o;
    } else {
      heroOpacitySmoothed += (o - heroOpacitySmoothed) * 0.095;
      if (Math.abs(o - heroOpacitySmoothed) < 0.004) heroOpacitySmoothed = o;
    }
    heroImg.style.opacity = String(heroOpacitySmoothed);
    return Math.abs(o - heroOpacitySmoothed) > 0.008;
  }

  function exitCinematic() {
    if (slideTimer) {
      clearInterval(slideTimer);
      slideTimer = null;
    }
    cinematicActive = false;
    if (cinematicEl) {
      cinematicEl.classList.remove("home-cinematic--active");
      cinematicEl.setAttribute("aria-hidden", "true");
    }
    updateHeroDissolve(smoothFillP);
    scheduleScrollPaint();
  }

  function onCinematicDismiss() {
    if (!cinematicActive) return;
    cinematicUserDismissed = true;
    exitCinematic();
  }

  function advanceSlide() {
    if (!imgA || !imgB || !SLIDES.length) return;
    slideIndex = (slideIndex + 1) % SLIDES.length;
    var next = SLIDES[slideIndex];
    var show = useAFront ? imgB : imgA;
    var hide = useAFront ? imgA : imgB;
    applySlideToImg(show, next);
    show.classList.add("is-front");
    hide.classList.remove("is-front");
    useAFront = !useAFront;
    if (liveEl) liveEl.textContent = next.alt;
  }

  function startCinematic() {
    if (!cinematicEl || !imgA || !imgB || cinematicActive) return;
    cinematicActive = true;
    slideIndex = 0;
    useAFront = true;
    applySlideToImg(imgA, SLIDES[0]);
    imgA.classList.add("is-front");
    imgB.classList.remove("is-front");
    imgB.removeAttribute("src");
    imgB.alt = "";
    cinematicEl.classList.add("home-cinematic--active");
    cinematicEl.setAttribute("aria-hidden", "false");
    if (liveEl) liveEl.textContent = SLIDES[0].alt;
    slideTimer = setInterval(advanceSlide, SLIDE_MS);
  }

  function syncCinematicSlideshow(ratio) {
    if (!cinematicEl) return;
    if (ratio < CINEMATIC_START_FILL) {
      cinematicUserDismissed = false;
    }
    if (ratio >= CINEMATIC_START_FILL) {
      if (!cinematicActive && !cinematicUserDismissed) startCinematic();
    } else if (ratio < CINEMATIC_EXIT_FILL) {
      if (cinematicActive) exitCinematic();
    }
  }

  var rafScroll = 0;
  function scheduleScrollPaint() {
    if (rafScroll) return;
    rafScroll = requestAnimationFrame(function () {
      rafScroll = 0;
      paint();
    });
  }

  scheduleScrollPaint();

  window.addEventListener("scroll", scheduleScrollPaint, { passive: true });
  window.addEventListener("resize", scheduleScrollPaint);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", scheduleScrollPaint);
    window.visualViewport.addEventListener("scroll", scheduleScrollPaint);
  }
  var ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(scheduleScrollPaint) : null;
  if (ro) ro.observe(heroSection);

  var img = stack.querySelector(".hero__img");
  if (img && !img.complete) {
    img.addEventListener("load", scheduleScrollPaint, { once: true });
  }

  if (cinematicEl) {
    cinematicEl.addEventListener("pointerdown", onCinematicDismiss);
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && cinematicActive) {
      e.preventDefault();
      onCinematicDismiss();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
