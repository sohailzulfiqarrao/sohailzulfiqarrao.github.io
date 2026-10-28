/* The hero graphic: Pakistan's 160 district points (from Lab 3) drawn as a network.
   Every point is linked to its three nearest neighbours; small packets travel along the links and the
   graph reacts to the pointer. Runs only while it is on screen and the tab is visible; with reduced
   motion it draws one still frame. */
(function () {
   'use strict';
   var canvas = document.getElementById('network');
   var points = window.DISTRICT_POINTS;
   if (!canvas || !points || !canvas.getContext) { return; }

   var ctx = canvas.getContext('2d');
   var stage = canvas.parentElement;
   var hud = stage.querySelector('.hud');
   var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

   // province index (alphabetical, see points.js) -> colour
   var COLOURS = ['103,232,249', '167,139,250', '196,181,253', '251,191,36', '56,189,248', '34,211,238', '52,211,153'];
   var CAPITAL = 3;                              // Islamabad

   /* ----- projection: equirectangular with cos(latitude) so shapes look right ----- */
   var LON0 = 62.0, LON1 = 77.2, LAT0 = 23.8, LAT1 = 37.2;
   var KX = Math.cos(30.5 * Math.PI / 180);
   var BW = (LON1 - LON0) * KX, BH = LAT1 - LAT0;
   var nodes = points.map(function (p, i) {
      return { x: (p[0] - LON0) * KX / BW, y: (LAT1 - p[1]) / BH, c: p[2], ph: Math.random() * 6.28, i: i, px: 0, py: 0 };
   });

   /* ----- edges: three nearest neighbours, long hops dropped unless a point would be left alone ----- */
   var edges = [], seen = {};
   nodes.forEach(function (a) {
      var near = nodes.filter(function (b) { return b !== a; }).map(function (b) {
         var dx = (a.x - b.x) * BW, dy = (a.y - b.y) * BH;
         return { b: b, d: Math.sqrt(dx * dx + dy * dy) };
      }).sort(function (u, v) { return u.d - v.d; }).slice(0, 3);
      near.forEach(function (n, k) {
         if (k > 0 && n.d > 2.9) { return; }
         var key = Math.min(a.i, n.b.i) * 1000 + Math.max(a.i, n.b.i);
         if (seen[key]) { return; }
         seen[key] = 1;
         edges.push({ a: a, b: n.b });
      });
   });

   /* ----- packets travelling along random edges ----- */
   var packets = [];
   function newPacket(p) {
      p = p || {};
      p.e = edges[(Math.random() * edges.length) | 0];
      p.t = 0; p.dir = Math.random() < .5 ? 1 : -1;
      p.speed = .35 + Math.random() * .5;        // edges per second
      p.col = Math.random() < .6 ? '103,232,249' : '167,139,250';
      return p;
   }
   for (var i = 0; i < 16; i++) { var pk = newPacket(); pk.t = Math.random(); packets.push(pk); }

   /* ----- sizing ----- */
   var W = 0, H = 0, DPR = 1, scale = 1, ox = 0, oy = 0;
   function layout() {
      var r = stage.getBoundingClientRect();
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.round(r.width); H = Math.round(r.height);
      canvas.width = W * DPR; canvas.height = H * DPR;
      var hudH = hud ? hud.offsetHeight + 22 : 0;        // keep clear of the log panel
      var availH = H - hudH - 14, availW = W - 40;
      scale = Math.min(availW / BW, availH / BH) * 0.98;
      ox = (W - BW * scale) / 2;
      oy = Math.max(8, (availH - BH * scale) / 2 + 6);
      nodes.forEach(function (n) { n.px = ox + n.x * BW * scale; n.py = oy + n.y * BH * scale; });
   }

   /* ----- pointer ----- */
   var ptr = { x: -999, y: -999, on: false, sx: 0, sy: 0 };
   stage.addEventListener('pointermove', function (e) {
      var r = stage.getBoundingClientRect();
      ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; ptr.on = true;
   });
   stage.addEventListener('pointerleave', function () { ptr.on = false; });

   /* ----- drawing ----- */
   function frame(t) {
      var s = t / 1000;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // gentle parallax towards the pointer
      var tx = ptr.on ? (ptr.x - W / 2) * 0.018 : 0, ty = ptr.on ? (ptr.y - H / 2) * 0.018 : 0;
      ptr.sx += (tx - ptr.sx) * 0.06; ptr.sy += (ty - ptr.sy) * 0.06;
      ctx.translate(ptr.sx, ptr.sy);

      var R = 96;                                   // pointer radius of influence
      var px = ptr.x - ptr.sx, py = ptr.y - ptr.sy;

      // links
      ctx.lineWidth = 1;
      for (var i = 0; i < edges.length; i++) {
         var e = edges[i], a = e.a, b = e.b, boost = 0;
         if (ptr.on) {
            var mx = (a.px + b.px) / 2 - px, my = (a.py + b.py) / 2 - py, d = Math.sqrt(mx * mx + my * my);
            if (d < R) { boost = 1 - d / R; }
         }
         ctx.strokeStyle = 'rgba(103,232,249,' + (0.13 + boost * 0.6).toFixed(3) + ')';
         ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke();
      }

      // points
      for (var j = 0; j < nodes.length; j++) {
         var n = nodes[j], tw = .6 + .4 * Math.sin(s * 1.6 + n.ph), near = 0;
         if (ptr.on) {
            var dx = n.px - px, dy = n.py - py, dd = Math.sqrt(dx * dx + dy * dy);
            if (dd < R) { near = 1 - dd / R; }
         }
         var col = COLOURS[n.c] || COLOURS[5], r = 1.9 + near * 2.6 + (n.c === CAPITAL ? 1.6 : 0);
         if (near > 0 || n.c === CAPITAL) {
            var g = ctx.createRadialGradient(n.px, n.py, 0, n.px, n.py, r * 5);
            g.addColorStop(0, 'rgba(' + col + ',' + (0.45 * Math.max(near, n.c === CAPITAL ? .7 : 0)).toFixed(3) + ')');
            g.addColorStop(1, 'rgba(' + col + ',0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.px, n.py, r * 5, 0, 6.2832); ctx.fill();
         }
         ctx.fillStyle = 'rgba(' + col + ',' + (0.55 * tw + 0.4 + near * 0.3).toFixed(3) + ')';
         ctx.beginPath(); ctx.arc(n.px, n.py, r, 0, 6.2832); ctx.fill();
      }

      // the capital gets a slow ring
      var cap = nodes.filter(function (n) { return n.c === CAPITAL; })[0];
      if (cap) {
         var k = (s * .5) % 1;
         ctx.strokeStyle = 'rgba(251,191,36,' + (0.5 * (1 - k)).toFixed(3) + ')';
         ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cap.px, cap.py, 6 + k * 22, 0, 6.2832); ctx.stroke();
      }

      // packets
      for (var m = 0; m < packets.length; m++) {
         var p = packets[m], a2 = p.dir > 0 ? p.e.a : p.e.b, b2 = p.dir > 0 ? p.e.b : p.e.a;
         var x = a2.px + (b2.px - a2.px) * p.t, y = a2.py + (b2.py - a2.py) * p.t;
         var tr = Math.max(0, p.t - .22), x0 = a2.px + (b2.px - a2.px) * tr, y0 = a2.py + (b2.py - a2.py) * tr;
         var grad = ctx.createLinearGradient(x0, y0, x, y);
         grad.addColorStop(0, 'rgba(' + p.col + ',0)'); grad.addColorStop(1, 'rgba(' + p.col + ',.95)');
         ctx.strokeStyle = grad; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke();
         ctx.fillStyle = 'rgba(' + p.col + ',1)'; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 6.2832); ctx.fill();
         if (!reduce) {
            p.t += p.speed * dt;
            if (p.t >= 1) { newPacket(p); }
         }
      }
   }

   /* ----- loop ----- */
   var running = false, visible = true, last = 0, dt = 0.016;
   function loop(t) {
      if (!running) { return; }
      dt = Math.min(.05, (t - last) / 1000 || .016); last = t;
      frame(t);
      requestAnimationFrame(loop);
   }
   function start() { if (reduce || running || !visible || document.hidden) { return; } running = true; last = performance.now(); requestAnimationFrame(loop); }
   function stop() { running = false; }

   layout();
   frame(1500);                                     // one frame straight away (also the still image for reduced motion)
   if (!reduce) { start(); }

   if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) { start(); } else { stop(); } }).observe(stage);
   }
   document.addEventListener('visibilitychange', function () { if (document.hidden) { stop(); } else { start(); } });
   var rz;
   window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { layout(); if (!running) { frame(1500); } }, 120); });
   if ('ResizeObserver' in window) { new ResizeObserver(function () { clearTimeout(rz); rz = setTimeout(function () { layout(); if (!running) { frame(1500); } }, 60); }).observe(stage); }
})();
