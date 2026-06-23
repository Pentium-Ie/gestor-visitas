# Mejoras y Correcciones — Gestor de Visitas

## 2026-06-13 — Sesión 1

### Objetivo
Revisión crítica del código y corrección de bugs críticos + mejoras de UX/seguridad.

---

### 1. 🔴 Fix: `atob()` no soporta base64url en JWT

**Archivo:** `js/supabase-client.js`

**Problema:** `atob(token.split('.')[1])` falla si el JWT contiene caracteres base64url (`-`, `_`) en lugar de base64 estándar (`+`, `/`). Esto causa un `DOMException` silencioso en `getTokenExpiry()`.

**Solución:**
```js
function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return str;
}
```
- Se creó `base64UrlDecode()` que normaliza base64url → base64 antes de pasar a `atob`.
- Se agregó validación de `parts.length < 2` para tokens malformados.

---

### 2. 🔴 Fix: Doble clic en submit duplica registros

**Archivos:** `js/helpers.js`, `js/registro.js`, `js/programacion.js`

**Problema:** Si el usuario hace clic dos veces rápido en "Registrar Ingreso" o "Agendar Visita", se disparan dos INSERT idénticos antes de que el primero responda.

**Solución:**
- Nueva función `disableButton(btn, texto)` en helpers.js: deshabilita el botón y cambia el texto.
- Nueva función `enableButton(btn)` en helpers.js: restaura estado original.
- Aplicado a todos los submit handlers (`formRegistro`, `formProgramacion`) y botones de modal (`modalConfirm`, `detailCancelar`, `confirmOk`).
- El botón se deshabilita ANTES del primer `await` y se re-habilita en `finally`.

---

### 3. 🔴 Fix: `getSession()` no refresca token si access token expiró

**Archivo:** `js/supabase-client.js`

**Problema:** Si solo existía refresh token en localStorage pero el access token había expirado o sido removido, `getSession()` retornaba `{ session: null }` en vez de intentar refrescar.

**Solución:**
- `getSession()` ahora verifica si existe refresh token aunque no haya access token.
- Si hay refresh token, intenta `refreshSession()` antes de retornar null.
- Si el refresh falla, recién retorna `{ session: null }`.

---

### 4. 🟡 Safe area insets para iOS

**Archivos:** `index.html`, `css/variables.css`, `css/base.css`, `css/responsive.css`

**Problema:** En iPhone con notch y barra inferior, el contenido se superpone con los bordes del dispositivo.

**Solución:**
- Meta tags: `viewport-fit=cover`, `theme-color` con `prefers-color-scheme`, `apple-mobile-web-app-status-bar-style=black-translucent`.
- Variables CSS: `--safe-top`, `--safe-bottom`, `--safe-left`, `--safe-right` usando `env(safe-area-inset-*)`.
- `body` padding usa estas variables.
- En mobile breakpoint (768px), se suma `10px` extra al top padding.

---

### 5. 🟡 Overflow en móvil con layout absolute

**Archivo:** `css/responsive.css`

**Problema:** `body { overflow: hidden }` en desktop es correcto (paneles absolute dentro de container fixed), pero en mobile los paneles son `position: relative` y el viewport puede excederse en landscape/tablet.

**Solución:** Ya existía `body { overflow-y: auto }` en el breakpoint 768px. Se agregó padding con safe-area.

---

### 6. 🟡 Select global afectaba historial

**Archivos:** `css/components.css`, `css/historial.css`

**Problema:** `select { appearance: none; ... }` global sobreescribía el `<select id="historial-search-col">`, eliminando la flecha nativa y reemplazándola con una SVG embeddida que se ve pixelada en algunos DPI.

**Solución:** Scope reducido a `.grid-form select` (solo selects de formularios). El select de historial mantiene comportamiento nativo del navegador.

---

### 7. 🟠 Login lockout tras 4 intentos fallidos

