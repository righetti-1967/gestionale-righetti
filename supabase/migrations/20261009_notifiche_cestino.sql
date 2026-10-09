-- ============================================================
-- Cestino notifiche push (soft-delete)
-- Data: 09/10/2026
-- ============================================================

ALTER TABLE public.notifiche
  ADD COLUMN IF NOT EXISTS eliminata_at     timestamptz,
  ADD COLUMN IF NOT EXISTS eliminata_da     uuid,
  ADD COLUMN IF NOT EXISTS eliminata_motivo text;

CREATE INDEX IF NOT EXISTS idx_notifiche_attive
  ON public.notifiche (client_id, created_at DESC)
  WHERE eliminata_at IS NULL;

CREATE OR REPLACE FUNCTION public.admin_elimina_notifica(
  notifica_id_input uuid,
  motivo_input      text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  staff_uid uuid;
BEGIN
  staff_uid := auth.uid();

  IF staff_uid IS NULL OR NOT is_staff() THEN
    RAISE EXCEPTION 'Non autorizzato';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM notifiche n
    JOIN clienti c ON c.id = n.client_id
    WHERE n.id = notifica_id_input
      AND c.user_id = staff_uid
  ) THEN
    RAISE EXCEPTION 'Notifica non trovata o non tua';
  END IF;

  UPDATE notifiche
     SET eliminata_at     = now(),
         eliminata_da     = staff_uid,
         eliminata_motivo = NULLIF(trim(motivo_input), '')
   WHERE id = notifica_id_input
     AND eliminata_at IS NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_notifiche_cliente(
  client_id_input bigint,
  limit_input     integer DEFAULT 30
)
RETURNS TABLE(
  id              uuid,
  tipo            text,
  titolo          text,
  messaggio       text,
  priorita        text,
  letta           boolean,
  letta_at        timestamptz,
  push_inviata    boolean,
  push_inviata_at timestamptz,
  push_errore     text,
  created_at      timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  staff_uid UUID;
BEGIN
  staff_uid := auth.uid();

  IF staff_uid IS NULL OR NOT is_staff() THEN
    RAISE EXCEPTION 'Non autorizzato';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM clienti
    WHERE clienti.id = client_id_input
      AND clienti.user_id = staff_uid
  ) THEN
    RAISE EXCEPTION 'Cliente non trovato o non tuo';
  END IF;

  RETURN QUERY
  SELECT
    n.id,
    n.tipo,
    n.titolo,
    n.messaggio,
    COALESCE(n.priorita, 'media'),
    COALESCE(n.letta, false),
    n.letta_at,
    COALESCE(n.push_inviata, false),
    n.push_inviata_at,
    n.push_errore,
    n.created_at
  FROM notifiche n
  WHERE n.client_id = client_id_input
    AND n.eliminata_at IS NULL
  ORDER BY n.created_at DESC
  LIMIT GREATEST(COALESCE(limit_input, 30), 1);
END;
$function$;
