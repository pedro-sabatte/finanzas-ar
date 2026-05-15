// ============================================================
// tarjetas.gs — Setup, resumen y alertas de tarjetas de crédito
// ============================================================

/**
 * Ejecutar UNA VEZ manualmente para cargar los datos iniciales de tarjetas.
 * Agrega columnas nuevas al sheet si no existen y carga:
 *   - dia_cierre, dia_vencimiento
 *   - saldo_pendiente_ars, saldo_pendiente_usd (resumen actual a pagar)
 *   - ultimo_cierre, proximo_cierre, proximo_vencimiento (fechas exactas)
 */
function cargarDatosTarjetas() {
  const hoja = getHoja('tarjetas');
  const datos = hoja.getDataRange().getValues();
  const headers = datos[0].map(String);

  // Agregar columnas nuevas al header si no existen
  const colsNuevas = [
    'saldo_pendiente_ars', 'saldo_pendiente_usd',
    'ultimo_cierre', 'proximo_cierre', 'proximo_vencimiento'
  ];
  const colIdx = {};
  colsNuevas.forEach(col => {
    let idx = headers.indexOf(col);
    if (idx === -1) {
      idx = headers.length;
      headers.push(col);
      const celda = hoja.getRange(1, idx + 1);
      celda.setValue(col);
      celda.setFontWeight('bold');
      celda.setBackground('#0B1220');
      celda.setFontColor('#FFFFFF');
    }
    colIdx[col] = idx;
  });

  const colNombre     = headers.indexOf('nombre');
  const colDiaCierre  = headers.indexOf('dia_cierre');
  const colDiaVenc    = headers.indexOf('dia_vencimiento');

  // ─── Datos reales de cada tarjeta ──────────────────────────────
  // saldo_pendiente = lo que figura en el resumen actual a pagar
  // proximo_cierre / proximo_vencimiento = próximas fechas exactas
  // ultimo_cierre = fecha exacta del último cierre (para calcular ciclo)
  const datos_tarjetas = {
    'Macro Selecta Visa': {
      dia_cierre:            7,
      dia_vencimiento:       15,
      saldo_pendiente_ars:   1189799.10,
      saldo_pendiente_usd:   0,
      ultimo_cierre:         '2026-05-07',
      proximo_cierre:        '2026-06-11',
      proximo_vencimiento:   '2026-05-15',   // ⚠ vence HOY 15/05
    },
    'Macro Selecta Amex': {
      dia_cierre:            23,
      dia_vencimiento:       4,
      saldo_pendiente_ars:   990940.15,
      saldo_pendiente_usd:   40,
      ultimo_cierre:         '2026-04-23',
      proximo_cierre:        '2026-05-21',
      proximo_vencimiento:   '2026-06-04',   // próximo vencimiento (el de 04/05 ya pasó)
    },
    'Santander Platinum Visa': {
      dia_cierre:            28,
      dia_vencimiento:       5,
      saldo_pendiente_ars:   258895.16,
      saldo_pendiente_usd:   71.45,
      ultimo_cierre:         '',             // ciclo aún abierto
      proximo_cierre:        '2026-05-28',
      proximo_vencimiento:   '2026-06-05',
    },
    'Santander Platinum Amex': {
      dia_cierre:            28,
      dia_vencimiento:       8,
      saldo_pendiente_ars:   0,
      saldo_pendiente_usd:   0,
      ultimo_cierre:         '',
      proximo_cierre:        '2026-05-28',
      proximo_vencimiento:   '2026-06-08',
    },
  };

  // Actualizar filas
  let actualizadas = 0;
  for (let i = 1; i < datos.length; i++) {
    const nombre = String(datos[i][colNombre]);
    const d = datos_tarjetas[nombre];
    if (!d) continue;

    const fila = i + 1;
    hoja.getRange(fila, colDiaCierre + 1).setValue(d.dia_cierre);
    hoja.getRange(fila, colDiaVenc   + 1).setValue(d.dia_vencimiento);
    hoja.getRange(fila, colIdx['saldo_pendiente_ars']  + 1).setValue(d.saldo_pendiente_ars);
    hoja.getRange(fila, colIdx['saldo_pendiente_usd']  + 1).setValue(d.saldo_pendiente_usd);
    hoja.getRange(fila, colIdx['ultimo_cierre']         + 1).setValue(d.ultimo_cierre);
    hoja.getRange(fila, colIdx['proximo_cierre']        + 1).setValue(d.proximo_cierre);
    hoja.getRange(fila, colIdx['proximo_vencimiento']   + 1).setValue(d.proximo_vencimiento);
    actualizadas++;
  }

  const msg = `✓ ${actualizadas} tarjetas cargadas.\n\n⚠️ MACRO VISA VENCE HOY 15/05 — $1.189.799,10`;
  SpreadsheetApp.getUi().alert(msg);
  console.log(msg);
}

// ============================================================
// getResumenTarjetas — endpoint GET action=resumen_tarjetas
// ============================================================
// Devuelve por cada tarjeta activa:
//   - saldo pendiente (manual) + consumos del ciclo (calculado desde movimientos)
//   - días para cierre / vencimiento
//   - alertas activas: cierre_hoy, revisar_resumen (+1/+2 días post-cierre),
//                      vencimiento_proximo (-2/-1 días), vencimiento_hoy, vencimiento_pasado
//   - deuda_total_usd_equiv: saldo en USD + saldo ARS / cotización
// Convierte un valor del Sheet (Date object o string) a 'yyyy-MM-dd', o null si está vacío
function fechaAString_(val) {
  if (!val || val === '') return null;
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
  }
  const s = String(val).trim();
  // Si ya viene como yyyy-MM-dd lo devuelve tal cual
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  // Si viene como fecha larga de JS la parsea
  const d = new Date(s);
  if (!isNaN(d)) return Utilities.formatDate(d, 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
  return null;
}

