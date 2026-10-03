/* Revision hub: the subject sites plus links, images and notes, all read from hub.json. */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function host(u) { try { return new URL(u, location.href).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  function fmt(n) { return n ? Number(n).toLocaleString('en-GB') : ''; }

  function render(data) {
    document.title = data.title || 'Revision';
    var h = '<div class="wrap"><header class="top"><div><h1>' + esc(data.title) + '</h1>' +
      '<p class="subtitle">' + esc(data.subtitle) + '</p></div></header>';

    h += '<h2>Subjects</h2><div class="grid">';
    (data.sites || []).forEach(function (s) {
      if (s.hidden) return;
      var live = !!s.origin;
      var band = s.image ? 'background-image:linear-gradient(rgba(0,0,0,.15),rgba(0,0,0,.35)),url(' + esc(s.image) + ');' : '';
      h += '<a class="subject' + (live ? '' : ' off') + '" href="' + (live ? '/' + esc(s.path) + '/' : '#') + '" style="--c:' + esc(s.color || '#33312e') + '">' +
        '<div class="band" style="' + band + '"><span class="logo">' + esc(s.name) + '</span></div>' +
        '<div class="body"><div class="name">' + esc(s.subject) + '</div>' +
        '<div class="stats">' + (s.questions ? fmt(s.questions) + ' questions · ' + fmt(s.papers) + ' papers' : '') +
        (live ? '' : ' · not online yet') + '</div></div></a>';
    });
    h += '</div>';

    (data.sections || []).forEach(function (sec) {
      if (!sec.cards || !sec.cards.length) return;
      h += '<h2>' + esc(sec.title) + '</h2><div class="grid">';
      sec.cards.forEach(function (c) {
        var inner = (c.image ? '<img src="' + esc(c.image) + '" alt="" loading="lazy">' : '') +
          '<div class="body"><div class="title">' + esc(c.title) + '</div>' +
          (c.note ? '<div class="note">' + esc(c.note) + '</div>' : '') +
          (c.url ? '<div class="host">' + esc(host(c.url)) + '</div>' : '') + '</div>';
        h += c.url ? '<a class="card" href="' + esc(c.url) + '" target="_blank" rel="noopener">' + inner + '</a>' : '<div class="card">' + inner + '</div>';
      });
      h += '</div>';
    });
    h += '<footer>Past papers and mark schemes are © their exam boards. For personal revision.</footer></div>';
    document.getElementById('app').innerHTML = h;
  }

  // drafts left over from the old editable version are no longer used
  try { localStorage.removeItem('hub-draft'); } catch (e) { /* storage blocked */ }

  fetch('hub.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(render).catch(function () {
    document.getElementById('app').innerHTML = '<p class="loading">Could not load hub.json.</p>';
  });
})();
