// Just enough of an email reader for the assistant: the headers, and the text of the message (the plain-text part if
// there is one, otherwise the HTML part with its tags taken out). Attachments are skipped. The raw email is handled as
// a "binary string" (one character per byte) and each part is decoded with its own character set.

const MAX = 400 * 1024; // more than enough for any real message; keeps the work small

export function readEmail(bytes) {
  const raw = latin1(bytes.length > MAX ? bytes.slice(0, MAX) : bytes);
  const { headers, body } = split(raw);
  const text = bodyText(headers, body) || '';
  return {
    headers,
    subject: words(headers.get('subject') || '').trim(),
    from: address(headers.get('from') || ''),
    fromName: displayName(headers.get('from') || ''),
    replyTo: address(headers.get('reply-to') || ''),
    messageId: (headers.get('message-id') || '').trim(),
    references: (headers.get('references') || '').trim(),
    text: text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(),
  };
}

// the new part of a reply: everything above "On ... wrote:" and quoted (">") lines
export function newPart(text) {
  const lines = text.split('\n'), out = [];
  for (const l of lines) {
    if (/^On .{4,200} wrote:\s*$/.test(l) || /^-{2,}\s*Original Message\s*-{2,}/i.test(l) || /^From: .+/.test(l) && out.length > 2) break;
    if (/^\s*>/.test(l)) continue;
    out.push(l);
  }
  return out.join('\n').trim() || text;
}

function latin1(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  return s;
}
function toBytes(bin) {
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i) & 255;
  return b;
}
function decodeBytes(bin, charset) {
  const bytes = toBytes(bin);
  try { return new TextDecoder(charset || 'utf-8').decode(bytes); } catch (e) { return new TextDecoder('utf-8').decode(bytes); }
}

function split(part) {
  const i = part.search(/\r?\n\r?\n/);
  const head = i < 0 ? part : part.slice(0, i), body = i < 0 ? '' : part.slice(i).replace(/^\r?\n\r?\n/, '');
  const headers = new Map();
  for (const line of head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (m && !headers.has(m[1].toLowerCase())) headers.set(m[1].toLowerCase(), m[2]);
  }
  return { headers, body };
}

const param = (h, name) => { const m = (h || '').match(new RegExp(name + '\\s*=\\s*"?([^";]+)"?', 'i')); return m ? m[1].trim() : ''; };

function bodyText(headers, body, depth = 0) {
  const type = (headers.get('content-type') || 'text/plain').toLowerCase();
  if (type.startsWith('multipart/') && depth < 5) {
    const boundary = param(headers.get('content-type'), 'boundary');
    if (!boundary) return '';
    const parts = body.split('--' + boundary).slice(1).filter(p => !p.startsWith('--'));
    const read = parts.map(p => split(p.replace(/^\r?\n/, '')));
    // plain text first, then HTML, then whatever is inside nested parts
    for (const want of ['text/plain', 'text/html', 'multipart/']) {
      for (const p of read) {
        const t = (p.headers.get('content-type') || 'text/plain').toLowerCase();
        if (/attachment/i.test(p.headers.get('content-disposition') || '')) continue;
        if (t.startsWith(want)) { const s = bodyText(p.headers, p.body, depth + 1); if (s.trim()) return s; }
      }
    }
    return '';
  }
  if (!type.startsWith('text/')) return '';
  const enc = (headers.get('content-transfer-encoding') || '').toLowerCase();
  let bin = body;
  if (enc === 'base64') { try { bin = atob(body.replace(/[^A-Za-z0-9+/=]/g, '')); } catch (e) { bin = ''; } }
  else if (enc === 'quoted-printable') bin = body.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const text = decodeBytes(bin, param(headers.get('content-type'), 'charset'));
  return type.startsWith('text/html') ? fromHtml(text) : text;
}

function fromHtml(h) {
  return h.replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n');
}

// "=?UTF-8?B?...?=" and "=?UTF-8?Q?...?=" in headers like Subject
function words(s) {
  return s.replace(/=\?([^?]+)\?([BQbq])\?([^?]*)\?=\s*/g, (_, cs, enc, data) => {
    const bin = enc.toUpperCase() === 'B' ? (() => { try { return atob(data); } catch (e) { return ''; } })()
      : data.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (__, h) => String.fromCharCode(parseInt(h, 16)));
    return decodeBytes(bin, cs);
  });
}

export function address(h) {
  const m = h.match(/<([^<>\s]+@[^<>\s]+)>/) || h.match(/([^\s<>",;]+@[^\s<>",;]+)/);
  return m ? m[1].trim().toLowerCase() : '';
}
function displayName(h) {
  const m = words(h).match(/^\s*"?([^"<]+?)"?\s*</);
  return m ? m[1].trim().slice(0, 60) : '';
}
