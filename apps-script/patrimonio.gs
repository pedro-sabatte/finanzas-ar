// ============================================================
// patrimonio.gs — Snapshot mensual de patrimonio + serie histórica
// ============================================================

/**
 * Genera y guarda el snapshot patrimonial del mes.
 * Se llama el día 1 de cada mes a las 7am (trigger) y al finalizar el cierre mensual.
 * @param {string} mes - 'YYYY-MM'. Si no se pasa, usa el mes anterior al actual.
 */
function snapshotPatrimonioMensual(mes) {
  const meses = mes || mesAnterior_();
  const cotizacion = getCotizacionHoy();
  const hoja = getHoja('patrimonio_historico');

  // Evitar duplicados: si ya existe snapshot de este mes, salir
  const existentes = hojaAObjetos('patrimonio_historico');
  if (existentes.find(p => p.mes === meses)) {
    console.log(`Snapshot de ${meses} ya existe, salteando.`);
    return;
  }

  // Calcular cash por cuenta
  const movimientos = hojaAObjetos('movimientos');
  const cuentas = hojaAObjetos('cuentas').filter(c => c.activa);

  const calcularSaldo = (cuenta, moneda) => {
    let saldo = 0;
    movimientos.forEach(mv => {
      // Solo movimientos hasta el fin del mes del snapshot
      if (mv.fecha > `${meses}-31`) return;
      if (mv.moneda !== moneda) return;
      if (mv.tipo === 'ingreso' && mv.cuenta_destino === cuenta) saldo += Number(mv.monto);
      if (mv.tipo === 'gasto' && (mv.medio_pago === cuenta || mv.cuenta_origen === cuenta)) saldo -= Number(mv.monto);
      if (mv.tipo === 'transferencia') {
        if (mv.cuenta_destino === cuenta) saldo += Number(mv.monto);
        if (mv.cuenta_origen === cuenta) saldo -= Number(mv.monto);
      }
    });
    return saldo;
  };

  let cashArs = 0;
  let cashUsd = 0;
  let usdColchon = 0;

  cuentas.forEach(c => {
    const saldo = calcularSaldo(c.nombre, c.moneda_default);
    if (c.nombre === 'USD billete colchón') {
      usdColchon += saldo;
    } else if (c.moneda_default === 'ARS') {
      cashArs += saldo;
    } else if (c.moneda_default === 'USD') {
      cashUsd += saldo;
    }
  });

  // Inversiones: última valuación del mes o anterior
  const valuaciones = hojaAObjetos('inversiones_valuaciones')
    .filter(v => v.mes <= meses)
    .sort((a, b) => b.mes.localeCompare(a.mes));
  const ultimoMesValuacion = valuaciones.length > 0 ? valuaciones[0].mes : null;
  const inversionesUsd = ultimoMesValuacion
    ? valuaciones.filter(v => v.mes === ultimoMesValuacion).reduce((s, v) => s + Number(v.valor_total_usd || 0), 0)
    : 0;

  const cotizacionUsada = cotizacion ? cotizacion.promedio : 0;
  const cashUsdEquiv = cashUsd + (cotizacionUsada > 0 ? cashArs / cotizacionUsada : 0);
  const patrimonioTotalUsd = cashUsdEquiv + usdColchon + inversionesUsd;

  hoja.appendRow([
    generarUUID(),
    meses,
    hoy(),
    Math.round(cashArs),
    Math.round(cashUsd * 100) / 100,
    Math.round(inversionesUsd * 100) / 100,
    Math.round(usdColchon * 100) / 100,
    Math.round(patrimonioTotalUsd * 100) / 100,
    cotizacionUsada
  ]);

  console.log(`Snapshot ${meses}: U$S ${Math.round(patrimonioTotalUsd).toLocaleString()}`);
}

/**
 * Devuelve la serie histórica de patrimonio para el gráfico de evolución.
 */
function getPatrimonioHistoricoData() {
  const historico = hojaAObjetos('patrimonio_historico')
    .sort((a, b) => a.mes.localeCompare(b.mes));

  return {
    ok: true,
    serie: historico.map(h => ({
      mes: h.mes,
      patrimonio_total_usd: Number(h.patrimonio_total_usd),
      cash_ars: Number(h.cash_ars),
      cash_usd: Number(h.cash_usd),
      inversiones_usd: Number(h.inversiones_valor_usd),
      cotizacion_mep: Number(h.cotizacion_mep_usada)
    }))
  };
}

function mesAnterior_() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return Utilities.formatDate(d, 'America/Argentina/Buenos_Aires', 'yyyy-MM');
}
