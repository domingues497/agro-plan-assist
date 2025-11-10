import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Produtor = {
  id: string;
  numerocm: string;
  nome: string;
  numerocm_consultor: string;
  consultor: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export const useProdutores = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["produtores", "by-consultor"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) throw new Error("Usuário não autenticado");

      // Verifica se é admin
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      const isAdmin = !!roleRow;

      let query = supabase
        .from("produtores")
        .select("*")
        .order("nome", { ascending: true });

      if (!isAdmin) {
        // Filtra pelos produtores do consultor logado obtido via profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("numerocm_consultor")
          .eq("user_id", user.id)
          .maybeSingle();
        let cmConsultor = profile?.numerocm_consultor as string | null | undefined;
        if (!cmConsultor) {
          // Fallback: tenta obter via consultores por e-mail
          const { data: consultor } = await supabase
            .from("consultores")
            .select("numerocm_consultor")
            .eq("email", user.email as string)
            .maybeSingle();
          cmConsultor = consultor?.numerocm_consultor;
        }
        if (cmConsultor) {
          query = query.eq("numerocm_consultor", cmConsultor);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Produtor[];
    },
  });

  return { data: data ?? [], isLoading, error };
};