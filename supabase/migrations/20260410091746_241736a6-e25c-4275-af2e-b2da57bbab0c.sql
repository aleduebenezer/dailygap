CREATE TABLE public.calendars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  niche TEXT NOT NULL,
  start_date DATE NOT NULL,
  posts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own calendars" ON public.calendars FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own calendars" ON public.calendars FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own calendars" ON public.calendars FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own calendars" ON public.calendars FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_calendars_updated_at
BEFORE UPDATE ON public.calendars
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();