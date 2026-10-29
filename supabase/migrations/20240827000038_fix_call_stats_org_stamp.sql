-- Fix call response saves after org multitenancy.
-- campaign_assignee_stats_daily and contact_call_days require organization_id,
-- but the helpers used by call_attempts / contacts triggers omitted it,
-- so INSERT into call_attempts failed and the UI showed "Failed to save call response."

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
DECLARE
  v_org uuid;
BEGIN
  IF p_campaign_id IS NULL OR p_day IS NULL OR p_attempts = 0 THEN
    RETURN;
  END IF;

  SELECT organization_id INTO v_org
  FROM public.campaigns
  WHERE id = p_campaign_id;

  IF v_org IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.campaign_assignee_stats_daily (
    campaign_id,
    assignee_id,
    organization_id,
    day,
    total_attempts,
    last_attempt_at
  )
  VALUES (
    p_campaign_id,
    p_assignee_id,
    v_org,
    p_day,
    p_attempts,
    p_last_attempt_at
  )
  ON CONFLICT (campaign_id, assignee_key, day) DO UPDATE
  SET
    organization_id = EXCLUDED.organization_id,
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
  v_org uuid;
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

  SELECT organization_id INTO v_org
  FROM public.campaigns
  WHERE id = p_campaign_id;

  IF v_org IS NULL THEN
    SELECT organization_id INTO v_org
    FROM public.contacts
    WHERE id = p_contact_id;
  END IF;

  IF v_org IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.contact_call_days (
    contact_id,
    campaign_id,
    organization_id,
    assignee_id,
    day,
    last_response,
    last_attempt_at,
    attempt_count
  )
  VALUES (
    p_contact_id,
    p_campaign_id,
    v_org,
    p_assignee_id,
    p_day,
    v_response,
    v_last_at,
    v_count
  )
  ON CONFLICT (contact_id, day) DO UPDATE
  SET
    campaign_id = EXCLUDED.campaign_id,
    organization_id = EXCLUDED.organization_id,
    assignee_id = EXCLUDED.assignee_id,
    last_response = EXCLUDED.last_response,
    last_attempt_at = EXCLUDED.last_attempt_at,
    attempt_count = EXCLUDED.attempt_count;
END;
$$;

NOTIFY pgrst, 'reload schema';
