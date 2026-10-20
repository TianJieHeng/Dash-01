// Photo compositions shared by Photos, Ambient, and the Today memory tile.
(function () {
  'use strict';
  var D = window.DATA;
  function key(p) { return String(p.id || p.seed || p.src || p.url); }
  App.photoKey = key;
  function src(p, big) {
    if (p.src || p.url) return p.src || p.url;
    var w = p.o === 'p' ? 800 : 1600, h = p.o === 'p' ? 1200 : 1000;
    if (!big) { w = Math.round(w / 2); h = Math.round(h / 2); }
    return App.img(p.seed, w, h);
  }
  App.photoSrc = src;
  function parseDate(p) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p.date || '');
    if (!match) return null;
    var d = new Date(+match[1], +match[2] - 1, +match[3]);
    return d.getFullYear() === +match[1] && d.getMonth() === +match[2] - 1 && d.getDate() === +match[3] ? d : null;
  }
  App.photoMeta = function (p) {
    var d = parseDate(p), now = App.now(), date = '', monthYear = '', kicker = '', onThisDay = false;
    if (d) {
      var future = App.dayStart(d) > App.dayStart(now);
      var years = now.getFullYear() - d.getFullYear();
      if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) years--;
      // A leap-day memory is "on this day" only on February 29.
      onThisDay = !future && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
      date = d.getDate() + ' ' + App.fmt.month(d) + ' ' + d.getFullYear();
      monthYear = App.fmt.month(d) + ' ' + d.getFullYear();
      kicker = future ? '' : years > 0 ? years + (years === 1 ? ' year ago' : ' years ago') : onThisDay ? 'Today' : d.getFullYear() === now.getFullYear() ? 'This year' : 'Less than a year ago';
    }
    return { date: date, monthYear: monthYear, kicker: kicker, onThisDay: onThisDay, place: p.place || p.caption || '', from: App.person(p.from) };
  };
  function caption(ps, size) {
    var m = App.photoMeta(ps[0]);
    return '<div class="cap cap--' + (size || 'l') + '"><div class="cap-kicker">' + (m.onThisDay ? '<b>On this day</b> · ' : '') + App.esc(m.kicker) + (m.place ? ' · ' + App.esc(m.place) : '') + '</div><div class="cap-date serif">' + App.esc(ps.length > 1 ? m.monthYear : m.date) + '</div></div>';
  }
  function image(p) {
    var focal = p.focal && isFinite(p.focal.x) && isFinite(p.focal.y) ? Math.max(0, Math.min(100, p.focal.x)) + '% ' + Math.max(0, Math.min(100, p.focal.y)) + '%' : '50% 50%';
    return '<img src="' + App.esc(src(p, true)) + '" alt="' + App.esc(p.description || p.alt || p.caption || '') + '" style="object-position:' + focal + '" data-photo-id="' + App.esc(key(p)) + '">';
  }
  function pane(p, cls, index) { return '<div class="pane ' + (cls || '') + '" data-photo-index="' + index + '"><div class="kb">' + image(p) + '</div></div>'; }
  var BUILD = {
    cover: function (ps, o) { return '<div class="slide slide--cover">' + pane(ps[0], '', 0) + (o.captions ? caption(ps) : '') + '</div>'; },
    pair: function (ps, o) { return '<div class="slide slide--pair">' + pane(ps[0], '', 0) + pane(ps[1], '', 1) + (o.captions ? caption(ps, 'm') : '') + '</div>'; },
    collage: function (ps, o) { return '<div class="slide slide--collage">' + pane(ps[0], 'pane--a', 0) + pane(ps[1], 'pane--b', 1) + pane(ps[2], 'pane--c', 2) + (o.captions ? caption(ps, 'm') : '') + '</div>'; },
    polaroid: function (ps, o) {
      var p = ps[0], m = App.photoMeta(p);
      return '<div class="slide slide--polaroid"><figure class="polaroid polaroid--' + (p.o === 'p' ? 'p' : 'l') + '" data-photo-index="0"><div class="polaroid-img">' + image(p) + '</div><figcaption class="serif">' + (o.captions ? App.esc(m.place || m.date) : '') + '</figcaption></figure></div>';
    }
  };
  function weighted(pool) {
    var total = pool.reduce(function (n, p) { return n + (p.fav ? 2 : 1); }, 0), pick = Math.random() * total;
    for (var i = 0; i < pool.length; i++) { pick -= pool[i].fav ? 2 : 1; if (pick < 0) return pool[i]; }
    return pool[0];
  }
  App.Slideshow = function (el, opts) {
    this.el = el;
    this.o = Object.assign({ layout: 'auto', interval: 15000, captions: true, autoplay: true }, opts || {});
    this.history = []; this.cursor = -1; this.current = null; this.timer = null; this.active = false; this.loading = false; this.generation = 0; this.failed = {};
    var self = this;
    this.onVisibility = function () { if (document.hidden) self.clearTimer(); else if (self.active) self.restart(); };
    document.addEventListener('visibilitychange', this.onVisibility);
  };
  var S = App.Slideshow.prototype;
  S.available = function () {
    var self = this, seen = {};
    return (D.photos || []).filter(function (p) { if (!p || !(p.seed || p.src || p.url)) return false; var id = key(p); if (seen[id] || self.failed[id]) return false; seen[id] = true; return true; });
  };
  S.pick = function (preferred) {
    var pool = this.available(); if (!pool.length) return null;
    var layout = this.o.layout, portraits = pool.filter(function (p) { return p.o === 'p'; });
    if (layout === 'auto') {
      var layouts = ['cover', 'polaroid'];
      if (portraits.length >= 2) layouts.push('pair');
      if (pool.length >= 3) layouts.push('collage');
      var last = this.current && this.current.layout;
      layouts = layouts.filter(function (l) { return l !== last; });
      layout = layouts[Math.floor(Math.random() * layouts.length)];
    }
    if (layout === 'pair' && portraits.length < 2) layout = 'cover';
    if (layout === 'collage' && pool.length < 3) layout = pool.length >= 2 && portraits.length >= 2 ? 'pair' : 'cover';
    var candidates = layout === 'pair' ? portraits : pool;
    var previous = this.current ? this.current.photos.map(key) : [];
    var unseen = candidates.filter(function (p) { return previous.indexOf(key(p)) < 0; });
    var today = !this.current && candidates.filter(function (p) { return App.photoMeta(p).onThisDay; });
    var first = preferred && candidates.indexOf(preferred) >= 0 ? preferred : weighted(today && today.length ? today : unseen.length ? unseen : candidates);
    var photos = [first], count = layout === 'pair' ? 2 : layout === 'collage' ? 3 : 1;
    while (photos.length < count) {
      var remaining = candidates.filter(function (p) { return photos.indexOf(p) < 0; });
      photos.push(weighted(remaining));
    }
    return { layout: layout, photos: photos };
  };
  S.status = function (text) { if (this.o.onStatus) this.o.onStatus(text); };
  S.render = function (slide, historyIndex) {
    if (!slide || !slide.photos.length) return;
    var self = this, token = ++this.generation;
    this.loading = true; this.status(this.current ? '' : 'Loading memories…');
    var wrap = document.createElement('div'); wrap.innerHTML = BUILD[slide.layout](slide.photos, this.o);
    var node = wrap.firstChild; node.style.opacity = '0'; node.setAttribute('aria-hidden', 'true'); this.el.appendChild(node);
    var images = Array.prototype.slice.call(node.querySelectorAll('img')), remaining = images.length, failed = false, finished = false;
    var timeout = setTimeout(function () { finish(true); }, 8000);
    function finish(bad) {
      if (finished) return; finished = true; clearTimeout(timeout);
      if (token !== self.generation) { node.remove(); return; }
      self.loading = false;
      if (bad || failed) {
        node.remove();
        // Skip the failed IDs for this session instead of cycling through broken panels forever.
        images.forEach(function (im) { if (!im.complete || !im.naturalWidth) self.failed[im.dataset.photoId] = true; });
        if (!Object.keys(self.failed).length) slide.photos.forEach(function (p) { self.failed[key(p)] = true; });
        if (self.available().length) { self.status('Some photos are unavailable. Trying another memory…'); self.render(self.pick()); }
        else { self.status('Photos unavailable'); self.restart(); }
        return;
      }
      Array.prototype.slice.call(self.el.children).forEach(function (old) { if (old !== node) old.remove(); });
      node.style.opacity = ''; node.removeAttribute('aria-hidden'); node.classList.add('is-in');
      self.current = slide;
      if (typeof historyIndex === 'number') self.cursor = historyIndex;
      else {
        self.history = self.history.slice(0, self.cursor + 1); self.history.push(slide); self.cursor = self.history.length - 1;
      }
      self.status('');
      if (self.o.onChange) self.o.onChange(slide);
      self.restart();
    }
    function ready(im) {
      if (im._settled) return; im._settled = true;
      if (!im.naturalWidth) { failed = true; self.failed[im.dataset.photoId] = true; }
      remaining--; if (!remaining) finish(false);
    }
    images.forEach(function (im) {
      if (im.complete) ready(im);
      else { im.addEventListener('load', function () { if (im.decode) im.decode().then(function () { ready(im); }, function () { ready(im); }); else ready(im); }); im.addEventListener('error', function () { ready(im); }); }
    });
    if (!images.length) finish(true);
  };
  S.next = function () {
    if (this.loading) return;
    if (this.cursor + 1 < this.history.length) { this.render(this.history[this.cursor + 1], this.cursor + 1); return; }
    if (this.current && this.available().length === 1 && this.o.layout !== 'auto') { this.restart(); return; }
    var slide = this.pick();
    if (!slide) { this.status((D.photos || []).length ? 'Photos unavailable' : 'No memories to display yet'); return; }
    this.render(slide);
  };
  S.prev = function () { if (!this.loading && this.cursor > 0) this.render(this.history[this.cursor - 1], this.cursor - 1); };
  S.setLayout = function (layout) {
    if (!BUILD[layout] && layout !== 'auto') return;
    this.o.layout = layout;
    // A style change recomposes the current memory rather than silently selecting another collection.
    if (this.loading) { this.generation++; this.loading = false; Array.prototype.slice.call(this.el.children).forEach(function (node) { if (node.getAttribute('aria-hidden') === 'true') node.remove(); }); }
    var slide = this.pick(this.current && this.current.photos[0]); if (slide) this.render(slide); else this.next();
  };
  S.showPhoto = function (id) {
    var p = (D.photos || []).filter(function (photo) { return key(photo) === String(id) || photo.seed === id; })[0];
    if (!p) return;
    this.generation++; this.loading = false;
    Array.prototype.slice.call(this.el.children).forEach(function (node) { if (node.getAttribute('aria-hidden') === 'true') node.remove(); });
    delete this.failed[key(p)];
    this.render({ layout: 'cover', photos: [p] });
  };
  S.clearTimer = function () { clearTimeout(this.timer); this.timer = null; };
  S.restart = function () {
    var self = this; this.clearTimer();
    // Fixed modes keep the original dashboard's autoplay; Auto also rotates concrete layouts.
    if (!this.active || document.hidden || this.o.autoplay === false || this.available().length < 2) return;
    this.timer = setTimeout(function () { self.timer = null; self.next(); }, this.o.interval);
  };
  S.start = function () { this.active = true; if (!this.current && !this.loading) this.next(); else this.restart(); };
  S.stop = function () { this.active = false; this.clearTimer(); };
})();
