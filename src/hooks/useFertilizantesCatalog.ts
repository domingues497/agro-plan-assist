import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useFertilizantesCatalog = () => {
  return useQuery({
    queryKey: ["fertilizantes-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fertilizantes_catalog")
        .select("item, cod_item, marca, principio_ativo, grupo, saldo")
        .order("item");

      if (error) throw error;
      return data;
    },
  });
};
