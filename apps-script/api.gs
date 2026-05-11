// ============================================================
// api.gs — Handlers de escritura y lectura general
// ============================================================

// ---- ESCRITURA ----

function crearMovimiento(payload) {
  // Idempotencia: si ya existe un movimiento con este id_cliente, no duplicar
  if (payload.id_cliente) {
    const existente = hojaAObjetos('movimientos').find(m => m.id_cliente === payload.id_cliente);
    if (existente) return { ok: true, message: 'Movimiento ya existente (idempotente)', id_creado: existente.id };
  }

  const cotizacion = getCotizacionHoy();
  const id = generarUUID();
  const montoUsdEquiv = payload.moneda === 'USD'
    ? payload.monto
    : (cotizacion ? payload.monto / cotizacion.promedio : null);

  const hoja = getHoja('movimientos');
  hoja.appendRow([
    id,
    payload.fecha || hoy(),
    payload.tipo,
    payload.titulo || '',
    payload.monto,
    payload.moneda,
    montoUsdEquiv,
    cotizacion ? cotizacion.promedio : '',
    payload.categoria || '',
    payload.descripcion || '',
    payload.quien_gasto || 'Conjunto',
    payload.medio_pago || '',
    payload.cuenta_origen || '',
    payload.cuenta_destino || '',
    payload.cuotas_total || 1,
    1, // cuotas_numero — primera cuota
    payload.es_recurrente_id || '',
    payload.reintegro_de_movimiento_id || '',
    payload.cargado_por || '',
    payload.id_cliente || '',
    new Date()
  ]);

  // Si tiene cuotas, generar las cuotas futuras
  if (payload.cuotas_total > 1 && payload.medio_pago) {
    generarCuotas(id, payload);
  }

  return { ok: true, message: 'Movimiento creado', id_creado: id };
}

function generarCuotas(movimientoId, payload) {
  const tarjetas = hojaAObjetos('tarjetas');
  const tarjeta = tarjetas.find(t => t.nombre === payload.medio_pago);
  const hojaCuotas = getHoja('cuotas');
  const montoCuota = payload.monto / payload.cuotas_total;
  const cotizacion = getCotizacionHoy();

  for (let i = 1; i <= payload.cuotas_total; i++) {
    // Estima fecha de vencimiento según cierre de tarjeta
    const fechaEstimada = estimarFechaCuota(i, tarjeta);
    const usdEquiv = payload.moneda === 'USD' ? montoCuota : (cotizacion ? montoCuota / cotizacion.promedio : null);

    hojaCuotas.appendRow([
      generarUUID(),
      movimientoId,
      i,
      payload.cuotas_total,
      montoCuota,
      payload.moneda,
      usdEquiv,
      tarjeta ? tarjeta.id : '',
      fechaEstimada,
      false
    ]);
  }
}