function getResumenTarjetas() {
  const tarjetas    = hojaAObjetos('tarjetas').filter(t => t.activa == true || t.activa === 'TRUE');
  const movimientos = hojaAObjetos('movimientos');
  const cotizacion  = getCotizacionHoy();
  const ahora       = new Date();
  const hoyStr      = Utilities.formatDate(ahora, 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');

  const resumen = tarjetas.map(t => {
    const ultimoCierre = fechaAString_(t.ultimo_cierre);

    // ── Consumos del ciclo actual (desde ultimo_cierre hasta hoy) ──
    const consumosCiclo = movimientos.filter(mv => {
      if (mv.medio_pago !== t.nombre) return false;
      if (!mv.fecha) return false;
      const f = String(mv.fecha).substring(0, 10);
      if (ultimoCierre && f <= ultimoCierre) return false;  // antes del último cierre
      return f <= hoyStr;
    });

    const consumosArs = consumosCiclo
      .filter(mv => mv.moneda === 'ARS')
      .reduce((s, mv) => s + Number(mv.monto || 0), 0);
    const consumosUsd = consumosCiclo
      .filter(mv => mv.moneda === 'USD')
      .reduce((s, mv) => s + Number(mv.monto || 0), 0);

    // ── Días hasta cierre y vencimiento ──
    let diasCierre      = null;
    let diasVencimiento = null;

    const proxCierreStr = fechaAString_(t.proximo_cierre);
    const proxVencStr   = fechaAString_(t.proximo_vencimiento);

    if (proxCierreStr) {
      const fc = new Date(proxCierreStr + 'T12:00:00-03:00');
      diasCierre = Math.round((fc - ahora) / 86400000);
    }
    if (proxVencStr) {
      const fv = new Date(proxVencStr + 'T12:00:00-03:00');
      diasVencimiento = Math.round((fv - ahora) / 86400000);
    }

    // ── Alertas ──
    const alertas = [];
    if (diasCierre !== null) {
      if (diasCierre === 0)                         alertas.push('cierre_hoy');
      if (diasCierre === -1 || diasCierre === -2)   alertas.push('revisar_resumen');   // 1-2 días post cierre
    }
    if (diasVencimiento !== null) {
      if (diasVencimiento === 0)                    alertas.push('vencimiento_hoy');
      if (diasVencimiento === 1 || diasVencimiento === 2) alertas.push('vencimiento_proximo');
      if (diasVencimiento < 0)                      alertas.push('vencimiento_pasado');
    }
    // Alerta especial: tiene deuda en USD
    if (Number(t.saldo_pendiente_usd || 0) > 0)    alertas.push('deuda_usd');

    // ── Deuda total en USD equivalente ──
    const saldoArs = Number(t.saldo_pendiente_ars || 0);
    const saldoUsd = Number(t.saldo_pendiente_usd || 0);
    const cotiz    = cotizacion ? cotizacion.promedio : null;
    const deudaTotalUsd = saldoUsd + (cotiz ? saldoArs / cotiz : 0);

    return {
      id:                    t.id,
      nombre:                t.nombre,
      banco:                 t.banco,
      marca:                 t.marca,
      extension_juani:       t.extension_juani == true || t.extension_juani === 'TRUE',
      saldo_pendiente_ars:   Math.round(saldoArs * 100) / 100,
      saldo_pendiente_usd:   Math.round(saldoUsd * 100) / 100,
      deuda_total_usd:       Math.round(deudaTotalUsd * 100) / 100,
      consumos_ciclo_ars:    Math.round(consumosArs * 100) / 100,
      consumos_ciclo_usd:    Math.round(consumosUsd * 100) / 100,
      ultimo_cierre:         ultimoCierre,
      proximo_cierre:        proxCierreStr,
      proximo_vencimiento:   proxVencStr,
      dias_para_cierre:      diasCierre,
      dias_para_vencimiento: diasVencimiento,
      alertas,
    };
  });

  // Ordenar: alertas activas primero, luego por días para vencimiento
  resumen.sort((a, b) => {
    if (a.alertas.length > 0 && b.alertas.length === 0) return -1;
    if (b.alertas.length > 0 && a.alertas.length === 0) return  1;
    const dA = a.dias_para_vencimiento ?? 999;
    const dB = b.dias_para_vencimiento ?? 999;
    return dA - dB;
  });

  return { ok: true, tarjetas: resumen, cotizacion_usada: cotizacion ? cotizacion.promedio : null };
}

// ============================================================
// actualizarSaldoTarjeta — endpoint POST accion=actualizar_saldo_tarjeta
// ============================================================
// Llamar después de pagar o cerrar un ciclo.
// payload: { id, saldo_pendiente_ars, saldo_pendiente_usd,
//            ultimo_cierre, proximo_cierre, proximo_vencimiento }
function actualizarSaldoTarjeta(payload) {
  if (!payload.id) throw new Error('id requerido');
  const fila = encontrarFilaPorId('tarjetas', payload.id);
  if (fila < 0) throw new Error('Tarjeta no encontrada: ' + payload.id);

  const hoja    = getHoja('tarjetas');
  const headers = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0].map(String);

  const campos = [
    'saldo_pendiente_ars', 'saldo_pendiente_usd',
    'ultimo_cierre', 'proximo_cierre', 'proximo_vencimiento'
  ];
  campos.forEach(campo => {
    if (payload[campo] === undefined) return;
    const col = headers.indexOf(campo);
    if (col >= 0) hoja.getRange(fila, col + 1).setValue(payload[campo]);
  });

  return { ok: true, message: 'Tarjeta actualizada' };
}
