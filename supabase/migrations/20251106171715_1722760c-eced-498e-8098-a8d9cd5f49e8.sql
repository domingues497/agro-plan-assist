-- Atualizar a função de handle_new_user para preencher o numerocm_consultor
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
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

  RETURN NEW;
END;
$$;

-- Recriar o trigger (se não existir)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();