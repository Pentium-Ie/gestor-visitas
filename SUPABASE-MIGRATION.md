# Supabase — Esquema y Configuración

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

#### `visitas` (fuente de verdad)
| Columna | Tipo | Notas |
|---|---|---|
| id | UUID PK | Generado con `crypto.randomUUID()` en JS |
| visitante_id | BIGINT | FK → visitantes(id) |
| anfitrion_id | BIGINT | FK → anfitriones(id) |
| motivo | TEXT | |
| obs_ingreso | TEXT | |
| obs_salida | TEXT | CHECK (obs_salida IS NULL OR length(obs_salida) >= 4) |
| fecha_programada | TIMESTAMPTZ | NULL para ingreso directo |
| fecha_ingreso | TIMESTAMPTZ | NULL si solo programado |
| fecha_salida | TIMESTAMPTZ | |
| estado | TEXT | CHECK IN ('Programado','Ingresado','Retirado','Cancelado') |
| creado_por | UUID | FK → perfiles(id) |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | Trigger `fn_visitas_updated_at()` |

**CHECK de máquina de estados:**
```sql
CHECK (
  (estado = 'Ingresado' AND fecha_ingreso IS NOT NULL AND fecha_salida IS NULL) OR
  (estado = 'Retirado' AND fecha_ingreso IS NOT NULL AND fecha_salida IS NOT NULL) OR
  (estado = 'Programado' AND fecha_programada IS NOT NULL AND fecha_ingreso IS NULL AND fecha_salida IS NULL) OR
  (estado = 'Cancelado')
)
```

#### `historial` (log inmutable)
| Columna | Tipo | Notas |
|---|---|---|
| id | BIGINT PK | |
| visita_id | UUID | FK → visitas(id). NULL para registros legacy |
| visitante_id | BIGINT | |
| tipo_doc | VARCHAR(5) | CHECK IN ('DNI','CE','PAS') |
| num_doc | VARCHAR(20) | |
| nombre | VARCHAR(150) | |
| empresa | VARCHAR(150) | |
| motivo | TEXT | |
| anfitrion_id | BIGINT | |
| anfitrion_nombre | VARCHAR(150) | |
| estado | VARCHAR(20) | CHECK IN ('Programado','Reprogramado','Ingresado','IngresadoProgramado','Retirado','RetiradoAutomatico','Cancelado') |
| obs | TEXT | |
| fecha | TIMESTAMPTZ | |
| fecha_programada | TIMESTAMPTZ | Solo para programaciones |
| creado_por | UUID | FK → perfiles(id) |
| creado_en | TIMESTAMPTZ | |
| grupo_id | UUID | Para agrupar eventos de una misma visita |

### Tablas Legacy (eliminadas)

`en_planta` y `programadas` fueron eliminadas del esquema.
La columna `historial.programada_id` también fue eliminada.

---

## Funciones (Custom)

| Función | Args | Propósito |
|---|---|---|
| `fn_get_users_info(user_ids UUID[])` | `TABLE(id UUID, email TEXT)` | Batch lookup de emails desde `auth.users` para el admin log |
| `fn_visitas_updated_at()` | trigger | Actualiza `visitas.updated_at` |
| `fn_actualizar_visitante()` | trigger | Actualiza `visitantes.actualizado_en` |
| `fn_kpi_visitas_hoy()` | `TABLE(total_hoy INT, en_planta INT)` | Total visitas del día (Lima) |
| `fn_kpi_tiempo_promedio()` | `TABLE(promedio_minutos NUMERIC)` | Tiempo promedio en planta |
| `fn_kpi_top_anfitrion()` | `TABLE(anfitrion_nombre VARCHAR(150), total_visitas INT)` | Anfitrión con más visitas |
| `fn_kpi_conversion_programados()` | `TABLE(total_programados INT, ingresaron INT, tasa_porcentaje NUMERIC)` | Tasa de conversión de programados |
| `fn_kpi_evolucion_mensual()` | `TABLE(mes TEXT, total INT)` | Visitas por mes (últimos 12 meses) |
| `fn_kpi_distribucion_anfitriones()` | `TABLE(anfitrion_nombre VARCHAR(150), total INT)` | Distribución de visitas por anfitrión |
| `fn_auto_cierre_diario()` | `void` | Auto-cierre 23:00 Lima: cancela programados sin ingreso + checkout de visitantes en planta |

