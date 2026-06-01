// ─────────────────────────────────────────────
//  despatch/language.js
//  Letter language selector pill group.
//  Languages: English · Hindi · Bilingual · Other
// ─────────────────────────────────────────────

export function initLanguage() {
  document.querySelectorAll('.lang-opt').forEach(opt => {
    opt.addEventListener('click', () => selectLang(opt));
  });
}

export function selectLang(el) {
  document.querySelectorAll('.lang-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  const hidden = document.getElementById('langValue');
  if (hidden) hidden.value = el.dataset.lang;
}

export function getLanguage() {
  return document.getElementById('langValue')?.value || '';
}