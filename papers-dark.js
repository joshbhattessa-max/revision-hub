/* Dark copies of past papers (Settings → Study → Dark papers). With it on, opening a paper, mark scheme or insert
   (/papers/<host>/<path>) shows a small page (functions/_lib/papers.js darkPage) that fetches the PDF, makes it dark
   here in the browser with pdf-lib (vendor/pdf-lib.min.js), then shows it with a Download button.

   How: each page is drawn as a picture of itself on a white sheet, then a light grey sheet is laid over it with the
   "difference" blend, which flips every colour: white paper becomes near-black and black ink near-white. Text, lines
   and diagrams stay sharp (nothing is turned into an image), and it works for scanned papers too. */
(function (root) {
  'use strict';
  // the top sheet's grey: paper comes out #141414 and black ink #EBEBEB (pure black/white is harsh to read)
  var INK = 0.92;

  function makeDark(bytes, PDFLib) {
    var L = PDFLib;
    return L.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false }).then(function (src) {
      return L.PDFDocument.create().then(function (out) {
        var pages = src.getPages();
        return out.embedPages(pages).then(function (embedded) {
          embedded.forEach(function (e, i) {
            var w = e.width, h = e.height;
            var page = out.addPage([w, h]);
            page.setRotation(pages[i].getRotation());
            page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: L.rgb(1, 1, 1) });
            page.drawPage(e, { x: 0, y: 0, width: w, height: h });
            page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: L.rgb(INK, INK, INK), blendMode: L.BlendMode.Difference });
          });
          var t = src.getTitle && src.getTitle();
          if (t) out.setTitle(t + ' (dark)');
          out.setProducer('JB Revision');
          return out.save();
        });
      });
    });
  }

  // the page from functions/_lib/papers.js: fetch the paper, make it dark, show it (on a phone: Open + Download)
  function run(box) {
    var msg = document.getElementById('dk-msg'), dl = document.getElementById('dk-dl');
    var phone = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    fetch(box.getAttribute('data-raw'), { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.arrayBuffer();
    }).then(function (b) {
      if (!root.PDFLib) throw new Error('pdf-lib missing');
      return makeDark(b, root.PDFLib);
    }).then(function (out) {
      var url = URL.createObjectURL(new Blob([out], { type: 'application/pdf' }));
      dl.href = url; dl.hidden = false; msg.textContent = '';
      if (phone) {
        box.innerHTML = '<div class="dk-mid"><p>Your dark copy is ready.</p><a class="dk-btn" href="' + url + '">Open it</a></div>';
      } else {
        var f = document.createElement('iframe');
        f.title = box.getAttribute('data-name') + ' (dark)';
        f.src = url;
        box.appendChild(f);
      }
    }).catch(function () {
      msg.textContent = "Couldn't make a dark copy of this one. The normal version still works.";
    });
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { makeDark: makeDark }; return; }
  root.JBR_DARK = { makeDark: makeDark };
  var box = document.getElementById('dk');
  if (box) run(box);
})(this);
