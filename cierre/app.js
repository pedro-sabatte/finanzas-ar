// ============================================================
// cierre/app.js — Lógica Alpine.js del Wizard de Cierre Mensual
// ============================================================

function cierreApp() {
  return {
    paso: 1,
    loading: false,
    toast: '',
    confirmado: false,

    // Mes que se cierra (auto-detectado: el mes anterior si estamos en los últimos 5 días, o el actual)
    mes: '',

    // Datos cargados desde la API
    activos: [],       // [{ key, activo_ticker, plataforma, cantidad, moneda, precio_cierre }]
    pagos: [],         // [{ id, titulo, sub, monto, moneda, pagado, tipo }]
    resumen: null,     // getDashboardResumen del mes
    cotizacion: null,  // MEP del día

    // Objetivos para el mes siguiente
    objetivos: { ahorro_ars: '', ahorro_usd: '', tope_gasto: '', pct_ingreso: '' },

    // Shortcut a fmt
    fmt,

    // ============================================================
    async init() {
      this.mes = this.detectarMes();
      // Primero resumen (cotizacion depende de él)
      await this.cargarResumen();
      await Promise.all([
        this.cargarActivos(),
        this.cargarPagos(),
        this.cargarCotizacion(),
      ]);
    },

    // Detecta qué mes cerrar:
    // Últimos 5 días del mes → mes actual. El resto → mes anterior.
    detectarMes() {
      const hoy = new Date();
      const diasEnElMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
      if (hoy.getDate() >= diasEnElMes - 4) {
        return fmt.mesActualStr();
      }
      // Mes anterior
      const anterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      return `${anterior.getFullYear()}-${String(anterior.getMonth() + 1).padStart(2, '0')}`;
    },

    nombreMesSiguiente() {
      const [y, m] = this.mes.split('-').map(Number);
      const siguiente = new Date(y, m, 1); // m sin -1 porque Date usa 0-indexed
      const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      return meses[siguiente.getMonth()];
    },

    // ============================================================
    // CARGA DE DATOS
    // ============================================================
    async cargarActivos() {
      try {
        const data = await api.get('catalogos');
        if (!data.ok) return;
        // Reconstruir posiciones actuales desde inversiones
        const compras = data.inversiones_compras || [];
        const posiciones = {};
        compras.forEach(c => {
          const key = `${c.activo_ticker}__${c.plataforma}`;
          if (!posiciones[key]) {
            posiciones[key] = { key, activo_ticker: c.activo_ticker,
              plataforma: c.plataforma, cantidad: 0, moneda: c.moneda, precio_cierre: '' };
          }
          if (c.tipo_operacion === 'compra') posiciones[key].cantidad += Number(c.cantidad);
          if (c.tipo_operacion === 'venta')  posiciones[key].cantidad -= Number(c.cantidad);
        });
        this.activos = Object.values(posiciones).filter(p => p.cantidad > 0);
      } catch(e) {
        // Sin conexión — activos vacíos, el usuario puede ingresar igual
      }
    },

    async cargarPagos() {
      try {
        // Cuotas del mes
        const venc = await api.get('proximos_vencimientos', { dias: 31 });
        if (venc.ok) {
          const cuotas = (venc.vencimientos || [])
            .filter(v => v.tipo === 'cuota' && v.fecha?.startsWith(this.mes))
            .map(v => ({
              id: v.id, tipo: 'cuota',
              titulo: v.nombre || 'Cuota',
              sub: `Vence ${fmt.fecha(v.fecha)}`,
              monto: v.monto, moneda: v.moneda || 'ARS',
              pagado: false,
            }));
          const recurrentes = (venc.vencimientos || [])
            .filter(v => v.tipo === 'recurrente' && v.fecha?.startsWith(this.mes))
            .map(v => ({
              id: `rec_${v.nombre}`, tipo: 'recurrente',
              titulo: v.nombre,
              sub: `Recurrente · vence ${fmt.fecha(v.fecha)}`,
              monto: v.monto, moneda: v.moneda || 'ARS',
              pagado: false,
            }));
          this.pagos = [...cuotas, ...recurrentes];
        }
      } catch(e) { /* sin conexión */ }
    },

    async cargarResumen() {
      try {
        const data = await api.get('dashboard_resumen', { mes: this.mes });
        if (data.ok) this.resumen = data;
      } catch(e) {}
    },

    async cargarCotizacion() {
      try {
        // Intentar leer del resumen
        if (this.resumen?.cotizacion_mep) {
          this.cotizacion = this.resumen.cotizacion_mep;
        }
      } catch(e) {}
    },

    // ============================================================
    // NAVEGACIÓN DEL WIZARD
    // ============================================================
    siguiente() {
      if (this.paso < 4) this.paso++;
      window.scrollTo(0, 0);
    },

    anterior() {
      if (this.paso > 1) this.paso--;
      window.scrollTo(0, 0);
    },

    togglePago(pago) {
      pago.pagado = !pago.pagado;
    },

    calcularTotal(activo) {
      const precio = parseFloat(activo.precio_cierre) || 0;
      const total = precio * activo.cantidad;
      return activo.moneda === 'USD'
        ? fmt.usd(total)
        : fmt.ars(total);
    },

    ahorroOk() {
      if (!this.resumen || !this.objetivos.ahorro_ars) return null;
      // ahorro.usd_equiv viene del backend; convertimos a ARS con la cotización disponible
      const ahorroUsd  = this.resumen.ahorro?.usd_equiv || 0;
      const cotiz      = this.cotizacion || this.resumen.cotizacion_mep || null;
      const ahorroArs  = cotiz ? ahorroUsd * cotiz : 0;
      return ahorroArs >= Number(this.objetivos.ahorro_ars);
    },

    // ============================================================
    // CONFIRMAR CIERRE (paso 4)
    // ============================================================
    async confirmarCierre() {
      this.loading = true;
      try {
        // Armar payload completo
        const valuaciones = this.activos
          .filter(a => a.precio_cierre)
          .map(a => ({
            activo_ticker: a.activo_ticker,
            plataforma: a.plataforma,
            cantidad_actual: a.cantidad,
            precio_cierre: parseFloat(a.precio_cierre),
            moneda: a.moneda,
          }));

        const cuotas_pagadas = this.pagos
          .filter(p => p.pagado && p.tipo === 'cuota')
          .map(p => p.id);

        const mesSiguiente = (() => {
          const [y, m] = this.mes.split('-').map(Number);
          const d = new Date(y, m, 1);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        })();

        const objetivos_proximo_mes = [];
        if (this.objetivos.ahorro_ars) objetivos_proximo_mes.push({ mes: mesSiguiente, tipo: 'ahorro_ars', monto_objetivo: Number(this.objetivos.ahorro_ars), moneda: 'ARS' });
        if (this.objetivos.ahorro_usd) objetivos_proximo_mes.push({ mes: mesSiguiente, tipo: 'ahorro_usd', monto_objetivo: Number(this.objetivos.ahorro_usd), moneda: 'USD' });
        if (this.objetivos.tope_gasto) objetivos_proximo_mes.push({ mes: mesSiguiente, tipo: 'tope_gasto', monto_objetivo: Number(this.objetivos.tope_gasto), moneda: 'ARS' });
        if (this.objetivos.pct_ingreso) objetivos_proximo_mes.push({ mes: mesSiguiente, tipo: 'pct_ingreso', monto_objetivo: Number(this.objetivos.pct_ingreso), moneda: 'PCT' });

        const data = await api.post('cierre_mensual', {
          mes: this.mes,
          valuaciones,
          cuotas_pagadas,
          objetivos_proximo_mes,
        });

        if (!data.ok) throw new Error(data.message);

        // Actualizar resumen con datos del cierre completo
        const resumenCierre = await api.get('resumen_cierre', { mes: this.mes });
        if (resumenCierre.ok) this.resumen = resumenCierre;
        this.confirmado = true;
        this.mostrarToast('✓ Cierre de ' + fmt.mes(this.mes) + ' completado');

      } catch(e) {
        this.mostrarToast('Error: ' + e.message);
      } finally {
        this.loading = false;
      }
    },

    mostrarToast(msg) {
      this.toast = msg;
      setTimeout(() => { this.toast = ''; }, 3500);
    },
  };
}
