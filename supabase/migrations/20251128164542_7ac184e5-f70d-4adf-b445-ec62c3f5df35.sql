-- Drop existing function
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Recreate function with automatic role assignment
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  consultor_data RECORD;
BEGIN
  -- Buscar dados do consultor pela email
  SELECT numerocm_consultor, consultor as nome
  INTO consultor_data
  FROM public.consultores
  WHERE email = NEW.email
  LIMIT 1;

  -- Inserir profile com dados do consultor
  INSERT INTO public.profiles (user_id, numerocm_consultor, nome)
  VALUES (
    NEW.id,
    consultor_data.numerocm_consultor,
    consultor_data.nome
  );

  -- Se o email existir em consultores, atribuir role 'consultor' automaticamente
  IF consultor_data.numerocm_consultor IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'consultor'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();