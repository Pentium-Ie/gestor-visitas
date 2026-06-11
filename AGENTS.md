# Resumen del Proyecto — Gestor de Visitas (Glass UI)

## Goal
Sistema web de gestión de visitas con diseño glass-morphism, tres vistas principales: Registro en planta, Programación de visitas futuras e Historial de movimientos.

## Arquitectura
- `index.html` — punto de entrada único
- `css/` — 7 archivos modulares (variables, base, glass, layout, components, historial, responsive)
- `js/` — 6 archivos modulares (helpers.js, supabase-client.js, historial.js, registro.js, programacion.js, app.js)
- Orden de carga JS: supabase-js CDN → helpers.js → supabase-client.js → historial.js → registro.js → programacion.js → app.js
- Estado global compartido via `window.AppState`
- Login: Supabase Auth (`master-admin@gestor-visitas.com` / `Huachip5667Sca85#`)
- Archivos monolíticos eliminados (`script.js`, `styles.css`)

## Vistas Implementadas
1. **Login** — formulario con autenticación simple, animaciones de entrada, `role="alert"` en errores
2. **Registro** — formulario de ingreso + lista de personas en planta + modal salida + modal detalle
3. **Programación** — formulario con datetime-local + lista programadas + modal detalle (editar/cancelar/confirmar ingreso) + modal confirmación con observaciones
4. **Historial** — tabla con columnas fijas + búsqueda por columna + filtro rango fechas + modal detalle con fecha programada/ingreso
5. **Administración** — placeholder

## Mejoras Aplicadas (junio 2026)
- **XSS**: sanitización `escapeHtml()` en todo template literal (helpers.js)
- **Validación**: `validarFormulario()` del lado JS en todos los formularios
- **Duplicado de código**: eliminados `script.js` y `styles.css` monolíticos; solo queda arquitectura modular
- **Delegación de eventos**: listeners en contenedores padre en vez de re-binding por render
- **Throttle**: `requestAnimationFrame` en mousemove del reflejo glass
- **Focus trap**: `focusTrap()` en todos los modales, cierre con Escape global
- **ARIA**: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `role="alert"`, `role="button"`, `scope="col"`, `sr-only`
- **Touch targets**: botones incrementados a `min-height: 34-38px`
- **Badges**: colores con variables CSS y mayor contraste (success-color, danger-color, warning-color)
- **Contraste**: `!important` removido de `.btn-secondary`, reemplazado por especificidad `.modal-actions .btn-secondary`
- **Clases vacío**: creada `.empty-state` para reemplazar inline styles
- **Loader overlay**: estructura preparada para operaciones asíncronas
- **CSS sin inline styles**: widths de modales pasados a clases `.modal-sm` / `.modal-md`

## Estado de Migración a Supabase (Junio 2026)
- **Login**: Supabase Auth (`master-admin@gestor-visitas.com`) — hardcoded removido
- **Registro**: INSERT en `en_planta` + `historial` vía Supabase; upsert en `visitantes` y `anfitriones`
- **Salida**: UPDATE `en_planta.salida_en` + INSERT en `historial` con estado `'salida'`
- **Programación**: INSERT/UPDATE/DELETE en `programadas` vía Supabase; registro desde programada INSERT en `en_planta` + `historial` con estado `'ingreso_programado'`
- **Cancelación**: UPDATE `programadas.estado = 'cancelado'` + INSERT en `historial` con estado `'cancelada'`
- **Historial**: SELECT desde `historial` con ILIKE por columna + filtro rango fechas; JOINs no necesarios (tabla desnormalizada)
- **Compartido**: `helpers.js` exporta `buscarOCrearVisitante()`, `buscarOCrearAnfitrion()`, `getCurrentUserId()` para todos los módulos

## Pendientes / Notas
- El panel de Administración sigue siendo placeholder
- Sin paginación en historial (para producción con +1000 registros)
- Sin tests unitarios
- Autocomplete de anfitriones y auto-relleno de visitantes por documento (futuro)

## Infraestructura Cloud
- **Supabase**: proyecto creado (ref: `bygwwnaudkxinytgbmrf`, región `sa-east-1`)
- **URL API**: `https://bygwwnaudkxinytgbmrf.supabase.co`
- **Admin Auth**: `admin@gestor-visitas.com` / `admin123`
- **GitHub**: `https://github.com/Pentium-Ie/gestor-visitas`
- **Tablas (6)**: `perfiles`, `anfitriones`, `visitantes`, `programadas`, `en_planta`, `historial`
- **RLS**: 15 policies (historial solo SELECT/INSERT, DELETE solo admin)
- **Auto-checkout**: función `fn_auto_checkout_cierre()` lista para Edge Function
- **Seed**: 8 anfitriones insertados
- **Triggers**: `trg_visitantes_actualizado` para timestamp de actualización
- **Constraints**: `chk_salida` (obs_salida >= 4 chars al registrar salida), `uq_en_planta_activo` (único visitante activo por vez), FK con `ON DELETE RESTRICT` en perfiles, CHECK en estado/tipo_doc
- **Índices**: 21 totales (PKs, FK btree, 3 GIN trgm, parcial único compuesto) — ver `pg_indexes` en `public`
