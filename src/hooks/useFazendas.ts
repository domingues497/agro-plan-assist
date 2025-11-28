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

      // Busca role do usuário
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      
      const userRole = roleData?.role;
      const isAdmin = userRole === "admin";
      const isGestor = userRole === "gestor";

      let query = supabase
        .from("fazendas")
        .select("*")
        .order("nomefazenda", { ascending: true });

      if (produtorNumerocm) {
        query = query.eq("numerocm", produtorNumerocm);
      } else if (!isAdmin && !isGestor) {
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
      // Para gestores, confia na RLS policy que filtra através da tabela user_fazendas

      const { data, error } = await query;
      if (error) throw error;
      
      // Para cada fazenda, busca a área cultivável (soma dos talhões) usando a função do banco
      const fazendasComArea = await Promise.all(
        (data || []).map(async (f: any) => {
          const { data: areaData } = await supabase.rpc('get_fazenda_area_cultivavel', {
            fazenda_uuid: f.id
          });
          
          return {
            ...f,
            id: String(f.id ?? f.idfazenda ?? ""),
            idfazenda: String(f.idfazenda ?? f.id ?? ""),
            numerocm: String(f.numerocm ?? ""),
            numerocm_consultor: String(f.numerocm_consultor ?? ""),
            area_cultivavel: areaData ? Number(areaData) : 0,
          };
        })
      );
      
      return fazendasComArea as Fazenda[];
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
      
      // Para cada fazenda, busca a área cultivável (soma dos talhões)
      const fazendasComArea = await Promise.all(
        (data || []).map(async (f: any) => {
          const { data: areaData } = await supabase.rpc('get_fazenda_area_cultivavel', {
            fazenda_uuid: f.id
          });
          
          return {
            ...f,
            area_cultivavel: areaData ? Number(areaData) : 0,
          };
        })
      );
      
      return fazendasComArea as Fazenda[];
    },
  });

  return { data: data ?? [], isLoading, error };
};
