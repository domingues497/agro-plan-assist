import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TratamentoSemente = {
  id: string;
  nome: string;
  cultura: "MILHO" | "SOJA";
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export const useTratamentosSementes = (cultura?: string) => {
  return useQuery({
    queryKey: ["tratamentos-sementes", cultura],
    queryFn: async () => {
      let query = supabase
        .from("tratamentos_sementes")
        .select("*")
        .eq("ativo", true)
        .order("nome");

      if (cultura) {
        query = query.eq("cultura", cultura.toUpperCase());
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as TratamentoSemente[];
    },
  });
};