## Cron Jobs (pg_cron)

| Job | Schedule (UTC) | Hora Lima | Acción |
|-----|---------------|-----------|--------|
| `auto-cierre-2300` | `0 4 * * *` | 23:00 | Ejecuta `fn_auto_cierre_diario()` |

---

## Índices

```sql
CREATE INDEX idx_historial_fecha ON historial (fecha DESC);
CREATE INDEX idx_visitas_estado ON visitas (estado);
CREATE INDEX idx_historial_grupo_id ON historial (grupo_id);
CREATE INDEX idx_visitas_fecha_ingreso ON visitas (fecha_ingreso DESC);
```

---

## Políticas RLS

```
perfiles    → SELECT: auth.uid() = id
anfitriones → SELECT: EXISTS(perfiles WHERE id = auth.uid() AND activo)
visitantes  → SELECT/INSERT/UPDATE: EXISTS(perfiles WHERE id = auth.uid() AND activo)
visitas     → SELECT: true (público), INSERT/UPDATE/DELETE: auth.uid() = creado_por
historial   → SELECT/INSERT: EXISTS(perfiles WHERE id = auth.uid() AND activo AND rol = 'admin')
```

Nota: `historial` requiere rol `admin` para SELECT/INSERT, y `visitas` requiere que el operador tenga un perfil activo.

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
3. `obs_salida` validado ≥ 4 caracteres en frontend y BD (CHECK)

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

### Auto-cierre Diario (23:00 Lima)
Ejecutado automáticamente por pg_cron (`auto-cierre-2300`, `0 4 * * *` UTC):
1. **Cancelar programados sin ingreso**: `visitas.estado='programado'` con `fecha_programada` del día actual → `UPDATE estado='cancelado'` + `INSERT historial(estado='cancelada', obs='[Auto] Cancelación programada 23:00')`
2. **Checkout automático en planta**: `visitas.estado='ingresado'` → `UPDATE estado='retirado', fecha_salida=NOW(), obs_salida='Salida automática 23:00'` + `INSERT historial(estado='salida_automatica', obs='[Auto] Salida automática 23:00')`

### Admin KPIs
Las KPIs se calculan vía RPC o client-side desde `visitas`:
1. **Visitas hoy** — Total ingresos + cuántos siguen en planta
2. **Tiempo promedio** — Minutos promedio entre ingreso y salida
3. **Top anfitrión** — Anfitrión que más visitas ha recibido
4. **Conversión programados** — % de programados que efectivamente ingresaron
5. **Evolución mensual** — Línea de visitas por mes (12 meses)
6. **Distribución por anfitrión** — Donut chart con %

---

## Notas Técnicas

- Sin paginación en historial (LIMIT 1000 fijo; para +1000 registros implementar offset-based)
- `TIMESTAMPTZ` con conversión a `America/Lima` en frontend
- Zona horaria: Perú (UTC-5, sin DST)
- Las FK usan BIGINT uniformemente
- `historial` requiere rol `admin` para SELECT (RLS)
- Máquina de estados enforce vía CHECK: `Programado→Ingresado→Retirado` o `→Cancelado`
- Estados en PascalCase para consistencia entre `visitas.estado` y `historial.estado`
- `historial` registra 7 eventos: `Programado` (nuevo), `Reprogramado` (editado), `Ingresado` (directo), `IngresadoProgramado` (desde programación), `Retirado` (manual), `RetiradoAutomatico` (auto 23:00), `Cancelado`
