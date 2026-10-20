// CINEMA FRAME — photography remains untouched; chrome and captions sit above it.
(function () {
  'use strict';
  var D = window.DATA;
  var V = { el: null, show: null, layout: 'cover', loud: false, active: 0, saving: false, messageTimer: null };
  var LAYOUTS = [['auto', 'Auto'], ['cover', 'Cover'], ['pair', 'Pair'], ['collage', 'Collage'], ['polaroid', 'Polaroid']];
  var FAV_KEY = 'dash01.photo-favourites.v1';
  // Favourite flags are local to this display. No remote service or sync is implied.
  try {
    var stored = JSON.parse(localStorage.getItem(FAV_KEY) || '{}');
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) D.photos.forEach(function (p) { if (typeof stored[App.photoKey(p)] === 'boolean') p.fav = stored[App.photoKey(p)]; });
  } catch (ignore) { /* Keep the supplied photo data when storage is unavailable/corrupt. */ }
  function activePhoto() { return V.show && V.show.current && V.show.current.photos[V.active]; }
  function notice(text) {
    var status = V.el.querySelector('.ph-notice'); status.textContent = text;
    clearTimeout(V.messageTimer); V.messageTimer = setTimeout(function () { status.textContent = ''; }, 5000);
  }
  function setLoud(value) {
    V.loud = value; V.el.querySelector('.photos').classList.toggle('is-loud', value);
    var center = V.el.querySelector('[data-loud]');
    center.setAttribute('aria-pressed', String(value)); center.setAttribute('aria-label', value ? 'Reduce photo details' : 'Emphasize photo details');
  }
  function paint() {
    var slide = V.show.current, p = activePhoto(), root = V.el.querySelector('.photos');
    root.classList.toggle('is-polaroid', !!slide && slide.layout === 'polaroid');
    var caption = V.el.querySelector('.ph-caption'), fav = V.el.querySelector('[data-fav]');
    if (!p) { caption.innerHTML = ''; fav.disabled = true; updateNavigation(); return; }
    var m = App.photoMeta(p), multi = slide.photos.length > 1;
    var cycle = caption.querySelector('[data-cycle-photo]');
    var restoreCycleFocus = cycle && document.activeElement === cycle;
    caption.innerHTML = (multi ? '<button class="ph-photo-number" data-cycle-photo aria-label="Caption and favourite target: photo ' + (V.active + 1) + ' of ' + slide.photos.length + '. Select next photo in this composition">Photo ' + (V.active + 1) + ' of ' + slide.photos.length + ' <span>· Select photo</span></button>' : '') +
      (m.place ? '<h2 class="ph-place">' + App.esc(m.place) + '</h2>' : '') +
      (m.date ? '<div class="ph-date">' + App.esc(m.date) + '</div>' : '') +
      (m.kicker ? '<div class="ph-relative">' + (m.onThisDay ? 'On this day · ' : '') + App.esc(m.kicker) + '</div>' : '');
    // Only replace focus that this render removed; autoplay must not pull it from another control.
    if (restoreCycleFocus && multi) caption.querySelector('[data-cycle-photo]').focus({ preventScroll: true });
    var frameCaption = V.el.querySelector('.polaroid figcaption');
    if (frameCaption) frameCaption.innerHTML = '<span>' + App.esc(m.place) + '</span>' + (m.date ? '<small>' + App.esc(m.date) + '</small>' : '');
    App.$$('[data-photo-index]', V.el.querySelector('.ph-stage')).forEach(function (pane) {
      pane.classList.toggle('is-active-photo', multi && +pane.dataset.photoIndex === V.active);
    });
    fav.disabled = V.saving; fav.classList.toggle('is-on', !!p.fav);
    fav.setAttribute('aria-pressed', String(!!p.fav)); fav.setAttribute('aria-busy', String(V.saving));
    fav.setAttribute('aria-label', (p.fav ? 'Remove this photo from favourites' : 'Add this photo to favourites') + (multi ? ', photo ' + (V.active + 1) + ' of ' + slide.photos.length : ''));
    fav.querySelector('span').textContent = V.saving ? 'Saving…' : 'Favourite';
    updateNavigation();
  }
  function updateNavigation() {
    var more = V.show.available().length > 1, busy = V.show.loading;
    App.$$('[data-prev]', V.el).forEach(function (b) { b.disabled = busy || V.show.cursor < 1; });
    App.$$('[data-next]', V.el).forEach(function (b) { b.disabled = busy || (!more && V.show.cursor + 1 >= V.show.history.length); });
  }
  function navigate(next) { if (next) V.show.next(); else V.show.prev(); updateNavigation(); }
  function chooseLayout(layout) {
    V.layout = layout;
    App.$$('[data-layout]', V.el).forEach(function (b) { var selected = b.dataset.layout === layout; b.classList.toggle('is-on', selected); b.setAttribute('aria-pressed', String(selected)); });
    V.show.setLayout(layout); updateNavigation();
  }
  function centreTap(event) {
    var slide = V.show.current;
    if (slide && slide.photos.length > 1 && event.detail !== 0) {
      var panes = App.$$('[data-photo-index]', V.el.querySelector('.ph-stage'));
      var hit = panes.filter(function (pane) { var r = pane.getBoundingClientRect(); return event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom; })[0];
      if (hit && +hit.dataset.photoIndex !== V.active) { V.active = +hit.dataset.photoIndex; setLoud(true); paint(); return; }
    }
    setLoud(!V.loud);
  }
  function favourite() {
    var p = activePhoto(); if (!p || V.saving) return;
    var before = !!p.fav; V.saving = true; p.fav = !before; paint();
    setTimeout(function () {
      try {
        var flags = {}; D.photos.forEach(function (photo) { flags[App.photoKey(photo)] = !!photo.fav; });
        localStorage.setItem(FAV_KEY, JSON.stringify(flags));
        notice(p.fav ? 'Added to favourites · shown more often in rotation' : 'Removed from favourites');
        App.emit('data');
      } catch (error) { p.fav = before; notice('Could not save favourite. Please try again.'); }
      V.saving = false; paint();
    }, 100);
  }
  function showSelected(opts) {
    if (opts && opts.photo) {
      V.layout = 'cover'; V.show.o.layout = 'cover';
      App.$$('[data-layout]', V.el).forEach(function (b) { var selected = b.dataset.layout === 'cover'; b.classList.toggle('is-on', selected); b.setAttribute('aria-pressed', String(selected)); });
      V.show.showPhoto(opts.photo);
    }
  }
  App.register('photos', {
    show: function (el, opts) {
      if (!V.el) {
        V.el = el;
        el.innerHTML = '<div class="photos"><div class="ph-stage" role="group" aria-label="Photo composition"></div>' +
          '<div class="ph-empty"><span>Loading memories…</span></div>' +
          '<div class="ph-surface" tabindex="0" role="group" aria-label="Memory frame. Left and right arrows navigate; Enter emphasizes details.">' +
          '<button class="ph-zone ph-zone--l" data-prev aria-label="Previous memory" tabindex="-1"></button><button class="ph-zone ph-zone--c" data-loud aria-label="Emphasize photo details" aria-pressed="false" tabindex="-1"></button><button class="ph-zone ph-zone--r" data-next aria-label="Next memory" tabindex="-1"></button></div>' +
          '<header class="ph-top"><h1>Photos <span>/ Memory Frame</span></h1><div class="ph-layouts" role="group" aria-label="Display style">' + LAYOUTS.map(function (l) {
            return '<button data-layout="' + l[0] + '" aria-pressed="' + (l[0] === V.layout) + '" class="' + (l[0] === V.layout ? 'is-on' : '') + '">' + l[1] + '</button>';
          }).join('') + '</div></header>' +
          '<button class="ph-arrow ph-arrow--prev" data-prev aria-label="Previous memory">' + App.icon('left', 31) + '</button><button class="ph-arrow ph-arrow--next" data-next aria-label="Next memory">' + App.icon('right', 31) + '</button>' +
          '<footer class="ph-bottom"><div class="ph-caption"></div><button class="ph-favourite" data-fav aria-pressed="false" aria-label="Add this photo to favourites" disabled>' + App.icon('heart', 43) + '<span>Favourite</span></button><div class="ph-notice" role="status" aria-live="polite"></div></footer></div>';
        V.show = new App.Slideshow(el.querySelector('.ph-stage'), {
          layout: V.layout, interval: 15000, captions: false,
          onChange: function () { V.active = 0; el.querySelector('.ph-empty').hidden = true; paint(); },
          onStatus: function (text) {
            var empty = el.querySelector('.ph-empty'); empty.hidden = !!V.show.current || !text;
            empty.querySelector('span').textContent = text;
            if (V.show.current && text) notice(text);
            updateNavigation();
          }
        });
        el.addEventListener('click', function (e) {
          var t = e.target.closest('button'); if (!t || t.disabled) return;
          if (t.hasAttribute('data-next')) return navigate(true);
          if (t.hasAttribute('data-prev')) return navigate(false);
          if (t.hasAttribute('data-loud')) return centreTap(e);
          if (t.dataset.layout) return chooseLayout(t.dataset.layout);
          if (t.hasAttribute('data-fav')) return favourite();
          if (t.hasAttribute('data-cycle-photo') && V.show.current) { V.active = (V.active + 1) % V.show.current.photos.length; paint(); }
        });
        el.querySelector('.ph-surface').addEventListener('keydown', function (e) {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); navigate(e.key === 'ArrowRight'); }
          else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLoud(!V.loud); }
          else if (e.key === 'Escape') { e.preventDefault(); setLoud(false); }
        });
        el.addEventListener('keydown', function (e) { if (e.key === 'Escape') setLoud(false); });
      }
      showSelected(opts); V.show.start(); paint();
    },
    resume: function (el, opts) { showSelected(opts); V.show.start(); paint(); },
    hide: function () { if (V.show) V.show.stop(); }
  });
})();
