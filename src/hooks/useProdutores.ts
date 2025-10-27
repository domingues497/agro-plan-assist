import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Produtor = {
  id: string;
  numerocm: string;
  nome: string;
  numerocm_consultor: string;
  consultor: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export const useProdutores = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["produtores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtores")
        .select("*")
        .order("nome", { ascending: true });

      if (error) throw error;
      return data as Produtor[];
    },
  });

  return { data: data ?? [], isLoading, error };
};