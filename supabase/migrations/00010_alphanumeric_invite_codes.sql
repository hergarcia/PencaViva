-- Change invite code generation from hex (md5) to alphanumeric (A-Z 0-9)
-- This expands the code space from 16^8 (~4B) to 36^8 (~2.8T) combinations.

-- Function that generates a random 8-character uppercase alphanumeric code
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * 36 + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Update the groups table default to use the new function
ALTER TABLE public.groups
  ALTER COLUMN invite_code SET DEFAULT public.generate_invite_code();
