// ============================================================
// Code.gs — Entry points principales del Web App
// ============================================================

const SHEET_ID = '1FfIeMW7jk6hEJgmPJufSfo_iLZfLnDUoHt6ZCMFoeXg';

function getSpreadsheet() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function getHoja(nombre) {
  const ss = getSpreadsheet();
  const hoja = ss.getSheetByName(nombre);
  if (!hoja) throw new Error('Hoja no encontrada: ' + nombre);
  return hoja;
}

// Verifica el token de seguridad enviado en cada request
function verificarToken(e) {
  const token = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  const tokenRecibido = (e.parameter && e.parameter.token) || '';
  if (!token || tokenRecibido !== token) {
    throw new Error('Token inválido o ausente');
  }
}

// Envuelve cualquier objeto en una respuesta JSON con CORS
function responder(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ---- doPost: escritura ----
function doPost(e) {
  try {
    verificarToken(e);
    const payload = JSON.parse(e.postData.contents);
    const accion = payload.accion;

    switch (accion) {
      case 'crear_movimiento':          return responder(crearMovimiento(payload));
      case 'crear_inversion_compra':    return responder(crearInversionCompra(payload));
      case 'actualizar_valuacion_mes':  return responder(actualizarValuacionMes(payload));
      case 'crear_recurrente':          return responder(crearRecurrente(payload));
      case 'actualizar_objetivo':       return responder(actualizarObjetivo(payload));
      case 'marcar_cuota_pagada':       return responder(marcarCuotaPagada(payload));
      case 'vincular_reintegro':        return responder(vincularReintegro(payload));
      case 'cierre_mensual':            return responder(cierreMensual(payload));
      default:
        return responder({ ok: false, message: 'Acción desconocida: ' + accion });
    }
  } catch (err) {
    console.error('doPost error:', err.message);
    return responder({ ok: false, message: err.message });
  }
}

// ---- doGet: lectura ----
function doGet(e) {
  try {
    verificarToken(e);
    const accion = e.parameter.action;

    switch (accion) {
      case 'dashboard_resumen':     return responder(getDashboardResumen(e.parameter.mes));
      case 'compromiso_mes':        return responder(getCompromisoMes(e.parameter.mes));
      case 'tarjeta_del_dia':       return responder(getTarjetaDelDia());
      case 'patrimonio_total':      return responder(getPatrimonioTotal());
      case 'patrimonio_historico':  return responder(getPatrimonioHistoricoData());
      case 'proximos_vencimientos': return responder(getProximosVencimientos(parseInt(e.parameter.dias) || 30));
      case 'gastos_por_categoria':  return responder(getGastosPorCategoria(e.parameter.mes));
      case 'ultimos_movimientos':   return responder(getUltimosMovimientos(parseInt(e.parameter.limit) || 5));
      case 'meta_largo_plazo':      return responder(getMetaLargoPlazo());
      case 'catalogos':             return responder(getCatalogos());
      case 'alertas_anomalias':     return responder(getAlertasAnomalias(e.parameter.mes));
      case 'comparativa_anual':     return responder(getComparativaAnual(e.parameter.mes_actual));
      case 'cierre_pendiente':      return responder(getCierrePendiente());
      default:
        return responder({ ok: false, message: 'Acción desconocida: ' + accion });
    }
  } catch (err) {
    console.error('doGet error:', err.message);
    return responder({ ok: false, message: err.message });
  }
}

// ---- Helpers globales ----

function generarUUID() {
  return Utilities.getUuid();
}

function mesActual() {
  return Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM');
}

function hoy() {
  return Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
}

// Convierte los datos de una hoja en array de objetos usando la primera fila como headers
function hojaAObjetos(nombreHoja) {
  const hoja = getHoja(nombreHoja);
  const datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return [];
  const headers = datos[0];
  return datos.slice(1).map(fila => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = fila[i]; });
    return obj;
  });
}

// Busca la fila (1-indexed) de un registro por su id en una hoja
function encontrarFilaPorId(nombreHoja, id) {
  const hoja = getHoja(nombreHoja);
  const datos = hoja.getDataRange().getValues();
  const headers = datos[0];
  const colId = headers.indexOf('id');
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][colId] === id) return i + 1; // +1 porque getDataRange incluye header
  }
  return -1;
}
