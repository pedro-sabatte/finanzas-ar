// ============================================================
// shared/api-client.js — Cliente HTTP compartido entre las 3 PWAs
// CONFIG debe estar cargado antes de este archivo (config.local.js)
// ============================================================

const api = (() => {
  function getConfig() {
    if (typeof CONFIG === 'undefined') {
      throw new Error('config.local.js no cargado. Copiá config.local.example.js como config.local.js y completá la URL y el token.');
    }
    return CONFIG;
  }

  /**
   * GET al Apps Script.
   * @param {string} action - El nombre de la acción (action=...)
   * @param {Object} params - Parámetros adicionales
   */
  async function get(action, params = {}) {
    const { APPS_SCRIPT_URL, API_TOKEN } = getConfig();
    const query = new URLSearchParams({ action, token: API_TOKEN, ...params });
    const resp = await fetch(`${APPS_SCRIPT_URL}?${query}`, {
      method: 'GET',
      redirect: 'follow',
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }

  /**
   * POST al Apps Script.
   * @param {string} accion - El nombre de la acción
   * @param {Object} payload - Datos a enviar
   */
  async function post(accion, payload = {}) {
    const { APPS_SCRIPT_URL, API_TOKEN } = getConfig();
    const resp = await fetch(`${APPS_SCRIPT_URL}?token=${encodeURIComponent(API_TOKEN)}`, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion, ...payload }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }

  return { get, post };
})();
