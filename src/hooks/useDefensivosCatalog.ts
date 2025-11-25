import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useDefensivosCatalog = () => {
  return useQuery({
    queryKey: ["defensivos-catalog"],
    queryFn: async () => {
      console.log("Buscando defensivos do catálogo...");
      
      const { data, error, count } = await supabase
        .from("defensivos_catalog")
        .select("item, cod_item, marca, principio_ativo, grupo, saldo", { count: 'exact' })
        .order("item")
        .range(0, 9999);

      if (error) {
        console.error("Erro ao buscar defensivos:", error);
        throw error;
      }
      
      console.log(`Total de registros no banco: ${count}`);
      console.log(`Total de registros retornados: ${data?.length || 0}`);
      
      return data;
    },
  });
};
