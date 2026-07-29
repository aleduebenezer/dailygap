
-- Create gallery_images table for user image uploads
CREATE TABLE public.gallery_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  filename TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own gallery images"
ON public.gallery_images FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can upload their own gallery images"
ON public.gallery_images FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own gallery images"
ON public.gallery_images FOR DELETE USING (auth.uid() = user_id);

-- Create post_schedule table for scheduling settings
CREATE TABLE public.post_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  calendar_id UUID REFERENCES public.calendars(id) ON DELETE CASCADE,
  start_time TEXT NOT NULL DEFAULT '07:00',
  end_time TEXT NOT NULL DEFAULT '08:15',
  timezone TEXT NOT NULL DEFAULT 'Africa/Lagos',
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, calendar_id)
);

ALTER TABLE public.post_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own schedules"
ON public.post_schedules FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own schedules"
ON public.post_schedules FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own schedules"
ON public.post_schedules FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own schedules"
ON public.post_schedules FOR DELETE USING (auth.uid() = user_id);

-- Add trigger for updated_at on post_schedules
CREATE TRIGGER update_post_schedules_updated_at
BEFORE UPDATE ON public.post_schedules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create gallery-images storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('gallery-images', 'gallery-images', true);

CREATE POLICY "Users can upload gallery images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'gallery-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Gallery images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'gallery-images');

CREATE POLICY "Users can delete their own gallery images"
ON storage.objects FOR DELETE
USING (bucket_id = 'gallery-images' AND auth.uid()::text = (storage.foldername(name))[1]);
