# Gestor de Visitas — Glass UI

## Goal
Sistema web de gestión de visitas con diseño glass-morphism, persistencia en Supabase, autenticación Auth, CSP y control de versiones en GitHub.

## Arquitectura
- `index.html` — punto de entrada único
- `css/` — 7 archivos modulares (variables.css, base.css, glass.css, layout.css, components.css, historial.css, responsive.css)
- `js/` — 7 archivos modulares (helpers.js, supabase-client.js, historial.js, registro.js, programacion.js, admin.js, app.js)
- Orden de carga JS: helpers.js → supabase-client.js → historial.js → registro.js → programacion.js → admin.js → app.js
- Estado global compartido via `window.AppState` (incluye `showSection()`, `historial`, `registro`, `programacion`, `admin`)
- Login: Supabase Auth con fetch directo (sin CDN supabase-js)

## Vistas
1. **Login** — formulario en español, toggle contraseña SVG, CSP protección, validación perfil activo post-login, lockout client-side (4 intentos)
2. **Registro** — formulario validado (DNI 8 dígitos, maxlength campos), autocomplete anfitrión + autorizador (ILIKE top 3), botón limpiar, auto-fill visitante por documento (debounce 300ms), lista en planta, modales salida (obs ≥4 chars) y detalle, evento delegado con `closest()`
3. **Programación** — formulario con datetime-local (horario 07-19 validado), autocomplete anfitrión + autorizador, botón limpiar, modal detalle (editar/reprogramar/confirmar ingreso/cancelar con motivo), modal confirmación registro con observaciones
4. **Historial** — tabla centrada, búsqueda ILIKE por columna, filtro rango fechas, modal detalle con fechas separadas (programado/ingreso/salida), LIMIT 1000
5. **Administración** — KPIs (visitas hoy, tiempo promedio, top anfitrión, conversión programados), donut chart + evolución mensual (Chart.js v4 carga dinámica con fallback CDN), log auditoría desde `historial` con email vía `fn_get_users_info`, log errores local

## Seguridad (vigente)
- **CSP**: meta tag `Content-Security-Policy` (script-src: self, cdn.jsdelivr.net, unpkg.com)
- **XSS**: `escapeHtml()` en todo template literal
- **Focus trap**: `focusTrap()` con limpieza de listeners en `cerrarModal()`
- **ARIA**: `role="dialog"`, `aria-modal`, `aria-labelledby`, `role="alert"`, `sr-only`
- **Perfil activo**: verificado post-login; sin perfil → login rechazado
- **Iconos**: SVGs inline (eye, moon, sun, check, cross) con bisel gradient
- **Modo claro/oscuro**: CSS variables en `[data-theme="light"]`, persistencia localStorage
- **Bisel glass**: `::before` con `mask-composite: exclude` en cards y modales
- **Touch targets**: botones con `min-height: 34-38px`

## Esquema de Datos
- **`visitas`** — tabla fuente de verdad (1 fila = 1 visita). CHECK: estado IN ('Programado','Ingresado','Retirado','Cancelado'), obs_salida ≥4, máquina de estados.
- **`historial`** — log inmutable (solo INSERT, FK `visita_id` → visitas). RLS: solo admin SELECT. CHECK: estado IN ('Programado','Reprogramado','Ingresado','IngresadoProgramado','Retirado','RetiradoAutomatico','Cancelado')
- **`visitantes`** — upsert por tipo_doc+num_doc. CHECK: tipo_doc IN ('DNI','CE','PAS')
- **`anfitriones`** — solo lectura (15 registros seeded). Índice GIN trgm en nombre.
- **`autorizadores`** — catálogo de autorizadores (5 registros seeded). Índice GIN trgm en nombre.
- **`perfiles`** — FK `ON DELETE RESTRICT` a `auth.users(id)`. CHECK: rol IN ('admin','operador')
- Función `fn_get_users_info(user_ids UUID[])` para lookup batch de emails
- 6 KPI functions (`fn_kpi_visitas_hoy`, `fn_kpi_tiempo_promedio`, `fn_kpi_top_anfitrion`, `fn_kpi_conversion_programados`, `fn_kpi_evolucion_mensual`, `fn_kpi_distribucion_anfitriones`)
- Función `fn_auto_cierre_diario()` ejecutada vía pg_cron (`auto-cierre-2300`) a las 23:00 Lima

## Auto-cierre diario
- **Server-side**: `fn_auto_cierre_diario()` (PL/pgSQL) programada con pg_cron a las 23:00 Lima (04:00 UTC)
- **Acciones**: (1) programados sin ingreso → `Cancelado` con historial `'Cancelado'`, (2) ingresados sin salida → `Retirado` con historial `'RetiradoAutomatico'`
- **Frontend**: `verificarAutoCierre()` en helpers.js muestra toast al usuario al entrar al sistema
- **Archivos**: `auto-cierre.sql` (migración a ejecutar), `js/helpers.js`, `js/app.js`

## Infraestructura Cloud
- **Supabase**: proyecto `bygwwnaudkxinytgbmrf`, URL `https://bygwwnaudkxinytgbmrf.supabase.co`, región `sa-east-1`
- **Vercel**: `https://gestor-visitas-one.vercel.app`
- **GitHub**: `https://github.com/Pentium-Ie/gestor-visitas`

## Documentación
- `MEJORAS.md` — historial completo de cambios por sesión
- `AUDIT.md` — hallazgos de auditoría (24/32 corregidos) y pendientes
- `SUPABASE-MIGRATION.md` — esquema BD actual, funciones, RLS, flujo datos
- `USERS.md` — creación de usuarios admin/operador
