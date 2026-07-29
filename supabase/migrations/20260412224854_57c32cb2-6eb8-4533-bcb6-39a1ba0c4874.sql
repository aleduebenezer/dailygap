
-- Create calendar_decorations table
CREATE TABLE public.calendar_decorations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  calendar_id UUID NOT NULL REFERENCES public.calendars(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  x_percent DOUBLE PRECISION NOT NULL DEFAULT 10,
  y_percent DOUBLE PRECISION NOT NULL DEFAULT 10,
  width_percent DOUBLE PRECISION NOT NULL DEFAULT 20,
  height_percent DOUBLE PRECISION NOT NULL DEFAULT 20,
  z_index INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calendar_decorations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own decorations"
ON public.calendar_decorations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own decorations"
ON public.calendar_decorations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own decorations"
ON public.calendar_decorations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own decorations"
ON public.calendar_decorations FOR DELETE
USING (auth.uid() = user_id);

-- Storage bucket for calendar images
INSERT INTO storage.buckets (id, name, public) VALUES ('calendar-images', 'calendar-images', true);

-- Storage policies
CREATE POLICY "Anyone can view calendar images"
ON storage.objects FOR SELECT
USING (bucket_id = 'calendar-images');

CREATE POLICY "Authenticated users can upload calendar images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'calendar-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own calendar images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'calendar-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own calendar images"
ON storage.objects FOR DELETE
USING (bucket_id = 'calendar-images' AND auth.uid()::text = (storage.foldername(name))[1]);
