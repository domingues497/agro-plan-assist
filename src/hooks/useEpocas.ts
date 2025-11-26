import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Epoca = {
  id: string;
  nome: string;
  descricao: string | null;
  ativa: boolean;
  created_at: string;
  updated_at: string;
};

export const useEpocas = () => {
  return useQuery({
    queryKey: ["epocas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("epocas")
        .select("*")
        .eq("ativa", true)
        .order("nome");

      if (error) throw error;
      return (data || []) as Epoca[];
    },
  });
};
