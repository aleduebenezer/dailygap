
CREATE TABLE public.ai_usage_daily (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, usage_date)
);
GRANT SELECT ON public.ai_usage_daily TO authenticated;
GRANT ALL ON public.ai_usage_daily TO service_role;
ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own usage" ON public.ai_usage_daily FOR SELECT USING (auth.uid() = user_id);