**Archivo:** `js/app.js`

**Problema:** Sin límite de intentos de login, un atacante puede probar contraseñas indefinidamente.

**Solución:** Implementación client-side con localStorage:
- Se almacena `loginAttempts_{email}` con contador de intentos.
- Se almacena `loginBlockedUntil_{email}` con timestamp de bloqueo.
- Tras 4 intentos fallidos consecutivos, se bloquea por 15 minutos.
- El contador se resetea al cerrar sesión o al iniciar sesión exitosamente.

---

### 8. 🟠 Re-login forzado cada día a las 8 AM Lima

**Archivo:** `js/app.js`

**Problema:** La sesión podía durar indefinidamente gracias al refresh token.

**Solución:**
- Se almacena `sessionStartedAt` con timestamp ISO al iniciar sesión.
- En cada inicialización de la app, se obtiene la hora actual en Lima (`America/Lima`).
- Si la hora actual en Lima es ≥ 08:00 y la sesión se inició en un día anterior, se fuerza logout.
- El usuario debe volver a autenticarse.

---

### 9. 🟡 Error logging visible en panel Administración

**Archivos:** `js/helpers.js`, `js/admin.js`, `js/supabase-client.js`, `js/registro.js`, `js/programacion.js`

**Problema:** Los errores de Supabase (timeout, 500, RLS) solo se logueaban a console.error, invisibles para el usuario admin.

**Solución:**
- Se crea función `logError(nivel, mensaje, detalle)` en helpers.js que persiste errores en `localStorage` (array `appLogs`), limitado a 200 registros.
- Se agrega sección "Log de Errores" en el panel Administración, debajo del log de auditoría.
- Muestra: fecha/hora, nivel (error/warn/info), mensaje, detalle con tooltip.
- Los errores se capturan en:
  - `_exec()` y `rpc()` de supabase-client.js
  - Todos los catch blocks de registro.js y programacion.js
  - Login fallido en app.js
- Botón "Limpiar Log de Errores" en el panel.

---

### 10. 🟡 Captura de errores en formularios

**Archivos:** `js/registro.js`, `js/programacion.js`

**Solución:** Todos los catch blocks ahora llaman a `logError()` con contexto del error, además del `console.error()` existente. Esto permite visibilidad desde el panel de administración sin depender de la consola del navegador.

### 11. 🟡 Backoff exponencial con reintentos (resuelto)

**Archivo:** `js/supabase-client.js`

**Decisión:** 3 reintentos máximos, tanto para GET como para POST/PATCH, con toast "Reintentando (1/3)..." visible.

**Implementación:**
- Nueva función `sleep(ms)` para pausas.
- Nueva función `isRetryable(err)`: no reintenta errores 4xx (salvo 429 Too Many Requests).
- Bucle `for (let attempt = 0; attempt <= maxRetries; attempt++)` en `_exec()` y `rpc()`.
- Delays: 1s → 2s → 4s (exponencial: `2^(attempt-1) * 1000`).
- En cada reintento: `mostrarToast('Reintentando (X/3)...', 'info')`.
- Si se agotan los reintentos: `logError('error', ...)` y retorna error final.
- Si el error no es retryable (ej. 404, 403): falla inmediatamente sin reintentar.

---

### Archivos modificados (final)

| Archivo | Cambios |
|---------|---------|
| `js/supabase-client.js` | base64UrlDecode, getSession con refresh, sleep(), isRetryable(), _exec() y rpc() con retry loop 3 intentos + 401 retry |
| `js/helpers.js` | disableButton(), enableButton(), logError(), getLimaNow(), getLimaDateStr() |
| `js/app.js` | Lockout intentos login, re-login 8AM Lima, initSessionCheck con daily verify |
| `js/registro.js` | disableButton/enableButton en submit y checkout + logError en catch blocks |
| `js/programacion.js` | disableButton/enableButton en submit, cancel, confirm + logError en catch blocks |
| `js/admin.js` | Render logs de error desde localStorage + botón limpiar |
| `index.html` | Meta tags safe area, theme-color, apple-mobile-web-app |
| `css/variables.css` | --safe-* variables |
| `css/base.css` | body padding con safe-area |
| `css/components.css` | select → .grid-form select (scope reducido) |
| `css/historial.css` | option usa variable CSS, select mantiene comportamiento nativo |
| `css/responsive.css` | Body padding safe-area en móvil |
| `MEJORAS.md` | Documentación de todos los cambios |

