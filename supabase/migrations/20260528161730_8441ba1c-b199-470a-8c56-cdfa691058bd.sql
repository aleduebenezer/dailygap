DROP POLICY IF EXISTS "Users update own linkedin connection" ON public.linkedin_connections;

CREATE POLICY "Users update own linkedin connection"
ON public.linkedin_connections
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);