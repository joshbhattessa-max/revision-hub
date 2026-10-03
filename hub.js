/* Revision hub: subject sites plus your own links, images and notes.
 * Everything shown comes from hub.json. Edit mode changes a draft kept in this
 * browser; "Publish" downloads the new hub.json to upload to GitHub. */
(function () {
  'use strict';
  var DRAFT_KEY = 'hub-draft';
  var data = null, published = '', editing = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
    catch (e) { return null; }
  }
  function json() { return JSON.stringify(data, null, 2) + '\n'; }
  function save() {
    var s = json();
    store(DRAFT_KEY, s === published ? null : s);
    render();
  }
  function host(u) { try { return new URL(u, location.href).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  function fmt(n) { return n ? Number(n).toLocaleString('en-GB') : ''; }

  // ------------------------------------------------------------------ render
  function render() {
    var draft = store(DRAFT_KEY);
    document.title = data.title || 'Revision';
    var h = '<div class="wrap">';
    if (draft) {
      h += '<div class="banner"><span>You have changes on this device that are not on the live site yet.</span>' +
        '<button class="btn primary small" data-act="publish">Publish…</button>' +
        '<button class="btn small" data-act="discard">Discard changes</button></div>';
    }
    h += '<header class="top"><div><h1 class="editable" data-field="title">' + esc(data.title) + '</h1>' +
      '<p class="subtitle editable" data-field="subtitle">' + esc(data.subtitle) + '</p></div>' +
      '<div class="actions">' + (editing
        ? '<button class="btn" data-act="add-section">+ Section</button><button class="btn primary" data-act="done">Done</button>'
        : '<button class="btn" data-act="edit">Edit page</button>') + '</div></header>';

    h += '<h2>Subjects</h2><div class="grid">';
    data.sites.forEach(function (s, i) {
      if (s.hidden && !editing) return;
      var live = !!s.origin;
      var band = s.image ? 'background-image:linear-gradient(rgba(0,0,0,.15),rgba(0,0,0,.35)),url(' + esc(s.image) + ');' : '';
      h += '<a class="subject' + (live || editing ? '' : ' off') + '" href="' + (live ? '/' + esc(s.path) + '/' : '#') + '" style="--c:' + esc(s.color || '#33312e') + '">' +
        '<div class="band" style="' + band + '"><span class="logo">' + esc(s.name) + '</span></div>' +
        '<div class="body"><div class="name">' + esc(s.subject) + (s.hidden ? ' (hidden)' : '') + '</div>' +
        '<div class="stats">' + (s.questions ? fmt(s.questions) + ' questions · ' + fmt(s.papers) + ' papers' : '') +
        (live ? '' : ' · not online yet') + '</div></div>' +
        (editing ? '<div class="edit-row"><button class="btn small" data-act="edit-site" data-i="' + i + '">Edit</button>' +
          '<button class="btn small" data-act="toggle-site" data-i="' + i + '">' + (s.hidden ? 'Show' : 'Hide') + '</button></div>' : '') +
        '</a>';
    });
    h += '</div>';

    data.sections.forEach(function (sec, si) {
      h += '<h2><span>' + esc(sec.title) + '</span>' + (editing
        ? '<button class="btn small" data-act="rename-section" data-s="' + si + '">Rename</button>' +
          '<button class="btn small danger" data-act="delete-section" data-s="' + si + '">Delete section</button>' : '') + '</h2>';
      h += '<div class="grid">';
      sec.cards.forEach(function (c, ci) {
        var inner = (c.image ? '<img src="' + esc(c.image) + '" alt="" loading="lazy">' : '') +
          '<div class="body"><div class="title">' + esc(c.title) + '</div>' +
          (c.note ? '<div class="note">' + esc(c.note) + '</div>' : '') +
          (c.url ? '<div class="host">' + esc(host(c.url)) + '</div>' : '') + '</div>';
        if (editing) {
          h += '<div class="card">' + inner + '<div class="edit-row">' +
            '<button class="btn small" data-act="edit-card" data-s="' + si + '" data-c="' + ci + '">Edit</button>' +
            '<button class="btn small" data-act="move-card" data-d="-1" data-s="' + si + '" data-c="' + ci + '">←</button>' +
            '<button class="btn small" data-act="move-card" data-d="1" data-s="' + si + '" data-c="' + ci + '">→</button>' +
            '<button class="btn small danger" data-act="delete-card" data-s="' + si + '" data-c="' + ci + '">Delete</button></div></div>';
        } else {
          h += c.url ? '<a class="card" href="' + esc(c.url) + '" target="_blank" rel="noopener">' + inner + '</a>' : '<div class="card">' + inner + '</div>';
        }
      });
      if (editing) h += '<button class="add-card" data-act="add-card" data-s="' + si + '">+ Add link or image</button>';
      h += '</div>';
    });
    h += '<footer>Past papers and mark schemes are © their exam boards. For personal revision.</footer></div>';
    document.getElementById('app').innerHTML = h;

    Array.prototype.forEach.call(document.querySelectorAll('.editable'), function (el) {
      el.contentEditable = editing ? 'true' : 'false';
      el.oninput = function () { data[el.getAttribute('data-field')] = el.textContent.trim(); store(DRAFT_KEY, json()); };
      el.onblur = function () { if (editing) save(); };
    });
  }

  // ------------------------------------------------------------------ dialogs
  function dialog(html, onSubmit) {
    var d = document.createElement('dialog');
    d.innerHTML = '<form method="dialog">' + html + '</form>';
    document.body.appendChild(d);
    var f = d.querySelector('form');
    f.addEventListener('submit', function (e) {
      var btn = e.submitter && e.submitter.value;
      if (btn === 'ok' && onSubmit) {
        if (onSubmit(f) === false) { e.preventDefault(); return; }
      }
    });
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
    return d;
  }

  function resizeImage(file, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var k = Math.min(1, 900 / img.width), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        cb(c.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function imageField(value) {
    return '<label>Image (paste a web address, or upload a picture)<input name="image" placeholder="https://… or images/photo.jpg" value="' +
      esc(value && value.indexOf('data:') === 0 ? '' : value) + '"></label>' +
      '<input type="file" name="file" accept="image/*">' +
      '<img class="preview" alt="" ' + (value ? 'src="' + esc(value) + '"' : 'hidden') + '>';
  }
  function wireImage(d, current) {
    var f = d.querySelector('form'), prev = f.querySelector('.preview'), state = { value: current || '' };
    f.file.addEventListener('change', function () {
      if (!f.file.files[0]) return;
      resizeImage(f.file.files[0], function (url) { state.value = url; f.image.value = ''; prev.src = url; prev.hidden = false; });
    });
    f.image.addEventListener('input', function () { state.value = f.image.value.trim(); prev.src = state.value; prev.hidden = !state.value; });
    return state;
  }

  function cardDialog(si, ci) {
    var c = ci == null ? { title: '', url: '', image: '', note: '' } : data.sections[si].cards[ci];
    var state;
    var d = dialog('<h3>' + (ci == null ? 'Add a link or image' : 'Edit') + '</h3>' +
      '<label>Title<input name="title" required value="' + esc(c.title) + '"></label>' +
      '<label>Link (optional)<input name="url" placeholder="https://…" value="' + esc(c.url) + '"></label>' +
      imageField(c.image) +
      '<label>Note (optional)<textarea name="note">' + esc(c.note) + '</textarea></label>' +
      '<div class="row"><button class="btn" value="cancel" formnovalidate>Cancel</button><button class="btn primary" value="ok">Save</button></div>',
      function (f) {
        var url = f.url.value.trim();
        if (url && !/^(https?:|mailto:|\/|#)/.test(url)) url = 'https://' + url;
        var card = { title: f.title.value.trim(), url: url, image: state.value, note: f.note.value.trim() };
        if (ci == null) data.sections[si].cards.push(card); else data.sections[si].cards[ci] = card;
        save();
      });
    state = wireImage(d, c.image);
  }

  function siteDialog(i) {
    var s = data.sites[i], state;
    var d = dialog('<h3>' + esc(s.subject) + '</h3>' +
      '<label>Site address (its own Cloudflare address, e.g. https://' + esc(s.name.toLowerCase()) + '.pages.dev)' +
      '<input name="origin" value="' + esc(s.origin) + '"></label>' +
      '<label>Colour<input name="color" type="color" value="' + esc(s.color || '#33312e') + '"></label>' +
      imageField(s.image) +
      '<div class="row"><button class="btn" value="cancel" formnovalidate>Cancel</button><button class="btn primary" value="ok">Save</button></div>',
      function (f) {
        s.origin = f.origin.value.trim().replace(/\/+$/, '');
        if (s.origin && !/^https?:/.test(s.origin)) s.origin = 'https://' + s.origin;
        s.color = f.color.value; s.image = state.value;
        save();
      });
    state = wireImage(d, s.image);
  }

  function publishDialog() {
    var blob = new Blob([json()], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'hub.json';
    document.body.appendChild(a); a.click(); a.remove();
    dialog('<h3>Put your changes online</h3>' +
      '<p style="margin:0">A file called <b>hub.json</b> has just been downloaded. To publish it:</p>' +
      '<ol><li>Open your hub repository on <b>github.com</b>.</li>' +
      '<li>Click <b>Add file</b> → <b>Upload files</b>.</li>' +
      '<li>Drag in the <b>hub.json</b> you just downloaded (it replaces the old one).</li>' +
      '<li>Click <b>Commit changes</b>. The site updates within a minute or two.</li></ol>' +
      '<p style="margin:0;font-size:.85rem;color:var(--muted)">Your changes also stay on this device until the live site has them.</p>' +
      '<div class="row"><button class="btn primary" value="ok">OK</button></div>');
  }

  // ------------------------------------------------------------------ actions
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    e.preventDefault();
    var act = b.getAttribute('data-act'), si = +b.getAttribute('data-s'), ci = +b.getAttribute('data-c'), i = +b.getAttribute('data-i');
    if (act === 'edit') { editing = true; render(); }
    else if (act === 'done') { editing = false; save(); }
    else if (act === 'publish') publishDialog();
    else if (act === 'discard') { if (confirm('Throw away the changes made on this device?')) { store(DRAFT_KEY, null); data = JSON.parse(published); render(); } }
    else if (act === 'add-section') {
      var t = prompt('Name of the new section', 'My links');
      if (t) { data.sections.push({ title: t, cards: [] }); save(); }
    }
    else if (act === 'rename-section') { var n = prompt('Section name', data.sections[si].title); if (n) { data.sections[si].title = n; save(); } }
    else if (act === 'delete-section') { if (confirm('Delete the section "' + data.sections[si].title + '" and everything in it?')) { data.sections.splice(si, 1); save(); } }
    else if (act === 'add-card') cardDialog(si, null);
    else if (act === 'edit-card') cardDialog(si, ci);
    else if (act === 'delete-card') { if (confirm('Delete this?')) { data.sections[si].cards.splice(ci, 1); save(); } }
    else if (act === 'move-card') {
      var cards = data.sections[si].cards, j = ci + (+b.getAttribute('data-d'));
      if (j >= 0 && j < cards.length) { var x = cards.splice(ci, 1)[0]; cards.splice(j, 0, x); save(); }
    }
    else if (act === 'edit-site') siteDialog(i);
    else if (act === 'toggle-site') { data.sites[i].hidden = !data.sites[i].hidden; save(); }
  });

  // ------------------------------------------------------------------ start
  fetch('hub.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (live) {
    published = JSON.stringify(live, null, 2) + '\n';
    var draft = store(DRAFT_KEY);
    // a draft that matches what is now live has been published: drop it
    if (draft === published) { store(DRAFT_KEY, null); draft = null; }
    data = draft ? JSON.parse(draft) : live;
    data.sites = data.sites || []; data.sections = data.sections || [];
    render();
  }).catch(function () {
    document.getElementById('app').innerHTML = '<p class="loading">Could not load hub.json.</p>';
  });
})();
