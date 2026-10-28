/* Behaviour for the main page. Everything here is an enhancement: with scripts off the page still reads
   and every link works. Respects prefers-reduced-motion. */
(function () {
   'use strict';
   var root = document.documentElement;
   var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
   var $ = function (s, c) { return (c || document).querySelector(s); };
   var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

   /* ---------- theme ---------- */
   var themeBtn = $('#theme-toggle');
   var themeColour = $('meta[name="theme-color"]');
   function applyTheme(t) {
      root.dataset.theme = t;
      if (themeColour) { themeColour.setAttribute('content', t === 'light' ? '#f4f7fc' : '#050912'); }
      if (themeBtn) { themeBtn.setAttribute('aria-label', t === 'light' ? 'Switch to the dark theme' : 'Switch to the light theme'); }
   }
   applyTheme(root.dataset.theme === 'light' ? 'light' : 'dark');
   if (themeBtn) {
      themeBtn.addEventListener('click', function () {
         var next = root.dataset.theme === 'light' ? 'dark' : 'light';
         applyTheme(next);
         try { localStorage.setItem('theme', next); } catch (e) { /* storage blocked */ }
      });
   }

   /* ---------- header, mobile menu, scroll-spy ---------- */
   var header = $('#site-header');
   function onScroll() {
      header.classList.toggle('scrolled', window.scrollY > 8);
      if (window.scrollY < 240) { $$('.nav a.active').forEach(function (a) { a.classList.remove('active'); a.removeAttribute('aria-current'); }); }   // back on the hero
   }
   onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

   var nav = $('#nav'), menuBtn = $('#menu-toggle');
   function setMenu(open) {
      nav.classList.toggle('open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
   }
   menuBtn.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });
   nav.addEventListener('click', function (e) { if (e.target.closest('a')) { setMenu(false); } });
   document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { setMenu(false); } });
   window.addEventListener('resize', function () { if (window.innerWidth > 960) { setMenu(false); } });

   var links = $$('.nav a');
   var byId = {}; links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
   if ('IntersectionObserver' in window) {
      var spy = new IntersectionObserver(function (entries) {
         entries.forEach(function (en) {
            if (en.isIntersecting && byId[en.target.id]) {
               links.forEach(function (a) { a.classList.remove('active'); a.removeAttribute('aria-current'); });
               byId[en.target.id].classList.add('active'); byId[en.target.id].setAttribute('aria-current', 'true');
            }
         });
      }, { rootMargin: '-45% 0px -50% 0px' });
      Object.keys(byId).forEach(function (id) { var s = document.getElementById(id); if (s) { spy.observe(s); } });
   }

   /* ---------- reveal on scroll ---------- */
   var reveals = $$('.reveal');
   reveals.forEach(function (el) {
      var sibs = $$('.reveal', el.parentElement), i = sibs.indexOf(el);
      el.style.setProperty('--d', Math.min(i, 5) * 0.07 + 's');
   });
   if ('IntersectionObserver' in window && !reduce) {
      var io = new IntersectionObserver(function (entries) {
         entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      reveals.forEach(function (el) { io.observe(el); });
   } else {
      reveals.forEach(function (el) { el.classList.add('in'); });
   }

   /* ---------- counters ---------- */
   function format(n) { return n.toLocaleString('en-US'); }
   var counters = $$('[data-count]');
   function runCounter(el) {
      var end = Number(el.getAttribute('data-count')), start = performance.now(), dur = 1500;
      function step(now) {
         var k = Math.min(1, (now - start) / dur), e = k === 1 ? 1 : 1 - Math.pow(2, -10 * k);
         el.textContent = format(Math.round(end * e));
         if (k < 1) { requestAnimationFrame(step); }
      }
      requestAnimationFrame(step);
   }
   if ('IntersectionObserver' in window && !reduce) {
      var co = new IntersectionObserver(function (entries) {
         entries.forEach(function (en) { if (en.isIntersecting) { runCounter(en.target); co.unobserve(en.target); } });
      }, { threshold: 0.6 });
      counters.forEach(function (el) { el.textContent = '0'; co.observe(el); });
   }

   /* ---------- results log in the hero (typed; every line is a real result from the labs) ---------- */
   var hud = $('#hud-body');
   var LOG = [
      [['p', '[webgis] '], ['t', '160 districts saved to PostGIS']],
      [['p', '[webgis] '], ['t', '/api/where/ → '], ['ok', 'Islamabad · pop 2,363,863']],
      [['m', '[ml]     '], ['t', 'OLS, 87 rows · test R² '], ['ok', '0.785'], ['t', ' · RMSE 1.78 mm']],
      [['m', '[ml]     '], ['t', 'K-means k=10 · ARI '], ['ok', '0.62'], ['t', ' on 25,311 unseen offers']]
   ];
   function span(cls, text) { var s = document.createElement('span'); if (cls !== 't') { s.className = cls === 'm' ? 'p m' : cls; } s.textContent = text; return s; }
   function paintAll() {
      hud.textContent = '';
      LOG.forEach(function (line, i) { line.forEach(function (seg) { hud.appendChild(span(seg[0], seg[1])); }); if (i < LOG.length - 1) { hud.appendChild(document.createTextNode('\n')); } });
   }
   if (hud) {
      if (reduce) { paintAll(); }
      else {
         var caret = document.createElement('span'); caret.className = 'caret';
         var gen = 0;                        // a new run bumps this, which ends any older run at its next step
         var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
         var typeLog = async function (mine) {
            while (mine === gen) {
               hud.textContent = ''; hud.appendChild(caret);
               for (var l = 0; l < LOG.length; l++) {
                  for (var s = 0; s < LOG[l].length; s++) {
                     var seg = LOG[l][s], node = span(seg[0], '');
                     if (mine !== gen) { return; }
                     hud.insertBefore(node, caret);
                     for (var c = 0; c < seg[1].length; c++) {
                        node.textContent += seg[1][c];
                        await wait(seg[0] === 'p' || seg[0] === 'm' ? 4 : 16 + Math.random() * 18);
                        if (mine !== gen) { return; }
                     }
                  }
                  if (l < LOG.length - 1) { hud.insertBefore(document.createTextNode('\n'), caret); await wait(260); if (mine !== gen) { return; } }
               }
               await wait(5200);
            }
         };
         typeLog(++gen);
         document.addEventListener('visibilitychange', function () { gen++; if (!document.hidden) { typeLog(gen); } });
      }
   }

   /* ---------- spotlight on cards ---------- */
   if (!reduce) {
      $$('[data-spot]').forEach(function (card) {
         card.addEventListener('pointermove', function (e) {
            var r = card.getBoundingClientRect();
            card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
            card.style.setProperty('--my', (e.clientY - r.top) + 'px');
         });
      });
   }

   /* ---------- quick jump (Ctrl K) ---------- */
   var dlg = $('#palette'), q = $('#palette-q'), list = $('#palette-list');
   var BASE = 'https://sohailzulfiqarrao.github.io/';
   var WG = BASE + 'webgis-ms25igis-578135/', ML = BASE + 'aml-ms25igis-578135/';
   var ITEMS = [
      { k: 'section', t: 'Pipeline', u: '#pipeline', w: 'how it fits together collect store serve map learn' },
      { k: 'section', t: 'Web GIS labs', u: '#webgis', w: 'leaflet django postgis maps' },
      { k: 'section', t: 'Machine learning assignments', u: '#ml', w: 'regression clustering notebooks' },
      { k: 'section', t: 'The stack', u: '#stack', w: 'tools python qgis' },
      { k: 'section', t: 'About', u: '#about', w: 'sohail zulfiqar nust igis' },
      { k: 'site', t: 'Web GIS hub', u: WG, w: 'labs all' },
      { k: 'site', t: 'Machine learning hub', u: ML, w: 'assignments all' },
      { k: 'site', t: 'GitHub profile', u: 'https://github.com/sohailzulfiqarrao', w: 'repositories code' },
      { k: 'web gis', t: 'Lab 01 · First Web Map', u: WG + 'lab-1-First-Web-Map/', w: 'islamabad leaflet markers' },
      { k: 'web gis', t: 'Lab 02 · District Explorer', u: WG + 'lab-2-district-explorer/', w: 'choropleth population province filter' },
      { k: 'web gis', t: 'Lab 03 · District Dashboard', u: WG + 'lab-3-district-dashboard/', w: 'layers density circles events' },
      { k: 'web gis', t: 'Lab 04 · GeoDjango with PostGIS (snapshot)', u: WG + 'lab-4-GeoDjango_Getting_Started/web/', w: 'django postgis admin api' },
      { k: 'ml', t: 'Assignment 01 · Evapotranspiration regression', u: ML + 'Assignments/Assignment%201/', w: 'mlr ndvi islamabad r2' },
      { k: 'ml', t: 'Assignment 02 · Clustering product offers', u: ML + 'Assignments/Assignment%202/', w: 'kmeans dbscan gmm tsne ari' },
      { k: 'repo', t: 'Web GIS repository', u: 'https://github.com/sohailzulfiqarrao/webgis-ms25igis-578135', w: 'source code' },
      { k: 'repo', t: 'Machine learning repository', u: 'https://github.com/sohailzulfiqarrao/aml-ms25igis-578135', w: 'source code notebooks' }
   ];
   var shown = [], sel = 0;
   function render() {
      var term = q.value.trim().toLowerCase();
      shown = ITEMS.filter(function (it) { return !term || (it.t + ' ' + it.k + ' ' + it.w).toLowerCase().indexOf(term) > -1; });
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      list.textContent = '';
      if (!shown.length) {
         var none = document.createElement('li'); none.className = 'palette-empty'; none.textContent = 'Nothing matches “' + q.value.trim() + '”'; list.appendChild(none); return;
      }
      shown.forEach(function (it, i) {
         var li = document.createElement('li'); li.setAttribute('role', 'option'); li.id = 'pal-' + i;
         li.setAttribute('aria-selected', String(i === sel));
         var k = document.createElement('span'); k.className = 'tagk'; k.textContent = it.k;
         var t = document.createElement('span'); t.textContent = it.t;
         var s = document.createElement('small'); s.textContent = it.u.charAt(0) === '#' ? 'jump' : 'opens in a new tab';
         li.appendChild(k); li.appendChild(t); li.appendChild(s);
         li.addEventListener('mousemove', function () { if (sel !== i) { sel = i; mark(); } });
         li.addEventListener('click', function () { go(it); });
         list.appendChild(li);
      });
      q.setAttribute('aria-activedescendant', 'pal-' + sel);
   }
   function mark() {
      $$('li', list).forEach(function (li, i) { li.setAttribute('aria-selected', String(i === sel)); if (i === sel) { li.scrollIntoView({ block: 'nearest' }); } });
      q.setAttribute('aria-activedescendant', 'pal-' + sel);
   }
   function go(it) {
      dlg.close();
      if (it.u.charAt(0) === '#') { location.hash = it.u; }
      else { window.open(it.u, '_blank', 'noopener'); }
   }
   function openPalette() {
      if (!dlg || typeof dlg.showModal !== 'function' || dlg.open) { return; }
      q.value = ''; sel = 0; render(); dlg.showModal(); q.focus();
   }
   if (dlg) {
      $('#open-palette').addEventListener('click', openPalette);
      q.addEventListener('input', function () { sel = 0; render(); });
      q.addEventListener('keydown', function (e) {
         if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); mark(); }
         else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
         else if (e.key === 'Enter') { e.preventDefault(); if (shown[sel]) { go(shown[sel]); } }
      });
      dlg.addEventListener('click', function (e) { if (e.target === dlg) { dlg.close(); } });   // click on the backdrop
   }
   document.addEventListener('keydown', function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
      else if (e.key === '/' && !typing) { e.preventDefault(); openPalette(); }
   });
})();
