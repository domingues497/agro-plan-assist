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
    queryKey: ["fazendas", produtorNumerocm],
    queryFn: async () => {
      let query = supabase
        .from("fazendas")
        .select("*")
        .order("nomefazenda", { ascending: true });

      if (produtorNumerocm) {
        query = query.eq("numerocm", produtorNumerocm);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Fazenda[];
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
