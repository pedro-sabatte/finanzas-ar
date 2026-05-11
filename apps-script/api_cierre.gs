// ============================================================
// api_cierre.gs — Endpoints del wizard de cierre mensual
// ============================================================

function cierreMensual(payload) {
  // payload: { mes, valuaciones[], cuotas_pagadas[], objetivos_proximo_mes[], cargado_por }
  // Operación atómica: valuaciones + marcar cuotas + actualizar objetivos

  const resultados = { valuaciones: null, cuotas: null, objetivos: null };

  // 1. Guardar valuaciones
  if (payload.valuaciones && payload.valuaciones.length > 0) {
    resultados.valuaciones = actualizarValuacionMes({ mes: payload.mes, valuaciones: payload.valuaciones });
  }

  // 2. Marcar cuotas como pagadas
  if (payload.cuotas_pagadas && payload.cuotas_pagadas.length > 0) {
    payload.cuotas_pagadas.forEach(cuotaId => marcarCuotaPagada({ cuota_id: cuotaId }));
    resultados.cuotas = { ok: true, marcadas: payload.cuotas_pagadas.length };
  }

  // 3. Actualizar objetivos del mes siguiente
  if (payload.objetivos_proximo_mes && payload.objetivos_proximo_mes.length > 0) {
    payload.objetivos_proximo_mes.forEach(obj => actualizarObjetivo(obj));
    resultados.objetivos = { ok: true, actualizados: payload.objetivos_proximo_mes.length };
  }

  // 4. Tomar snapshot patrimonial del mes que cierra
  snapshotPatrimonioMensual(payload.mes);

  return { ok: true, message: `Cierre de ${payload.mes} completado`, resultados };
}

function getCierrePendiente() {
  const hoyFecha = new Date();
  const diaHoy = hoyFecha.getDate();
  const diasEnElMes = new Date(hoyFecha.getFullYear(), hoyFecha.getMonth() + 1, 0).getDate();
  const diasRestantes = diasEnElMes - diaHoy;
  const m = mesActual();

  if (diasRestantes > 5) {
    return { ok: true, cierre_pendiente: false, dias_restantes: diasRestantes };
  }

  // Verificar qué falta
  const activos = obtenerActivosActuales();
  const valuaciones = hojaAObjetos('inversiones_valuaciones').filter(v => v.mes === m);
  const tickersConValuacion = valuaciones.map(v => v.activo_ticker);
  const activosSinValuacion = activos.filter(a => !tickersConValuacion.includes(a.activo_ticker));

  const recurrentes = hojaAObjetos('recurrentes').filter(r => r.activa && r.monto_variable && r.frecuencia === 'mensual');
  const movimientos = hojaAObjetos('movimientos').filter(mv => (mv.fecha || '').startsWith(m));
  const idsConMovimiento = movimientos.filter(mv => mv.es_recurrente_id).map(mv => mv.es_recurrente_id);
  const recurrentesSinMonto = recurrentes.filter(r => !idsConMovimiento.includes(r.id));

  return {
    ok: true,
    cierre_pendiente: true,
    dias_restantes: diasRestantes,
    mes: m,
    pendiente: {
      valuaciones_faltantes: activosSinValuacion,
      recurrentes_variables_sin_monto: recurrentesSinMonto.map(r => ({ id: r.id, nombre: r.nombre }))
    }
  };
}

// Devuelve la posición actual de cada activo (agrupando compras y ventas)
function obtenerActivosActuales() {
  const compras = hojaAObjetos('inversiones_compras');
  const posiciones = {};

  compras.forEach(c => {
    const key = `${c.activo_ticker}__${c.plataforma}`;
    if (!posiciones[key]) {
      posiciones[key] = { activo_ticker: c.activo_ticker, activo_nombre: c.activo_nombre, plataforma: c.plataforma, cantidad: 0 };
    }
    if (c.tipo_operacion === 'compra') posiciones[key].cantidad += Number(c.cantidad);
    if (c.tipo_operacion === 'venta') posiciones[key].cantidad -= Number(c.cantidad);
  });

  return Object.values(posiciones).filter(p => p.cantidad > 0);
}

// Datos para armar el resumen del paso 4 del wizard
function getResumenCierre(mes) {
  const resumen = getDashboardResumen(mes);
  const patrimonioActual = getPatrimonioTotal();
  const historico = hojaAObjetos('patrimonio_historico');
  const snapshotAnterior = historico
    .filter(h => h.mes < mes)
    .sort((a, b) => b.mes.localeCompare(a.mes))[0];

  const patrimonioInicio = snapshotAnterior ? Number(snapshotAnterior.patrimonio_total_usd) : null;
  const patrimonioFin = patrimonioActual.patrimonio_total_usd;
  const crecimientoPct = patrimonioInicio ? ((patrimonioFin - patrimonioInicio) / patrimonioInicio) * 100 : null;

  // Distribución del crecimiento
  const ahorroNuevoUsd = resumen.ahorro.usd_equiv;
  const crecimientoTotal = patrimonioFin - (patrimonioInicio || patrimonioFin);
  const rendimientoInversiones = crecimientoTotal - ahorroNuevoUsd;

  return {
    ok: true,
    mes,
    ingresos: resumen.ingresos,
    gastos: resumen.gastos,
    ahorro: resumen.ahorro,
    patrimonio_inicio_usd: patrimonioInicio,
    patrimonio_fin_usd: patrimonioFin,
    crecimiento_pct: crecimientoPct !== null ? Math.round(crecimientoPct * 10) / 10 : null,
    distribucion_crecimiento: {
      ahorro_nuevo_usd: Math.round(ahorroNuevoUsd * 100) / 100,
      rendimiento_inversiones_usd: Math.round(rendimientoInversiones * 100) / 100
    },
    objetivos: resumen.objetivos
  };
}
