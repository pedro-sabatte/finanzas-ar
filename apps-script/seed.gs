// ============================================================
// seed.gs — Setup inicial: crea hojas, headers y datos de catálogo
// ============================================================

/**
 * Ejecutar manualmente UNA VEZ desde el editor de Apps Script, ANTES de empezar a cargar datos.
 * Crea todas las hojas con sus headers y pre-carga: cuentas, tarjetas, categorías, meta de largo plazo.
 */
function setup() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert(
    '⚠️ Setup inicial',
    'Este proceso crea todas las hojas de datos. Si ya existen hojas con datos, NO las elimina. ¿Continuar?',
    ui.ButtonSet.YES_NO
  );
  if (resp !== ui.Button.YES) return;

  crearHojas_();
  seedCuentas_();
  seedTarjetas_();
  seedCategorias_();
  seedObjetivos_();

  ui.alert('✓ Setup completado. Ahora ejecutá setupTriggers() para instalar los triggers automáticos.');
  console.log('Setup completado correctamente.');
}

// ----- Definición de hojas y sus headers -----

const HOJAS_CONFIG = {
  movimientos: [
    'id', 'fecha', 'tipo', 'titulo', 'monto', 'moneda', 'monto_usd_equiv', 'cotizacion_usada',
    'categoria', 'descripcion', 'quien_gasto', 'medio_pago', 'cuenta_origen', 'cuenta_destino',
    'cuotas_total', 'cuotas_numero', 'es_recurrente_id', 'reintegro_de_movimiento_id',
    'cargado_por', 'id_cliente', 'timestamp_carga'
  ],
  cuotas: [
    'id', 'movimiento_id', 'numero_cuota', 'total_cuotas', 'monto_cuota', 'moneda',
    'monto_usd_equiv', 'tarjeta_id', 'fecha_estimada_pago', 'pagada'
  ],
  inversiones_compras: [
    'id', 'fecha', 'activo_ticker', 'activo_nombre', 'cantidad', 'precio_unitario', 'moneda',
    'plataforma', 'cuenta_que_pago', 'tipo_operacion', 'comision', 'notas', 'id_cliente', 'timestamp_carga'
  ],
  inversiones_valuaciones: [
    'id', 'mes', 'activo_ticker', 'plataforma', 'cantidad_actual', 'precio_cierre', 'moneda',
    'valor_total', 'cotizacion_mep_cierre', 'valor_total_usd'
  ],
  recurrentes: [
    'id', 'nombre', 'monto', 'moneda', 'monto_variable', 'frecuencia', 'dia_cobro',
    'mes_cobro', 'tarjeta_default', 'categoria', 'activa', 'fecha_inicio', 'fecha_fin'
  ],
  cuentas: ['id', 'nombre', 'tipo', 'moneda_default', 'titular', 'activa'],
  tarjetas: ['id', 'nombre', 'banco', 'marca', 'tipo', 'extension_juani', 'dia_cierre', 'dia_vencimiento', 'activa'],
  categorias: ['id', 'nombre', 'tipo', 'activa'],
  objetivos: ['id', 'mes', 'tipo', 'monto_objetivo', 'moneda', 'monto_actual', 'descripcion'],
  cotizaciones: ['fecha', 'tipo', 'compra', 'venta', 'promedio', 'timestamp_fetch'],
  patrimonio_historico: [
    'id', 'mes', 'fecha_snapshot', 'cash_ars', 'cash_usd', 'inversiones_valor_usd',
    'usd_colchon', 'patrimonio_total_usd', 'cotizacion_mep_usada'
  ]
};

function crearHojas_() {
  const ss = getSpreadsheet();

  Object.entries(HOJAS_CONFIG).forEach(([nombre, headers]) => {
    let hoja = ss.getSheetByName(nombre);
    if (!hoja) {
      hoja = ss.insertSheet(nombre);
      console.log(`Hoja creada: ${nombre}`);
    } else {
      console.log(`Hoja ya existe: ${nombre} — respetando datos`);
    }

    // Solo agregar headers si la hoja está vacía
    if (hoja.getLastRow() === 0) {
      hoja.appendRow(headers);
      // Formatear header row
      const headerRange = hoja.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#0B1220');
      headerRange.setFontColor('#FFFFFF');
      hoja.setFrozenRows(1);
    }
  });

  // Eliminar la hoja por defecto "Hoja 1" si existe y está vacía
  const hojaDefault = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (hojaDefault && hojaDefault.getLastRow() <= 1) {
    ss.deleteSheet(hojaDefault);
  }
}

