// ============================================================
// tarjetas/app.js — Lógica Alpine.js del Tarjetas PWA
// ============================================================

function tarjetasApp() {
  return {
    // ── Estado ──────────────────────────────────────────────
    loading: true,
    tarjetas: [],
    activeIdx: 0,

    // Carousel touch
    dragStartX: 0,
    dragStartY: 0,
    dragOffset: 0,
    isDragging: false,
    dragDirection: null,   // 'h' | 'v' | null

    // Sheet consumos
    showMovs: false,
    sheetMovs: [],
    sheetTarjeta: null,

    // Sheet cerrar ciclo
    showCierreCiclo: false,
    cierreCicloTarjeta: null,
    cierreCicloForm: { saldo_ars: '', saldo_usd: '', fecha_cierre: '', proximo_cierre: '', proximo_vencimiento: '' },
    cierreCicloLoading: false,

    // ── Init ────────────────────────────────────────────────
    async init() {
      await this.cargar();
    },

    async cargar() {
      this.loading = true;
      try {
        const data = await api.get('resumen_tarjetas');
        if (data.ok) {
          // Solo tarjetas con dia_cierre configurado (las relevantes)
          this.tarjetas = (data.tarjetas || []).filter(t =>
            t.proximo_cierre || t.proximo_vencimiento
          );
        }
      } catch (e) {
        console.error('Error cargando tarjetas:', e);
      } finally {
        this.loading = false;
      }
    },

    get activeTarjeta() {
      return this.tarjetas[this.activeIdx] || null;
    },

    // ── Carousel ─────────────────────────────────────────────
    CARD_W: 272,
    CARD_GAP: 14,

    carouselStart(e) {
      const t = e.touches[0];
      this.dragStartX = t.clientX;
      this.dragStartY = t.clientY;
      this.dragOffset = 0;
      this.isDragging = true;
      this.dragDirection = null;
    },

    carouselMove(e) {
      if (!this.isDragging) return;
      const t = e.touches[0];
      const dx = t.clientX - this.dragStartX;
      const dy = t.clientY - this.dragStartY;

      if (this.dragDirection === null) {
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          this.dragDirection = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
        }
        return;
      }
      if (this.dragDirection === 'v') { this.isDragging = false; return; }

      e.preventDefault();
      // Resistencia en los extremos
      const max = this.CARD_W * 0.6;
      let d = dx;
      if ((dx > 0 && this.activeIdx === 0) || (dx < 0 && this.activeIdx === this.tarjetas.length - 1)) {
        d = dx * 0.25; // resistencia
      }
      this.dragOffset = Math.max(-max, Math.min(max, d));
    },

    carouselEnd() {
      if (!this.isDragging) return;
      this.isDragging = false;
      const threshold = 60;
      if (this.dragOffset < -threshold && this.activeIdx < this.tarjetas.length - 1) {
        this.activeIdx++;
      } else if (this.dragOffset > threshold && this.activeIdx > 0) {
        this.activeIdx--;
      }
      this.dragOffset = 0;
      this.dragDirection = null;
    },

    goTo(idx) {
      if (idx >= 0 && idx < this.tarjetas.length) {
        this.activeIdx = idx;
      }
    },

    // ── Sheet consumos ───────────────────────────────────────
    abrirMovimientos() {
      const t = this.activeTarjeta;
      if (!t) return;
      this.sheetTarjeta = t;
      this.sheetMovs = t.movimientos_ciclo || [];
      this.showMovs = true;
    },

    // ── Cerrar ciclo ─────────────────────────────────────────
    abrirCierreCiclo() {
      const t = this.activeTarjeta;
      if (!t) return;
      this.cierreCicloTarjeta = t;

      // Pre-fill: el cierre que acaba de pasar es el proximo_cierre actual
      const fechaCierre = t.proximo_cierre || this.hoy();

      // Estimar próximo cierre = +1 mes desde la fecha de cierre
      const dCierre = new Date(fechaCierre + 'T12:00:00-03:00');
      dCierre.setMonth(dCierre.getMonth() + 1);
      const proxCierre = dCierre.toISOString().substring(0, 10);

      // Estimar próximo vencimiento = +1 mes desde el vencimiento actual
      const fechaVenc = t.proximo_vencimiento;
      let proxVenc = '';
      if (fechaVenc) {
        const dVenc = new Date(fechaVenc + 'T12:00:00-03:00');
        dVenc.setMonth(dVenc.getMonth() + 1);
        proxVenc = dVenc.toISOString().substring(0, 10);
      }

      this.cierreCicloForm = {
        saldo_ars: '',
        saldo_usd: '',
        fecha_cierre: fechaCierre,
        proximo_cierre: proxCierre,
        proximo_vencimiento: proxVenc,
      };
      this.showCierreCiclo = true;
    },

    async confirmarCierreCiclo() {
      const t = this.cierreCicloTarjeta;
      if (!t || this.cierreCicloLoading) return;
      this.cierreCicloLoading = true;
      try {
        await api.post('actualizar_saldo_tarjeta', {
          id: t.id,
          saldo_pendiente_ars: parseFloat(this.cierreCicloForm.saldo_ars) || 0,
          saldo_pendiente_usd: parseFloat(this.cierreCicloForm.saldo_usd) || 0,
          ultimo_cierre:        this.cierreCicloForm.fecha_cierre,
          proximo_cierre:       this.cierreCicloForm.proximo_cierre,
          proximo_vencimiento:  this.cierreCicloForm.proximo_vencimiento,
        });
        this.showCierreCiclo = false;
        await this.cargar();
      } catch(e) {
        console.error('Error al cerrar ciclo:', e);
      } finally {
        this.cierreCicloLoading = false;
      }
    },

    async pagarUsd() {
      const t = this.activeTarjeta;
      if (!t) return;
      await api.post('actualizar_saldo_tarjeta', { id: t.id, saldo_pendiente_usd: 0 });
      await this.cargar();
    },

    async pagarArs() {
      const t = this.activeTarjeta;
      if (!t) return;
      await api.post('actualizar_saldo_tarjeta', { id: t.id, saldo_pendiente_ars: 0 });
      await this.cargar();
    },

    // ── Card theme ───────────────────────────────────────────
    cardTheme(t) {
      const isSantander = (t.banco || '').toLowerCase().includes('santander');
      return isSantander ? 'santander' : 'macro';
    },

    cardBg(t) {
      const theme = this.cardTheme(t);
      if (theme === 'santander') {
        return 'linear-gradient(135deg, #E6E4DE 0%, #BFBDB6 45%, #D8D5CE 80%, #A8A6A0 100%)';
      }
      return 'linear-gradient(135deg, #0E0E12 0%, #181820 60%, #0B0B10 100%)';
    },

    cardInk(t) {
      return this.cardTheme(t) === 'santander' ? '#1A1A1F' : '#FFFFFF';
    },

    cardSub(t) {
      return this.cardTheme(t) === 'santander'
        ? 'rgba(26,26,31,0.55)'
        : 'rgba(255,255,255,0.55)';
    },

    cardAccent(t) {
      return this.cardTheme(t) === 'santander' ? '#1A1A1F' : '#C9A961';
    },

    cardNetwork(t) {
      return (t.marca || '').toLowerCase().includes('amex') ? 'amex' : 'visa';
    },

    // ── Timeline ─────────────────────────────────────────────
    // Devuelve los 3 hitos en orden cronológico: [izq, centro, der]
    // Maneja el caso donde próx.cierre viene antes o después del vencimiento
    timelineAnchors(t) {
      const cierre = t.ultimo_cierre || this.estimarUltimoCierre(t);
      const venc   = t.proximo_vencimiento;
      const prox   = t.proximo_cierre;
      const toMs   = iso => new Date(iso + 'T12:00:00-03:00').getTime();
      const vencPrimero = venc && prox && toMs(venc) <= toMs(prox);
      return [
        { fecha: cierre, label: 'Cierre' },
        vencPrimero
          ? { fecha: venc,  label: 'Vencimiento' }
          : { fecha: prox,  label: 'Próx. cierre' },
        vencPrimero
          ? { fecha: prox,  label: 'Próx. cierre' }
          : { fecha: venc,  label: 'Vencimiento'  },
      ];
    },

    // Posición 0..1 del marcador usando el orden cronológico real
    timelinePos(t) {
      const [a, b, c] = this.timelineAnchors(t);
      if (!a.fecha || !b.fecha || !c.fecha) return 0;
      const toD = iso => new Date(iso + 'T12:00:00-03:00').getTime() / 86400000;
      const tA = toD(a.fecha), tB = toD(b.fecha), tC = toD(c.fecha);
      const tH = toD(this.hoy());
      let pos;
      if      (tH <= tA) pos = 0;
      else if (tH >= tC) pos = 1;
      else if (tH <= tB) pos = 0.5 * (tH - tA) / (tB - tA);
      else               pos = 0.5 + 0.5 * (tH - tB) / (tC - tB);
      return Math.max(0, Math.min(1, pos));
    },

    timelineLabel(t) {
      const venc      = t.proximo_vencimiento;
      const proxCierr = t.proximo_cierre;
      const diasV = t.dias_para_vencimiento;
      const diasC = t.dias_para_cierre;

      if (diasV === 0)                return { text: 'Hoy vence tu resumen', tone: 'alert' };
      if (diasV !== null && diasV > 0 && diasV <= 2)
                                      return { text: `Vence en ${diasV} día${diasV > 1 ? 's' : ''}`, tone: 'warning' };
      if (diasC !== null && diasC >= -2 && diasC < 0)
                                      return { text: 'Revisá el resumen del ciclo cerrado', tone: 'warning' };
      if (diasV !== null && diasV > 0) return { text: `Vence en ${diasV} días`, tone: 'ink' };
      if (diasC !== null && diasC > 0) return { text: `Próximo cierre en ${diasC} días`, tone: 'ink' };
      return { text: proxCierr ? `Próximo cierre ${this.fmtFecha(proxCierr)}` : '—', tone: 'ink' };
    },

    timelineToneColor(tone) {
      return { alert: 'var(--alert)', warning: 'var(--warning)', ink: 'var(--ink)' }[tone] || 'var(--ink)';
    },

    isVencimientoHoy(t) {
      return t.dias_para_vencimiento === 0;
    },

    estimarUltimoCierre(t) {
      if (!t.proximo_cierre) return null;
      const d = new Date(t.proximo_cierre + 'T12:00:00-03:00');
      d.setMonth(d.getMonth() - 1);
      return d.toISOString().substring(0, 10);
    },

    // ── Formatters ───────────────────────────────────────────
    hoy() {
      return new Date().toISOString().substring(0, 10);
    },

    fmtFecha(iso) {
      if (!iso) return '—';
      const [, m, d] = iso.split('-').map(Number);
      return `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}`;
    },

    fmtArs(n) {
      if (n == null) return '—';
      return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    fmtUsd(n) {
      if (n == null) return '—';
      return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    fechaHoy() {
      return new Date().toLocaleDateString('es-AR', {
        weekday: 'short', day: 'numeric', month: 'short'
      });
    },
  };
}
