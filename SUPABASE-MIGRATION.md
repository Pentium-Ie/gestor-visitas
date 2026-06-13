# Migración a Supabase — Gestor de Visitas

## Visión General

Persistencia en Supabase (PostgreSQL) con autenticación real (Auth),
sincronización multi-sesión y modelo de datos normalizado con integridad referencial.

---

## Proyecto

- **Ref:** `bygwwnaudkxinytgbmrf`
- **URL:** `https://bygwwnaudkxinytgbmrf.supabase.co`
- **Región:** `sa-east-1` (São Paulo)
- **Cliente JS:** fetch directo (sin CDN supabase-js) en `js/supabase-client.js`
- **Login:** Supabase Auth con `signInWithPassword`

---

## Esquema de Base de Datos

```
auth.users (Supabase Auth)
  └── perfiles (1:1 con auth.users.id, FK ON DELETE RESTRICT)
  
visitas (tabla fuente de verdad — 1 fila = 1 visita con estado)
  ├── visitantes (catálogo normalizado, upsert por tipo_doc+num_doc)
  ├── anfitriones (catálogo de solo lectura, 15 registros seeded)
  └── historial (log inmutable, solo INSERT, con visita_id FK)
```

### Tablas Activas

#### `perfiles`
| Columna | Tipo | Notas |
|---|---|---|
| id | UUID PK | FK → `auth.users(id) ON DELETE RESTRICT` |
| nombre | VARCHAR(100) | |
| rol | VARCHAR(20) | CHECK IN ('admin','operador') |
| activo | BOOLEAN | DEFAULT true |
| creado_en | TIMESTAMPTZ | |

#### `anfitriones`
| Columna | Tipo | Notas |
|---|---|---|
| id | BIGINT PK | Generated always as identity |
| nombre | VARCHAR(150) | Búsqueda ILIKE, autocomplete top 3 |
| area | VARCHAR(150) | |
| activo | BOOLEAN | DEFAULT true |
| creado_en | TIMESTAMPTZ | |
| creado_por | UUID | FK → perfiles(id) |

Índice GIN trgm en `nombre` para ILIKE.

#### `visitantes`
| Columna | Tipo | Notas |
|---|---|---|
| id | BIGINT PK | Generated always as identity |
| tipo_doc | VARCHAR(5) | CHECK IN ('DNI','CE','PAS') |
| num_doc | VARCHAR(20) | UNIQUE con tipo_doc |
| nombre | VARCHAR(150) | |
| empresa | VARCHAR(150) | DEFAULT 'Particular' |
| creado_en | TIMESTAMPTZ | |
| actualizado_en | TIMESTAMPTZ | Trigger `trg_visitantes_actualizado` |

Trigger: `fn_actualizar_visitante()` actualiza `actualizado_en` en UPDATE.

#### `visitas` (fuente de verdad)
| Columna | Tipo | Notas |
|---|---|---|
| id | UUID PK | Generado con `crypto.randomUUID()` en JS |
| visitante_id | INTEGER FK → visitantes(id) | |
| anfitrion_id | INTEGER FK → anfitriones(id) | |
| motivo | TEXT | |
| obs_ingreso | TEXT | |
| obs_salida | TEXT | |
| fecha_programada | TIMESTAMPTZ | NULL para ingreso directo |
| fecha_ingreso | TIMESTAMPTZ | NULL si solo programado |
| fecha_salida | TIMESTAMPTZ | |
| estado | TEXT | 'programado','ingresado','retirado','cancelado' |
| creado_por | UUID | FK → perfiles(id) |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | Trigger `fn_visitas_updated_at()` |

#### `historial` (log inmutable)
| Columna | Tipo | Notas |
|---|---|---|
| id | BIGINT PK | |
| visita_id | UUID | FK → visitas(id). NULL para registros legacy |
| visitante_id | BIGINT | |
| tipo_doc | VARCHAR(5) | |
| num_doc | VARCHAR(20) | |
| nombre | VARCHAR(150) | |
| empresa | VARCHAR(150) | |
| motivo | VARCHAR(250) | |
| anfitrion_id | BIGINT | |
| anfitrion_nombre | VARCHAR(150) | |
| estado | VARCHAR(20) | 'ingreso','salida','cancelada','ingreso_programado','salida_automatica','reprogramado','agendado' |
| obs | TEXT | |
| fecha | TIMESTAMPTZ | |
| fecha_programada | TIMESTAMPTZ | Solo para programaciones |
| creado_por | UUID | FK → perfiles(id) |
| creado_en | TIMESTAMPTZ | |
| grupo_id | UUID | Para agrupar eventos de una misma visita |
| programada_id | BIGINT | Legacy, NULL |

