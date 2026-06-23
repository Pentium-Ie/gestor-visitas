(function() {
  const adminKPIs = document.getElementById('admin-kpis');
  const adminLogSection = document.getElementById('admin-log-section');
  const adminErrorSection = document.getElementById('admin-error-section');
  let chartDistribucion = null;
  let chartEvolucion = null;

  const CHART_COLORS = ['#5ddb8a','#ffc832','#5dade2','#bb8fce','#f1948a','#85c1e9','#f7dc6f','#82e0aa','#f0b27a','#a3e4d7','#d2b4de','#aed6f1','#f9e79f','#a9dfbf','#fadbd8'];

  async function ensureChartJS() {
    if (typeof Chart !== 'undefined') return true;
    const urls = ['https://cdn.jsdelivr.net/npm/chart.js', 'https://unpkg.com/chart.js/dist/chart.umd.min.js'];
    for (const url of urls) {
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = url;
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
        if (typeof Chart !== 'undefined') return true;
      } catch {}
    }
    return false;
  }

  async function loadAdmin() {
    toggleLoading(true);
    try {
      const chartReady = await ensureChartJS();
      if (!chartReady) logError('warn', 'Chart.js no disponible, gráficos omitidos');
      window.__chartReady = chartReady;
      await Promise.all([loadKPIs(), loadCharts(), loadLog()]);
    } catch (err) {
      logError('error', 'Error cargando panel admin', err.message);
      if (adminKPIs) adminKPIs.innerHTML = '<p class="empty-state">Error al cargar KPIs.</p>';
    } finally {
      toggleLoading(false);
    }
  }

  async function loadKPIs() {
    if (!adminKPIs) return;
    const c = getLimaComponents();
    const pad = (n) => String(n).padStart(2, '0');
    const todayStart = c.year + '-' + pad(c.month) + '-' + pad(c.day) + 'T05:00:00Z';
    const nextDay = new Date(c.year, c.month - 1, c.day);
    nextDay.setDate(nextDay.getDate() + 1);
    const todayEnd = nextDay.getFullYear() + '-' + pad(nextDay.getMonth() + 1) + '-' + pad(nextDay.getDate()) + 'T05:00:00Z';

    const [{ data: visitasHoy }, { data: retirados }, { data: allVisits }, { data: progData }] = await Promise.all([
      supabase.from('visitas').select('estado').gte('fecha_ingreso', todayStart).lt('fecha_ingreso', todayEnd),
      supabase.from('visitas').select('fecha_ingreso, fecha_salida').eq('estado', 'Retirado').not('fecha_salida', 'is', null).not('fecha_ingreso', 'is', null),
      supabase.from('visitas').select('anfitrion_id, anfitriones!inner(nombre)').in('estado', ['Ingresado', 'Retirado']),
      supabase.from('visitas').select('estado').not('fecha_programada', 'is', null).neq('estado', 'Cancelado')
    ]);

    const totalHoy = visitasHoy ? visitasHoy.length : 0;
    const enPlanta = visitasHoy ? visitasHoy.filter(v => v.estado === 'Ingresado').length : 0;

    let avgMin = 0;
    if (retirados && retirados.length > 0) {
      const totalMin = retirados.reduce((sum, v) => sum + (new Date(v.fecha_salida) - new Date(v.fecha_ingreso)) / 60000, 0);
      avgMin = Math.round(totalMin / retirados.length);
    }

    const hostCounts = {};
    if (allVisits) allVisits.forEach(v => { const name = v.anfitriones?.nombre || '—'; hostCounts[name] = (hostCounts[name] || 0) + 1; });
    const sortedHosts = Object.entries(hostCounts).sort((a, b) => b[1] - a[1]);
    const topHost = sortedHosts[0] || null;

    const totalProg = progData ? progData.length : 0;
    const ingresaronProg = progData ? progData.filter(v => v.estado === 'Ingresado' || v.estado === 'Retirado').length : 0;
    const tasaConversion = totalProg > 0 ? Math.round(ingresaronProg * 100 / totalProg) : 0;

    adminKPIs.innerHTML = `
      <div class="kpi-card">
        <div class="kpi-value">${totalHoy}</div>
        <div class="kpi-label">Visitas Hoy</div>
        <div class="kpi-sub">${enPlanta} en planta</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${avgMin}<span class="kpi-unit">min</span></div>
        <div class="kpi-label">Tiempo Promedio</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value kpi-value-sm">${topHost ? escapeHtml(topHost[0]) : '—'}</div>
        <div class="kpi-label">Top Anfitrión</div>
        <div class="kpi-sub">${topHost ? topHost[1] + ' visitas' : ''}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${tasaConversion}<span class="kpi-unit">%</span></div>
        <div class="kpi-label">Conversión Programados</div>
        <div class="kpi-sub">${ingresaronProg}/${totalProg}</div>
      </div>
    `;
  }

  async function loadCharts() {
    if (chartDistribucion) { chartDistribucion.destroy(); chartDistribucion = null; }
    if (chartEvolucion) { chartEvolucion.destroy(); chartEvolucion = null; }
    if (!window.__chartReady) return;

    try {
      const c = getLimaComponents();
      const [{ data: distData }, { data: evoData }] = await Promise.all([
        supabase.from('visitas').select('anfitrion_id, anfitriones!inner(nombre)').in('estado', ['Ingresado', 'Retirado']),
        supabase.from('visitas').select('fecha_ingreso').not('fecha_ingreso', 'is', null).gte('fecha_ingreso', new Date(c.year, c.month - 12, 1).toISOString())
      ]);

      const hostCounts = {};
      if (distData) distData.forEach(v => { const name = v.anfitriones?.nombre || 'Desconocido'; hostCounts[name] = (hostCounts[name] || 0) + 1; });
      const distLabels = Object.keys(hostCounts);
      const distValues = Object.values(hostCounts);

      const monthCounts = {};
      if (evoData) evoData.forEach(v => { const d = new Date(v.fecha_ingreso); const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); monthCounts[key] = (monthCounts[key] || 0) + 1; });
      const evoLabels = [];
      const evoValues = [];
      const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      for (let i = 11; i >= 0; i--) {
        const m = new Date(c.year, c.month - 1 - i, 1);
        const key = m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0');
        evoLabels.push(meses[m.getMonth()] + ' ' + m.getFullYear());
        evoValues.push(monthCounts[key] || 0);
      }

      const style = getComputedStyle(document.documentElement);
      const textColor = style.getPropertyValue('--text-muted').trim() || 'rgba(255,255,255,0.45)';
      const gridColor = style.getPropertyValue('--border-subtle').trim() || 'rgba(255,255,255,0.05)';

      const ctx1 = document.getElementById('chart-distribucion');
      if (ctx1 && distLabels.length > 0) {
        chartDistribucion = new Chart(ctx1, {
          type: 'doughnut',
          data: { labels: distLabels, datasets: [{ data: distValues, backgroundColor: CHART_COLORS.slice(0, distLabels.length), borderWidth: 0 }] },
          options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom', labels: { color: textColor, padding: 12, font: { size: 11 } } } } }
        });
      }

      const ctx2 = document.getElementById('chart-evolucion');
      if (ctx2 && evoLabels.length > 0) {
        chartEvolucion = new Chart(ctx2, {
          type: 'line',
          data: { labels: evoLabels, datasets: [{ label: 'Visitas', data: evoValues, borderColor: '#5ddb8a', backgroundColor: 'rgba(93,219,138,0.1)', fill: true, tension: 0.3, pointRadius: 3, pointBackgroundColor: '#5ddb8a' }] },
          options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } }, y: { ticks: { color: textColor, font: { size: 10 }, stepSize: 1 }, grid: { color: gridColor } } } }
        });
      }
    } catch (err) {
      logError('error', 'Error cargando gráficos admin', err.message);
    }
  }

  async function loadLog() {
    if (!adminLogSection) return;
    try {
      const { data, error } = await supabase.from('historial').select('*').order('fecha', { ascending: false }).limit(500);
      if (error) throw error;
      const userIds = [...new Set((data || []).map(r => r.creado_por).filter(Boolean))];
      let emailMap = {};
      if (userIds.length > 0) {
        const { data: emails } = await supabase.rpc('fn_get_users_info', { user_ids: userIds });
        if (emails) emails.forEach(u => emailMap[u.id] = u.email);
      }
      renderLog(data || [], emailMap);
    } catch (err) {
      logError('error', 'Error cargando log de auditoría', err.message);
      adminLogSection.innerHTML = '<h3 style="margin-top:28px">Log de Auditoría</h3><p class="empty-state">Error al cargar.</p>';
    }
  }

  function renderLog(rows, emailMap) {
    let html = '<h3 style="margin-top:28px">Log de Auditoría</h3>';
    if (rows.length === 0) {
      html += '<p class="empty-state">No hay eventos registrados.</p>';
    } else {
      html += '<div class="historial-table-wrapper" style="max-height:400px"><table class="historial-table"><thead><tr>' +
        '<th scope="col" style="width:18%">Fecha/Hora</th><th scope="col" style="width:14%">Evento</th><th scope="col" style="width:22%">Visitante</th>' +
        '<th scope="col" style="width:16%">Documento</th><th scope="col" style="width:16%">Anfitrión</th><th scope="col" style="width:14%">Usuario</th>' +
        '</tr></thead><tbody>';
      rows.forEach(r => {
        const d = new Date(r.fecha);
        const fechaStr = d.toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' });
        const horaStr = d.toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit' });
        const userEmail = r.creado_por ? (emailMap[r.creado_por] || r.creado_por.substring(0, 8) + '…') : '—';
        const estadoClean = r.estado.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
        html += '<tr><td>' + fechaStr + '<br><span class="hora">' + horaStr + '</span></td><td><span class="estado-badge estado-' + estadoClean + '">' + escapeHtml(r.estado) + '</span></td><td>' + escapeHtml(r.nombre) + '</td><td>' + escapeHtml(r.tipo_doc) + ': ' + escapeHtml(r.num_doc) + '</td><td>' + escapeHtml(r.anfitrion_nombre) + '</td><td style="font-size:0.8rem;color:var(--text-muted)">' + escapeHtml(userEmail) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }
    adminLogSection.innerHTML = html;
    renderErrorLogs();
  }

  function renderErrorLogs() {
    if (!adminErrorSection) return;
    const errorLogs = JSON.parse(localStorage.getItem('appLogs') || '[]');
    let html = '';
    if (errorLogs.length > 0) {
      html += '<h3 style="margin-top:28px">Log de Errores</h3>';
      html += '<div class="historial-table-wrapper" style="max-height:300px"><table class="historial-table"><thead><tr>' +
        '<th scope="col" style="width:18%">Fecha/Hora</th><th scope="col" style="width:10%">Nivel</th><th scope="col" style="width:32%">Mensaje</th><th scope="col">Detalle</th>' +
        '</tr></thead><tbody>';
      errorLogs.slice(0, 100).forEach(r => {
        const d = new Date(r.fecha);
        const fechaStr = d.toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' });
        const horaStr = d.toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit' });
        const nivelClass = r.nivel === 'error' ? 'estado-retirado' : r.nivel === 'warn' ? 'estado-cancelado' : 'estado-ingresado';
        html += '<tr><td>' + fechaStr + '<br><span class="hora">' + horaStr + '</span></td><td><span class="estado-badge ' + nivelClass + '">' + escapeHtml(r.nivel) + '</span></td><td>' + escapeHtml(r.mensaje) + '</td><td style="font-size:0.78rem;color:var(--text-muted);max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escapeHtml(r.detalle) + '">' + escapeHtml(r.detalle) + '</td></tr>';
      });
      html += '</tbody></table></div>';
      html += '<button id="clear-error-logs" class="btn-secondary" style="margin-top:8px;padding:6px 14px;border-radius:6px;border:1px solid var(--icon-btn-border);background:transparent;color:var(--text-muted);cursor:pointer">Limpiar Log de Errores</button>';
    }
    adminErrorSection.innerHTML = html;

    const clearBtn = document.getElementById('clear-error-logs');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        localStorage.removeItem('appLogs');
        renderErrorLogs();
        mostrarToast('Log de errores limpiado.');
      });
    }
  }

  window.AppState = window.AppState || {};
  window.AppState.admin = { loadAdmin };
})();
