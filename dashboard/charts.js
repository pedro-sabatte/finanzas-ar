// ============================================================
// dashboard/charts.js — Helpers de Chart.js (patrimonio + donut + histórico)
// ============================================================

const DONUT_COLORS = [
  '#0B1220', // ink — Comida (mayor)
  '#16A36A', // peso — Vivienda
  '#2C5BEC', // dolar — Transporte
  '#DC2A2A', // alert — Entretenimiento
  '#6B5BD2', // conjunto — OQU
  '#8A93A2', // ink-3 — Otros
];

let patrimonioChartInstance = null;
let donutChartInstance = null;
let historicoChartInstance = null;

/**
 * Dibuja el sparkline de patrimonio en el canvas #patrimonioChart.
 * @param {Array} serie - [{ mes, patrimonio_total_usd }]
 */
function dibujarPatrimonioChart(serie) {
  const canvas = document.getElementById('patrimonioChart');
  if (!canvas || serie.length < 2) return;

  if (patrimonioChartInstance) patrimonioChartInstance.destroy();

  const labels = serie.map(s => s.mes.substring(5)); // MM
  const data   = serie.map(s => s.patrimonio_total_usd);

  patrimonioChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: '#2C5BEC',
        borderWidth: 1.5,
        fill: true,
        backgroundColor: 'rgba(44,91,236,0.06)',
        pointRadius: (ctx) => ctx.dataIndex === data.length - 1 ? 3 : 0,
        pointBackgroundColor: '#2C5BEC',
        tension: 0.3,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        callbacks: {
          label: ctx => 'U$S ' + ctx.parsed.y.toLocaleString('en-US', { maximumFractionDigits: 0 })
        }
      }},
      scales: {
        x: { display: false },
        y: { display: false }
      },
      animation: { duration: 400 }
    }
  });
}

/**
 * Dibuja el donut de gastos por categoría en #donutChart.
 * @param {Array} categorias - [{ categoria, usd_equiv }]
 */
function dibujarDonutChart(categorias) {
  const canvas = document.getElementById('donutChart');
  if (!canvas || categorias.length === 0) return;

  if (donutChartInstance) donutChartInstance.destroy();

  const top6 = categorias.slice(0, 6);
  const total = top6.reduce((s, c) => s + c.usd_equiv, 0);

  donutChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: top6.map(c => c.categoria),
      datasets: [{
        data: top6.map(c => c.usd_equiv),
        backgroundColor: DONUT_COLORS.slice(0, top6.length),
        borderWidth: 0,
        hoverOffset: 4,
      }]
    },
    options: {
      responsive: false,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const pct = Math.round((ctx.parsed / total) * 100);
              return `${ctx.label}: ${pct}%`;
            }
          }
        }
      },
      animation: { duration: 300 }
    }
  });
}

/**
 * Dibuja el gráfico de barras histórico en #historicoChart.
 * @param {Array} serie - [{ mes, patrimonio_total_usd }]
 * @param {Array} resumenMeses - [{ mes, ingresos_usd, gastos_usd, ahorro_usd }] (opcional)
 */
function dibujarHistoricoChart(serie) {
  const canvas = document.getElementById('historicoChart');
  if (!canvas || serie.length === 0) return;

  if (historicoChartInstance) historicoChartInstance.destroy();

  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const labels = serie.map(s => meses[parseInt(s.mes.split('-')[1]) - 1] + ' ' + s.mes.split('-')[0].slice(2));

  historicoChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Patrimonio U$S',
        data: serie.map(s => s.patrimonio_total_usd),
        borderColor: '#2C5BEC',
        backgroundColor: 'rgba(44,91,236,0.08)',
        fill: true,
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.3,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => 'U$S ' + ctx.parsed.y.toLocaleString('en-US', { maximumFractionDigits: 0 })
          }
        }
      },
      scales: {
        y: {
          ticks: {
            callback: v => 'U$S ' + (v / 1000).toFixed(0) + 'K',
            font: { size: 11, family: 'Inter' },
            color: '#8A93A2',
          },
          grid: { color: 'rgba(11,18,32,0.06)' }
        },
        x: {
          ticks: { font: { size: 11, family: 'Inter' }, color: '#8A93A2' },
          grid: { display: false }
        }
      },
      animation: { duration: 400 }
    }
  });
}
