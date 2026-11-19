/*
 * Growr mark animation for the website: the ring winds back and swallows the
 * dot, springs forward one full turn (its gap narrows with speed) and pops the
 * dot back out. A port of LogoMotion in lib/core/widgets/growr_logo_motion.dart
 * (same timings and springs), formerly the app's launch animation; see
 * design/launch-animation/README.md.
 *
 * Usage: an inline mark SVG (viewBox 0 0 512 512, one ring <path>, one dot
 * <circle>) with a data-logo-motion attribute:
 *   data-logo-motion="intro"  plays once when the page loads
 *   data-logo-motion="loop"   loops (1.7 s) while the element is on the page,
 *                             e.g. as a loading indicator
 *   data-logo-motion="view"   plays once each time it scrolls into view
 * Under prefers-reduced-motion the mark stays still.
 */
(function () {
  'use strict';

  var REST_GAP = 60, RING_R = 120, DOT_R = 26, DOT_ANGLE = -20;
  var LEAD = 100, WIND_UP = 180, WIND_UP_TURN = -18, GULP = 200;
  var MAX_SQUEEZE = 28, POP_AT = 520, RIPPLE_AT = 610, RIPPLE_LEN = 440;
  var RECOIL = 0.03, RECOIL_LEN = 300;
  var INTRO = LEAD + 1060, PERIOD = 1700;

  // Flutter's under-damped SpringSimulation from 0 to 1 at rest.
  function spring(mass, stiffness, ratio) {
    var c = ratio * 2 * Math.sqrt(mass * stiffness);
    var r = -c / (2 * mass);
    var w = Math.sqrt(4 * mass * stiffness - c * c) / (2 * mass);
    var c1 = -1, c2 = -r * c1 / w;
    return {
      x: function (s) {
        var p = Math.exp(r * s);
        return 1 + p * (c1 * Math.cos(w * s) + c2 * Math.sin(w * s));
      },
      dx: function (s) {
        var p = Math.exp(r * s), co = Math.cos(w * s), si = Math.sin(w * s);
        return p * (c2 * w * co - c1 * w * si) + r * p * (c2 * si + c1 * co);
      }
    };
  }
  var SPIN = spring(1, 110, 0.78);
  var POP = spring(1, 520, 0.42);
  var SPIN_PEAK = (function () {
    var peak = 0;
    for (var s = 0; s < 1; s += 0.002) peak = Math.max(peak, Math.abs(SPIN.dx(s)));
    return peak;
  })();

  // Flutter's Cubic curves.
  function cubic(a, b, c, d) {
    function ev(p1, p2, m) {
      return 3 * p1 * (1 - m) * (1 - m) * m + 3 * p2 * (1 - m) * m * m + m * m * m;
    }
    return function (t) {
      var lo = 0, hi = 1;
      for (;;) {
        var mid = (lo + hi) / 2, est = ev(a, c, mid);
        if (Math.abs(t - est) < 0.001) return ev(b, d, mid);
        if (est < t) lo = mid; else hi = mid;
      }
    };
  }
  var easeInOutCubic = cubic(0.645, 0.045, 0.355, 1);
  var easeInBack = cubic(0.6, -0.28, 0.735, 0.045);
  var easeOutCubic = cubic(0.215, 0.61, 0.355, 1);
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  var REST = { turn: 0, gap: REST_GAP, dot: 1, ripple: 0, scale: 1 };

  // The pose t ms after the intro started (rest before 0 and after INTRO).
  function poseAt(t) {
    var ms = t - LEAD;
    if (ms <= 0 || ms >= INTRO - LEAD) return REST;
    var turn, gap = REST_GAP;
    if (ms < WIND_UP) {
      turn = WIND_UP_TURN * easeInOutCubic(ms / WIND_UP);
    } else {
      var s = (ms - WIND_UP) / 1000;
      turn = WIND_UP_TURN + (360 - WIND_UP_TURN) * SPIN.x(s);
      gap -= MAX_SQUEEZE * clamp01(Math.abs(SPIN.dx(s)) / SPIN_PEAK);
    }
    var dot = 0;
    if (ms < GULP) dot = 1 - easeInBack(ms / GULP);
    else if (ms >= POP_AT) dot = Math.max(0, POP.x((ms - POP_AT) / 1000));
    var recoil = clamp01((ms - POP_AT) / RECOIL_LEN);
    return {
      turn: turn,
      gap: gap,
      dot: dot,
      ripple: clamp01((ms - RIPPLE_AT) / RIPPLE_LEN),
      scale: 1 + RECOIL * Math.sin(Math.PI * recoil)
    };
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';
  function rad(deg) { return deg * Math.PI / 180; }
  function pt(deg, r) {
    return (256 + Math.cos(rad(deg)) * r).toFixed(2) + ' ' +
      (256 + Math.sin(rad(deg)) * r).toFixed(2);
  }

  function attach(svg) {
    var ring = svg.querySelector('path');
    var dot = svg.querySelector('circle');
    if (!ring || !dot) return null;
    var ripple = document.createElementNS(SVG_NS, 'circle');
    ripple.setAttribute('fill', 'none');
    ripple.setAttribute('stroke', dot.getAttribute('fill') || '#FF8A4C');
    ripple.setAttribute('opacity', '0');
    svg.insertBefore(ripple, ring);
    return function draw(p) {
      var scale = 'translate(256 256) scale(' + p.scale + ') translate(-256 -256)';
      var start = DOT_ANGLE + p.turn + p.gap / 2;
      var sweep = 360 - p.gap;
      ring.setAttribute('d', 'M' + pt(start, RING_R) + ' A ' + RING_R + ' ' +
        RING_R + ' 0 ' + (sweep > 180 ? 1 : 0) + ' 1 ' + pt(start + sweep, RING_R));
      ring.setAttribute('transform', scale);
      var c = pt(DOT_ANGLE + p.turn, RING_R).split(' ');
      dot.setAttribute('cx', c[0]);
      dot.setAttribute('cy', c[1]);
      dot.setAttribute('r', (DOT_R * p.dot).toFixed(2));
      dot.setAttribute('transform', scale);
      if (p.ripple > 0 && p.ripple < 1) {
        var grow = easeOutCubic(p.ripple);
        ripple.setAttribute('cx', c[0]);
        ripple.setAttribute('cy', c[1]);
        ripple.setAttribute('r', (DOT_R + 72 * grow).toFixed(2));
        ripple.setAttribute('stroke-width', (2 + 6 * (1 - grow)).toFixed(2));
        ripple.setAttribute('opacity', (0.8 * Math.pow(1 - p.ripple, 1.5)).toFixed(3));
        ripple.setAttribute('transform', scale);
      } else {
        ripple.setAttribute('opacity', '0');
      }
    };
  }

  // Plays the intro once every time the mark enters the viewport.
  function watch(svg, draw) {
    if (!('IntersectionObserver' in window)) return;
    var playing = false;
    new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting || playing) return;
      playing = true;
      var origin = null;
      requestAnimationFrame(function frame(now) {
        if (origin === null) origin = now;
        var t = now - origin;
        if (t >= INTRO) { draw(REST); playing = false; return; }
        draw(poseAt(t));
        requestAnimationFrame(frame);
      });
    }, { threshold: 0.6 }).observe(svg);
  }

  function start() {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var marks = [];
    document.querySelectorAll('svg[data-logo-motion]').forEach(function (svg) {
      var draw = attach(svg);
      if (!draw) return;
      var mode = svg.getAttribute('data-logo-motion');
      if (mode === 'view') { watch(svg, draw); return; }
      marks.push({ svg: svg, draw: draw, loop: mode === 'loop', done: false });
    });
    if (!marks.length) return;
    var origin = null;
    function frame(now) {
      if (origin === null) origin = now;
      var t = now - origin, running = false;
      marks.forEach(function (m) {
        if (m.done) return;
        if (m.loop) {
          if (!m.svg.isConnected) { m.done = true; return; }
          m.draw(poseAt(t % PERIOD));
          running = true;
        } else if (t >= INTRO) {
          m.draw(REST);
          m.done = true;
        } else {
          m.draw(poseAt(t));
          running = true;
        }
      });
      if (running) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
