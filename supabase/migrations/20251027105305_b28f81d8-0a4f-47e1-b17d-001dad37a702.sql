-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create cultivares catalog table
CREATE TABLE public.cultivares_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_registro TEXT UNIQUE NOT NULL,
    cultivar TEXT,
    nome_comum TEXT,
    nome_cientifico TEXT,
    grupo_especie TEXT,
    situacao TEXT,
    numero_formulario TEXT,
    data_registro DATE,
    data_validade_registro DATE,
    mantenedor TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cultivares_catalog ENABLE ROW LEVEL SECURITY;

-- RLS policies - everyone can read, only admins can write
CREATE POLICY "Anyone can view cultivares catalog"
ON public.cultivares_catalog
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage cultivares catalog"
ON public.cultivares_catalog
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create fertilizantes catalog table
CREATE TABLE public.fertilizantes_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cod_item TEXT UNIQUE NOT NULL,
    item TEXT,
    grupo TEXT,
    marca TEXT,
    principio_ativo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fertilizantes_catalog ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view fertilizantes catalog"
ON public.fertilizantes_catalog
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage fertilizantes catalog"
ON public.fertilizantes_catalog
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create defensivos catalog table
CREATE TABLE public.defensivos_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cod_item TEXT UNIQUE NOT NULL,
    item TEXT,
    grupo TEXT,
    marca TEXT,
    principio_ativo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.defensivos_catalog ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view defensivos catalog"
ON public.defensivos_catalog
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage defensivos catalog"
ON public.defensivos_catalog
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add triggers for updated_at
CREATE TRIGGER update_cultivares_catalog_updated_at
BEFORE UPDATE ON public.cultivares_catalog
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_fertilizantes_catalog_updated_at
BEFORE UPDATE ON public.fertilizantes_catalog
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_defensivos_catalog_updated_at
BEFORE UPDATE ON public.defensivos_catalog
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();