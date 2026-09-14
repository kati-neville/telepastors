-- Call script shown to callers on the My Calls queue for this campaign.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS call_script TEXT;
