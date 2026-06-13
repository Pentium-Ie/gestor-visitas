(function() {
  const adminContent = document.querySelector('#sec-admin .glass-content');
  
  async function loadLog() {
    if (!adminContent) return;
    toggleLoading(true);
    try {
      const { data, error } = await supabase
        .from('historial')
        .select('*')
        .order('fecha', { ascending: false })
        .limit(500);
      if (error) throw error;
      renderLog(data || []);
    } catch (err) {
      console.error('Error cargando log:', err);
      adminContent.innerHTML = '<h3>Log de Auditoría</h3><p class="empty-state">Error al cargar.</p>';
    } finally {
      toggleLoading(false);
    }
  }

  function renderLog(rows) {
    let html = '<h3>Log de Auditoría</h3>';
    if (rows.length === 0) {
      html += '<p class="empty-state">No hay eventos registrados.</p>';
      adminContent.innerHTML = html;
      return;
    }
    html += '<div class="historial-table-wrapper"><table class="historial-table"><thead><tr>' +
      '<th scope="col">Fecha/Hora</th><th scope="col">Evento</th><th scope="col">Visitante</th>' +
      '<th scope="col">Documento</th><th scope="col">Anfitrión</th><th scope="col">Usuario</th>' +
      '</tr></thead><tbody>';
    rows.forEach(r => {
      const d = new Date(r.fecha);
      const fechaStr = d.toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' });
      const horaStr = d.toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit' });
      html += `<tr>
        <td>${fechaStr}<br><span class="hora">${horaStr}</span></td>
        <td><span class="estado-badge estado-${r.estado.toLowerCase().replace(/[^a-záéíóú]/g,'')}">${escapeHtml(r.estado)}</span></td>
        <td>${escapeHtml(r.nombre)}</td>
        <td>${escapeHtml(r.tipo_doc)}: ${escapeHtml(r.num_doc)}</td>
        <td>${escapeHtml(r.anfitrion_nombre)}</td>
        <td style="font-size:0.75rem;font-family:monospace;color:var(--text-muted)">${r.creado_por ? r.creado_por.substring(0, 8) + '…' : '—'}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    adminContent.innerHTML = html;
  }

  window.AppState = window.AppState || {};
  window.AppState.admin = { loadLog };
})();
