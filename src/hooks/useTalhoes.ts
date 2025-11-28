import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Talhao = {
  id: string;
  fazenda_id: string;
  nome: string;
  area: number;
  arrendado: boolean;
  created_at: string;
  updated_at: string;
};

export const useTalhoes = (fazendaId?: string) => {
  return useQuery({
    queryKey: ["talhoes", fazendaId],
    queryFn: async () => {
      // Se não houver fazendaId, retornar array vazio ao invés de buscar todos
      if (!fazendaId) {
        return [] as Talhao[];
      }

      const { data, error } = await supabase
        .from("talhoes")
        .select("*")
        .eq("fazenda_id", fazendaId)
        .order("nome");

      if (error) throw error;
      return data as Talhao[];
    },
    enabled: !!fazendaId,
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
