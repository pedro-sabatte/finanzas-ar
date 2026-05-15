// ============================================================
// form/app.js — Lógica Alpine.js del Form PWA
// ============================================================

function formApp() {
  return {
    // ---- Estado general ----
    persona: 'Pedro',
    saludo: '',
    modo: 'gasto',        // 'gasto' | 'ingreso' | 'interno'
    subModo: 'Transferencia',
    loading: false,
    errorMsg: '',
    dropdownAbierto: '',
    campoFocused: '',
    mostrarMasCampos: false,

    // ---- Tabs ----
    tabs: [
      { id: 'gasto',   label: 'Gasto' },
      { id: 'ingreso', label: 'Ingreso' },
      { id: 'interno', label: 'Mov. interno' },
    ],

    // ---- Catálogos cargados desde la API ----
    catalogos: {
      categorias_gasto: [
        'Comida','Transporte','Vivienda','Salud','Entretenimiento',
        'Compras personales','Viajes','Educación','Impuestos',
        'Suscripciones digitales','Deporte','OQU','Regalos','Otros'
      ],
      categorias_ingreso: [
        'Sueldo Pedro','Sueldo Juani','Freelance / honorarios',
        'Sueldo USD (ARQ)','Rendimientos de inversiones',
        'Reintegros / cashback','Regalos / ayuda familiar','Bono'
      ],
      cuentas: [],
      tarjetas: [],
      recurrentes: []
    },

    // ---- Últimos movimientos ----
    ultimosMovimientos: [],

    // ---- Recurrentes pendientes de monto ----
    recurrentesPendientes: [],

    // ---- Formulario ----
    form: {},

    // ---- Toast ----
    toast: { visible: false, msg: '', timer: null },

    // ---- Último movimiento guardado (para deshacer) ----
    ultimoGuardado: null,

    // ============================================================
    // INIT
    // ============================================================
    async init() {
      this.actualizarSaludo();
      this.persona = localStorage.getItem('persona') || 'Pedro';
      this.resetForm();
      await Promise.all([
        this.cargarCatalogos(),
        this.cargarUltimosMovimientos(),
        this.cargarRecurrentesPendientes()
      ]);
    },

    actualizarSaludo() {
      const h = new Date().getHours();
      if (h >= 6 && h < 13)  this.saludo = 'Buen día';
      else if (h >= 13 && h < 20) this.saludo = 'Buenas tardes';
      else this.saludo = 'Buenas noches';
    },

    setPersona(p) {
      this.persona = p;
      localStorage.setItem('persona', p);
    },

    // ============================================================
    // CATÁLOGOS
    // ============================================================
    async cargarCatalogos() {
      try {
        const data = await api.get('catalogos');
        if (data.ok) {
          this.catalogos.cuentas = data.cuentas || [];
          this.catalogos.tarjetas = data.tarjetas || [];
          this.catalogos.recurrentes = data.recurrentes || [];
          // Extraer categorías del catálogo si viene de la API
          if (data.categorias) {
            this.catalogos.categorias_gasto = data.categorias.filter(c => c.tipo === 'gasto').map(c => c.nombre);
            this.catalogos.categorias_ingreso = data.categorias.filter(c => c.tipo === 'ingreso').map(c => c.nombre);
          }
        }
      } catch (e) {
        // Usar los defaults hardcodeados si no hay conexión
        console.warn('No se pudo cargar catálogos, usando defaults');
      }
    },

    async cargarUltimosMovimientos() {
      try {
        const data = await api.get('ultimos_movimientos', { limit: 10 });
        if (data.ok) this.ultimosMovimientos = data.movimientos || [];
      } catch (e) {
        console.warn('No se pudo cargar últimos movimientos');
      }
    },

    async cargarRecurrentesPendientes() {
      try {
        const data = await api.get('cierre_pendiente');
        if (data.ok && data.pendiente) {
          this.recurrentesPendientes = data.pendiente.recurrentes_variables_sin_monto || [];
        }
      } catch (e) {
        // Silencioso — no crítico
      }
    },

    // ============================================================
    // FORM
    // ============================================================
    resetForm() {
      this.form = {
        titulo: '',
        monto: '',
        moneda: 'ARS',
        categoria: '',
        medio_pago: '',
        cuenta_origen: '',
        cuenta_destino: '',
        quien_gasto: 'Conjunto',
        cuotas_total: 1,
        descripcion: '',
        reintegro_de_movimiento_id: '',
        activo_ticker: '',
        cantidad: '',
        plataforma: 'ARQ',
      };
      this.mostrarMasCampos = false;
      this.dropdownAbierto = '';
      this.errorMsg = '';
    },

    labelGuardar() {
      if (this.modo === 'gasto')   return 'Guardar gasto';
      if (this.modo === 'ingreso') return 'Guardar ingreso';
      return 'Guardar movimiento';
    },

    toggleDropdown(nombre) {
      this.dropdownAbierto = this.dropdownAbierto === nombre ? '' : nombre;
    },

    // ============================================================
    // GUARDAR
    // ============================================================
    async guardar() {
      if (!this.form.monto || this.loading) return;
      this.loading = true;
      this.errorMsg = '';

      try {
        const payload = this.armarPayload();
        const data = await api.post('crear_movimiento', payload);

        if (!data.ok) throw new Error(data.message || 'Error al guardar');

        this.ultimoGuardado = { id_creado: data.id_creado, payload };
        this.mostrarToast(`Cargado ✓  ${this.form.moneda === 'ARS' ? '$' : 'U$S'} ${this.formatMonto(this.form.monto, this.form.moneda)}`);

        // Actualizar lista de últimos movimientos sin hacer fetch
        this.ultimosMovimientos.unshift({
          id: data.id_creado,
          titulo: payload.titulo || payload.categoria,
          categoria: payload.categoria,
          medio_pago: payload.medio_pago,
          monto: payload.monto,
          moneda: payload.moneda,
          tipo: payload.tipo,
          quien_gasto: payload.quien_gasto,
        });
        this.ultimosMovimientos = this.ultimosMovimientos.slice(0, 10);

        this.resetForm();

      } catch (err) {
        this.errorMsg = err.message || 'Error al guardar. Revisá la conexión.';
      } finally {
        this.loading = false;
      }
    },

    armarPayload() {
      const idCliente = 'form_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

      if (this.modo === 'gasto') {
        return {
          tipo: 'gasto',
          titulo: this.form.titulo,
          monto: parseFloat(this.form.monto),
          moneda: this.form.moneda,
          categoria: this.form.categoria,
          medio_pago: this.form.medio_pago,
          quien_gasto: this.form.quien_gasto,
          cuotas_total: this.form.cuotas_total,
          descripcion: this.form.descripcion,
          reintegro_de_movimiento_id: this.form.reintegro_de_movimiento_id,
          cargado_por: this.persona,
          id_cliente: idCliente,
        };
      }

      if (this.modo === 'ingreso') {
        return {
          tipo: 'ingreso',
          titulo: this.form.titulo,
          monto: parseFloat(this.form.monto),
          moneda: this.form.moneda,
          categoria: this.form.categoria,
          cuenta_destino: this.form.cuenta_destino,
          quien_gasto: this.persona,
          cargado_por: this.persona,
          id_cliente: idCliente,
        };
      }

      if (this.modo === 'interno') {
        if (this.subModo === 'Transferencia') {
          return {
            tipo: 'transferencia',
            titulo: this.form.titulo || 'Transferencia',
            monto: parseFloat(this.form.monto),
            moneda: this.form.moneda,
            cuenta_origen: this.form.cuenta_origen,
            cuenta_destino: this.form.cuenta_destino,
            cargado_por: this.persona,
            id_cliente: idCliente,
          };
        } else {
          return {
            tipo: this.subModo === 'Compra activo' ? 'inversion_compra' : 'inversion_venta',
            titulo: this.form.titulo || `${this.subModo} ${this.form.activo_ticker}`,
            monto: parseFloat(this.form.monto),
            moneda: this.form.moneda,
            activo_ticker: this.form.activo_ticker?.toUpperCase(),
            cantidad: parseFloat(this.form.cantidad),
            plataforma: this.form.plataforma,
            cuenta_origen: this.form.cuenta_origen,
            cargado_por: this.persona,
            id_cliente: idCliente,
          };
        }
      }
    },

    // ============================================================
    // TOAST + DESHACER
    // ============================================================
    mostrarToast(msg) {
      if (this.toast.timer) clearTimeout(this.toast.timer);
      this.toast.msg = msg;
      this.toast.visible = true;
      this.toast.timer = setTimeout(() => { this.toast.visible = false; }, 3500);
    },

    async deshacer() {
      if (!this.ultimoGuardado) return;
      this.toast.visible = false;
      if (this.toast.timer) clearTimeout(this.toast.timer);
      // TODO: implementar endpoint delete_movimiento en Apps Script para deshacer
      // Por ahora solo oculta el toast
      console.log('Deshacer — movimiento:', this.ultimoGuardado.id_creado);
      this.ultimoGuardado = null;
    },

    // ============================================================
    // DUPLICAR
    // ============================================================
    duplicar(mv) {
      this.modo = mv.tipo === 'ingreso' ? 'ingreso' : 'gasto';
      this.resetForm();
      this.$nextTick(() => {
        this.form.titulo   = mv.titulo || '';
        this.form.moneda   = mv.moneda || 'ARS';
        this.form.categoria = mv.categoria || '';
        this.form.medio_pago = mv.medio_pago || '';
        this.form.quien_gasto = mv.quien_gasto || 'Conjunto';
        // No copiar el monto — usuario lo edita
      });
    },

    // ============================================================
    // PRE-CARGAR RECURRENTE
    // ============================================================
    precargarRecurrente(rec) {
      this.modo = 'gasto';
      this.resetForm();
      this.$nextTick(() => {
        this.form.titulo = rec.nombre;
        this.form.moneda = rec.moneda || 'ARS';
        this.form.categoria = rec.categoria || '';
        this.form.medio_pago = rec.tarjeta_default || '';
        this.mostrarMasCampos = false;
        // Foco en el monto
        this.$refs.montoInput?.focus();
      });
    },

    // ============================================================
    // HELPERS DE PRESENTACIÓN
    // ============================================================
    personaColor(persona) {
      if (persona === 'Pedro')   return '#2C5BEC';
      if (persona === 'Juani')   return '#E26A77';
      return '#6B5BD2'; // Conjunto
    },

    formatMonto(monto, moneda) {
      if (!monto) return '0';
      const num = parseFloat(monto);
      if (moneda === 'USD') {
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      return num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    },
  };
}
