/* "Try a few questions" (/try): three real past-paper questions, each with its mark scheme, for people without an
   account. The questions are fixed and served from /try/, so nothing behind the sign-in is opened. Marks stay in this
   tab only (sessionStorage); at the end it asks you to make an account. */
(function () {
  'use strict';
  var QUESTIONS = [
    { subject: 'Biology', paper: 'AQA GCSE · June 2023 · Paper 1F · Question 1', img: 'biology', marks: 1, w: 796, h: 322, mw: 909, mh: 186 },
    { subject: 'Chemistry', paper: 'AQA GCSE · June 2022 · Paper 2F · Question 1', img: 'chemistry', marks: 3, w: 796, h: 592, mw: 909, mh: 528 },
    { subject: 'Maths', paper: 'AQA GCSE · June 2023 · Paper 1F · Question 1', img: 'maths', marks: 4, w: 796, h: 640, mw: 909, mh: 408 }
  ];
  var KEY = 'jbr-try', root = document.getElementById('try');
  var st = load();

  function load() {
    try { var s = JSON.parse(sessionStorage.getItem(KEY)); if (s && Array.isArray(s.got)) return s; } catch (e) {}
    return { at: 0, shown: false, got: [] };
  }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'on') e.addEventListener('click', attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function sheet(src, w, h, alt) { return el('div', { class: 'sheet' }, [el('img', { src: src, width: w, height: h, alt: alt })]); }

  function render() {
    root.textContent = '';
    if (st.at >= QUESTIONS.length) return done();
    var q = QUESTIONS[st.at], n = st.at + 1, got = st.got[st.at];
    root.appendChild(el('p', { class: 'step', text: 'Question ' + n + ' of ' + QUESTIONS.length }));
    root.appendChild(el('h1', { text: q.subject }));
    root.appendChild(el('p', { class: 'paper', text: q.paper }));
    root.appendChild(sheet('/try/' + q.img + '-q.webp', q.w, q.h, q.subject + ' question from ' + q.paper));
    if (!st.shown) {
      root.appendChild(el('p', { class: 'label', text: 'Answer it on paper first, then check.' }));
      root.appendChild(el('button', { class: 'b solid', type: 'button', text: 'Show mark scheme', on: function () { st.shown = true; save(); render(); } }));
    } else {
      root.appendChild(el('p', { class: 'label', text: 'Mark scheme' }));
      root.appendChild(sheet('/try/' + q.img + '-ms.webp', q.mw, q.mh, 'Mark scheme for this question'));
      root.appendChild(el('p', { class: 'label', id: 'how', text: 'How many marks did you get?' }));
      var row = el('div', { class: 'marks', role: 'group', 'aria-labelledby': 'how' });
      for (var m = 0; m <= q.marks; m++) {
        row.appendChild(el('button', { class: 'mk', type: 'button', text: String(m), 'aria-pressed': String(got === m),
          on: (function (v) { return function () { st.got[st.at] = v; save(); render(); }; })(m) }));
      }
      row.appendChild(el('span', { class: 'of', text: 'out of ' + q.marks }));
      root.appendChild(row);
    }
    var dots = el('div', { class: 'dots', 'aria-hidden': 'true' });
    QUESTIONS.forEach(function (x, i) { dots.appendChild(el('i', i <= st.at ? { class: 'on' } : {})); });
    var next = el('button', { class: 'b solid', type: 'button', text: n < QUESTIONS.length ? 'Next question' : 'See how you did',
      on: function () { st.at++; st.shown = false; save(); render(); window.scrollTo(0, 0); } });
    if (got == null) next.disabled = true, next.style.opacity = '.35', next.style.cursor = 'default';
    root.appendChild(el('div', { class: 'row' }, [dots, next]));
  }

  function done() {
    var total = 0, out = 0;
    QUESTIONS.forEach(function (q, i) { total += q.marks; out += st.got[i] || 0; });
    var box = el('div', { class: 'done' });
    box.appendChild(el('h1', { text: "That's your three." }));
    box.appendChild(el('p', { class: 'score', text: 'You got ' + out + ' out of ' + total + ' marks.' }));
    var list = el('ul', { class: 'recap' });
    QUESTIONS.forEach(function (q, i) {
      list.appendChild(el('li', {}, [el('b', { text: q.subject }), el('span', { text: (st.got[i] || 0) + ' / ' + q.marks })]));
    });
    box.appendChild(list);
    box.appendChild(el('div', { class: 'acts' }, [
      el('a', { class: 'b solid', href: '/login#signup', text: 'Create a free account' }),
      el('a', { class: 'b text', href: '/login', text: 'I already have one' })
    ]));
    box.appendChild(el('p', { class: 'note', text: 'An account opens every question in all 14 subjects, sorted by topic, plus mock papers and your progress.' }));
    root.appendChild(box);
  }

  render();
})();
