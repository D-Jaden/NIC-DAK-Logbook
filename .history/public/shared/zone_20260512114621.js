// ─────────────────────────────────────────────
//  shared/zone.js
//  State → Zone mapping, Hindi zone labels,
//  and helpers used by both despatch & acquired
// ─────────────────────────────────────────────

/** Maps a zone code to { en, hi, color } */
export const ZONE_META = {
  A: { en: 'Zone A', hi: 'जोन A', color: '#1565C0' },
  B: { en: 'Zone B', hi: 'जोन B', color: '#E65100' },
  C: { en: 'Zone C', hi: 'जोन C', color: '#2E7D32' },
};

/**
 * Each entry: "StateName|Zone"
 * The HTML <option value="StateName|Zone"> pattern is used throughout.
 */
export const STATE_DATA = [
  // ZONE A
  { state: 'Bihar', zone: 'A' },
  { state: 'Haryana', zone: 'A' },
  { state: 'Rajasthan', zone: 'A' },
  { state: 'Jharkhand', zone: 'A' },
  { state: 'Delhi', zone: 'A' },                    // Delhi(New) → Delhi
  { state: 'Uttarakhand', zone: 'A' },
  { state: 'Chhattisgarh', zone: 'A' },
  { state: 'Uttar Pradesh', zone: 'A' },            // Uttar-Pradesh
  { state: 'Madhya Pradesh', zone: 'A' },           // Madhya-Pradesh
  { state: 'Himachal Pradesh', zone: 'A' },         // Himachal-Pradesh
  { state: 'Andaman & Nicobar Islands', zone: 'A' },

  // ZONE B
  { state: 'Punjab', zone: 'B' },
  { state: 'Gujarat', zone: 'B' },
  { state: 'Chandigarh', zone: 'B' },
  { state: 'Maharashtra', zone: 'B' },
  { state: 'Daman & Diu', zone: 'B' },
  { state: 'Dadra & Nagar Haveli', zone: 'B' },     

  // ZONE C
  { state: 'Goa', zone: 'C' },
  { state: 'Kerala', zone: 'C' },
  { state: 'Assam', zone: 'C' },
  { state: 'Sikkim', zone: 'C' },
  { state: 'Odisha', zone: 'C' },
  { state: 'Tripura', zone: 'C' },
  { state: 'Ladakh', zone: 'C' },
  { state: 'Manipur', zone: 'C' },
  { state: 'Mizoram', zone: 'C' },
  { state: 'Nagaland', zone: 'C' },
  { state: 'Karnataka', zone: 'C' },
  { state: 'Telangana', zone: 'C' },
  { state: 'Meghalaya', zone: 'C' },
  { state: 'Tamil Nadu', zone: 'C' },
  { state: 'Puducherry', zone: 'C' },
  { state: 'West Bengal', zone: 'C' },
  { state: 'Lakshadweep', zone: 'C' },
  { state: 'Andhra Pradesh', zone: 'C' },
  { state: 'Arunachal Pradesh', zone: 'C' },
  { state: 'Jammu and Kashmir', zone: 'C' },
];

/**
 * Returns an <option> list string for state selects.
 * value format: "StateName|Zone"
 */
export function stateOptionsHTML() {
  return STATE_DATA
    .map(d => `<option value="${d.state}|${d.zone}">${d.state}</option>`)
    .join('\n');
}

/**
 * Given "StateName|Zone" string, returns zone meta object or null.
 * @param {string} stateVal - value from a state <select>
 */
export function getZoneFromStateVal(stateVal) {
  if (!stateVal) return null;
  const zone = stateVal.split('|')[1];
  return ZONE_META[zone] || null;
}

/**
 * Renders a zone badge element and injects it into a container.
 * @param {HTMLElement} container
 * @param {{ en, hi, color }} zoneMeta
 */
export function renderZoneBadge(container, zoneMeta) {
  if (!container) return;
  if (!zoneMeta) { container.innerHTML = ''; return; }
  container.innerHTML = `
    <span class="zone-badge" style="--zc:${zoneMeta.color}">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <circle cx="5" cy="5" r="4" stroke="var(--zc)" stroke-width="1.5"/>
        <circle cx="5" cy="5" r="2" fill="var(--zc)"/>
      </svg>
      <span class="zone-en">${zoneMeta.en}</span>
      <span class="zone-hi">${zoneMeta.hi}</span>
    </span>`;
}