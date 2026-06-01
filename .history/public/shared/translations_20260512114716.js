// ─────────────────────────────────────────────
//  shared/translations.js
//  Debounced translation dispatcher.
//  Calls the HuggingFace-backed /api/translate
//  endpoint; falls back to a static map offline.
// ─────────────────────────────────────────────

const DEBOUNCE_MS = 700;
const _timers = {};

/** Static offline fallback — common civic / dak terms */
export const STATIC_MAP = {
  'subject':        'विषय',
  'immediate':      'तत्काल',
  'priority':       'प्राथमिकता',
  'hand':           'हाथ',
  'email':          'ईमेल',
  'efile':          'ई-फ़ाइल',
  'speed post':     'स्पीड पोस्ट',
  'registered post':'पंजीकृत डाक',
  'dispatch':       'प्रेषण',
  'received':       'प्राप्त',
  'pending':        'लंबित',
  'approved':       'स्वीकृत',
};

/**
 * Debounced trigger: reads srcId input, writes Hindi to destId element.
 * Shows an inline spinner (id="spinner-{destId}") while fetching.
 */
export function triggerTranslate(srcId, destId) {
  const srcEl  = document.getElementById(srcId);
  const destEl = document.getElementById(destId);
  const spinner = document.getElementById('spinner-' + destId);
  if (!srcEl || !destEl) return;

  const text = srcEl.tagName === 'SELECT'
    ? srcEl.options[srcEl.selectedIndex]?.text || ''
    : srcEl.value.trim();

  if (!text) { destEl.textContent = ''; return; }

  clearTimeout(_timers[destId]);
  _timers[destId] = setTimeout(async () => {
    if (spinner) spinner.style.display = 'inline-block';
    destEl.textContent = await callTranslationAPI(text);
    if (spinner) spinner.style.display = 'none';
  }, DEBOUNCE_MS);
}

/**
 * Calls server-side /api/translate (POST).
 * Falls back to static map, then to original text.
 */
export async function callTranslationAPI(text) {
  // Static map first (instant, no network)
  const lower = text.toLowerCase();
  for (const [k, v] of Object.entries(STATIC_MAP)) {
    if (lower === k) return v;
  }
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, src: 'en', tgt: 'hi' }),
    });
    if (!res.ok) throw new Error(res.statusText);
    const { translation } = await res.json();
    return translation || text;
  } catch {
    return text; // graceful degradation
  }
}