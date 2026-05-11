// ============================================================
// shared/formatters.js — Helpers de formato compartidos
// ============================================================

const fmt = (() => {
  /**
   * Formatea un monto en ARS (estilo argentino: puntos de miles, coma decimal)
   * Ej: 1420000 → "1.420.000"
   */
  function ars(monto, decimales = 0) {
    if (monto == null || isNaN(monto)) return '—';
    return Number(monto).toLocaleString('es-AR', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    });
  }

  /**
   * Formatea un monto en USD (estilo US: coma de miles, punto decimal)
   * Ej: 1234.56 → "1,234.56"
   */
  function usd(monto, decimales = 2) {
    if (monto == null || isNaN(monto)) return '—';
    return Number(monto).toLocaleString('en-US', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    });
  }

  /**
   * Formatea un monto con símbolo según moneda.
   * ARS → "$ 1.420.000"
   * USD → "U$S 1,234.56"
   */
  function moneda(monto, monedaStr) {
    if (monedaStr === 'USD') return `U$S ${usd(monto)}`;
    return `$ ${ars(monto)}`;
  }

  /**
   * Formatea un monto en USD con símbolo, abreviando si es grande.
   * < 10.000 → "U$S 1,234"
   * >= 10.000 → "U$S 12.4K"
   */
  function usdCompacto(monto) {
    if (monto == null || isNaN(monto)) return '—';
    const n = Number(monto);
    if (Math.abs(n) >= 1_000_000) return `U$S ${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 10_000)   return `U$S ${(n / 1_000).toFixed(1).replace('.', ',')}K`;
    return `U$S ${usd(n, 0)}`;
  }

  /**
   * Formatea una fecha ISO (YYYY-MM-DD) en formato legible.
   * Ej: "2026-05-11" → "11 may"  |  "11 may 2026" si showYear=true
   */
  function fecha(isoStr, showYear = false) {
    if (!isoStr) return '—';
    const [y, m, d] = isoStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const base = `${d} ${meses[m - 1]}`;
    return showYear ? `${base} ${y}` : base;
  }

  /**
   * Formatea YYYY-MM en nombre de mes largo.
   * Ej: "2026-05" → "Mayo 2026"
   */
  function mes(yyyyMM) {
    if (!yyyyMM) return '—';
    const [y, m] = yyyyMM.split('-').map(Number);
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return `${meses[m - 1]} ${y}`;
  }

  /**
   * Variación porcentual con signo y color.
   * Devuelve { texto: "+12%", positivo: true }
   */
  function variacion(pct) {
    if (pct == null) return { texto: '—', positivo: null };
    const redondeado = Math.round(pct);
    return {
      texto: (redondeado > 0 ? '+' : '') + redondeado + '%',
      positivo: redondeado >= 0,
    };
  }

  /**
   * Devuelve el mes actual en formato YYYY-MM.
   */
  function mesActualStr() {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Devuelve la fecha de hoy en formato YYYY-MM-DD.
   */
  function hoyStr() {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  }

  return { ars, usd, moneda, usdCompacto, fecha, mes, variacion, mesActualStr, hoyStr };
})();