### Tablas Legacy (no usadas por el frontend)

`en_planta` y `programadas` existen en la BD pero no son utilizadas
por el código actual. Toda la lógica opera sobre `visitas`.

---

## Funciones (Custom)

| Función | Args | Propósito |
|---|---|---|
| `fn_get_users_info(user_ids UUID[])` | `TABLE(id UUID, email TEXT)` | Batch lookup de emails desde `auth.users` para el admin log |
| `fn_auto_checkout_cierre()` | `TABLE(...)` | Auto-checkout 23:00 Lima (pendiente de implementar) |
| `fn_visitas_updated_at()` | trigger | Actualiza `visitas.updated_at` |
| `fn_actualizar_visitante()` | trigger | Actualiza `visitantes.actualizado_en` |
| `fn_backfill_grupo_id()` | util | Backfill de grupo_id en historial |
| `fn_cleanup()` | util | Limpieza de datos |

---

## Políticas RLS

```
perfiles    → SELECT: auth.uid() = id
anfitriones → SELECT/INSERT: EXISTS(perfiles activo)
visitantes  → SELECT/INSERT/UPDATE: EXISTS(perfiles activo)
visitas     → SELECT: true (público), INSERT/UPDATE/DELETE: auth.uid() = creado_por
historial   → SELECT/INSERT: EXISTS(perfiles activo)
```

`en_planta` y `programadas` tienen sus propias políticas (legacy, no utilizadas).

---

## Flujo de Datos

### Registro de Ingreso
1. `buscarVisitantePorDoc(tipo_doc, num_doc)` → auto-fill nombre+empresa
2. `buscarOCrearVisitante(...)` → upsert en `visitantes`
3. `buscarAnfitrion(nombre)` → lookup en `anfitriones` (solo lectura, sin creación)
4. INSERT en `visitas` con `estado='ingresado'`, `fecha_ingreso=now()`
5. INSERT en `historial` con `estado='ingreso'`, `visita_id=<nueva_visita>`

### Registro de Salida
1. UPDATE `visitas` set `estado='retirado'`, `fecha_salida=now()`, `obs_salida=...`
2. INSERT en `historial` con `estado='salida'`
3. `obs_salida` validado ≥ 4 caracteres en frontend (sin CHECK en BD)

### Programar Visita
1. INSERT en `visitas` con `estado='programado'`, `fecha_programada=...`
2. INSERT en `historial` con `estado='agendado'`

### Editar Programación
1. UPDATE `visitas` (in-place) con nuevos datos
2. INSERT en `historial` con `estado='reprogramado'`

### Confirmar Ingreso desde Programación
1. UPDATE `visitas` set `estado='ingresado'`, `fecha_ingreso=now()`, `obs_ingreso=...`
2. INSERT en `historial` con `estado='ingreso_programado'`

### Cancelar Visita
1. UPDATE `visitas` set `estado='cancelado'`
2. INSERT en `historial` con `estado='cancelada'`

### Historial
- SELECT en `visitas` con JOIN a `visitantes` y `anfitriones`
- Filtro ILIKE por columna (nombre, empresa, motivo, anfitrion)
- Filtro por rango de fechas (fecha_ingreso / fecha_salida / fecha_programada)
- Orden descendente por fecha más relevante

### Admin Log
- SELECT en `historial` ordenado por fecha DESC
- `fn_get_users_info(batch_user_ids)` para resolver emails desde `auth.users`
- Columnas: Fecha/Hora, Evento, Visitante, Documento, Anfitrión, Usuario

---

## Notas Técnicas

- Sin paginación en historial (para +1000 registros en producción)
- 21 índices en `public` (PKs, FK btree, GIN trgm, unique parcial)
- TG_REG exF (`pg_trgm`) para búsqueda por substring
- `TIMESTAMPTZ` con conversión a `America/Lima` en frontend (`toLocaleDateString('es-PE')`)
- Zona horaria: Perú (UTC-5, sin DST)

## Pendientes

- Notificación de visitas >3h en planta
- Edge Function para auto-checkout 23:00 Lima
- Paginación en historial para producción
