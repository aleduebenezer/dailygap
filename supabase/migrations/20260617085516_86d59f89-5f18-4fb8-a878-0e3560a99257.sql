
CREATE TABLE public.linkedin_auto_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  comment_count integer NOT NULL DEFAULT 5,
  comment_types text[] NOT NULL DEFAULT ARRAY['Greeting','Post-related','Well-wishes']::text[],
  attach_media boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.linkedin_auto_comments TO authenticated;
GRANT ALL ON public.linkedin_auto_comments TO service_role;

ALTER TABLE public.linkedin_auto_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own auto-comment settings"
  ON public.linkedin_auto_comments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_linkedin_auto_comments_updated_at
  BEFORE UPDATE ON public.linkedin_auto_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
