CREATE TABLE public.linkedin_auto_reposts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  last_reposted_at TIMESTAMPTZ,
  last_reposted_urn TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.linkedin_auto_reposts TO authenticated;
GRANT ALL ON public.linkedin_auto_reposts TO service_role;

ALTER TABLE public.linkedin_auto_reposts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own auto-repost setting"
  ON public.linkedin_auto_reposts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own auto-repost setting"
  ON public.linkedin_auto_reposts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own auto-repost setting"
  ON public.linkedin_auto_reposts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete their own auto-repost setting"
  ON public.linkedin_auto_reposts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_linkedin_auto_reposts_updated_at
  BEFORE UPDATE ON public.linkedin_auto_reposts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();