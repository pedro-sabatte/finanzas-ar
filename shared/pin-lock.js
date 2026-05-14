/**
 * Finanzas J&P — PIN Lock
 *
 * Muestra una pantalla de código antes de cargar la app.
 * Una vez desbloqueado, queda activo durante UNLOCK_HOURS horas
 * (compartido entre las 3 apps del mismo origen).
 *
 * ─── Cómo cambiar el PIN ───────────────────────────────────────
 *  1. Abrí la consola del navegador (F12 → Console)
 *  2. Ejecutá:
 *       (async()=>{
 *         const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('TuNuevoPIN'));
 *         console.log([...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join(''));
 *       })()
 *  3. Copiá el hash y reemplazá CORRECT_HASH abajo
 *
 * ──────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  // ─── Configuración ─────────────────────────────────────────────────────────
  // SHA-256 del PIN.
  const CORRECT_HASH = 'd74fe97872d8a425b5263add13d51a1066bf0b2cdd5e368d316dfe31048b2104';
  const UNLOCK_HOURS = 8;
  const UNLOCK_MS    = UNLOCK_HOURS * 60 * 60 * 1000;
  const STORAGE_KEY  = 'jp_unlock_ts';
  const PIN_LENGTH   = 4;

  // ─── ¿Ya desbloqueado? ────────────────────────────────────────────────────
  function isUnlocked() {
    try {
      const ts = localStorage.getItem(STORAGE_KEY);
      return !!ts && (Date.now() - parseInt(ts, 10)) < UNLOCK_MS;
    } catch { return false; }
  }

  function markUnlocked() {
    try { localStorage.setItem(STORAGE_KEY, Date.now().toString()); } catch {}
  }

  if (isUnlocked()) {
    document.documentElement.style.visibility = '';
    return;
  }

  // ─── Estilos ───────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #jp-lock {
      position: fixed; inset: 0; z-index: 99999;
      background: #F6F7F9;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
      padding-bottom: env(safe-area-inset-bottom, 0px);
      padding-top: env(safe-area-inset-top, 0px);
      user-select: none;
    }
    #jp-lock .lk-brand {
      font-family: 'Source Serif 4', ui-serif, Georgia, serif;
      font-size: 38px; font-style: italic;
      color: #0B1220; letter-spacing: -0.02em;
      margin-bottom: 6px; line-height: 1;
    }
    #jp-lock .lk-brand em { color: #2C5BEC; font-style: italic; }
    #jp-lock .lk-sub {
      font-size: 12px; color: #8A93A2; font-weight: 500;
      letter-spacing: 0.08em; text-transform: uppercase;
      margin-bottom: 44px;
    }
    #jp-lock .lk-dots {
      display: flex; gap: 18px; margin-bottom: 52px;
    }
    #jp-lock .lk-dot {
      width: 13px; height: 13px; border-radius: 50%;
      border: 2px solid #D1D5DB;
      background: transparent;
      transition: background 160ms, border-color 160ms;
    }
    #jp-lock .lk-dot.filled {
      background: #2C5BEC; border-color: #2C5BEC;
    }
    #jp-lock .lk-dot.error {
      background: #DC2A2A; border-color: #DC2A2A;
    }
    @keyframes lk-shake {
      0%,100% { transform: translateX(0); }
      15%     { transform: translateX(-9px); }
      35%     { transform: translateX(9px); }
      55%     { transform: translateX(-6px); }
      75%     { transform: translateX(6px); }
    }
    #jp-lock .lk-dots.shake { animation: lk-shake 420ms cubic-bezier(0.2,0,0,1); }
    #jp-lock .lk-pad {
      display: grid;
      grid-template-columns: repeat(3, 76px);
      gap: 12px;
    }
    #jp-lock .lk-btn {
      width: 76px; height: 76px; border-radius: 50%;
      border: none; cursor: pointer;
      font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
      font-size: 26px; font-weight: 400; color: #0B1220;
      background: #FFFFFF;
      box-shadow:
        0 1px 0 rgba(11,18,32,0.04),
        0 2px 10px -4px rgba(11,18,32,0.12);
      display: flex; align-items: center; justify-content: center;
      transition: transform 120ms cubic-bezier(0.2,0,0,1),
                  box-shadow 120ms cubic-bezier(0.2,0,0,1),
                  opacity 120ms;
      -webkit-tap-highlight-color: transparent;
    }
    #jp-lock .lk-btn:active {
      transform: scale(0.91);
      box-shadow: 0 1px 0 rgba(11,18,32,0.04);
    }
    #jp-lock .lk-btn.del {
      font-size: 20px; color: #8A93A2;
      background: transparent; box-shadow: none;
    }
    #jp-lock .lk-btn.empty {
      background: transparent; box-shadow: none;
      pointer-events: none; opacity: 0;
    }
    #jp-lock.fade-out {
      transition: opacity 280ms cubic-bezier(0.2,0,0,1);
      opacity: 0;
    }
  `;
  document.head.appendChild(style);

  // ─── HTML ──────────────────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'jp-lock';
  overlay.innerHTML = `
    <div class="lk-brand">J<em>&amp;</em>P</div>
    <div class="lk-sub">Ingresá el código</div>
    <div class="lk-dots" id="lk-dots">
      ${Array.from({length: PIN_LENGTH}, (_,i) => `<div class="lk-dot" id="lk-d${i}"></div>`).join('')}
    </div>
    <div class="lk-pad">
      ${[1,2,3,4,5,6,7,8,9].map(n =>
        `<button class="lk-btn" onclick="_lkTap('${n}')">${n}</button>`
      ).join('')}
      <button class="lk-btn empty" disabled aria-hidden="true"></button>
      <button class="lk-btn" onclick="_lkTap('0')">0</button>
      <button class="lk-btn del" onclick="_lkDel()" aria-label="Borrar">⌫</button>
    </div>
  `;

  // Inyectar lo antes posible para que nada se filtre
  function injectOverlay() {
    if (document.body) {
      document.body.insertBefore(overlay, document.body.firstChild);
      document.documentElement.style.visibility = '';
    } else {
      requestAnimationFrame(injectOverlay);
    }
  }
  injectOverlay();

  // ─── Lógica del PIN ────────────────────────────────────────────────────────
  let entered = '';
  let checking = false;

  function updateDots(state) {
    for (let i = 0; i < PIN_LENGTH; i++) {
      const dot = document.getElementById('lk-d' + i);
      if (!dot) continue;
      if (i < entered.length) {
        dot.className = 'lk-dot ' + (state === 'error' ? 'error' : 'filled');
      } else {
        dot.className = 'lk-dot';
      }
    }
  }

  async function sha256(str) {
    const buf = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(str)
    );
    return [...new Uint8Array(buf)]
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function checkPin() {
    if (checking) return;
    checking = true;
    const hash = await sha256(entered);

    if (hash === CORRECT_HASH) {
      markUnlocked();
      overlay.classList.add('fade-out');
      setTimeout(() => overlay.remove(), 300);
    } else {
      updateDots('error');
      const dots = document.getElementById('lk-dots');
      if (dots) {
        dots.classList.add('shake');
        setTimeout(() => {
          dots.classList.remove('shake');
          entered = '';
          checking = false;
          updateDots();
        }, 480);
      } else {
        entered = '';
        checking = false;
        updateDots();
      }
    }
  }

  window._lkTap = function (digit) {
    if (checking || entered.length >= PIN_LENGTH) return;
    entered += digit;
    updateDots();
    if (entered.length === PIN_LENGTH) checkPin();
  };

  window._lkDel = function () {
    if (checking) return;
    entered = entered.slice(0, -1);
    updateDots();
  };

  // Soporte de teclado (útil en desktop)
  document.addEventListener('keydown', function (e) {
    if (e.key >= '0' && e.key <= '9') window._lkTap(e.key);
    if (e.key === 'Backspace')        window._lkDel();
  });

})();
