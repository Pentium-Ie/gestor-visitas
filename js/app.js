document.addEventListener('DOMContentLoaded', () => {
  const viewLogin = document.getElementById('view-login');
  const viewDashboard = document.getElementById('view-dashboard');
  const formLogin = document.getElementById('form-login');
  const loginError = document.getElementById('login-error');
  const btnLogout = document.getElementById('btn-logout');
  const togglePassword = document.getElementById('toggle-password');
  const passwordInput = document.getElementById('password');
  const btnThemeToggle = document.getElementById('btn-theme-toggle');

  togglePassword?.addEventListener('click', () => {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    togglePassword.innerHTML = type === 'password' ? ICONS.eyeOpen : ICONS.eyeClosed;
    togglePassword.setAttribute('aria-label', type === 'password' ? 'Mostrar contraseña' : 'Ocultar contraseña');
  });

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    if (btnThemeToggle) {
      btnThemeToggle.innerHTML = theme === 'light' ? ICONS.sun : ICONS.moon;
      btnThemeToggle.setAttribute('aria-label', theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
    }
  }

  const savedTheme = localStorage.getItem('theme') || 'dark';
  setTheme(savedTheme);

  btnThemeToggle?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'light' ? 'dark' : 'light');
  });

  const navLinks = document.querySelectorAll('.nav-link');
  const workspacePanels = document.querySelectorAll('.workspace-panel');

  const systemHeader = document.querySelector('.system-header');
  const workspaceContainer = document.querySelector('.workspace-container');

  viewLogin.classList.add('fade-in');

  function aplicarReflejoCristal(card, angle, travelRatio) {
    card.style.setProperty('--light-deg', `${angle + 90}deg`);
    card.style.setProperty('--light-pos-min', `${travelRatio - 45}%`);
    card.style.setProperty('--light-pos-edge', `${travelRatio - 15}%`);
    card.style.setProperty('--light-pos-peak', `${travelRatio}%`);
    card.style.setProperty('--light-pos-edge2', `${travelRatio + 15}%`);
    card.style.setProperty('--light-pos-max', `${travelRatio + 45}%`);
  }

  let reflejoTicking = false;
  document.addEventListener('mousemove', (e) => {
    if (!reflejoTicking) {
      window.requestAnimationFrame(() => {
        const visibleCards = document.querySelectorAll('.glass-card:not(.hidden-section), .toast-container .toast');
        visibleCards.forEach(card => {
          const rect = card.getBoundingClientRect();
          const angle = Math.atan2(e.clientY - (rect.top + rect.height / 2), e.clientX - (rect.left + rect.width / 2)) * (180 / Math.PI);
          const travelRatio = (Math.sqrt(Math.pow(e.clientX - (rect.left + rect.width / 2), 2) + Math.pow(e.clientY - (rect.top + rect.height / 2), 2)) / Math.sqrt(window.innerWidth**2 + window.innerHeight**2)) * 130;
          aplicarReflejoCristal(card, angle, travelRatio);
        });
        reflejoTicking = false;
      });
      reflejoTicking = true;
    }
  });

  if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', (e) => {
      let x = e.gamma; let y = e.beta;
      if (x === null || y === null) return;
      if (y > 40) y = (y - 70) * 1.8;
      const angle = Math.atan2(y, x) * (180 / Math.PI);
      const travelRatioClamped = Math.max(5, Math.min(50 + (x * 0.8) + (y * 0.5), 95));
      const visibleCards = document.querySelectorAll('.glass-card:not(.hidden-section)');
      visibleCards.forEach(card => aplicarReflejoCristal(card, angle, travelRatioClamped));
    });
  }

  function solicitarPermisoSensores() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().catch(console.error);
    }
  }

  function showSection(targetId) {
    navLinks.forEach(l => l.classList.remove('active'));
    const link = document.querySelector('.nav-link[data-target="' + targetId + '"]');
    if (link) link.classList.add('active');
    workspacePanels.forEach(panel => panel.classList.add('hidden-section'));
    const target = document.getElementById(targetId);
    if (target) target.classList.remove('hidden-section');
    if (targetId === 'sec-historial') window.AppState.historial.loadHistorial();
    if (targetId === 'sec-registro') window.AppState.registro.renderVisitors();
    if (targetId === 'sec-programacion') window.AppState.programacion.renderProgramadas();
    if (targetId === 'sec-admin') window.AppState.admin.loadAdmin();
  }

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      showSection(link.getAttribute('data-target'));
    });
  });

  async function entrarAlSistema() {
    viewLogin.classList.remove('fade-in');
    viewLogin.classList.add('fade-out');
    setTimeout(() => {
      viewLogin.classList.add('hidden');
      viewDashboard.classList.remove('hidden');
      window.AppState.registro.renderVisitors();
      window.AppState.programacion.renderProgramadas();
      workspacePanels.forEach(panel => panel.classList.add('hidden-section'));
      const registroPanel = document.getElementById('sec-registro');
      if (registroPanel) registroPanel.classList.remove('hidden-section');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          systemHeader.classList.add('animate-header');
          setTimeout(() => {
            workspaceContainer.classList.add('animate-workspace');
          }, 1200);
        });
      });
    }, 1000);
  }

  async function verificarBloqueoLogin(email) {
    const key = `loginBlockedUntil_${email}`;
    const blocked = localStorage.getItem(key);
    if (blocked && Date.now() < parseInt(blocked, 10)) {
      const restante = Math.ceil((parseInt(blocked, 10) - Date.now()) / 60000);
      loginError.textContent = `Demasiados intentos. Intente de nuevo en ${restante} minuto(s).`;
      return true;
    }
    if (blocked) localStorage.removeItem(key);
    return false;
  }

  function registrarIntentoFallido(email) {
    const countKey = `loginAttempts_${email}`;
    const blockKey = `loginBlockedUntil_${email}`;
    let attempts = parseInt(localStorage.getItem(countKey) || '0', 10) + 1;
    localStorage.setItem(countKey, String(attempts));
    if (attempts >= 4) {
      localStorage.setItem(blockKey, String(Date.now() + 15 * 60 * 1000));
      localStorage.removeItem(countKey);
      logError('warn', `Login bloqueado para ${email} tras 4 intentos fallidos`);
    }
  }

  function limpiarIntentosLogin(email) {
    localStorage.removeItem(`loginAttempts_${email}`);
    localStorage.removeItem(`loginBlockedUntil_${email}`);
  }

  function verificarReLoginDiario() {
    const sessionStarted = localStorage.getItem('sessionStartedAt');
    if (!sessionStarted) return false;
    const lima = getLimaNow();
    const hora = lima.getHours();
    const fechaSession = sessionStarted.slice(0, 10);
    const hoy = getLimaDateStr();
    if (hora >= 8 && fechaSession < hoy) {
      logError('info', 'Sesión expirada por re-login diario (8 AM Lima)');
      return true;
    }
    return false;
  }

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    solicitarPermisoSensores();

    const email = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    if (!email || !password) {
      loginError.textContent = "Complete todos los campos.";
      return;
    }

    if (await verificarBloqueoLogin(email)) return;

    toggleLoading(true);
    disableButton(formLogin.querySelector('.btn-submit'), 'Ingresando...');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const userId = await getCurrentUserId();
      const { data: perfil } = await supabase.from('perfiles').select('rol, activo').eq('id', userId).limit(1).single();
      if (!perfil || !perfil.activo) {
        await supabase.auth.signOut();
        loginError.textContent = "Su cuenta no tiene un perfil activo. Contacte al administrador.";
        toggleLoading(false);
        enableButton(formLogin.querySelector('.btn-submit'));
        return;
      }
      limpiarIntentosLogin(email);
      localStorage.setItem('sessionStartedAt', new Date().toISOString());
      loginError.textContent = "";
      entrarAlSistema();
    } catch (err) {
      console.error('Login error:', err);
      registrarIntentoFallido(email);
      loginError.textContent = err.message || "Usuario o contraseña incorrectos.";
      logError('error', 'Login fallido', err.message);
    } finally {
      toggleLoading(false);
      enableButton(formLogin.querySelector('.btn-submit'));
    }
  });

  btnLogout.addEventListener('click', async () => {
    await supabase.auth.signOut().catch(() => {});
    viewDashboard.classList.add('hidden');
    systemHeader.classList.remove('animate-header');
    workspaceContainer.classList.remove('animate-workspace');
    workspacePanels.forEach(panel => panel.classList.add('hidden-section'));
    viewLogin.classList.remove('fade-out');
    viewLogin.classList.add('fade-in');
    viewLogin.classList.remove('hidden');
    formLogin.reset();
    loginError.textContent = "";
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay[aria-active="true"]').forEach(modal => {
        cerrarModal(modal);
      });
    }
  });

  window.AppState = window.AppState || {};
  window.AppState.showSection = showSection;

  (async () => {
    if (verificarReLoginDiario()) {
      await supabase.auth.signOut().catch(() => {});
      localStorage.removeItem('sb-access-token');
      localStorage.removeItem('sb-refresh-token');
      localStorage.removeItem('sessionStartedAt');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (session) entrarAlSistema();
  })();
});