// ----- Seed: Cuentas -----
function seedCuentas_() {
  const hoja = getHoja('cuentas');
  if (hoja.getLastRow() > 1) { console.log('cuentas: ya tiene datos, salteando'); return; }

  const cuentas = [
    ['Mercado Pago ARS', 'fintech',   'ARS', 'Pedro',    true],
    ['Santander ARS',    'banco',     'ARS', 'Pedro',    true],
    ['Macro ARS',        'banco',     'ARS', 'Pedro',    true],
    ['ICBC ARS',         'banco',     'ARS', 'Pedro',    true],
    ['Macro USD',        'banco',     'USD', 'Pedro',    true],
    ['Santander USD',    'banco',     'USD', 'Pedro',    true],
    ['ARQ USD',          'broker',    'USD', 'Pedro',    true],
    ['Inviu USD',        'broker',    'USD', 'Pedro',    true],
    ['Efectivo ARS',     'efectivo',  'ARS', 'Conjunto', true],
    ['USD billete colchón', 'efectivo', 'USD', 'Conjunto', true],
  ];
  cuentas.forEach(c => hoja.appendRow([generarUUID(), ...c]));
  console.log(`Seed cuentas: ${cuentas.length} cuentas cargadas.`);
}

// ----- Seed: Tarjetas -----
function seedTarjetas_() {
  const hoja = getHoja('tarjetas');
  if (hoja.getLastRow() > 1) { console.log('tarjetas: ya tiene datos, salteando'); return; }

  // [nombre, banco, marca, tipo, extension_juani, dia_cierre, dia_vencimiento, activa]
  const tarjetas = [
    ['Macro Selecta Visa',        'Macro',     'Visa',       'Crédito', true,  '', '', true],
    ['Macro Selecta Amex',        'Macro',     'Amex',       'Crédito', true,  '', '', true],
    ['Santander Platinum Visa',   'Santander', 'Visa',       'Crédito', false, '', '', true],
    ['Santander Platinum Amex',   'Santander', 'Amex',       'Crédito', false, '', '', true],
    ['Mercado Pago Crédito',      'MP',        'Mastercard', 'Crédito', false, '', '', true],
    ['Mercado Pago Débito',       'MP',        'Mastercard', 'Débito',  false, '', '', true],
    ['ARQ',                       'ARQ',       '—',          'Débito',  false, '', '', true],
  ];
  tarjetas.forEach(t => hoja.appendRow([generarUUID(), ...t]));
  console.log(`Seed tarjetas: ${tarjetas.length} tarjetas cargadas. Completá dia_cierre y dia_vencimiento en la Sheet.`);
}

// ----- Seed: Categorías -----
function seedCategorias_() {
  const hoja = getHoja('categorias');
  if (hoja.getLastRow() > 1) { console.log('categorias: ya tiene datos, salteando'); return; }

  const gastos = [
    'Comida', 'Transporte', 'Vivienda', 'Salud', 'Entretenimiento',
    'Compras personales', 'Viajes', 'Educación', 'Impuestos', 'Suscripciones digitales',
    'Deporte', 'OQU', 'Compra inmuebles', 'Compras extraordinarias', 'Regalos', 'Otros'
  ];
  const ingresos = [
    'Sueldo principal', 'Sueldo Juani', 'Freelance / honorarios', 'Sueldo USD (ARQ)',
    'Rendimientos de inversiones', 'Reintegros / cashback', 'Regalos / ayuda familiar', 'Bono'
  ];

  gastos.forEach(nombre => hoja.appendRow([generarUUID(), nombre, 'gasto', true]));
  ingresos.forEach(nombre => hoja.appendRow([generarUUID(), nombre, 'ingreso', true]));
  console.log(`Seed categorías: ${gastos.length} de gasto + ${ingresos.length} de ingreso.`);
}

// ----- Seed: Objetivos -----
function seedObjetivos_() {
  const hoja = getHoja('objetivos');
  if (hoja.getLastRow() > 1) { console.log('objetivos: ya tiene datos, salteando'); return; }

  // Meta de largo plazo — monto y fecha se completan manualmente después
  hoja.appendRow([
    generarUUID(),
    'long_term',
    'meta_largo_plazo',
    0,             // monto_objetivo — completar manualmente
    'USD',
    0,
    'Terreno + construcción de casa (crédito hipotecario)'
  ]);
  console.log('Seed objetivos: meta de largo plazo cargada. Completá el monto objetivo en la Sheet.');
}