---

### Decisiones tomadas

| Tema | Decisión |
|------|----------|
| Offline | ❌ No implementar. App depende 100% de Supabase. Sin Service Worker. |
| Backoff | ✅ 3 reintentos, ambos verbos, toast visible, delays 1s/2s/4s |
| MFA | ❌ No necesario (sin datos sensibles). Lockout 4 intentos + re-login diario es suficiente. |

---

## 2026-06-13 — Sesión 2 (KPIs, Charts, SQL Migration)

### Objetivo
Implementar KPIs en panel Administración, ejecutar SQL migration completa, añadir Chart.js.

### 12. 🟢 KPIs en panel Administración

**Archivos:** `js/admin.js`, `index.html`, `css/components.css`, `css/responsive.css`

| KPI | Descripción |
|-----|-------------|
| **Visitas Hoy** | Total visitas del día + "X en planta" |
| **Tiempo Promedio** | Minutos promedio entre ingreso y salida |
| **Top Anfitrión** | Anfitrión con más visitas (LIMIT 1) |
| **Conversión Programados** | % de programados que ingresaron |
| **Donut Chart** | Distribución porcentual por anfitrión |
| **Line Chart** | Evolución mensual (12 meses) |

**Detalles técnicos:**
- Chart.js v4 desde CDN (`cdn.jsdelivr.net/npm/chart.js`)
- Colores adaptados al tema via `getComputedStyle`
- KPIs calculados client-side desde `visitas`
- 6 RPC functions como respaldo en BD
- Gráficos se destruyen/re-crean al navegar

### 13. 🟢 SQL Migration ejecutada

**Ejecutado vía Management API el 13/06/2026:**

| Paso | Acción |
|------|--------|
| 1 | 5 CHECK constraints |
| 2 | FK types INTEGER → BIGINT |
| 3 | `historial.motivo` VARCHAR(250) → TEXT |
| 4 | Drop tablas legacy |
| 5 | 4 índices |
| 6 | RLS historial: solo admin SELECT |
| 7 | 6 KPI functions |

### Archivos modificados (sesión 2)

| Archivo | Cambios |
|---------|---------|
| `index.html` | Chart.js CDN, admin section con KPIs/charts/logs placeholders |
| `js/admin.js` | Rewrite completo: loadAdmin(), loadKPIs(), loadCharts() (donut + evolution), loadLog(), renderErrorLogs() |
| `js/supabase-client.js` | Métodos faltantes `not()`, `in()`, `neq()`, `lt()`, `gt()`, fix `is()` |
| `css/components.css` | .admin-content, .admin-kpis, .kpi-card, .kpi-value, .charts-row, .chart-container |
| `css/responsive.css` | KPI grid responsive (2 cols ≤1024px, 1 col ≤576px) |
| `js/app.js` | loadLog() → loadAdmin() en nav |
| `SUPABASE-MIGRATION.md` | Nota de ejecución completada |

---

## 2026-06-14 — Sesión 3 (Auditoría y Correcciones)

### Objetivo
Auditar full codebase (32 hallazgos) y corregir 24 hallazgos de seguridad, UX y consistencia.

### Hallazgos Corregidos (24/32)

