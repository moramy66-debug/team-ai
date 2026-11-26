(function (global) {
  'use strict';
  const ALLOWED_TAGS = [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'hr',
    'pre', 'code', 'span', 'div',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'a', 'sup', 'sub'
  ];
  const ALLOWED_ATTR = ['href', 'title', 'target', 'rel', 'class', 'dir'];

  function fallbackSanitize(dirtyHtml) {
    if (!dirtyHtml) return '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(dirtyHtml), 'text/html');
    const allowedSet = new Set(ALLOWED_TAGS);
    const walk = (node) => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          if (!allowedSet.has(child.tagName.toLowerCase())) {
            child.remove();
            continue;
          }
          for (const attr of Array.from(child.attributes)) {
            const name = attr.name.toLowerCase();
            if (!ALLOWED_ATTR.includes(name) || name.startsWith('on')) {
              child.removeAttribute(attr.name);
              continue;
            }
            if (name === 'href') {
              const val = attr.value.trim().toLowerCase();
              if (!val.startsWith('http://') && !val.startsWith('https://') && !val.startsWith('mailto:') && !val.startsWith('#')) {
                child.removeAttribute('href');
              } else {
                child.setAttribute('rel', 'noopener noreferrer');
                child.setAttribute('target', '_blank');
              }
            }
          }
          walk(child);
        }
      }
    };
    walk(doc.body);
    return doc.body.innerHTML;
  }

  function sanitizeHTML(dirtyHtml) {
    if (!dirtyHtml) return '';
    if (global.DOMPurify && typeof global.DOMPurify.sanitize === 'function') {
      return global.DOMPurify.sanitize(String(dirtyHtml), { ALLOWED_TAGS, ALLOWED_ATTR, ALLOW_DATA_ATTR: false });
    }
    return fallbackSanitize(dirtyHtml);
  }

  global.TeamAISanitize = { sanitizeHTML };
})(typeof window !== 'undefined' ? window : globalThis);
