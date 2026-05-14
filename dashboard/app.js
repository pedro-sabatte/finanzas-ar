// ============================================================
// dashboard/app.js — Lógica Alpine.js del Dashboard
// ============================================================

function dashApp() {
  return {
    // ---- Navegación ----
    vistaActual: 'inicio',
    navTabs: [
      { id: 'inicio',      label: 'Inicio' },
      { id: 'inversiones', label: 'Inversiones' },
      { id: 'movimientos', label: 'Movimientos' },
      { id: 'historico',   label: 'Histórico' },
    ],

    // ---- Estado ----
    loading: false,
    mesActual: '',
    filtro: 'Conjunto',     // Conjunto / Pedro / Juani
    filtroMov: 'todos',
    mostrarTodasTarjetas: false,
    historicoLoaded: false,

    // ---- Datos ----
    tarjeta: null,
    resumen: null,
    compromiso: null,
    patrimonio: null,
    patrimonioVar: null,
    meta: null,
    vencimientos: [],
    gastosCat: [],
    alertas: [],
    ultimosMov: [],
    todosLosMov: [],
    inversiones: [],
    historicoSerie: [],
    mostrarBannerCierre: false,

    // Shortcut
    fmt,

    // ============================================================
    async init() {
      this.mesActual = fmt.mesActualStr();
      this.verificarBannerCierre();
      await this.cargarTodo();
    },

    verificarBannerCierre() {
      const hoy = new Date();
      const diasEnElMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
      this.mostrarBannerCierre = hoy.getDate() >= diasEnElMes - 4;
    },

    // ============================================================
    // CARGA DE DATOS (en paralelo donde es posible)
    // ============================================================
    async cargarTodo() {
      this.loading = true;
      try {
        await Promise.all([
          this.cargarTarjeta(),
          this.cargarResumen(),
          this.cargarPatrimonio(),
          this.cargarVencimientos(),
          this.cargarGastosCat(),
          this.cargarAlertas(),
          this.cargarUltimosMovimientos(),
        ]);
      } finally {
        this.loading = false;
        // Dibujar gráficos después de que Alpine renderice el DOM
        this.$nextTick(() => {
          if (this.historicoSerie.length > 1) dibujarPatrimonioChart(this.historicoSerie);
          if (this.gastosCat.length > 0) dibujarDonutChart(this.gastosCat);
        });
      }
    },

    async refrescar() {
      await this.cargarTodo();
    },

    async cargarTarjeta() {
      try {
        const data = await api.get('tarjeta_del_dia');
        if (data.ok) this.tarjeta = data;
      } catch(e) {}
    },

    async cargarResumen() {
      try {
        const [resumen, compromiso] = await Promise.all([
          api.get('dashboard_resumen', { mes: this.mesActual }),
          api.get('compromiso_mes', { mes: this.mesActual }),
        ]);
        if (resumen.ok) this.resumen = resumen;
        if (compromiso.ok) this.compromiso = compromiso;
      } catch(e) {}
    },

    async cargarPatrimonio() {
      try {
        const [pat, hist, meta] = await Promise.all([
          api.get('patrimonio_total'),
          api.get('patrimonio_historico'),
          api.get('meta_largo_plazo'),
        ]);
        if (pat.ok) this.patrimonio = pat;
        if (hist.ok) {
          this.historicoSerie = hist.serie || [];
          // Calcular variación vs mes anterior
          if (this.historicoSerie.length >= 2) {
            const last   = this.historicoSerie[this.historicoSerie.length - 1];
            const prev   = this.historicoSerie[this.historicoSerie.length - 2];
            if (prev.patrimonio_total_usd > 0) {
              this.patrimonioVar = ((last.patrimonio_total_usd - prev.patrimonio_total_usd) / prev.patrimonio_total_usd) * 100;
            }
          }
        }
        if (meta.ok && meta.metas?.length > 0) this.meta = meta.metas[0];
      } catch(e) {}
    },

    async cargarVencimientos() {
      try {
        const data = await api.get('proximos_vencimientos', { dias: 30 });
        if (data.ok) this.vencimientos = data.vencimientos || [];
      } catch(e) {}
    },

    async cargarGastosCat() {
      try {
        const data = await api.get('gastos_por_categoria', { mes: this.mesActual });
        if (data.ok) {
          this.gastosCat = data.categorias || [];
          this.$nextTick(() => dibujarDonutChart(this.gastosCat));
        }
      } catch(e) {}
    },

    async cargarAlertas() {
      try {
        const data = await api.get('alertas_anomalias', { mes: this.mesActual });
        if (data.ok) this.alertas = data.alertas || [];
      } catch(e) {}
    },

    async cargarUltimosMovimientos() {
      try {
        const data = await api.get('ultimos_movimientos', { limit: 20 });
        if (data.ok) {
          this.todosLosMov = data.movimientos || [];
          this.ultimosMov  = this.todosLosMov.slice(0, 5);
        }
      } catch(e) {}
    },

    // ============================================================
    // VISTAS LAZY
    // ============================================================
    async onVistaChange(vista) {
      if (vista === 'inversiones' && this.inversiones.length === 0) {
        await this.cargarInversiones();
      }
      if (vista === 'historico' && !this.historicoLoaded) {
        this.$nextTick(() => {
          if (this.historicoSerie.length > 0) {
            dibujarHistoricoChart(this.historicoSerie);
            this.historicoLoaded = true;
          }
        });
      }
    },

    async cargarInversiones() {
      try {
        const data = await api.get('catalogos');
        if (!data.ok) return;
        // Reconstruir posiciones desde inversiones_compras + última valuación
        const compras = data.inversiones_compras || [];
        const valuaciones = data.inversiones_valuaciones || [];
        const posiciones = {};
        compras.forEach(c => {
          const key = `${c.activo_ticker}__${c.plataforma}`;
          if (!posiciones[key]) posiciones[key] = { key, activo_ticker: c.activo_ticker, plataforma: c.plataforma, cantidad: 0, moneda: c.moneda };
          if (c.tipo_operacion === 'compra') posiciones[key].cantidad += Number(c.cantidad);
          if (c.tipo_operacion === 'venta')  posiciones[key].cantidad -= Number(c.cantidad);
        });
        // Agregar datos de valuación más reciente
        const ultimoMes = valuaciones.length > 0 ? valuaciones.sort((a,b) => b.mes.localeCompare(a.mes))[0].mes : null;
        if (ultimoMes) {
          valuaciones.filter(v => v.mes === ultimoMes).forEach(v => {
            const key = `${v.activo_ticker}__${v.plataforma}`;
            if (posiciones[key]) {
              posiciones[key].precio_cierre = v.precio_cierre;
              posiciones[key].valor_total_usd = v.valor_total_usd;
            }
          });
        }
        this.inversiones = Object.values(posiciones).filter(p => p.cantidad > 0);
      } catch(e) {}
    },

    // ============================================================
    // HELPERS DE PRESENTACIÓN
    // ============================================================
    fechaHoy() {
      const d = new Date();
      const dias = ['dom','lun','mar','mié','jue','vie','sáb'];
      const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
      return `${dias[d.getDay()]} ${d.getDate()} ${meses[d.getMonth()]}`;
    },

    ahorroOk() {
      if (!this.resumen || !this.resumen.objetivos?.ahorro_ars) return null;
      const ahorroArs = (this.resumen.ahorro?.usd_equiv || 0) * (this.resumen.cotizacion_mep || 1200);
      return ahorroArs >= this.resumen.objetivos.ahorro_ars;
    },

    ahorroColor() {
      const ok = this.ahorroOk();
      if (ok === null) return 'var(--ink)';
      return ok ? 'var(--positive)' : 'var(--alert)';
    },

    metaPct() {
      if (!this.patrimonio || !this.meta || !this.meta.monto_objetivo) return 0;
      const pct = (this.patrimonio.patrimonio_total_usd / this.meta.monto_objetivo) * 100;
      return Math.min(100, Math.round(pct));
    },

    catPct(cat) {
      const total = this.gastosCat.reduce((s, c) => s + c.usd_equiv, 0);
      if (!total) return 0;
      return Math.round((cat.usd_equiv / total) * 100);
    },

    donutColor(i) {
      const colors = ['#0B1220','#16A36A','#2C5BEC','#DC2A2A','#6B5BD2','#8A93A2'];
      return colors[i % colors.length];
    },

    esMuyProximo(fechaStr) {
      const hoy = new Date();
      const fecha = new Date(fechaStr + 'T00:00:00');
      const diff = (fecha - hoy) / (1000 * 60 * 60 * 24);
      return diff <= 3;
    },
  };
}

// Watcher para cargar datos al cambiar de vista
document.addEventListener('alpine:init', () => {
  Alpine.effect(() => {
    // Se ejecuta cuando Alpine está listo
  });
});
