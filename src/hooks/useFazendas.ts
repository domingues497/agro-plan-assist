import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Fazenda = {
  id: string;
  numerocm: string;
  idfazenda: string;
  nomefazenda: string;
  numerocm_consultor: string;
  area_cultivavel: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export const useFazendas = (produtorNumerocm?: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["fazendas", produtorNumerocm || "by-consultor"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) throw new Error("Usuário não autenticado");

      // Verifica papel admin
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      const isAdmin = !!roleRow;

      let query = supabase
        .from("fazendas")
        .select("*")
        .order("nomefazenda", { ascending: true });

      if (produtorNumerocm) {
        query = query.eq("numerocm", produtorNumerocm);
      } else if (!isAdmin) {
        // Filtra fazendas do consultor logado obtido via profiles
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
      // Normaliza tipos vindos do banco para evitar inconsistências na UI
      const normalized = (data || []).map((f: any) => ({
        ...f,
        id: String(f.id ?? f.idfazenda ?? ""),
        idfazenda: String(f.idfazenda ?? f.id ?? ""),
        numerocm: String(f.numerocm ?? ""),
        numerocm_consultor: String(f.numerocm_consultor ?? ""),
        area_cultivavel:
          f.area_cultivavel === null || f.area_cultivavel === undefined
            ? null
            : Number(f.area_cultivavel),
      })) as Fazenda[];
      return normalized;
    },
  });

  return { data: data ?? [], isLoading, error };
};

// Busca fazendas pertencentes a múltiplos produtores
export const useFazendasMulti = (produtoresNumerocm: string[] = []) => {
  const key = produtoresNumerocm.slice().sort().join(",");
  const { data, isLoading, error } = useQuery({
    queryKey: ["fazendas-multi", key],
    queryFn: async () => {
      let query = supabase
        .from("fazendas")
        .select("*")
        .order("nomefazenda", { ascending: true });

      if (produtoresNumerocm && produtoresNumerocm.length > 0) {
        query = query.in("numerocm", produtoresNumerocm);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Fazenda[];
    },
  });

  return { data: data ?? [], isLoading, error };
};
