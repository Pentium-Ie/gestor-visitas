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
      const userIds = [...new Set((data || []).map(r => r.creado_por).filter(Boolean))];
      let emailMap = {};
      if (userIds.length > 0) {
        const { data: emails } = await supabase.rpc('fn_get_users_info', { user_ids: userIds });
        if (emails) emails.forEach(u => emailMap[u.id] = u.email);
      }
      renderLog(data || [], emailMap);
    } catch (err) {
      console.error('Error cargando log:', err);
      logError('error', 'Error cargando log de auditoría', err.message);
      adminContent.innerHTML = '<h3>Log de Auditoría</h3><p class="empty-state">Error al cargar.</p>';
    } finally {
      toggleLoading(false);
    }
  }

  function renderLog(rows, emailMap) {
    let html = '<h3>Log de Auditoría</h3>';
    if (rows.length === 0) {
      html += '<p class="empty-state">No hay eventos registrados.</p>';
    } else {
      html += '<div class="historial-table-wrapper"><table class="historial-table"><thead><tr>' +
        '<th scope="col">Fecha/Hora</th><th scope="col">Evento</th><th scope="col">Visitante</th>' +
        '<th scope="col">Documento</th><th scope="col">Anfitrión</th><th scope="col">Usuario</th>' +
        '</tr></thead><tbody>';
      rows.forEach(r => {
        const d = new Date(r.fecha);
        const fechaStr = d.toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' });
        const horaStr = d.toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit' });
        const userEmail = r.creado_por ? (emailMap[r.creado_por] || r.creado_por.substring(0, 8) + '…') : '—';
        html += `<tr>
          <td>${fechaStr}<br><span class="hora">${horaStr}</span></td>
          <td><span class="estado-badge estado-${r.estado.toLowerCase().replace(/[^a-záéíóú]/g,'')}">${escapeHtml(r.estado)}</span></td>
          <td>${escapeHtml(r.nombre)}</td>
          <td>${escapeHtml(r.tipo_doc)}: ${escapeHtml(r.num_doc)}</td>
          <td>${escapeHtml(r.anfitrion_nombre)}</td>
          <td style="font-size:0.8rem;color:var(--text-muted)">${escapeHtml(userEmail)}</td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    }

    const errorLogs = JSON.parse(localStorage.getItem('appLogs') || '[]');
    if (errorLogs.length > 0) {
      html += '<h3 style="margin-top:28px">Log de Errores</h3>';
      html += '<div class="historial-table-wrapper"><table class="historial-table"><thead><tr>' +
        '<th scope="col">Fecha/Hora</th><th scope="col">Nivel</th><th scope="col">Mensaje</th><th scope="col">Detalle</th>' +
        '</tr></thead><tbody>';
      errorLogs.slice(0, 100).forEach(r => {
        const d = new Date(r.fecha);
        const fechaStr = d.toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' });
        const horaStr = d.toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit' });
        const nivelClass = r.nivel === 'error' ? 'estado-salida' : r.nivel === 'warn' ? 'estado-cancelada' : 'estado-ingreso';
        html += `<tr>
          <td>${fechaStr}<br><span class="hora">${horaStr}</span></td>
          <td><span class="estado-badge ${nivelClass}">${escapeHtml(r.nivel)}</span></td>
          <td>${escapeHtml(r.mensaje)}</td>
          <td style="font-size:0.78rem;color:var(--text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(r.detalle)}">${escapeHtml(r.detalle)}</td>
        </tr>`;
      });
      html += '</tbody></table></div>';
      html += '<button id="clear-error-logs" class="btn-secondary" style="margin-top:8px;padding:6px 14px;border-radius:6px;border:1px solid var(--icon-btn-border);background:transparent;color:var(--text-muted);cursor:pointer">Limpiar Log de Errores</button>';
    }

    adminContent.innerHTML = html;

    const clearBtn = document.getElementById('clear-error-logs');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        localStorage.removeItem('appLogs');
        loadLog();
        mostrarToast('Log de errores limpiado.');
      });
    }
  }

  window.AppState = window.AppState || {};
  window.AppState.admin = { loadLog };
})();
