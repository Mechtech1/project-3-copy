-- Create overlay-images storage bucket for permanent DALL-E 3 image storage
-- This ensures overlay images are permanently cached and reusable

-- Create the overlay-images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'overlay-images',
  'overlay-images', 
  true,
  10485760, -- 10MB limit
  ARRAY['image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read overlay images
INSERT INTO storage.policies (bucket_id, name, definition, check_definition, command)
VALUES (
  'overlay-images',
  'Allow authenticated read access',
  'SELECT',
  'auth.role() = ''authenticated''',
  'SELECT'
)
ON CONFLICT (bucket_id, name) DO NOTHING;

-- Allow service role full access for image uploads
INSERT INTO storage.policies (bucket_id, name, definition, check_definition, command)
VALUES (
  'overlay-images',
  'Allow service role full access',
  'ALL',
  'auth.role() = ''service_role''',
  'ALL'
)
ON CONFLICT (bucket_id, name) DO NOTHING;

-- Allow anonymous users to read overlay images (for public access)
INSERT INTO storage.policies (bucket_id, name, definition, check_definition, command)
VALUES (
  'overlay-images',
  'Allow anonymous read access',
  'SELECT',
  'true',
  'SELECT'
)
ON CONFLICT (bucket_id, name) DO NOTHING;

-- Allow anonymous users to insert overlay images (for client-side uploads)
INSERT INTO storage.policies (bucket_id, name, definition, check_definition, command)
VALUES (
  'overlay-images',
  'Allow anonymous insert access',
  'INSERT',
  'true',
  'INSERT'
)
ON CONFLICT (bucket_id, name) DO NOTHING;
