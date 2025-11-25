import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useDefensivosCatalog = () => {
  return useQuery({
    queryKey: ["defensivos-catalog"],
    queryFn: async () => {
      console.log("Buscando defensivos do catálogo...");
      
      let allData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error, count } = await supabase
          .from("defensivos_catalog")
          .select("item, cod_item, marca, principio_ativo, grupo, saldo", { count: 'exact' })
          .order("item")
          .range(from, from + pageSize - 1);

        if (error) {
          console.error("Erro ao buscar defensivos:", error);
          throw error;
        }

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }

        console.log(`Buscados ${allData.length} registros até agora...`);
      }
      
      console.log(`Total de registros carregados: ${allData.length}`);
      
      return allData;
    },
  });
};
