-- Phase B: current-pool counters maintained on write.
-- Phase C: per-UTC-day attempt rollups + per-contact call days for period queries.
-- Read RPCs keep the same signatures. Date/response filters that cannot be
-- answered from counters fall back to the Phase A universe.
-- Safe to re-run: drops partial counter tables from a previous attempt.

DROP TRIGGER IF EXISTS trg_campaign_stats_contacts ON public.contacts;
DROP TRIGGER IF EXISTS trg_campaign_stats_call_attempts ON public.call_attempts;

DROP TABLE IF EXISTS public.contact_call_days CASCADE;
DROP TABLE IF EXISTS public.campaign_assignee_stats_daily CASCADE;
DROP TABLE IF EXISTS public.campaign_assignee_stats CASCADE;

CREATE TABLE public.campaign_assignee_stats (
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  assignee_id uuid REFERENCES public.telepastors (id) ON DELETE CASCADE,
  assignee_key uuid NOT NULL GENERATED ALWAYS AS (
    COALESCE(assignee_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) STORED,
  total_contacts integer NOT NULL DEFAULT 0,
  completed integer NOT NULL DEFAULT 0,
  remaining integer NOT NULL DEFAULT 0,
  coming integer NOT NULL DEFAULT 0,
  not_coming integer NOT NULL DEFAULT 0,
  unreachable integer NOT NULL DEFAULT 0,
  switched_off integer NOT NULL DEFAULT 0,
  wrong_number integer NOT NULL DEFAULT 0,
  other integer NOT NULL DEFAULT 0,
  with_notes integer NOT NULL DEFAULT 0,
  total_attempts integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  PRIMARY KEY (campaign_id, assignee_key)
);

CREATE INDEX IF NOT EXISTS campaign_assignee_stats_assignee_idx
  ON public.campaign_assignee_stats (assignee_id, campaign_id);

CREATE TABLE public.campaign_assignee_stats_daily (
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  assignee_id uuid REFERENCES public.telepastors (id) ON DELETE CASCADE,
  assignee_key uuid NOT NULL GENERATED ALWAYS AS (
    COALESCE(assignee_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) STORED,
  day date NOT NULL,
  total_attempts integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  PRIMARY KEY (campaign_id, assignee_key, day)
);

CREATE INDEX IF NOT EXISTS campaign_assignee_stats_daily_day_idx
  ON public.campaign_assignee_stats_daily (day, campaign_id);

CREATE TABLE public.contact_call_days (
  contact_id uuid NOT NULL REFERENCES public.contacts (id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  assignee_id uuid REFERENCES public.telepastors (id) ON DELETE SET NULL,
  day date NOT NULL,
  last_response public.call_response NOT NULL,
  last_attempt_at timestamptz NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (contact_id, day)
);

CREATE INDEX IF NOT EXISTS contact_call_days_scope_idx
  ON public.contact_call_days (assignee_id, campaign_id, day);

CREATE INDEX IF NOT EXISTS contact_call_days_day_idx
  ON public.contact_call_days (day, campaign_id);

ALTER TABLE public.campaign_assignee_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_assignee_stats_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_call_days ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.campaign_assignee_stats FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.campaign_assignee_stats_daily FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.contact_call_days FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.report_utc_day(p_ts timestamptz)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (p_ts AT TIME ZONE 'utc')::date;
$$;

CREATE OR REPLACE FUNCTION public.report_notes_flag(p_notes text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_notes IS NOT NULL AND length(btrim(p_notes)) > 0;
$$;

CREATE OR REPLACE FUNCTION public.apply_campaign_assignee_delta(
  p_campaign_id uuid,
  p_assignee_id uuid,
  p_total_contacts integer,
  p_completed integer,
  p_remaining integer,
  p_coming integer,
  p_not_coming integer,
  p_unreachable integer,
  p_switched_off integer,
  p_wrong_number integer,
  p_other integer,
  p_with_notes integer,
  p_total_attempts integer,
  p_last_attempt_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_campaign_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.campaign_assignee_stats (
    campaign_id,
    assignee_id,
    total_contacts,
    completed,
    remaining,
    coming,
    not_coming,
    unreachable,
    switched_off,
    wrong_number,
    other,
    with_notes,
    total_attempts,
    last_attempt_at
  )
  VALUES (
    p_campaign_id,
    p_assignee_id,
    p_total_contacts,
    p_completed,
    p_remaining,
    p_coming,
    p_not_coming,
    p_unreachable,
    p_switched_off,
    p_wrong_number,
    p_other,
    p_with_notes,
    p_total_attempts,
    p_last_attempt_at
  )
  ON CONFLICT (campaign_id, assignee_key) DO UPDATE
  SET
    total_contacts = public.campaign_assignee_stats.total_contacts + EXCLUDED.total_contacts,
    completed = public.campaign_assignee_stats.completed + EXCLUDED.completed,
    remaining = public.campaign_assignee_stats.remaining + EXCLUDED.remaining,
    coming = public.campaign_assignee_stats.coming + EXCLUDED.coming,
    not_coming = public.campaign_assignee_stats.not_coming + EXCLUDED.not_coming,
    unreachable = public.campaign_assignee_stats.unreachable + EXCLUDED.unreachable,
    switched_off = public.campaign_assignee_stats.switched_off + EXCLUDED.switched_off,
    wrong_number = public.campaign_assignee_stats.wrong_number + EXCLUDED.wrong_number,
    other = public.campaign_assignee_stats.other + EXCLUDED.other,
    with_notes = public.campaign_assignee_stats.with_notes + EXCLUDED.with_notes,
    total_attempts = public.campaign_assignee_stats.total_attempts + EXCLUDED.total_attempts,
    last_attempt_at = CASE
      WHEN public.campaign_assignee_stats.total_attempts + EXCLUDED.total_attempts <= 0 THEN NULL
      WHEN EXCLUDED.last_attempt_at IS NOT NULL THEN
        GREATEST(public.campaign_assignee_stats.last_attempt_at, EXCLUDED.last_attempt_at)
      ELSE public.campaign_assignee_stats.last_attempt_at
    END;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_contact_stat_delta(
  p_campaign_id uuid,
  p_assignee_id uuid,
  p_response public.call_response,
  p_has_notes boolean,
  p_sign integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.apply_campaign_assignee_delta(
    p_campaign_id,
    p_assignee_id,
    p_sign,
    CASE WHEN p_response IS NOT NULL THEN p_sign ELSE 0 END,
    CASE WHEN p_response IS NULL THEN p_sign ELSE 0 END,
    CASE WHEN p_response = 'COMING' THEN p_sign ELSE 0 END,
    CASE WHEN p_response = 'NOT_COMING' THEN p_sign ELSE 0 END,
    CASE WHEN p_response = 'UNREACHABLE' THEN p_sign ELSE 0 END,
    CASE WHEN p_response = 'SWITCHED_OFF' THEN p_sign ELSE 0 END,
    CASE WHEN p_response = 'WRONG_NUMBER' THEN p_sign ELSE 0 END,
    CASE WHEN p_response = 'OTHER' THEN p_sign ELSE 0 END,
    CASE WHEN p_has_notes THEN p_sign ELSE 0 END,
    0,
    NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_daily_attempt_delta(
  p_campaign_id uuid,
  p_assignee_id uuid,
  p_day date,
  p_attempts integer,
  p_last_attempt_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_campaign_id IS NULL OR p_day IS NULL OR p_attempts = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.campaign_assignee_stats_daily (
    campaign_id,
    assignee_id,
    day,
    total_attempts,
    last_attempt_at
  )
  VALUES (
    p_campaign_id,
    p_assignee_id,
    p_day,
    p_attempts,
    p_last_attempt_at
  )
  ON CONFLICT (campaign_id, assignee_key, day) DO UPDATE
  SET
    total_attempts = public.campaign_assignee_stats_daily.total_attempts + EXCLUDED.total_attempts,
    last_attempt_at = CASE
      WHEN public.campaign_assignee_stats_daily.total_attempts + EXCLUDED.total_attempts <= 0 THEN NULL
      WHEN EXCLUDED.last_attempt_at IS NOT NULL THEN
        GREATEST(
          public.campaign_assignee_stats_daily.last_attempt_at,
          EXCLUDED.last_attempt_at
        )
      ELSE public.campaign_assignee_stats_daily.last_attempt_at
    END;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_contact_call_day(
  p_contact_id uuid,
  p_campaign_id uuid,
  p_assignee_id uuid,
  p_day date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_last_at timestamptz;
  v_response public.call_response;
BEGIN
  SELECT
    count(*)::integer,
    max(ca.attempted_at),
    (
      ARRAY_AGG(ca.response ORDER BY ca.attempted_at DESC, ca.id DESC)
    )[1]
  INTO v_count, v_last_at, v_response
  FROM public.call_attempts ca
  WHERE ca.contact_id = p_contact_id
    AND public.report_utc_day(ca.attempted_at) = p_day;

  IF COALESCE(v_count, 0) = 0 THEN
    DELETE FROM public.contact_call_days
    WHERE contact_id = p_contact_id
      AND day = p_day;
    RETURN;
  END IF;

  INSERT INTO public.contact_call_days (
    contact_id,
    campaign_id,
    assignee_id,
    day,
    last_response,
    last_attempt_at,
    attempt_count
  )
  VALUES (
    p_contact_id,
    p_campaign_id,
    p_assignee_id,
    p_day,
    v_response,
    v_last_at,
    v_count
  )
  ON CONFLICT (contact_id, day) DO UPDATE
  SET
    campaign_id = EXCLUDED.campaign_id,
    assignee_id = EXCLUDED.assignee_id,
    last_response = EXCLUDED.last_response,
    last_attempt_at = EXCLUDED.last_attempt_at,
    attempt_count = EXCLUDED.attempt_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_campaign_stats_contacts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts integer;
  v_last timestamptz;
  r public.contact_call_days%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.apply_contact_stat_delta(
      NEW.campaign_id,
      NEW.current_assignee_id,
      NEW.latest_response,
      public.report_notes_flag(NEW.latest_notes),
      1
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.apply_contact_stat_delta(
      OLD.campaign_id,
      OLD.current_assignee_id,
      OLD.latest_response,
      public.report_notes_flag(OLD.latest_notes),
      -1
    );
    RETURN OLD;
  END IF;

  IF
    OLD.campaign_id IS NOT DISTINCT FROM NEW.campaign_id
    AND OLD.current_assignee_id IS NOT DISTINCT FROM NEW.current_assignee_id
    AND OLD.latest_response IS NOT DISTINCT FROM NEW.latest_response
    AND public.report_notes_flag(OLD.latest_notes)
      IS NOT DISTINCT FROM public.report_notes_flag(NEW.latest_notes)
  THEN
    RETURN NEW;
  END IF;

  PERFORM public.apply_contact_stat_delta(
    OLD.campaign_id,
    OLD.current_assignee_id,
    OLD.latest_response,
    public.report_notes_flag(OLD.latest_notes),
    -1
  );
  PERFORM public.apply_contact_stat_delta(
    NEW.campaign_id,
    NEW.current_assignee_id,
    NEW.latest_response,
    public.report_notes_flag(NEW.latest_notes),
    1
  );

  IF
    OLD.campaign_id IS DISTINCT FROM NEW.campaign_id
    OR OLD.current_assignee_id IS DISTINCT FROM NEW.current_assignee_id
  THEN
    SELECT COALESCE(sum(d.attempt_count), 0)::integer, max(d.last_attempt_at)
    INTO v_attempts, v_last
    FROM public.contact_call_days d
    WHERE d.contact_id = NEW.id;

    IF v_attempts > 0 THEN
      PERFORM public.apply_campaign_assignee_delta(
        OLD.campaign_id, OLD.current_assignee_id,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -v_attempts, NULL
      );
      PERFORM public.apply_campaign_assignee_delta(
        NEW.campaign_id, NEW.current_assignee_id,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, v_attempts, v_last
      );
    END IF;

    FOR r IN
      SELECT * FROM public.contact_call_days WHERE contact_id = NEW.id
    LOOP
      PERFORM public.apply_daily_attempt_delta(
        OLD.campaign_id, OLD.current_assignee_id, r.day, -r.attempt_count, NULL
      );
      PERFORM public.apply_daily_attempt_delta(
        NEW.campaign_id, NEW.current_assignee_id, r.day, r.attempt_count, r.last_attempt_at
      );
    END LOOP;

    UPDATE public.contact_call_days
    SET
      campaign_id = NEW.campaign_id,
      assignee_id = NEW.current_assignee_id
    WHERE contact_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_campaign_stats_call_attempts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_id uuid;
  v_assignee_id uuid;
  v_day date;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT c.campaign_id, c.current_assignee_id
    INTO v_campaign_id, v_assignee_id
    FROM public.contacts c
    WHERE c.id = NEW.contact_id;

    v_day := public.report_utc_day(NEW.attempted_at);

    PERFORM public.apply_campaign_assignee_delta(
      v_campaign_id, v_assignee_id,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, NEW.attempted_at
    );
    PERFORM public.apply_daily_attempt_delta(
      v_campaign_id, v_assignee_id, v_day, 1, NEW.attempted_at
    );
    PERFORM public.sync_contact_call_day(
      NEW.contact_id, v_campaign_id, v_assignee_id, v_day
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT c.campaign_id, c.current_assignee_id
    INTO v_campaign_id, v_assignee_id
    FROM public.contacts c
    WHERE c.id = OLD.contact_id;

    IF NOT FOUND THEN
      v_campaign_id := OLD.campaign_id;
      v_assignee_id := NULL;
    END IF;

    v_day := public.report_utc_day(OLD.attempted_at);

    PERFORM public.apply_campaign_assignee_delta(
      v_campaign_id, v_assignee_id,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, NULL
    );
    PERFORM public.apply_daily_attempt_delta(
      v_campaign_id, v_assignee_id, v_day, -1, NULL
    );
    PERFORM public.sync_contact_call_day(
      OLD.contact_id, COALESCE(v_campaign_id, OLD.campaign_id), v_assignee_id, v_day
    );
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF
      OLD.contact_id IS NOT DISTINCT FROM NEW.contact_id
      AND OLD.attempted_at IS NOT DISTINCT FROM NEW.attempted_at
      AND OLD.response IS NOT DISTINCT FROM NEW.response
      AND OLD.campaign_id IS NOT DISTINCT FROM NEW.campaign_id
    THEN
      RETURN NEW;
    END IF;

    SELECT c.campaign_id, c.current_assignee_id
    INTO v_campaign_id, v_assignee_id
    FROM public.contacts c
    WHERE c.id = OLD.contact_id;

    v_day := public.report_utc_day(OLD.attempted_at);
    PERFORM public.apply_campaign_assignee_delta(
      COALESCE(v_campaign_id, OLD.campaign_id), v_assignee_id,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, NULL
    );
    PERFORM public.apply_daily_attempt_delta(
      COALESCE(v_campaign_id, OLD.campaign_id), v_assignee_id, v_day, -1, NULL
    );
    PERFORM public.sync_contact_call_day(
      OLD.contact_id, COALESCE(v_campaign_id, OLD.campaign_id), v_assignee_id, v_day
    );

    SELECT c.campaign_id, c.current_assignee_id
    INTO v_campaign_id, v_assignee_id
    FROM public.contacts c
    WHERE c.id = NEW.contact_id;

    v_day := public.report_utc_day(NEW.attempted_at);
    PERFORM public.apply_campaign_assignee_delta(
      v_campaign_id, v_assignee_id,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, NEW.attempted_at
    );
    PERFORM public.apply_daily_attempt_delta(
      v_campaign_id, v_assignee_id, v_day, 1, NEW.attempted_at
    );
    PERFORM public.sync_contact_call_day(
      NEW.contact_id, v_campaign_id, v_assignee_id, v_day
    );
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_campaign_stats_contacts ON public.contacts;
CREATE TRIGGER trg_campaign_stats_contacts
  AFTER INSERT OR UPDATE OR DELETE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_campaign_stats_contacts();

DROP TRIGGER IF EXISTS trg_campaign_stats_call_attempts ON public.call_attempts;
CREATE TRIGGER trg_campaign_stats_call_attempts
  AFTER INSERT OR UPDATE OR DELETE ON public.call_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_campaign_stats_call_attempts();

CREATE OR REPLACE FUNCTION public.rebuild_report_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  ALTER TABLE public.contacts DISABLE TRIGGER trg_campaign_stats_contacts;
  ALTER TABLE public.call_attempts DISABLE TRIGGER trg_campaign_stats_call_attempts;

  TRUNCATE public.campaign_assignee_stats;
  TRUNCATE public.campaign_assignee_stats_daily;
  TRUNCATE public.contact_call_days;

  INSERT INTO public.contact_call_days (
    contact_id,
    campaign_id,
    assignee_id,
    day,
    last_response,
    last_attempt_at,
    attempt_count
  )
  SELECT
    ca.contact_id,
    c.campaign_id,
    c.current_assignee_id,
    public.report_utc_day(ca.attempted_at),
    (ARRAY_AGG(ca.response ORDER BY ca.attempted_at DESC, ca.id DESC))[1],
    max(ca.attempted_at),
    count(*)::integer
  FROM public.call_attempts ca
  INNER JOIN public.contacts c ON c.id = ca.contact_id
  GROUP BY
    ca.contact_id,
    c.campaign_id,
    c.current_assignee_id,
    public.report_utc_day(ca.attempted_at);

  INSERT INTO public.campaign_assignee_stats (
    campaign_id,
    assignee_id,
    total_contacts,
    completed,
    remaining,
    coming,
    not_coming,
    unreachable,
    switched_off,
    wrong_number,
    other,
    with_notes,
    total_attempts,
    last_attempt_at
  )
  SELECT
    c.campaign_id,
    c.current_assignee_id,
    count(*)::integer,
    count(*) FILTER (WHERE c.latest_response IS NOT NULL)::integer,
    count(*) FILTER (WHERE c.latest_response IS NULL)::integer,
    count(*) FILTER (WHERE c.latest_response = 'COMING')::integer,
    count(*) FILTER (WHERE c.latest_response = 'NOT_COMING')::integer,
    count(*) FILTER (WHERE c.latest_response = 'UNREACHABLE')::integer,
    count(*) FILTER (WHERE c.latest_response = 'SWITCHED_OFF')::integer,
    count(*) FILTER (WHERE c.latest_response = 'WRONG_NUMBER')::integer,
    count(*) FILTER (WHERE c.latest_response = 'OTHER')::integer,
    count(*) FILTER (WHERE public.report_notes_flag(c.latest_notes))::integer,
    0,
    NULL
  FROM public.contacts c
  GROUP BY c.campaign_id, c.current_assignee_id;

  INSERT INTO public.campaign_assignee_stats (
    campaign_id,
    assignee_id,
    total_attempts,
    last_attempt_at
  )
  SELECT
    d.campaign_id,
    d.assignee_id,
    sum(d.attempt_count)::integer,
    max(d.last_attempt_at)
  FROM public.contact_call_days d
  GROUP BY d.campaign_id, d.assignee_id
  ON CONFLICT (campaign_id, assignee_key) DO UPDATE
  SET
    total_attempts = EXCLUDED.total_attempts,
    last_attempt_at = EXCLUDED.last_attempt_at;

  INSERT INTO public.campaign_assignee_stats_daily (
    campaign_id,
    assignee_id,
    day,
    total_attempts,
    last_attempt_at
  )
  SELECT
    d.campaign_id,
    d.assignee_id,
    d.day,
    sum(d.attempt_count)::integer,
    max(d.last_attempt_at)
  FROM public.contact_call_days d
  GROUP BY d.campaign_id, d.assignee_id, d.day;

  ALTER TABLE public.contacts ENABLE TRIGGER trg_campaign_stats_contacts;
  ALTER TABLE public.call_attempts ENABLE TRIGGER trg_campaign_stats_call_attempts;
EXCEPTION
  WHEN OTHERS THEN
    ALTER TABLE public.contacts ENABLE TRIGGER trg_campaign_stats_contacts;
    ALTER TABLE public.call_attempts ENABLE TRIGGER trg_campaign_stats_call_attempts;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.rebuild_report_stats() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.report_contact_universe(
  p_assignee_ids uuid[],
  p_scope_all boolean,
  p_campaign_id uuid,
  p_response text,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE (
  contact_id uuid,
  campaign_id uuid,
  current_assignee_id uuid,
  response public.call_response,
  latest_notes text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_from IS NOT NULL OR p_to IS NOT NULL THEN
    RETURN QUERY
    SELECT
      period.contact_id,
      period.campaign_id,
      period.assignee_id,
      period.last_response,
      c.latest_notes
    FROM (
      SELECT DISTINCT ON (d.contact_id)
        d.contact_id,
        d.campaign_id,
        d.assignee_id,
        d.last_response,
        d.last_attempt_at
      FROM public.contact_call_days d
      WHERE (
          p_scope_all
          OR d.assignee_id = ANY (p_assignee_ids)
        )
        AND (p_campaign_id IS NULL OR d.campaign_id = p_campaign_id)
        AND (p_from IS NULL OR d.day >= public.report_utc_day(p_from))
        AND (p_to IS NULL OR d.day <= public.report_utc_day(p_to))
        AND (p_from IS NULL OR d.last_attempt_at >= p_from)
        AND (p_to IS NULL OR d.last_attempt_at <= p_to)
      ORDER BY d.contact_id, d.last_attempt_at DESC
    ) period
    INNER JOIN public.contacts c ON c.id = period.contact_id
    WHERE p_response IS NULL OR period.last_response::text = p_response;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.campaign_id,
    c.current_assignee_id,
    c.latest_response,
    c.latest_notes
  FROM public.contacts c
  WHERE (
      p_scope_all
      OR c.current_assignee_id = ANY (p_assignee_ids)
    )
    AND (p_campaign_id IS NULL OR c.campaign_id = p_campaign_id)
    AND (p_response IS NULL OR c.latest_response::text = p_response);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_leadership_dashboard_stats(
  p_assignee_ids uuid[] DEFAULT NULL,
  p_scope_all boolean DEFAULT false,
  p_campaign_id uuid DEFAULT NULL,
  p_response text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID;
  actor_role public.ministry_role;
  v_total bigint := 0;
  v_assigned bigint := 0;
  v_unassigned bigint := 0;
  v_completed bigint := 0;
  v_remaining bigint := 0;
  v_coming bigint := 0;
  v_not_coming bigint := 0;
  v_unreachable bigint := 0;
  v_switched_off bigint := 0;
  v_wrong_number bigint := 0;
  v_other bigint := 0;
  v_notes bigint := 0;
  v_active_campaigns bigint := 0;
  v_attempts bigint := 0;
  v_has_period boolean := false;
  v_use_counters boolean := false;
BEGIN
  actor_id := public.current_telepastor_id();
  actor_role := public.current_ministry_role();

  IF actor_id IS NULL OR actor_role IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF actor_role NOT IN ('SUPER_ADMIN', 'GOVERNOR', 'LEADER') THEN
    RAISE EXCEPTION 'Not authorized for leadership dashboard stats';
  END IF;

  IF p_scope_all AND actor_role <> 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'scope_all is only allowed for SUPER_ADMIN';
  END IF;

  IF NOT p_scope_all AND (p_assignee_ids IS NULL OR cardinality(p_assignee_ids) = 0) THEN
    RETURN jsonb_build_object(
      'totalContacts', 0,
      'assigned', 0,
      'unassigned', 0,
      'completed', 0,
      'remaining', 0,
      'coming', 0,
      'notComing', 0,
      'unreachable', 0,
      'switchedOff', 0,
      'wrongNumber', 0,
      'other', 0,
      'contactsWithNotes', 0,
      'activeCampaigns', 0,
      'totalCallAttempts', 0
    );
  END IF;

  v_has_period := p_from IS NOT NULL OR p_to IS NOT NULL;
  v_use_counters := (NOT v_has_period) AND p_response IS NULL;

  IF v_use_counters THEN
    SELECT
      COALESCE(sum(s.total_contacts), 0),
      COALESCE(sum(s.total_contacts) FILTER (WHERE s.assignee_id IS NOT NULL), 0),
      COALESCE(sum(s.total_contacts) FILTER (WHERE s.assignee_id IS NULL), 0),
      COALESCE(sum(s.completed), 0),
      COALESCE(sum(s.remaining), 0),
      COALESCE(sum(s.coming), 0),
      COALESCE(sum(s.not_coming), 0),
      COALESCE(sum(s.unreachable), 0),
      COALESCE(sum(s.switched_off), 0),
      COALESCE(sum(s.wrong_number), 0),
      COALESCE(sum(s.other), 0),
      COALESCE(sum(s.with_notes), 0),
      COALESCE(sum(s.total_attempts), 0)
    INTO
      v_total,
      v_assigned,
      v_unassigned,
      v_completed,
      v_remaining,
      v_coming,
      v_not_coming,
      v_unreachable,
      v_switched_off,
      v_wrong_number,
      v_other,
      v_notes,
      v_attempts
    FROM public.campaign_assignee_stats s
    WHERE (p_campaign_id IS NULL OR s.campaign_id = p_campaign_id)
      AND (
        p_scope_all
        OR s.assignee_id = ANY (p_assignee_ids)
      );
  ELSE
    SELECT
      count(*),
      count(*) FILTER (WHERE u.current_assignee_id IS NOT NULL),
      count(*) FILTER (WHERE u.current_assignee_id IS NULL),
      count(*) FILTER (WHERE u.response IS NOT NULL),
      count(*) FILTER (WHERE u.response IS NULL),
      count(*) FILTER (WHERE u.response = 'COMING'),
      count(*) FILTER (WHERE u.response = 'NOT_COMING'),
      count(*) FILTER (WHERE u.response = 'UNREACHABLE'),
      count(*) FILTER (WHERE u.response = 'SWITCHED_OFF'),
      count(*) FILTER (WHERE u.response = 'WRONG_NUMBER'),
      count(*) FILTER (WHERE u.response = 'OTHER'),
      count(*) FILTER (
        WHERE u.latest_notes IS NOT NULL AND length(btrim(u.latest_notes)) > 0
      )
    INTO
      v_total,
      v_assigned,
      v_unassigned,
      v_completed,
      v_remaining,
      v_coming,
      v_not_coming,
      v_unreachable,
      v_switched_off,
      v_wrong_number,
      v_other,
      v_notes
    FROM public.report_contact_universe(
      p_assignee_ids,
      p_scope_all,
      p_campaign_id,
      p_response,
      p_from,
      p_to
    ) u;

    IF v_has_period AND p_response IS NULL THEN
      SELECT COALESCE(sum(d.total_attempts), 0)
      INTO v_attempts
      FROM public.campaign_assignee_stats_daily d
      WHERE (p_campaign_id IS NULL OR d.campaign_id = p_campaign_id)
        AND (
          p_scope_all
          OR d.assignee_id = ANY (p_assignee_ids)
        )
        AND (p_from IS NULL OR d.day >= public.report_utc_day(p_from))
        AND (p_to IS NULL OR d.day <= public.report_utc_day(p_to));
    ELSE
      SELECT count(*)
      INTO v_attempts
      FROM public.call_attempts ca
      WHERE (p_from IS NULL OR ca.attempted_at >= p_from)
        AND (p_to IS NULL OR ca.attempted_at <= p_to)
        AND EXISTS (
          SELECT 1
          FROM public.contacts c
          WHERE c.id = ca.contact_id
            AND (
              p_scope_all
              OR c.current_assignee_id = ANY (p_assignee_ids)
            )
            AND (p_campaign_id IS NULL OR c.campaign_id = p_campaign_id)
            AND (
              p_response IS NULL
              OR (
                CASE
                  WHEN v_has_period THEN ca.response::text = p_response
                  ELSE c.latest_response::text = p_response
                END
              )
            )
        );
    END IF;
  END IF;

  IF p_scope_all AND NOT v_has_period THEN
    SELECT count(*)
    INTO v_active_campaigns
    FROM public.campaigns camp
    WHERE camp.status = 'ACTIVE'
      AND (p_campaign_id IS NULL OR camp.id = p_campaign_id);
  ELSIF v_has_period THEN
    SELECT count(DISTINCT u.campaign_id)
    INTO v_active_campaigns
    FROM public.report_contact_universe(
      p_assignee_ids,
      p_scope_all,
      p_campaign_id,
      p_response,
      p_from,
      p_to
    ) u
    INNER JOIN public.campaigns camp ON camp.id = u.campaign_id
    WHERE camp.status = 'ACTIVE';
  ELSE
    SELECT count(*)
    INTO v_active_campaigns
    FROM public.campaigns camp
    WHERE camp.status = 'ACTIVE'
      AND (p_campaign_id IS NULL OR camp.id = p_campaign_id)
      AND EXISTS (
        SELECT 1
        FROM public.campaign_assignee_stats s
        WHERE s.campaign_id = camp.id
          AND s.assignee_id = ANY (p_assignee_ids)
          AND s.total_contacts > 0
      );
  END IF;

  RETURN jsonb_build_object(
    'totalContacts', v_total,
    'assigned', v_assigned,
    'unassigned', v_unassigned,
    'completed', v_completed,
    'remaining', v_remaining,
    'coming', v_coming,
    'notComing', v_not_coming,
    'unreachable', v_unreachable,
    'switchedOff', v_switched_off,
    'wrongNumber', v_wrong_number,
    'other', v_other,
    'contactsWithNotes', v_notes,
    'activeCampaigns', v_active_campaigns,
    'totalCallAttempts', v_attempts
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_report_team_performance(
  p_assignee_ids uuid[] DEFAULT NULL,
  p_scope_all boolean DEFAULT false,
  p_campaign_id uuid DEFAULT NULL,
  p_response text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID;
  actor_role public.ministry_role;
  v_has_period boolean := false;
  v_use_counters boolean := false;
  v_result jsonb;
BEGIN
  actor_id := public.current_telepastor_id();
  actor_role := public.current_ministry_role();

  IF actor_id IS NULL OR actor_role IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF actor_role NOT IN ('SUPER_ADMIN', 'GOVERNOR', 'LEADER') THEN
    RAISE EXCEPTION 'Not authorized for team performance stats';
  END IF;

  IF p_scope_all AND actor_role <> 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'scope_all is only allowed for SUPER_ADMIN';
  END IF;

  IF NOT p_scope_all AND (p_assignee_ids IS NULL OR cardinality(p_assignee_ids) = 0) THEN
    RETURN jsonb_build_object(
      'memberRows', '[]'::jsonb,
      'governorRows', '[]'::jsonb
    );
  END IF;

  v_has_period := p_from IS NOT NULL OR p_to IS NOT NULL;
  v_use_counters := (NOT v_has_period) AND p_response IS NULL;

  IF v_use_counters THEN
    WITH member_stats AS (
      SELECT
        s.assignee_id AS member_id,
        sum(s.total_contacts)::bigint AS total_contacts,
        sum(s.completed)::bigint AS completed,
        sum(s.remaining)::bigint AS remaining,
        sum(s.coming)::bigint AS coming,
        sum(s.not_coming)::bigint AS not_coming,
        sum(s.unreachable)::bigint AS unreachable,
        sum(s.switched_off)::bigint AS switched_off,
        sum(s.wrong_number)::bigint AS wrong_number,
        sum(s.other)::bigint AS other
      FROM public.campaign_assignee_stats s
      WHERE s.assignee_id IS NOT NULL
        AND (p_scope_all OR s.assignee_id = ANY (p_assignee_ids))
        AND (p_campaign_id IS NULL OR s.campaign_id = p_campaign_id)
      GROUP BY s.assignee_id
    ),
    member_attempts AS (
      SELECT
        s.assignee_id AS member_id,
        sum(s.total_attempts)::bigint AS total_attempts,
        max(s.last_attempt_at) AS last_attempt_at
      FROM public.campaign_assignee_stats s
      WHERE s.assignee_id IS NOT NULL
        AND (p_scope_all OR s.assignee_id = ANY (p_assignee_ids))
        AND (p_campaign_id IS NULL OR s.campaign_id = p_campaign_id)
      GROUP BY s.assignee_id
    ),
    governor_map AS (
      SELECT
        t.id AS member_id,
        CASE t.role
          WHEN 'GOVERNOR' THEN t.id
          WHEN 'LEADER' THEN t.governor_id
          WHEN 'TELEPASTOR' THEN COALESCE(leader.governor_id, t.governor_id)
          ELSE NULL
        END AS governor_id
      FROM public.telepastors t
      LEFT JOIN public.telepastors leader ON leader.id = t.leader_id
    ),
    member_rows AS (
      SELECT
        jsonb_build_object(
          'memberId', t.id,
          'memberName', t.name,
          'memberRole', t.role::text,
          'totalContacts', ms.total_contacts,
          'assigned', ms.total_contacts,
          'unassigned', 0,
          'completed', ms.completed,
          'remaining', ms.remaining,
          'coming', ms.coming,
          'notComing', ms.not_coming,
          'unreachable', ms.unreachable,
          'switchedOff', ms.switched_off,
          'wrongNumber', ms.wrong_number,
          'other', ms.other,
          'totalCallAttempts', COALESCE(ma.total_attempts, 0),
          'lastAttemptAt', ma.last_attempt_at
        ) AS row,
        ms.completed
      FROM member_stats ms
      INNER JOIN public.telepastors t ON t.id = ms.member_id
      LEFT JOIN member_attempts ma ON ma.member_id = ms.member_id
      WHERE t.is_active
        AND t.role IN ('LEADER', 'TELEPASTOR')
        AND (ms.total_contacts > 0 OR COALESCE(ma.total_attempts, 0) > 0)
    ),
    governor_rows AS (
      SELECT
        jsonb_build_object(
          'memberId', g.id,
          'memberName', g.name,
          'memberRole', g.role::text,
          'totalContacts', sum(ms.total_contacts),
          'assigned', sum(ms.total_contacts),
          'unassigned', 0,
          'completed', sum(ms.completed),
          'remaining', sum(ms.remaining),
          'coming', sum(ms.coming),
          'notComing', sum(ms.not_coming),
          'unreachable', sum(ms.unreachable),
          'switchedOff', sum(ms.switched_off),
          'wrongNumber', sum(ms.wrong_number),
          'other', sum(ms.other),
          'totalCallAttempts', sum(COALESCE(ma.total_attempts, 0)),
          'lastAttemptAt', max(ma.last_attempt_at)
        ) AS row,
        sum(ms.completed) AS completed
      FROM member_stats ms
      LEFT JOIN member_attempts ma ON ma.member_id = ms.member_id
      INNER JOIN governor_map gm ON gm.member_id = ms.member_id
      INNER JOIN public.telepastors g
        ON g.id = gm.governor_id
       AND g.role = 'GOVERNOR'
       AND g.is_active
      GROUP BY g.id, g.name, g.role
      HAVING sum(ms.total_contacts) > 0
          OR sum(COALESCE(ma.total_attempts, 0)) > 0
    )
    SELECT jsonb_build_object(
      'memberRows', COALESCE(
        (
          SELECT jsonb_agg(member_rows.row ORDER BY member_rows.completed DESC)
          FROM member_rows
        ),
        '[]'::jsonb
      ),
      'governorRows', COALESCE(
        (
          SELECT jsonb_agg(governor_rows.row ORDER BY governor_rows.completed DESC)
          FROM governor_rows
        ),
        '[]'::jsonb
      )
    )
    INTO v_result;
  ELSE
    WITH universe AS (
      SELECT contact_id, current_assignee_id, response
      FROM public.report_contact_universe(
        p_assignee_ids,
        p_scope_all,
        p_campaign_id,
        p_response,
        p_from,
        p_to
      )
    ),
    member_stats AS (
      SELECT
        u.current_assignee_id AS member_id,
        count(*)::bigint AS total_contacts,
        count(*) FILTER (WHERE u.response IS NOT NULL)::bigint AS completed,
        count(*) FILTER (WHERE u.response IS NULL)::bigint AS remaining,
        count(*) FILTER (WHERE u.response = 'COMING')::bigint AS coming,
        count(*) FILTER (WHERE u.response = 'NOT_COMING')::bigint AS not_coming,
        count(*) FILTER (WHERE u.response = 'UNREACHABLE')::bigint AS unreachable,
        count(*) FILTER (WHERE u.response = 'SWITCHED_OFF')::bigint AS switched_off,
        count(*) FILTER (WHERE u.response = 'WRONG_NUMBER')::bigint AS wrong_number,
        count(*) FILTER (WHERE u.response = 'OTHER')::bigint AS other
      FROM universe u
      WHERE u.current_assignee_id IS NOT NULL
      GROUP BY u.current_assignee_id
    ),
    member_attempts AS (
      SELECT
        d.assignee_id AS member_id,
        sum(d.total_attempts)::bigint AS total_attempts,
        max(d.last_attempt_at) AS last_attempt_at
      FROM public.campaign_assignee_stats_daily d
      WHERE v_has_period
        AND p_response IS NULL
        AND d.assignee_id IS NOT NULL
        AND (p_scope_all OR d.assignee_id = ANY (p_assignee_ids))
        AND (p_campaign_id IS NULL OR d.campaign_id = p_campaign_id)
        AND (p_from IS NULL OR d.day >= public.report_utc_day(p_from))
        AND (p_to IS NULL OR d.day <= public.report_utc_day(p_to))
      GROUP BY d.assignee_id

      UNION ALL

      SELECT
        u.current_assignee_id AS member_id,
        count(*)::bigint AS total_attempts,
        max(ca.attempted_at) AS last_attempt_at
      FROM public.call_attempts ca
      INNER JOIN universe u ON u.contact_id = ca.contact_id
      WHERE NOT (v_has_period AND p_response IS NULL)
        AND u.current_assignee_id IS NOT NULL
        AND (p_from IS NULL OR ca.attempted_at >= p_from)
        AND (p_to IS NULL OR ca.attempted_at <= p_to)
      GROUP BY u.current_assignee_id
    ),
    governor_map AS (
      SELECT
        t.id AS member_id,
        CASE t.role
          WHEN 'GOVERNOR' THEN t.id
          WHEN 'LEADER' THEN t.governor_id
          WHEN 'TELEPASTOR' THEN COALESCE(leader.governor_id, t.governor_id)
          ELSE NULL
        END AS governor_id
      FROM public.telepastors t
      LEFT JOIN public.telepastors leader ON leader.id = t.leader_id
    ),
    member_rows AS (
      SELECT
        jsonb_build_object(
          'memberId', t.id,
          'memberName', t.name,
          'memberRole', t.role::text,
          'totalContacts', ms.total_contacts,
          'assigned', ms.total_contacts,
          'unassigned', 0,
          'completed', ms.completed,
          'remaining', ms.remaining,
          'coming', ms.coming,
          'notComing', ms.not_coming,
          'unreachable', ms.unreachable,
          'switchedOff', ms.switched_off,
          'wrongNumber', ms.wrong_number,
          'other', ms.other,
          'totalCallAttempts', COALESCE(ma.total_attempts, 0),
          'lastAttemptAt', ma.last_attempt_at
        ) AS row,
        ms.completed
      FROM member_stats ms
      INNER JOIN public.telepastors t ON t.id = ms.member_id
      LEFT JOIN member_attempts ma ON ma.member_id = ms.member_id
      WHERE t.is_active
        AND t.role IN ('LEADER', 'TELEPASTOR')
        AND (ms.total_contacts > 0 OR COALESCE(ma.total_attempts, 0) > 0)
    ),
    governor_rows AS (
      SELECT
        jsonb_build_object(
          'memberId', g.id,
          'memberName', g.name,
          'memberRole', g.role::text,
          'totalContacts', sum(ms.total_contacts),
          'assigned', sum(ms.total_contacts),
          'unassigned', 0,
          'completed', sum(ms.completed),
          'remaining', sum(ms.remaining),
          'coming', sum(ms.coming),
          'notComing', sum(ms.not_coming),
          'unreachable', sum(ms.unreachable),
          'switchedOff', sum(ms.switched_off),
          'wrongNumber', sum(ms.wrong_number),
          'other', sum(ms.other),
          'totalCallAttempts', sum(COALESCE(ma.total_attempts, 0)),
          'lastAttemptAt', max(ma.last_attempt_at)
        ) AS row,
        sum(ms.completed) AS completed
      FROM member_stats ms
      LEFT JOIN member_attempts ma ON ma.member_id = ms.member_id
      INNER JOIN governor_map gm ON gm.member_id = ms.member_id
      INNER JOIN public.telepastors g
        ON g.id = gm.governor_id
       AND g.role = 'GOVERNOR'
       AND g.is_active
      GROUP BY g.id, g.name, g.role
      HAVING sum(ms.total_contacts) > 0
          OR sum(COALESCE(ma.total_attempts, 0)) > 0
    )
    SELECT jsonb_build_object(
      'memberRows', COALESCE(
        (
          SELECT jsonb_agg(member_rows.row ORDER BY member_rows.completed DESC)
          FROM member_rows
        ),
        '[]'::jsonb
      ),
      'governorRows', COALESCE(
        (
          SELECT jsonb_agg(governor_rows.row ORDER BY governor_rows.completed DESC)
          FROM governor_rows
        ),
        '[]'::jsonb
      )
    )
    INTO v_result;
  END IF;

  RETURN COALESCE(
    v_result,
    jsonb_build_object('memberRows', '[]'::jsonb, 'governorRows', '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_call_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID;
  v_result jsonb;
BEGIN
  actor_id := public.current_telepastor_id();

  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT jsonb_build_object(
    'assigned', COALESCE(sum(s.total_contacts), 0),
    'completed', COALESCE(sum(s.completed), 0),
    'remaining', COALESCE(sum(s.remaining), 0),
    'coming', COALESCE(sum(s.coming), 0),
    'notComing', COALESCE(sum(s.not_coming), 0),
    'unreachable', COALESCE(sum(s.unreachable), 0),
    'switchedOff', COALESCE(sum(s.switched_off), 0),
    'wrongNumber', COALESCE(sum(s.wrong_number), 0),
    'other', COALESCE(sum(s.other), 0),
    'contactsWithNotes', COALESCE(sum(s.with_notes), 0)
  )
  INTO v_result
  FROM public.campaign_assignee_stats s
  WHERE s.assignee_id = actor_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leadership_dashboard_stats(
  uuid[], boolean, uuid, text, timestamptz, timestamptz
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_report_team_performance(
  uuid[], boolean, uuid, text, timestamptz, timestamptz
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_call_stats() TO authenticated;

SELECT public.rebuild_report_stats();

NOTIFY pgrst, 'reload schema';


