-- Phase 2: profile picture storage and search support

CREATE INDEX IF NOT EXISTS telepastors_name_lower_idx ON public.telepastors (lower(name));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-pictures',
  'profile-pictures',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.profile_picture_telepastor_id(object_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF((string_to_array(object_name, '/'))[1], '')::uuid;
$$;

CREATE POLICY "Profile pictures are publicly readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'profile-pictures');

CREATE POLICY "Authorized users can upload profile pictures"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-pictures'
  AND (
    public.can_manage_telepastor(public.profile_picture_telepastor_id(name))
    OR public.profile_picture_telepastor_id(name) = public.current_telepastor_id()
  )
);

CREATE POLICY "Authorized users can update profile pictures"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-pictures'
  AND (
    public.can_manage_telepastor(public.profile_picture_telepastor_id(name))
    OR public.profile_picture_telepastor_id(name) = public.current_telepastor_id()
  )
)
WITH CHECK (
  bucket_id = 'profile-pictures'
  AND (
    public.can_manage_telepastor(public.profile_picture_telepastor_id(name))
    OR public.profile_picture_telepastor_id(name) = public.current_telepastor_id()
  )
);

CREATE POLICY "Authorized users can delete profile pictures"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-pictures'
  AND (
    public.can_manage_telepastor(public.profile_picture_telepastor_id(name))
    OR public.profile_picture_telepastor_id(name) = public.current_telepastor_id()
  )
);

GRANT EXECUTE ON FUNCTION public.profile_picture_telepastor_id(text) TO authenticated;