| ID | Severidad | Hallazgo | Fix |
|----|-----------|----------|-----|
| C1 | 🔴 Crítico | `focusTrap()` memory leak | Listener almacenado en `modalEl._focusHandler` y removido en `cerrarModal()` |
| C2 | 🔴 Crítico | `Pasaporte` vs `PAS` inconsistente | Unificado a `PAS` en ambos formularios |
| A1 | 🟡 Alto | Sin Content-Security-Policy | Meta tag CSP con `script-src 'self' cdn.jsdelivr.net unpkg.com` |
| A3 | 🟡 Alto | Sin verificación perfil activo post-login | Consulta `SELECT rol FROM perfiles WHERE id = ... AND activo`; rechaza si inactivo |
| A5 | 🟡 Alto | Chart.js CDN sin fallback | `ensureChartJS()`: intenta jsdelivr → unpkg → degradación suave |
| A6 | 🟡 Alto | Máquina estados sin validación checkout | Verifica `entry.estado === 'ingresado'` antes de procesar salida |
| M1 | 🔵 Medio | Color `#ff5559` hardcodeado | `getCSSVar('--danger-color')` resuelve CSS variable a valor inline |
| M2 | 🔵 Medio | Duplicate `@media (max-width: 576px)` | Unificado en un solo bloque |
| M3 | 🔵 Medio | Sin maxlength en inputs | Agregado a todos los campos (20-500 chars) |
| M4 | 🔵 Medio | `estadoClean` regex frágil | `normalize('NFD')` + strip diacríticos + solo `[a-z]` |
| M5 | 🔵 Medio | Nav coupling: simula click en nav | `showSection()` via `window.AppState` en vez de `nav.click()` |
| M6 | 🔵 Medio | Sin `aria-label` en logout | Agregado `aria-label="Cerrar sesión"` |
| M7 | 🔵 Medio | `confirm()` nativo en cancelación | Modal glass reemplaza `confirm()` |
| M8 | 🔵 Medio | Sin validación horario laboral | Validación 07:00-19:00 en programación |
| M9 | 🔵 Medio | Modal buttons sin `type="button"` | Agregado `type="button"` a todos los botones de modal |
| M10 | 🔵 Medio | Sección duplicada MEJORAS.md | Tabla redundante de "Archivos modificados" eliminada |
| M11 | 🔵 Medio | `var ICONS` inconsistente | Cambiado a `const ICONS` |
| M12 | 🔵 Medio | DNI sin validación de formato | Validación `/^\d{8}$/` para tipo DNI |
| B1 | 🟢 Bajo | Logo "STUDIO PRISM" no coincide | Cambiado a "Gestor Visitas" |
| B2 | 🟢 Bajo | Login en inglés | Traducido a español: "Email" → "Correo", "Password" → "Contraseña", "Sign In" → "Iniciar Sesión" |
| B4 | 🟢 Bajo | `will-change: transform` en glass | Eliminado de `.glass-glow`, `.modal-glass .glass-glow`, `.system-header`, `.workspace-container` |
| B5 | 🟢 Bajo | `btn-submit:hover` sin cambio visual | Agregado `filter: brightness(1.15)` |
| B7 | 🟢 Bajo | KPIs con UTC off-by-one | Migrado a `Intl.DateTimeFormat` + `Date.setDate()` para fin de mes |
| B10 | 🟢 Bajo | Search select fondo fijo oscuro | Cambiado a `var(--input-bg)` |

### Pendientes (8/32)

Requieren infraestructura server-side o decisiones adicionales:

