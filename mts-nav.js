/* The MTS Resources link in the top bar, next to Mock paper etc. on every subject site and next to Your progress on the
   home page. The middleware only adds this script for accounts the admin gave access to (functions/_lib/mts.js). The
   bars are drawn (and redrawn) by each page's own script, so the link is put back whenever they change. */
(function () {
  'use strict';
  function place() {
    Array.prototype.forEach.call(document.querySelectorAll('.study-nav, .top-links'), function (n) {
      if (n.querySelector('.mts-link')) return;
      var a = document.createElement('a');
      a.href = '/mts';
      a.className = (n.classList.contains('study-nav') ? 'spec-btn' : 'btn-quiet') + ' mts-link' + (location.pathname.replace(/\/+$/, '') === '/mts' ? ' on' : '');
      a.textContent = 'MTS Resources';
      n.appendChild(a);
    });
  }
  function start() { place(); new MutationObserver(place).observe(document.body, { childList: true, subtree: true }); }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
