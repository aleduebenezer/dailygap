
-- Connections table
CREATE TABLE public.linkedin_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  linkedin_sub text NOT NULL,
  linkedin_name text,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.linkedin_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own linkedin connection"
  ON public.linkedin_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own linkedin connection"
  ON public.linkedin_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own linkedin connection"
  ON public.linkedin_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own linkedin connection"
  ON public.linkedin_connections FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_linkedin_connections_updated_at
BEFORE UPDATE ON public.linkedin_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Post log
CREATE TABLE public.linkedin_post_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  calendar_id uuid NOT NULL,
  post_date date NOT NULL,
  post_index integer NOT NULL DEFAULT 0,
  linkedin_post_urn text,
  posted_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'success',
  error text,
  UNIQUE (user_id, calendar_id, post_date, post_index)
);

ALTER TABLE public.linkedin_post_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own post log"
  ON public.linkedin_post_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own post log"
  ON public.linkedin_post_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own post log"
  ON public.linkedin_post_log FOR DELETE USING (auth.uid() = user_id);

-- Cron extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
