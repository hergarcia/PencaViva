-- Migration: Auto-create profile when a user signs up via Supabase Auth
-- Trigger function: handle_new_user
-- Trigger: on_auth_user_created
--
-- When a new row is inserted into auth.users (signup), this trigger
-- automatically creates a corresponding row in public.profiles with:
--   - display_name: from raw_user_meta_data (full_name -> name -> email prefix)
--   - username: deterministic from UUID (user_<first 12 hex chars>), collision-free

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _display_name TEXT;
  _username TEXT;
BEGIN
  -- Extract display_name: prefer full_name from OAuth metadata, then name, then email prefix
  _display_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(SPLIT_PART(COALESCE(NEW.email, ''), '@', 1), '')
  );

  -- Final fallback if everything is empty (e.g. phone-only auth)
  IF _display_name IS NULL OR _display_name = '' THEN
    _display_name := 'User';
  END IF;

  -- Generate deterministic, collision-free username from user UUID
  -- Strips hyphens from UUID and takes first 12 hex chars
  -- e.g. UUID 550e8400-e29b-41d4-... -> user_550e8400e29b
  _username := 'user_' || substr(replace(NEW.id::text, '-', ''), 1, 12);

  INSERT INTO public.profiles (id, display_name, username)
  VALUES (NEW.id, _display_name, _username);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
