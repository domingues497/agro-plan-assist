import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useTratamentosPorCultivar = (cultivarCodItem?: string) => {
  return useQuery({
    queryKey: ["tratamentos-por-cultivar", cultivarCodItem],
    queryFn: async () => {
      if (!cultivarCodItem) return [];
      
      const { data, error } = await supabase
        .from("cultivares_tratamentos")
        .select(`
          tratamento_id,
          tratamentos_sementes!inner(
            id,
            nome,
            cultura,
            ativo
          )
        `)
        .eq("cultivar_cod_item", cultivarCodItem);

      if (error) throw error;
      
      return data.map(item => item.tratamentos_sementes).filter(t => t.ativo);
    },
    enabled: !!cultivarCodItem,
  });
};