| ID | Severidad | Hallazgo | Requiere |
|----|-----------|----------|----------|
| C3 | 🔴 Crítico | Login lockout client-side | Edge Function + tabla `intentos_login` |
| A2 | 🟡 Alto | TOKENS.md con tokens vivos | Gestor de secretos externo (Windows Credential Manager, 1Password CLI) |
| A4 | 🟡 Alto | LIMIT 1000 sin paginación | Paginación offset-based en historial |
| B3 | 🟢 Bajo | Sin LICENSE | Decidido: no agregar |
| B6 | 🟢 Bajo | Script tag sin `crossorigin`/`integrity` | Baja prioridad (CDN confiable) |
| B8 | 🟢 Bajo | Sin CHANGELOG.md | MEJORAS.md cumple ese rol |
| B9 | 🟢 Bajo | `loginError.textContent` seguro | Correcto por seguridad (no XSS) |
| B11 | 🟢 Bajo | AGENTS.md "25+ índices" inexacto | Actualizado en AGENTS.md |

### Archivos modificados (sesión 3)

| Archivo | Cambios |
|---------|---------|
| `index.html` | CSP meta tag, login español, logo "Gestor Visitas", modal cancel-glass, PAS en reg-tipodoc, maxlength inputs, type=button modales, aria-label logout |
| `js/helpers.js` | focusTrap cleanup, `getCSSVar()`, `const ICONS`, showSection via AppState |
| `js/app.js` | Perfil activo post-login, login español, showSection via AppState |
| `js/admin.js` | Chart.js dynamic loading con fallback, KPIs con Intl.DateTimeFormat + Date.setDate(), estadoClean con normalize |
| `js/registro.js` | DNI 8 dígitos validación, máquina estados checkout |
| `js/programacion.js` | Horario 07-19 validación, DNI 8 dígitos, modal cancel-glass, showSection via AppState |
| `css/variables.css` | Sin cambios |
| `css/base.css` | Sin cambios |
| `css/glass.css` | will-change eliminado |
| `css/components.css` | btn-submit:hover brightness, KPI rules movidos (unified media query) |
| `css/historial.css` | search select usa `var(--input-bg)` |
| `css/responsive.css` | Media queries unificadas |
| `AGENTS.md` | Limpiado: solo estado actual (sin historial ni pendientes) |
| `SUPABASE-MIGRATION.md` | Limpiado: solo esquema actual (sin SQL ejecutado ni migración histórica) |
| `AUDIT.md` | Simplificado: snapshot de hallazgos con estado actual |
| `MEJORAS.md` | Esta sesión |

---

## 2026-06-23 — Sesión 4 (Auto-cierre diario 23:00)

### Objetivo
Implementar cierre automático de visitas a las 23:00 hora Lima: cancelar programados sin ingreso + checkout automático de visitantes en planta.

### 14. 🟢 Función `fn_auto_cierre_diario()` + pg_cron

**Archivo:** `auto-cierre.sql`

| Componente | Descripción |
|------------|-------------|
| **Cancelación programados** | Visitas con `estado='programado'` y `fecha_programada` del día actual → `estado='cancelado'`. Historial con `obs='[Auto] Cancelación programada 23:00'` |
| **Checkout automático** | Visitas con `estado='ingresado'` → `estado='retirado'`, `fecha_salida=NOW()`, `obs_salida='Salida automática 23:00'`. Historial con `estado='salida_automatica'`, `obs='[Auto] Salida automática 23:00'` |
| **Cron schedule** | `0 4 * * *` UTC (23:00 Lima UTC-5) via `cron.schedule('auto-cierre-2300', ...)` |

**Ejecución:** Correr `auto-cierre.sql` en Supabase SQL Editor con service_role.

### 15. 🟢 Toast informativo al usuario

**Archivos:** `js/helpers.js`, `js/app.js`

- Nueva función `verificarAutoCierre()` en helpers.js que consulta `historial` del día actual con `obs ILIKE '[Auto]%'`
- Muestra toast con conteo de salidas automáticas y cancelaciones
- Se llama al entrar al sistema (login + session restore)
- Se registra en log de errores con nivel `info`

### Archivos modificados (sesión 4)

