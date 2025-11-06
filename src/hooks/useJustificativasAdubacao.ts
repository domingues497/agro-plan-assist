import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type JustificativaAdubacao = {
  id: string;
  descricao: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export const useJustificativasAdubacao = () => {
  return useQuery({
    queryKey: ["justificativas-adubacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("justificativas_adubacao")
        .select("*")
        .eq("ativo", true)
        .order("descricao");

      if (error) throw error;
      return (data || []) as JustificativaAdubacao[];
    },
  });
};
