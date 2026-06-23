-- ============================================================
-- Auto-cierre diario de visitas — 23:00 hora Lima
-- Ejecutar en Supabase SQL Editor (con service_role)
-- ============================================================

-- 1. Crear función de cierre automático
CREATE OR REPLACE FUNCTION fn_auto_cierre_diario()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET TIMEZONE = 'America/Lima'
AS $$
DECLARE
  v RECORD;
  hoy_inicio timestamptz;
  hoy_fin    timestamptz;
  cant       integer := 0;
BEGIN
  hoy_inicio := date_trunc('day', NOW());
  hoy_fin    := hoy_inicio + INTERVAL '1 day';

  -- 1.1 Cancelar programados que no ingresaron hoy
  FOR v IN
    SELECT v.id, v.visitante_id, v.motivo, v.creado_por,
           vf.tipo_doc, vf.num_doc, vf.nombre AS v_nombre, vf.empresa,
           a.id AS anf_id, a.nombre AS anf_nombre
    FROM visitas v
    JOIN visitantes vf ON vf.id = v.visitante_id
    LEFT JOIN anfitriones a ON a.id = v.anfitrion_id
    WHERE v.estado = 'Programado'
      AND v.fecha_programada >= hoy_inicio
      AND v.fecha_programada < hoy_fin
  LOOP
    UPDATE visitas SET estado = 'Cancelado' WHERE id = v.id;
    INSERT INTO historial (
      visita_id, visitante_id, tipo_doc, num_doc, nombre, empresa, motivo,
      anfitrion_id, anfitrion_nombre, estado, obs, fecha, creado_por, grupo_id
    ) VALUES (
      v.id, v.visitante_id, v.tipo_doc, v.num_doc, v.v_nombre, v.empresa,
      v.motivo, v.anf_id, v.anf_nombre, 'Cancelado',
      '[Auto] Cancelación programada 23:00', NOW(),
      v.creado_por, gen_random_uuid()
    );
    cant := cant + 1;
  END LOOP;

  -- 1.2 Salida automática de visitantes aún en planta
  FOR v IN
    SELECT v.id, v.visitante_id, v.motivo, v.creado_por,
           vf.tipo_doc, vf.num_doc, vf.nombre AS v_nombre, vf.empresa,
           a.id AS anf_id, a.nombre AS anf_nombre
    FROM visitas v
    JOIN visitantes vf ON vf.id = v.visitante_id
    LEFT JOIN anfitriones a ON a.id = v.anfitrion_id
    WHERE v.estado = 'Ingresado'
  LOOP
    UPDATE visitas
      SET estado = 'Retirado',
          fecha_salida = NOW(),
          obs_salida  = 'Salida automática 23:00'
      WHERE id = v.id;
    INSERT INTO historial (
      visita_id, visitante_id, tipo_doc, num_doc, nombre, empresa, motivo,
      anfitrion_id, anfitrion_nombre, estado, obs, fecha, creado_por, grupo_id
    ) VALUES (
      v.id, v.visitante_id, v.tipo_doc, v.num_doc, v.v_nombre, v.empresa,
      v.motivo, v.anf_id, v.anf_nombre, 'RetiradoAutomatico',
      '[Auto] Salida automática 23:00', NOW(),
      v.creado_por, gen_random_uuid()
    );
    cant := cant + 1;
  END LOOP;
END;
$$;

-- 2. Programar ejecución diaria a las 23:00 Lima (UTC–5 → 04:00 UTC)
SELECT cron.schedule(
  'auto-cierre-2300',
  '0 4 * * *',
  'SELECT fn_auto_cierre_diario();'
);
