-- Add SWITCHED_OFF as a call outcome (phone off).
ALTER TYPE public.call_response ADD VALUE IF NOT EXISTS 'SWITCHED_OFF';
