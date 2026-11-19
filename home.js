/*
 * Home page motion: scroll reveals, count-ups, card spotlight and the
 * phone demo (sets get checked, the rest timer runs, a PR toast pops).
 * Everything is decoration: without JS, or under prefers-reduced-motion,
 * the page shows its final state.
 */
(function () {
  'use strict';

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  // ---- scroll reveal ------------------------------------------------------
  var revealed = document.querySelectorAll('[data-reveal], .split, .showcase .card');
  if (reduce || !('IntersectionObserver' in window)) {
    revealed.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        if (e.target.querySelector('[data-count]')) countUp(e.target);
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealed.forEach(function (el) { io.observe(el); });
    // A fast jump can skip an element without it ever intersecting; reveal
    // anything that is already above the fold.
    var pending = false;
    window.addEventListener('scroll', function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        revealed.forEach(function (el) {
          if (el.classList.contains('in')) return;
          if (el.getBoundingClientRect().top < innerHeight * 0.9) {
            el.classList.add('in');
            if (el.querySelector('[data-count]')) countUp(el);
            io.unobserve(el);
          }
        });
      });
    }, { passive: true });
  }

  // ---- count-up -----------------------------------------------------------
  function countUp(scope) {
    scope.querySelectorAll('[data-count]').forEach(function (el) {
      var to = parseFloat(el.getAttribute('data-count'));
      var dec = parseInt(el.getAttribute('data-decimals') || '0', 10);
      var dur = 1100, t0 = null;
      function fmt(v) {
        return v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
      }
      function step(now) {
        if (t0 === null) t0 = now;
        var p = Math.min(1, (now - t0) / dur);
        var e = 1 - Math.pow(1 - p, 4);
        el.textContent = fmt(to * e);
        if (p < 1) requestAnimationFrame(step);
      }
      el.textContent = fmt(0);
      requestAnimationFrame(step);
    });
  }

  // ---- spotlight + tilt (fine pointers only) ------------------------------
  if (!reduce && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.spot, .tilt').forEach(function (el) {
      el.addEventListener('pointermove', function (ev) {
        var r = el.getBoundingClientRect();
        var x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
        el.style.setProperty('--x', (x * 100).toFixed(1) + '%');
        el.style.setProperty('--y', (y * 100).toFixed(1) + '%');
        if (el.classList.contains('tilt')) {
          el.style.setProperty('--rx', ((0.5 - y) * 4).toFixed(2) + 'deg');
          el.style.setProperty('--ry', ((x - 0.5) * 5).toFixed(2) + 'deg');
        }
      });
      el.addEventListener('pointerleave', function () {
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });
  }

  // ---- header state -------------------------------------------------------
  var header = document.querySelector('header.site');
  function onScroll() { header.classList.toggle('scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---- phone demo ---------------------------------------------------------
  var phone = document.querySelector('.phone');
  if (!phone) return;
  var sets = phone.querySelectorAll('.ph-row.set');
  var bar = document.getElementById('ph-bar');
  var doneEl = document.getElementById('ph-done');
  var rest = document.getElementById('ph-rest');
  var restLine = document.getElementById('ph-rest-line');
  var restTime = document.getElementById('ph-rest-time');
  var toast = document.getElementById('ph-toast');
  var elapsed = document.getElementById('ph-elapsed');
  var TOTAL = 9, BASE = 0, REST = 150;

  function setDone(n) {
    sets.forEach(function (row, i) { row.classList.toggle('done', i < n); });
    doneEl.textContent = BASE + n;
    bar.style.transform = 'scaleX(' + ((BASE + n) / TOTAL) + ')';
  }
  function mmss(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

  if (reduce) {
    setDone(3);
    rest.classList.add('on');
    restLine.style.transform = 'scaleX(.6)';
    restTime.textContent = '1:30';
    return;
  }

  // Elapsed clock ticks in real time.
  var startClock = 24 * 60 + 18, clockT0 = Date.now();
  setInterval(function () {
    var s = startClock + Math.floor((Date.now() - clockT0) / 1000);
    elapsed.textContent = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }, 1000);

  // The rest countdown is sped up so a full cycle fits in a few seconds.
  var restEnd = 0, restRaf = 0;
  function startRest(ms) {
    rest.classList.add('on');
    var t0 = performance.now();
    restEnd = t0 + ms;
    cancelAnimationFrame(restRaf);
    (function tick(now) {
      var left = Math.max(0, restEnd - now), p = left / ms;
      restLine.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      restTime.textContent = mmss(REST * p);
      if (left > 0) restRaf = requestAnimationFrame(tick);
    })(t0);
  }

  var visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }, { threshold: 0.2 }).observe(phone);
  }

  var timeline = [
    function () { setDone(0); rest.classList.remove('on'); toast.classList.remove('on'); },
    function () { setDone(1); startRest(1900); },
    function () { setDone(2); startRest(1900); },
    function () { setDone(3); startRest(2600); toast.classList.add('on'); },
    function () { toast.classList.remove('on'); },
    function () { setDone(4); startRest(1900); },
    function () { setDone(5); startRest(1900); },
    function () {}
  ];
  var waits = [900, 2000, 2000, 1500, 1300, 2000, 2600, 600];
  var i = 0;
  function run() {
    if (visible && !document.hidden) {
      timeline[i]();
      var w = waits[i];
      i = (i + 1) % timeline.length;
      setTimeout(run, w);
    } else {
      setTimeout(run, 400);
    }
  }
  setDone(0);
  setTimeout(run, 900);
})();
