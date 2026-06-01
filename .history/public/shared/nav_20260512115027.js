// ─────────────────────────────────────────────
//  shared/nav.js
//  Tab navigation helper.
//  showPage() hides all .page divs and shows
//  the requested one, keeping nav-tab highlights.
// ─────────────────────────────────────────────

/**
 * @param {string} name - page name key (e.g. 'entry', 'dashboard')
 * @param {Object} tabMap - { name: tabIndex } mapping
 */
export function showPage(name, tabMap) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // Show target
  const pg = document.getElementById('page-' + name);
  if (pg) pg.classList.add('active');

  // Highlight correct tab
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(t => t.classList.remove('active'));
  const idx = tabMap[name];
  if (idx !== undefined && tabs[idx]) tabs[idx].classList.add('active');

  // Persist selection
  sessionStorage.setItem('dakPage', name);
}

/** Restore last visited tab on page load */
export function restorePage(tabMap) {
  const saved = sessionStorage.getItem('dakPage');
  const first = Object.keys(tabMap)[0];
  showPage(saved && tabMap[saved] !== undefined ? saved : first, tabMap);
}