| Archivo | Cambios |
|---------|---------|
| `auto-cierre.sql` | Nuevo: función + cron schedule |
| `js/helpers.js` | `verificarAutoCierre()` |
| `js/app.js` | Llamada a `verificarAutoCierre()` tras login y session restore |
| `AGENTS.md` | Actualizado con nueva funcionalidad |
| `SUPABASE-MIGRATION.md` | Agregada función y cron |

---

## 2026-06-23 — Sesión 5 (Estandarización Estados + Bug Fix CHECK Constraint)

### Objetivo
Estandarizar todos los estados a PascalCase en ambas tablas (`visitas` e `historial`), corregir bug del doble CHECK constraint en `historial`, y limpiar datos existentes.

### 16. 🔴 Fix: Doble CHECK constraint en `historial.estado`

**Archivo:** `SUPABASE-MIGRATION.md` (SQL ejecutado)

**Problema:** La tabla `historial` tenía dos CHECK constraints activos simultáneamente:
- `historial_estado_check` (original): `IN ('ingreso','salida','cancelada','ingreso_programado','salida_automatica','reprogramado','agendado')`
- `chk_historial_estado` (nuevo, migración Sesión 2): `IN ('ingreso','salida','cancelada','ingreso_programado','salida_automatica','reprogramado','agendado')`

La intersección de ambos constraints creaba una restricción más estricta que excluía `'agendado'` y `'reprogramado'` — causando error `"La inserción o actualización en la tabla 'historial' viola la restricción CHECK 'chk_historial_estado'"` al programar o reprogramar visitas.

**Solución:**
```sql
ALTER TABLE historial DROP CONSTRAINT historial_estado_check;
```

### 17. 🟢 Estandarización estados → PascalCase

**Migración ejecutada vía Management API:**
```sql
ALTER TABLE visitas DROP CONSTRAINT visitas_estado_check;
ALTER TABLE visitas ADD CONSTRAINT visitas_estado_check CHECK (estado IN ('Programado','Ingresado','Retirado','Cancelado'));

ALTER TABLE historial DROP CONSTRAINT chk_historial_estado;
ALTER TABLE historial ADD CONSTRAINT chk_historial_estado CHECK (estado IN ('Programado','Reprogramado','Ingresado','IngresadoProgramado','Retirado','RetiradoAutomatico','Cancelado'));
```

**Nuevo mapeo completo:**

| visitas.estado | historial.estado (nuevo) | historial.estado (anterior) |
|---|---|---|
| `'Programado'` | `'Programado'` | `'agendado'` |
| `'Ingresado'` | `'Ingresado'` | `'ingreso'` |
| `'Ingresado'` | `'IngresadoProgramado'` | `'ingreso_programado'` |
| `'Retirado'` | `'Retirado'` | `'salida'` |
| `'Retirado'` | `'RetiradoAutomatico'` | `'salida_automatica'` |
| `'Cancelado'` | `'Cancelado'` | `'cancelada'` |
| — | `'Reprogramado'` | `'reprogramado'` |

### 18. 🟢 Limpieza de datos

```sql
DELETE FROM historial;
DELETE FROM visitas;
```

### Archivos modificados (sesión 5)

| Archivo | Cambios |
|---------|---------|
| `js/programacion.js` | 7 referencias de estado actualizadas a PascalCase |
| `js/registro.js` | 6 referencias actualizadas |
| `js/historial.js` | Display map con nuevos nombres |
| `js/admin.js` | 6 referencias KPIs + 3 clases log auditoría |
| `js/helpers.js` | `verificarAutoCierre()` usa `'RetiradoAutomatico'` y `'Cancelado'` |
| `css/components.css` | Clases `.estado-*` mapeadas a lowercase de PascalCase |
| `auto-cierre.sql` | Función `fn_auto_cierre_diario` actualizada con PascalCase |
| `SUPABASE-MIGRATION.md` | CHECK constraints y estados actualizados |
| `AGENTS.md` | Estados actualizados en esquema y auto-cierre |
| `MEJORAS.md` | Esta sesión |
