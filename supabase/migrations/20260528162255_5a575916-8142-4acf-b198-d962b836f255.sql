DELETE FROM public.linkedin_connections a
USING public.linkedin_connections b
WHERE a.linkedin_sub = b.linkedin_sub
  AND a.updated_at < b.updated_at;

ALTER TABLE public.linkedin_connections
  ADD CONSTRAINT linkedin_connections_linkedin_sub_key UNIQUE (linkedin_sub);