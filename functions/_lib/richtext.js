// The formatting an admin console message may keep (bold, italic, underline, headings, lists, links, text colour):
// everything else is dropped before it's saved, so the page that shows it can put it straight in (functions/api/note.js).
const KEEP = new Set(['b', 'strong', 'i', 'em', 'u', 'h2', 'h3', 'p', 'div', 'br', 'ul', 'ol', 'li', 'a', 'font', 'span']);
const DROP_INSIDE = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'svg', 'math', 'textarea', 'select', 'noscript']);
const VOID = new Set(['br']);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const COLOR = /^#[0-9a-f]{3}([0-9a-f]{3})?$|^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i;

function attrs(src) {
  const out = {};
  const re = /([a-z][\w-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/gi;
  let m;
  while ((m = re.exec(src))) out[m[1].toLowerCase()] = (m[2] ?? m[3] ?? m[4] ?? '').replace(/&amp;/g, '&');
  return out;
}

export function cleanHtml(html, max = 20000) {
  let out = '', skip = 0;
  for (const part of String(html || '').slice(0, max).match(/<[^>]*>?|[^<]+/g) || []) {
    const tag = part.match(/^<\s*(\/?)\s*([a-z][a-z0-9]*)([^>]*)>?$/i);
    if (!tag) {
      if (!skip && part[0] !== '<') out += part.replace(/>/g, '&gt;');
      continue;
    }
    const close = !!tag[1], name = tag[2].toLowerCase();
    if (DROP_INSIDE.has(name)) { skip = Math.max(0, skip + (close ? -1 : 1)); continue; }
    if (skip || !KEEP.has(name)) continue;
    if (close) { if (!VOID.has(name)) out += '</' + name + '>'; continue; }
    const a = attrs(tag[3]);
    let keep = '';
    if (name === 'a' && /^(https?:|mailto:|\/)/i.test(a.href || '')) keep = ' href="' + esc(a.href) + '" target="_blank" rel="noopener"';
    if (name === 'font' && COLOR.test(a.color || '')) keep = ' color="' + esc(a.color) + '"';
    if (name === 'span') {
      const c = (a.style || '').match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
      if (c && COLOR.test(c[1].trim())) keep = ' style="color:' + esc(c[1].trim()) + '"';
    }
    out += '<' + name + keep + '>';
  }
  return out;
}
