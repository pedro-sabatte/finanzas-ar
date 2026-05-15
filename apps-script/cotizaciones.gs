// ============================================================
// cotizaciones.gs — Fetch y cache del dólar MEP (dolarapi.com)
// ============================================================

const URL_DOLAR_API = 'https://dolarapi.com/v1/dolares/bolsa';

/**
 * Obtiene la cotización MEP del día.
 * Primero intenta el caché (hoja cotizaciones), si no fetchea.
 */
function getCotizacionHoy() {
  const hoyStr = hoy();
  const cotizaciones = hojaAObjetos('cotizaciones');
  const cache = cotizaciones.find(c => c.fecha === hoyStr && c.tipo === 'mep');
  if (cache) {
    return {
      compra:   Number(cache.compra),
      venta:    Number(cache.venta),
      promedio: Number(cache.promedio),
      fecha:    cache.fecha
    };
  }
  // No hay caché para hoy — fetchear
  return fetchCotizacionMEP();
}

/**
 * Fetcha el MEP de dolarapi y lo guarda en la hoja cotizaciones.
 * Llamada por el trigger diario 9am.
 */
function fetchCotizacionMEP() {
  try {
    const resp = UrlFetchApp.fetch(URL_DOLAR_API, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) {
      console.error('dolarapi respondió ' + resp.getResponseCode());
      return null;
    }
    const data = JSON.parse(resp.getContentText());
    const compra   = data.compra || data.buy || 0;
    const venta    = data.venta  || data.sell || 0;
    const promedio = (compra + venta) / 2;
    const hojaCot  = getHoja('cotizaciones');
    const hoyStr   = hoy();

    // Evitar duplicados: si ya existe entrada de hoy, actualizar
    const datos = hojaCot.getDataRange().getValues();
    const headers = datos[0];
    const colFecha = headers.indexOf('fecha');
    const colTipo  = headers.indexOf('tipo');
    let filaExistente = -1;
    for (let i = 1; i < datos.length; i++) {
      const fStr = datos[i][colFecha] instanceof Date
        ? Utilities.formatDate(datos[i][colFecha], 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd')
        : String(datos[i][colFecha]).substring(0, 10);
      if (fStr === hoyStr && datos[i][colTipo] === 'mep') { filaExistente = i + 1; break; }
    }
    if (filaExistente > 0) {
      hojaCot.getRange(filaExistente, headers.indexOf('compra')          + 1).setValue(compra);
      hojaCot.getRange(filaExistente, headers.indexOf('venta')           + 1).setValue(venta);
      hojaCot.getRange(filaExistente, headers.indexOf('promedio')        + 1).setValue(promedio);
      hojaCot.getRange(filaExistente, headers.indexOf('timestamp_fetch') + 1).setValue(new Date());
    } else {
      hojaCot.appendRow([hoyStr, 'mep', compra, venta, promedio, new Date()]);
    }

    console.log(`MEP actualizado: compra=$${compra} venta=$${venta}`);
    return { compra, venta, promedio, fecha: hoyStr };

  } catch (err) {
    console.error('fetchCotizacionMEP error:', err.message);
    // Devolver la última cotización disponible como fallback
    const cotizaciones = hojaAObjetos('cotizaciones')
      .filter(c => c.tipo === 'mep' && c.promedio)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    if (cotizaciones.length > 0) {
      const last = cotizaciones[0];
      return { compra: Number(last.compra), venta: Number(last.venta), promedio: Number(last.promedio), fecha: last.fecha };
    }
    return null;
  }
}

/**
 * También guarda blue y oficial para contexto (no se usa en cálculos, solo info)
 */
function fetchTodasLasCotizaciones() {
  const endpoints = [
    { tipo: 'mep',     url: 'https://dolarapi.com/v1/dolares/bolsa' },
    { tipo: 'oficial', url: 'https://dolarapi.com/v1/dolares/oficial' },
    { tipo: 'blue',    url: 'https://dolarapi.com/v1/dolares/blue' },
    { tipo: 'cripto',  url: 'https://dolarapi.com/v1/dolares/cripto' },
  ];
  const hojaCot = getHoja('cotizaciones');
  const hoyStr  = hoy();

  endpoints.forEach(ep => {
    try {
      const resp = UrlFetchApp.fetch(ep.url, { muteHttpExceptions: true });
      if (resp.getResponseCode() !== 200) return;
      const data    = JSON.parse(resp.getContentText());
      const compra  = data.compra  || data.buy  || 0;
      const venta   = data.venta   || data.sell || 0;
      const promedio= (compra + venta) / 2;

      const datos2  = hojaCot.getDataRange().getValues();
      const hdrs2   = datos2[0];
      const cFecha2 = hdrs2.indexOf('fecha');
      const cTipo2  = hdrs2.indexOf('tipo');
      let fila2 = -1;
      for (let i = 1; i < datos2.length; i++) {
        const fStr = datos2[i][cFecha2] instanceof Date
          ? Utilities.formatDate(datos2[i][cFecha2], 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd')
          : String(datos2[i][cFecha2]).substring(0, 10);
        if (fStr === hoyStr && datos2[i][cTipo2] === ep.tipo) { fila2 = i + 1; break; }
      }
      if (fila2 > 0) {
        hojaCot.getRange(fila2, hdrs2.indexOf('compra')          + 1).setValue(compra);
        hojaCot.getRange(fila2, hdrs2.indexOf('venta')           + 1).setValue(venta);
        hojaCot.getRange(fila2, hdrs2.indexOf('promedio')        + 1).setValue(promedio);
        hojaCot.getRange(fila2, hdrs2.indexOf('timestamp_fetch') + 1).setValue(new Date());
      } else {
        hojaCot.appendRow([hoyStr, ep.tipo, compra, venta, promedio, new Date()]);
      }
    } catch (err) {
      console.error(`fetchCotizacion ${ep.tipo} error:`, err.message);
    }
  });
}
