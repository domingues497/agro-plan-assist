import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Talhao = {
  id: string;
  fazenda_id: string;
  nome: string;
  area: number;
  created_at: string;
  updated_at: string;
};

export const useTalhoes = (fazendaId?: string) => {
  return useQuery({
    queryKey: ["talhoes", fazendaId],
    queryFn: async () => {
      let query = supabase
        .from("talhoes")
        .select("*")
        .order("nome");
      
      if (fazendaId) {
        query = query.eq("fazenda_id", fazendaId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Talhao[];
    },
    enabled: !!fazendaId || fazendaId === undefined,
  });
};

export const useTalhoesMultiFazendas = (fazendaIds?: string[]) => {
  return useQuery({
    queryKey: ["talhoes-multi", fazendaIds],
    queryFn: async () => {
      if (!fazendaIds || fazendaIds.length === 0) return [];

      const { data, error } = await supabase
        .from("talhoes")
        .select("*")
        .in("fazenda_id", fazendaIds)
        .order("nome");

      if (error) throw error;
      return data as Talhao[];
    },
    enabled: !!fazendaIds && fazendaIds.length > 0,
  });
};
