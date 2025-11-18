import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useTratamentosPorCultivar = (codItem: string | undefined) => {
  return useQuery({
    queryKey: ["tratamentos-por-cultivar", codItem],
    queryFn: async () => {
      if (!codItem) return [];

      const { data: vinculos, error } = await supabase
        .from("cultivares_tratamentos")
        .select(`
          tratamento_id,
          tratamentos_sementes (
            id,
            nome,
            cultura,
            ativo
          )
        `)
        .eq("cultivar_cod_item", codItem);

      if (error) throw error;

      return vinculos
        ?.map(v => v.tratamentos_sementes)
        .filter(t => t && t.ativo) || [];
    },
    enabled: !!codItem,
  });
};
