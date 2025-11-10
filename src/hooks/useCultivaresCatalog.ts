import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useCultivaresCatalog = () => {
  return useQuery({
    queryKey: ["cultivares-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cultivares_catalog")
        .select("cod_item, item, grupo, marca, cultivar, cultura")
        .order("cultivar");

      if (error) throw error;
      return data;
    },
  });
};
