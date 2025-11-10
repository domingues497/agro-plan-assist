import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useDefensivosCatalog = () => {
  return useQuery({
    queryKey: ["defensivos-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("defensivos_catalog")
        .select("item, cod_item, marca, principio_ativo, grupo")
        .order("item");

      if (error) throw error;
      return data;
    },
  });
};