function estimarFechaCuota(numeroCuota, tarjeta) {
  const hoy_ = new Date();
  const fecha = new Date(hoy_.getFullYear(), hoy_.getMonth() + numeroCuota - 1, 1);
  if (tarjeta && tarjeta.dia_vencimiento) {
    fecha.setDate(tarjeta.dia_vencimiento);
  }
  return Utilities.formatDate(fecha, 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
}

function crearInversionCompra(payload) {
  if (payload.id_cliente) {
    const existente = hojaAObjetos('inversiones_compras').find(m => m.id_cliente === payload.id_cliente);
    if (existente) return { ok: true, message: 'Inversión ya existente (idempotente)', id_creado: existente.id };
  }

  const cotizacion = getCotizacionHoy();
  const id = generarUUID();
  const hoja = getHoja('inversiones_compras');
  hoja.appendRow([
    id,
    payload.fecha || hoy(),
    payload.activo_ticker,
    payload.activo_nombre || '',
    payload.cantidad,
    payload.precio_unitario,
    payload.moneda,
    payload.plataforma,
    payload.cuenta_que_pago || '',
    payload.tipo_operacion || 'compra',
    payload.comision || 0,
    payload.notas || '',
    payload.id_cliente || '',
    new Date()
  ]);

  // Registrar también como movimiento interno si se quiere trackear el cash
  if (payload.registrar_movimiento) {
    crearMovimiento({
      tipo: 'inversion_compra',
      titulo: `Compra ${payload.activo_ticker}`,
      monto: payload.cantidad * payload.precio_unitario + (payload.comision || 0),
      moneda: payload.moneda,
      categoria: 'Inversiones',
      cuenta_origen: payload.cuenta_que_pago,
      cargado_por: payload.cargado_por || 'Pedro'
    });
  }

  return { ok: true, message: 'Inversión registrada', id_creado: id };
}

function actualizarValuacionMes(payload) {
  // payload.mes: 'YYYY-MM', payload.valuaciones: [{ activo_ticker, plataforma, cantidad_actual, precio_cierre, moneda }]
  const cotizacion = getCotizacionHoy();
  const hoja = getHoja('inversiones_valuaciones');

  payload.valuaciones.forEach(v => {
    // Verificar si ya existe valuación para este mes/activo/plataforma
    const existentes = hojaAObjetos('inversiones_valuaciones');
    const existe = existentes.find(e => e.mes === payload.mes && e.activo_ticker === v.activo_ticker && e.plataforma === v.plataforma);
    const valorTotal = v.cantidad_actual * v.precio_cierre;
    const valorTotalUsd = v.moneda === 'USD' ? valorTotal : (cotizacion ? valorTotal / cotizacion.promedio : null);

    if (existe) {
      // Actualizar fila existente
      const fila = encontrarFilaPorId('inversiones_valuaciones', existe.id);
      if (fila > 0) {
        const hj = getHoja('inversiones_valuaciones');
        // Actualizar columnas relevantes
        const headers = hj.getRange(1, 1, 1, hj.getLastColumn()).getValues()[0];
        const cols = { precio_cierre: headers.indexOf('precio_cierre') + 1, valor_total: headers.indexOf('valor_total') + 1, valor_total_usd: headers.indexOf('valor_total_usd') + 1, cantidad_actual: headers.indexOf('cantidad_actual') + 1 };
        hj.getRange(fila, cols.precio_cierre).setValue(v.precio_cierre);
        hj.getRange(fila, cols.valor_total).setValue(valorTotal);
        hj.getRange(fila, cols.valor_total_usd).setValue(valorTotalUsd);
        hj.getRange(fila, cols.cantidad_actual).setValue(v.cantidad_actual);
      }
    } else {
      hoja.appendRow([
        generarUUID(),
        payload.mes,
        v.activo_ticker,
        v.plataforma,
        v.cantidad_actual,
        v.precio_cierre,
        v.moneda,
        valorTotal,
        cotizacion ? cotizacion.promedio : '',
        valorTotalUsd
      ]);
    }
  });

  return { ok: true, message: 'Valuaciones actualizadas' };
}

function crearRecurrente(payload) {
  const id = generarUUID();
  const hoja = getHoja('recurrentes');
  hoja.appendRow([
    id,
    payload.nombre,
    payload.monto || '',
    payload.moneda,
    payload.monto_variable ? true : false,
    payload.frecuencia || 'mensual',
    payload.dia_cobro || '',
    payload.mes_cobro || '',
    payload.tarjeta_default || '',
    payload.categoria || '',
    true, // activa
    payload.fecha_inicio || hoy(),
    payload.fecha_fin || ''
  ]);
  return { ok: true, message: 'Recurrente creado', id_creado: id };
}

function actualizarObjetivo(payload) {
  const existentes = hojaAObjetos('objetivos');
  const existe = existentes.find(o => o.mes === payload.mes && o.tipo === payload.tipo);

  if (existe) {
    const fila = encontrarFilaPorId('objetivos', existe.id);
    const hj = getHoja('objetivos');
    const headers = hj.getRange(1, 1, 1, hj.getLastColumn()).getValues()[0];
    const colMonto = headers.indexOf('monto_objetivo') + 1;
    const colDesc = headers.indexOf('descripcion') + 1;
    hj.getRange(fila, colMonto).setValue(payload.monto_objetivo);
    if (payload.descripcion) hj.getRange(fila, colDesc).setValue(payload.descripcion);
    return { ok: true, message: 'Objetivo actualizado', id_creado: existe.id };
  } else {
    const id = generarUUID();
    getHoja('objetivos').appendRow([
      id,
      payload.mes,
      payload.tipo,
      payload.monto_objetivo,
      payload.moneda || 'ARS',
      0, // monto_actual (se calcula al vuelo)
      payload.descripcion || ''
    ]);
    return { ok: true, message: 'Objetivo creado', id_creado: id };
  }
}

function marcarCuotaPagada(payload) {
  const fila = encontrarFilaPorId('cuotas', payload.cuota_id);
  if (fila < 0) throw new Error('Cuota no encontrada: ' + payload.cuota_id);
  const hj = getHoja('cuotas');
  const headers = hj.getRange(1, 1, 1, hj.getLastColumn()).getValues()[0];
  const colPagada = headers.indexOf('pagada') + 1;
  hj.getRange(fila, colPagada).setValue(true);
  return { ok: true, message: 'Cuota marcada como pagada' };
}

function vincularReintegro(payload) {
  // payload.movimiento_id: el movimiento que ES el reintegro
  // payload.movimiento_original_id: el movimiento al que se le aplica el reintegro
  const fila = encontrarFilaPorId('movimientos', payload.movimiento_id);
  if (fila < 0) throw new Error('Movimiento no encontrado');
  const hj = getHoja('movimientos');
  const headers = hj.getRange(1, 1, 1, hj.getLastColumn()).getValues()[0];
  const col = headers.indexOf('reintegro_de_movimiento_id') + 1;
  hj.getRange(fila, col).setValue(payload.movimiento_original_id);
  return { ok: true, message: 'Reintegro vinculado' };
}

// ---- LECTURA ----

function getDashboardResumen(mes) {
  const m = mes || mesActual();
  const movimientos = hojaAObjetos('movimientos').filter(mv => (mv.fecha || '').startsWith(m));
  const cotizacion = getCotizacionHoy();

  const ingresos = movimientos.filter(mv => mv.tipo === 'ingreso');
  const gastos = movimientos.filter(mv => mv.tipo === 'gasto');

  const totalIngresosArs = ingresos.filter(i => i.moneda === 'ARS').reduce((s, i) => s + Number(i.monto), 0);
  const totalIngresosUsd = ingresos.filter(i => i.moneda === 'USD').reduce((s, i) => s + Number(i.monto), 0);
  const totalGastosArs = gastos.filter(g => g.moneda === 'ARS').reduce((s, g) => s + Number(g.monto), 0);
  const totalGastosUsd = gastos.filter(g => g.moneda === 'USD').reduce((s, g) => s + Number(g.monto), 0);

  const totalIngresosUsdEquiv = totalIngresosUsd + (cotizacion ? totalIngresosArs / cotizacion.promedio : 0);
  const totalGastosUsdEquiv = totalGastosUsd + (cotizacion ? totalGastosArs / cotizacion.promedio : 0);
  const ahorroUsd = totalIngresosUsdEquiv - totalGastosUsdEquiv;

  const objetivos = hojaAObjetos('objetivos').filter(o => o.mes === m);
  const objAhorroArs = objetivos.find(o => o.tipo === 'ahorro_ars');
  const objAhorroUsd = objetivos.find(o => o.tipo === 'ahorro_usd');

  // Comparativa con mes anterior
  const fechaMesAnterior = new Date();
  fechaMesAnterior.setMonth(fechaMesAnterior.getMonth() - 1);
  const mesAnterior = Utilities.formatDate(fechaMesAnterior, 'America/Argentina/Buenos_Aires', 'yyyy-MM');
  const gastosMesAnterior = hojaAObjetos('movimientos').filter(mv => mv.tipo === 'gasto' && (mv.fecha || '').startsWith(mesAnterior));
  const totalGastosMesAnteriorUsdEquiv = gastosMesAnterior.reduce((s, g) => s + Number(g.monto_usd_equiv || 0), 0);
  const varGastos = totalGastosMesAnteriorUsdEquiv > 0
    ? ((totalGastosUsdEquiv - totalGastosMesAnteriorUsdEquiv) / totalGastosMesAnteriorUsdEquiv) * 100
    : null;

  return {
    ok: true,
    mes: m,
    ingresos: { ars: totalIngresosArs, usd: totalIngresosUsd, usd_equiv: totalIngresosUsdEquiv },
    gastos: { ars: totalGastosArs, usd: totalGastosUsd, usd_equiv: totalGastosUsdEquiv },
    ahorro: { usd_equiv: ahorroUsd },
    objetivos: {
      ahorro_ars: objAhorroArs ? Number(objAhorroArs.monto_objetivo) : null,
      ahorro_usd: objAhorroUsd ? Number(objAhorroUsd.monto_objetivo) : null
    },
    variacion_vs_mes_anterior_pct: varGastos !== null ? Math.round(varGastos * 10) / 10 : null,
    cotizacion_mep: cotizacion ? cotizacion.promedio : null
  };
}

function getCompromisoMes(mes) {
  const m = mes || mesActual();
  const movimientos = hojaAObjetos('movimientos');
  const cuotas = hojaAObjetos('cuotas');
  const recurrentes = hojaAObjetos('recurrentes');
  const cotizacion = getCotizacionHoy();

  // Gastos ya debitados en el mes
  const gastosDelMes = movimientos.filter(mv => mv.tipo === 'gasto' && (mv.fecha || '').startsWith(m));
  const debitado = gastosDelMes.reduce((s, g) => s + Number(g.monto_usd_equiv || 0), 0);

  // Cuotas que vencen este mes (no pagadas)
  const cuotasDelMes = cuotas.filter(c => !c.pagada && (c.fecha_estimada_pago || '').startsWith(m));
  const comprometidoCuotas = cuotasDelMes.reduce((s, c) => {
    const usd = c.moneda === 'USD' ? Number(c.monto_cuota) : (cotizacion ? Number(c.monto_cuota) / cotizacion.promedio : 0);
    return s + usd;
  }, 0);

  // Recurrentes activos del mes (los que todavía no tienen movimiento generado)
  const idsRecurrentesConMovimiento = gastosDelMes
    .filter(mv => mv.es_recurrente_id)
    .map(mv => mv.es_recurrente_id);
  const recurrentesPendientes = recurrentes.filter(r =>
    r.activa && r.frecuencia === 'mensual' && !idsRecurrentesConMovimiento.includes(r.id)
  );
  const comprometidoRecurrentes = recurrentesPendientes.reduce((s, r) => {
    if (!r.monto) return s; // monto variable sin cargar
    const usd = r.moneda === 'USD' ? Number(r.monto) : (cotizacion ? Number(r.monto) / cotizacion.promedio : 0);
    return s + usd;
  }, 0);

  return {
    ok: true,
    mes: m,
    gasto_debitado_usd: Math.round(debitado * 100) / 100,
    gasto_comprometido_usd: Math.round((debitado + comprometidoCuotas + comprometidoRecurrentes) * 100) / 100,
    detalle: { cuotas_pendientes: comprometidoCuotas, recurrentes_pendientes: comprometidoRecurrentes }
  };
}

function getTarjetaDelDia() {
  const tarjetas = hojaAObjetos('tarjetas').filter(t => t.tipo === 'Crédito' && t.dia_cierre);
  const hoyFecha = new Date();
  const diaHoy = hoyFecha.getDate();

  const conDias = tarjetas.map(t => {
    const diasDesdeCierre = (diaHoy - Number(t.dia_cierre) + 30) % 30;
    const diasHastaVencimiento = (Number(t.dia_vencimiento) - diaHoy + 30) % 30 || 30;
    return { ...t, diasDesdeCierre, diasHastaVencimiento };
  }).sort((a, b) => b.diasDesdeCierre - a.diasDesdeCierre);

  const mejor = conDias[0];
  return {
    ok: true,
    tarjeta_recomendada: mejor || null,
    todas_las_tarjetas: conDias,
    explicacion: mejor
      ? `${mejor.nombre} cerró hace ${mejor.diasDesdeCierre} días, tenés ${mejor.diasHastaVencimiento} días de financiación`
      : 'Sin datos de cierre de tarjetas todavía'
  };
}

function getPatrimonioTotal() {
  const cuentas = hojaAObjetos('cuentas').filter(c => c.activa);
  const cotizacion = getCotizacionHoy();

  // Saldos de cuentas (manual por ahora — fase 2: integración bancaria)
  // Por ahora se calcula sumando movimientos de cada cuenta
  const movimientos = hojaAObjetos('movimientos');

  const calcularSaldoCuenta = (nombreCuenta, moneda) => {
    let saldo = 0;
    movimientos.forEach(mv => {
      if (mv.cuenta_destino === nombreCuenta && mv.moneda === moneda) saldo += Number(mv.monto);
      if (mv.cuenta_origen === nombreCuenta && mv.moneda === moneda) saldo -= Number(mv.monto);
      if (mv.tipo === 'ingreso' && mv.cuenta_destino === nombreCuenta && mv.moneda === moneda) saldo += Number(mv.monto);
      if (mv.tipo === 'gasto' && mv.medio_pago === nombreCuenta && mv.moneda === moneda) saldo -= Number(mv.monto);
    });
    return saldo;
  };

  const cuentasConSaldo = cuentas.map(c => ({
    nombre: c.nombre,
    tipo: c.tipo,
    moneda: c.moneda_default,
    saldo: calcularSaldoCuenta(c.nombre, c.moneda_default),
    titular: c.titular
  }));

  const totalArs = cuentasConSaldo.filter(c => c.moneda === 'ARS').reduce((s, c) => s + c.saldo, 0);
  const totalUsd = cuentasConSaldo.filter(c => c.moneda === 'USD').reduce((s, c) => s + c.saldo, 0);

  // Inversiones: última valuación disponible
  const valuaciones = hojaAObjetos('inversiones_valuaciones');
  const mesUltimaValuacion = valuaciones.length > 0
    ? valuaciones.sort((a, b) => b.mes.localeCompare(a.mes))[0].mes
    : null;
  const inversionesUltimaValuacion = mesUltimaValuacion
    ? valuaciones.filter(v => v.mes === mesUltimaValuacion)
    : [];
  const totalInversionesUsd = inversionesUltimaValuacion.reduce((s, v) => s + Number(v.valor_total_usd || 0), 0);

  const cashUsdEquiv = totalUsd + (cotizacion ? totalArs / cotizacion.promedio : 0);
  const patrimonioTotalUsd = cashUsdEquiv + totalInversionesUsd;

  return {
    ok: true,
    cash_ars: totalArs,
    cash_usd: totalUsd,
    cash_usd_equiv: cashUsdEquiv,
    inversiones_usd: totalInversionesUsd,
    patrimonio_total_usd: patrimonioTotalUsd,
    cotizacion_mep: cotizacion ? cotizacion.promedio : null,
    cuentas: cuentasConSaldo,
    inversiones_detalle: inversionesUltimaValuacion,
    ultima_valuacion_mes: mesUltimaValuacion
  };
}

function getProximosVencimientos(dias) {
  const limite = dias || 30;
  const hoyFecha = new Date();
  const fechaLimite = new Date(hoyFecha.getTime() + limite * 24 * 60 * 60 * 1000);
  const fechaLimiteStr = Utilities.formatDate(fechaLimite, 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
  const hoyStr = hoy();

  const cuotas = hojaAObjetos('cuotas').filter(c =>
    !c.pagada && c.fecha_estimada_pago >= hoyStr && c.fecha_estimada_pago <= fechaLimiteStr
  );

  const recurrentes = hojaAObjetos('recurrentes').filter(r => r.activa && r.frecuencia === 'mensual');
  const vencimientosRecurrentes = recurrentes.map(r => {
    const diaStr = String(r.dia_cobro).padStart(2, '0');
    const mesStr = Utilities.formatDate(hoyFecha, 'America/Argentina/Buenos_Aires', 'yyyy-MM');
    const fechaEst = `${mesStr}-${diaStr}`;
    return { tipo: 'recurrente', nombre: r.nombre, fecha: fechaEst, monto: r.monto, moneda: r.moneda };
  }).filter(v => v.fecha >= hoyStr && v.fecha <= fechaLimiteStr);

  const tarjetas = hojaAObjetos('tarjetas').filter(t => t.dia_cierre && t.dia_vencimiento);
  const vencimientosTarjetas = tarjetas.flatMap(t => {
    const resultados = [];
    for (let i = 0; i <= 1; i++) {
      const fecha = new Date(hoyFecha.getFullYear(), hoyFecha.getMonth() + i, Number(t.dia_vencimiento));
      const fechaStr = Utilities.formatDate(fecha, 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
      if (fechaStr >= hoyStr && fechaStr <= fechaLimiteStr) {
        resultados.push({ tipo: 'tarjeta_vencimiento', nombre: `Vencimiento ${t.nombre}`, fecha: fechaStr });
      }
      const fechaCierre = new Date(hoyFecha.getFullYear(), hoyFecha.getMonth() + i, Number(t.dia_cierre));
      const fechaCierreStr = Utilities.formatDate(fechaCierre, 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
      if (fechaCierreStr >= hoyStr && fechaCierreStr <= fechaLimiteStr) {
        resultados.push({ tipo: 'tarjeta_cierre', nombre: `Cierre ${t.nombre}`, fecha: fechaCierreStr });
      }
    }
    return resultados;
  });

  const todos = [
    ...cuotas.map(c => ({ tipo: 'cuota', nombre: `Cuota ${c.numero_cuota}/${c.total_cuotas}`, fecha: c.fecha_estimada_pago, monto: c.monto_cuota, moneda: c.moneda, id: c.id })),
    ...vencimientosRecurrentes,
    ...vencimientosTarjetas
  ].sort((a, b) => a.fecha.localeCompare(b.fecha));

  return { ok: true, vencimientos: todos };
}

function getGastosPorCategoria(mes) {
  const m = mes || mesActual();
  const gastos = hojaAObjetos('movimientos').filter(mv => mv.tipo === 'gasto' && (mv.fecha || '').startsWith(m));
  const cotizacion = getCotizacionHoy();

  const porCategoria = {};
  gastos.forEach(g => {
    const cat = g.categoria || 'Sin categoría';
    if (!porCategoria[cat]) porCategoria[cat] = { ars: 0, usd: 0, usd_equiv: 0, cantidad: 0 };
    porCategoria[cat].cantidad++;
    if (g.moneda === 'ARS') {
      porCategoria[cat].ars += Number(g.monto);
      porCategoria[cat].usd_equiv += cotizacion ? Number(g.monto) / cotizacion.promedio : 0;
    } else {
      porCategoria[cat].usd += Number(g.monto);
      porCategoria[cat].usd_equiv += Number(g.monto);
    }
  });

  const resultado = Object.entries(porCategoria).map(([categoria, data]) => ({
    categoria,
    ...data,
    usd_equiv: Math.round(data.usd_equiv * 100) / 100
  })).sort((a, b) => b.usd_equiv - a.usd_equiv);

  return { ok: true, mes: m, categorias: resultado };
}

function getUltimosMovimientos(limit) {
  const n = limit || 5;
  const movimientos = hojaAObjetos('movimientos')
    .sort((a, b) => new Date(b.timestamp_carga) - new Date(a.timestamp_carga))
    .slice(0, n);
  return { ok: true, movimientos };
}

function getMetaLargoPlazo() {
  const metas = hojaAObjetos('objetivos').filter(o => o.mes === 'long_term');
  const patrimonioActual = getPatrimonioTotal();
  return {
    ok: true,
    metas,
    patrimonio_actual_usd: patrimonioActual.patrimonio_total_usd
  };
}

function getCatalogos() {
  return {
    ok: true,
    cuentas: hojaAObjetos('cuentas').filter(c => c.activa),
    tarjetas: hojaAObjetos('tarjetas'),
    categorias: hojaAObjetos('categorias'),
    recurrentes: hojaAObjetos('recurrentes').filter(r => r.activa)
  };
}
