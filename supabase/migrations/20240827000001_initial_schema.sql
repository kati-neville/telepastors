-- Telepastors Ministry: Phase 1 schema
-- Ministry members (telepastors) are decoupled from auth.users via nullable auth_user_id.

CREATE TYPE public.ministry_role AS ENUM (
  'SUPER_ADMIN',
  'GOVERNOR',
  'LEADER',
  'TELEPASTOR'
);

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.telepastors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  profile_picture_url TEXT,
  date_of_birth DATE,
  occupation TEXT,
  role public.ministry_role NOT NULL DEFAULT 'TELEPASTOR',
  is_active BOOLEAN NOT NULL DEFAULT true,
  leader_id UUID REFERENCES public.telepastors(id) ON DELETE SET NULL,
  governor_id UUID REFERENCES public.telepastors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT telepastors_super_admin_no_hierarchy CHECK (
    role != 'SUPER_ADMIN' OR (leader_id IS NULL AND governor_id IS NULL)
  ),
  CONSTRAINT telepastors_governor_no_hierarchy CHECK (
    role != 'GOVERNOR' OR (leader_id IS NULL AND governor_id IS NULL)
  ),
  CONSTRAINT telepastors_leader_no_leader CHECK (
    role != 'LEADER' OR leader_id IS NULL
  ),
  CONSTRAINT telepastors_telepastor_no_governor CHECK (
    role != 'TELEPASTOR' OR governor_id IS NULL
  )
);

CREATE INDEX telepastors_auth_user_id_idx ON public.telepastors (auth_user_id);
CREATE INDEX telepastors_role_idx ON public.telepastors (role);
CREATE INDEX telepastors_is_active_idx ON public.telepastors (is_active);
CREATE INDEX telepastors_leader_id_idx ON public.telepastors (leader_id);
CREATE INDEX telepastors_governor_id_idx ON public.telepastors (governor_id);
CREATE INDEX telepastors_phone_idx ON public.telepastors (phone);

CREATE TRIGGER telepastors_updated_at
  BEFORE UPDATE ON public.telepastors
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Auth/session helpers (SECURITY DEFINER, search_path locked down)
CREATE OR REPLACE FUNCTION public.current_telepastor_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.telepastors
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_ministry_role()
RETURNS public.ministry_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.telepastors
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_governor_for_telepastor(target_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_role public.ministry_role;
  target_leader_id UUID;
  target_governor_id UUID;
  leader_governor_id UUID;
BEGIN
  SELECT role, leader_id, governor_id
  INTO target_role, target_leader_id, target_governor_id
  FROM public.telepastors
  WHERE id = target_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF target_role = 'GOVERNOR' OR target_role = 'SUPER_ADMIN' THEN
    RETURN NULL;
  END IF;

  IF target_role = 'LEADER' THEN
    RETURN target_governor_id;
  END IF;

  IF target_leader_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT governor_id INTO leader_governor_id
  FROM public.telepastors
  WHERE id = target_leader_id;

  RETURN leader_governor_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_view_telepastor(target_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  viewer_id UUID;
  viewer_role public.ministry_role;
  target_role public.ministry_role;
  target_leader_id UUID;
  target_governor_id UUID;
BEGIN
  viewer_id := public.current_telepastor_id();
  IF viewer_id IS NULL THEN
    RETURN false;
  END IF;

  IF viewer_id = target_id THEN
    RETURN true;
  END IF;

  viewer_role := public.current_ministry_role();
  IF viewer_role = 'SUPER_ADMIN' THEN
    RETURN true;
  END IF;

  SELECT role, leader_id, governor_id
  INTO target_role, target_leader_id, target_governor_id
  FROM public.telepastors
  WHERE id = target_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF viewer_role = 'GOVERNOR' THEN
    IF target_role = 'LEADER' AND target_governor_id = viewer_id THEN
      RETURN true;
    END IF;

    IF target_role = 'TELEPASTOR' AND target_leader_id IS NOT NULL THEN
      IF public.get_governor_for_telepastor(target_id) = viewer_id THEN
        RETURN true;
      END IF;
    END IF;
  END IF;

  IF viewer_role = 'LEADER' THEN
    IF target_role = 'TELEPASTOR' AND target_leader_id = viewer_id THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_telepastor(target_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  viewer_id UUID;
  viewer_role public.ministry_role;
BEGIN
  viewer_id := public.current_telepastor_id();
  IF viewer_id IS NULL OR viewer_id = target_id THEN
    RETURN false;
  END IF;

  viewer_role := public.current_ministry_role();

  IF viewer_role = 'SUPER_ADMIN' THEN
    RETURN true;
  END IF;

  RETURN public.can_view_telepastor(target_id)
    AND viewer_role IN ('GOVERNOR', 'LEADER');
END;
$$;

CREATE OR REPLACE FUNCTION public.can_change_role()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_ministry_role() = 'SUPER_ADMIN';
$$;

ALTER TABLE public.telepastors ENABLE ROW LEVEL SECURITY;

CREATE POLICY telepastors_select_policy ON public.telepastors
  FOR SELECT
  TO authenticated
  USING (public.can_view_telepastor(id));

CREATE POLICY telepastors_insert_policy ON public.telepastors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_ministry_role() = 'SUPER_ADMIN'
    OR (
      public.current_ministry_role() = 'GOVERNOR'
      AND role IN ('LEADER', 'TELEPASTOR')
    )
    OR (
      public.current_ministry_role() = 'LEADER'
      AND role = 'TELEPASTOR'
    )
  );

CREATE POLICY telepastors_update_policy ON public.telepastors
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_telepastor(id) OR id = public.current_telepastor_id())
  WITH CHECK (
    CASE
      WHEN role IS DISTINCT FROM (SELECT t.role FROM public.telepastors t WHERE t.id = telepastors.id)
      THEN public.can_change_role()
      ELSE true
    END
  );

CREATE POLICY telepastors_delete_policy ON public.telepastors
  FOR DELETE
  TO authenticated
  USING (public.current_ministry_role() = 'SUPER_ADMIN');

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telepastors TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_telepastor_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_ministry_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_governor_for_telepastor(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_telepastor(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_telepastor(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_change_role() TO authenticated;
