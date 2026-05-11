// ============================================================
// triggers.gs — Instalar y gestionar todos los triggers automáticos
// ============================================================

/**
 * Ejecutar esta función UNA VEZ manualmente desde el editor de Apps Script.
 * Instala todos los triggers automáticos del sistema.
 *
 * IMPORTANTE: Antes de ejecutar, asegurate de haber publicado el Web App
 * y configurado las propiedades del script (API_TOKEN, BACKUP_FOLDER_ID).
 */
function setupTriggers() {
  // Eliminar todos los triggers existentes para no duplicar
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  console.log(`Eliminados ${triggers.length} triggers previos.`);

  // 1. Cotización MEP — todos los días a las 9am Argentina
  ScriptApp.newTrigger('triggerCotizacionDiaria')
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .inTimezone('America/Argentina/Buenos_Aires')
    .create();

  // 2. Generar recurrentes — día 1 de cada mes a las 6am
  ScriptApp.newTrigger('triggerRecurrentesMensuales')
    .timeBased()
    .onMonthDay(1)
    .atHour(6)
    .inTimezone('America/Argentina/Buenos_Aires')
    .create();

  // 3. Snapshot patrimonial — día 1 de cada mes a las 7am
  ScriptApp.newTrigger('triggerSnapshotPatrimonio')
    .timeBased()
    .onMonthDay(1)
    .atHour(7)
    .inTimezone('America/Argentina/Buenos_Aires')
    .create();

  // 4. Backup semanal — domingos a las 3am
  ScriptApp.newTrigger('triggerBackupSemanal')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(3)
    .inTimezone('America/Argentina/Buenos_Aires')
    .create();

  const nuevos = ScriptApp.getProjectTriggers();
  console.log(`✓ ${nuevos.length} triggers instalados:`);
  nuevos.forEach(t => console.log(`  - ${t.getHandlerFunction()} (${t.getEventType()})`));
}

// ----- Funciones que ejecutan los triggers -----

function triggerCotizacionDiaria() {
  console.log('Trigger: actualizando cotizaciones...');
  fetchTodasLasCotizaciones();
}

function triggerRecurrentesMensuales() {
  console.log('Trigger: generando movimientos recurrentes del mes...');
  generarRecurrentesDelMes();
}

function triggerSnapshotPatrimonio() {
  console.log('Trigger: tomando snapshot patrimonial...');
  snapshotPatrimonioMensual();
}

function triggerBackupSemanal() {
  console.log('Trigger: ejecutando backup semanal...');
  backupSemanal();
}

// ----- Generación de recurrentes mensuales -----

/**
 * Día 1 de cada mes: crea movimientos para todos los recurrentes activos mensuales.
 * Recurrentes con monto fijo → movimiento completo.
 * Recurrentes con monto variable → movimiento con monto vacío, marcado como pendiente.
 */
function generarRecurrentesDelMes() {
  const mesActualStr = mesActual();
  const recurrentes = hojaAObjetos('recurrentes').filter(r => {
    if (!r.activa) return false;
    if (r.frecuencia === 'mensual') return true;
    if (r.frecuencia === 'anual') {
      // Verificar si el mes_cobro coincide con el mes actual
      const mesActualNum = parseInt(mesActualStr.split('-')[1]);
      return Number(r.mes_cobro) === mesActualNum;
    }
    return false;
  });

  const movimientosExistentes = hojaAObjetos('movimientos')
    .filter(mv => (mv.fecha || '').startsWith(mesActualStr) && mv.es_recurrente_id);
  const idsYaGenerados = movimientosExistentes.map(mv => mv.es_recurrente_id);

  let generados = 0;
  recurrentes.forEach(r => {
    // Idempotencia: no generar si ya existe movimiento de este recurrente este mes
    if (idsYaGenerados.includes(r.id)) return;

    const fechaPago = `${mesActualStr}-${String(r.dia_cobro || 1).padStart(2, '0')}`;
    const hoja = getHoja('movimientos');
    const cotizacion = getCotizacionHoy();
    const monto = r.monto_variable ? null : Number(r.monto);
    const usdEquiv = monto && !r.monto_variable
      ? (r.moneda === 'USD' ? monto : (cotizacion ? monto / cotizacion.promedio : null))
      : null;

    hoja.appendRow([
      generarUUID(),
      fechaPago,
      'gasto',
      r.nombre,
      monto || '',           // monto vacío si es variable
      r.moneda,
      usdEquiv || '',
      cotizacion ? cotizacion.promedio : '',
      r.categoria || '',
      r.monto_variable ? 'PENDIENTE: cargar monto' : '',
      'Conjunto',
      r.tarjeta_default || '',
      '',                    // cuenta_origen
      '',                    // cuenta_destino
      1,                     // cuotas_total
      1,                     // cuotas_numero
      r.id,                  // es_recurrente_id
      '',                    // reintegro_de_movimiento_id
      'Sistema',             // cargado_por
      '',                    // id_cliente
      new Date()
    ]);
    generados++;
  });

  console.log(`Recurrentes: ${generados} movimientos generados para ${mesActualStr}`);
}

/**
 * Muestra los triggers activos en los logs. Útil para debuggear.
 */
function listarTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  console.log(`Triggers activos: ${triggers.length}`);
  triggers.forEach(t => {
    console.log(`  ${t.getHandlerFunction()} — ${t.getEventType()} — ID: ${t.getUniqueId()}`);
  });
}
