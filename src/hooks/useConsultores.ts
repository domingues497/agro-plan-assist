import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Consultor = {
  id: string;
  numerocm_consultor: string;
  consultor: string;
  email: string;
  created_at: string | null;
  updated_at: string | null;
};

export const useConsultores = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["consultores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultores")
        .select("*")
        .order("consultor", { ascending: true });
      if (error) throw error;
      return (data || []) as Consultor[];
    },
  });

  return { data: data ?? [], isLoading, error };
};