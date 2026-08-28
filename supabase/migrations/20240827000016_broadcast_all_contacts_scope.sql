-- Add ALL_CONTACTS broadcast recipient scope

ALTER TYPE public.broadcast_recipient_scope ADD VALUE IF NOT EXISTS 'ALL_CONTACTS';
