// ============================================================
// alertas.gs — Anomalías de gasto y comparativa anual
// ============================================================

/**
 * Detecta categorías con gasto ≥ 50% por encima del promedio de los últimos 3 meses.
 * @param {string} mes - 'YYYY-MM'. Defaults al mes actual.
 */
function getAlertasAnomalias(mes) {
  const m = mes || mesActual();
  const movimientos = hojaAObjetos('movimientos');
  const cotizacion = getCotizacionHoy();

  // Calcular gasto por categoría para el mes actual
  const gastosActuales = movimientos.filter(mv => mv.tipo === 'gasto' && (mv.fecha || '').startsWith(m));
  const porCategoriaActual = agruparPorCategoria_(gastosActuales, cotizacion);

  // Calcular promedio de los últimos 3 meses
  const mesesAnteriores = ultimosMeses_(m, 3);
  const promediosPorCategoria = {};

  mesesAnteriores.forEach(mesAnterior => {
    const gastosMes = movimientos.filter(mv => mv.tipo === 'gasto' && (mv.fecha || '').startsWith(mesAnterior));
    const porCategoria = agruparPorCategoria_(gastosMes, cotizacion);
    Object.entries(porCategoria).forEach(([cat, total]) => {
      if (!promediosPorCategoria[cat]) promediosPorCategoria[cat] = [];
      promediosPorCategoria[cat].push(total);
    });
  });

  // Calcular promedio real (si una categoría no apareció en un mes, cuenta como 0)
  const promedioFinal = {};
  Object.entries(promediosPorCategoria).forEach(([cat, totales]) => {
    // Rellenar con 0 los meses donde no hubo gasto en esa categoría
    while (totales.length < mesesAnteriores.length) totales.push(0);
    promedioFinal[cat] = totales.reduce((s, v) => s + v, 0) / totales.length;
  });

  // Detectar anomalías
  const alertas = [];
  Object.entries(porCategoriaActual).forEach(([cat, totalActual]) => {
    const promedio = promedioFinal[cat] || 0;
    if (promedio === 0) return; // Sin historial, no alertar
    const pct = ((totalActual - promedio) / promedio) * 100;
    if (pct >= 50) {
      alertas.push({
        categoria: cat,
        gasto_actual_usd: Math.round(totalActual * 100) / 100,
        promedio_3m_usd: Math.round(promedio * 100) / 100,
        variacion_pct: Math.round(pct)
      });
    }
  });

  return {
    ok: true,
    mes: m,
    alertas: alertas.sort((a, b) => b.variacion_pct - a.variacion_pct)
  };
}

/**
 * Compara el mes actual con el mismo mes del año anterior.
 * Devuelve null en todos los campos si no hay datos del año anterior.
 */
function getComparativaAnual(mesActual_) {
  const m = mesActual_ || mesActual();
  const anioAnterior = String(parseInt(m.substring(0, 4)) - 1);
  const mesAnterior = `${anioAnterior}-${m.substring(5, 7)}`;

  const movimientos = hojaAObjetos('movimientos');
  const cotizacion = getCotizacionHoy();

  const gastosMesActual = movimientos.filter(mv => mv.tipo === 'gasto' && (mv.fecha || '').startsWith(m));
  const gastosMesAnterior = movimientos.filter(mv => mv.tipo === 'gasto' && (mv.fecha || '').startsWith(mesAnterior));

  if (gastosMesAnterior.length === 0) {
    return { ok: true, tiene_datos_anio_anterior: false, mes_actual: m, mes_comparado: mesAnterior };
  }

  const categoriasActual = agruparPorCategoria_(gastosMesActual, cotizacion);
  const categoriasAnterior = agruparPorCategoria_(gastosMesAnterior, cotizacion);

  const totalActualUsd = Object.values(categoriasActual).reduce((s, v) => s + v, 0);
  const totalAnteriorUsd = Object.values(categoriasAnterior).reduce((s, v) => s + v, 0);
  const varTotal = totalAnteriorUsd > 0 ? ((totalActualUsd - totalAnteriorUsd) / totalAnteriorUsd) * 100 : null;

  // Comparativa por categoría
  const todasLasCategorias = new Set([...Object.keys(categoriasActual), ...Object.keys(categoriasAnterior)]);
  const porCategoria = [];
  todasLasCategorias.forEach(cat => {
    const actual   = categoriasActual[cat]   || 0;
    const anterior = categoriasAnterior[cat] || 0;
    const var_ = anterior > 0 ? ((actual - anterior) / anterior) * 100 : null;
    porCategoria.push({ categoria: cat, actual_usd: actual, anterior_usd: anterior, variacion_pct: var_ !== null ? Math.round(var_) : null });
  });

  // Snapshot patrimonial para comparar
  const historico = hojaAObjetos('patrimonio_historico').sort((a, b) => b.mes.localeCompare(a.mes));
  const snapActual   = historico.find(h => h.mes === m);
  const snapAnterior = historico.find(h => h.mes === mesAnterior);

  return {
    ok: true,
    tiene_datos_anio_anterior: true,
    mes_actual: m,
    mes_comparado: mesAnterior,
    gastos: {
      actual_usd: Math.round(totalActualUsd * 100) / 100,
      anterior_usd: Math.round(totalAnteriorUsd * 100) / 100,
      variacion_pct: varTotal !== null ? Math.round(varTotal) : null
    },
    por_categoria: porCategoria.sort((a, b) => (b.actual_usd || 0) - (a.actual_usd || 0)),
    patrimonio: {
      actual_usd: snapActual ? Number(snapActual.patrimonio_total_usd) : null,
      anterior_usd: snapAnterior ? Number(snapAnterior.patrimonio_total_usd) : null
    }
  };
}

// ----- Helpers privados -----

function agruparPorCategoria_(movimientos, cotizacion) {
  const resultado = {};
  movimientos.forEach(mv => {
    const cat = mv.categoria || 'Sin categoría';
    const usd = mv.moneda === 'USD'
      ? Number(mv.monto)
      : (cotizacion ? Number(mv.monto) / cotizacion.promedio : Number(mv.monto_usd_equiv || 0));
    resultado[cat] = (resultado[cat] || 0) + usd;
  });
  return resultado;
}

/**
 * Devuelve los últimos n meses antes del mes dado, en formato 'YYYY-MM'.
 */
function ultimosMeses_(mesBase, n) {
  const [anio, mes] = mesBase.split('-').map(Number);
  const resultado = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(anio, mes - 1 - i, 1);
    resultado.push(Utilities.formatDate(d, 'America/Argentina/Buenos_Aires', 'yyyy-MM'));
  }
  return resultado;
}
