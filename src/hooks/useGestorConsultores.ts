import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type GestorConsultor = {
  id: string;
  user_id: string;
  numerocm_consultor: string;
  created_at: string;
};

export const useGestorConsultores = (userId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["gestor-consultores", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("gestor_consultores")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as GestorConsultor[];
    },
    enabled: !!userId,
  });

  const addConsultor = useMutation({
    mutationFn: async ({
      userId,
      numerocmConsultor,
    }: {
      userId: string;
      numerocmConsultor: string;
    }) => {
      const { data, error } = await supabase
        .from("gestor_consultores")
        .insert({
          user_id: userId,
          numerocm_consultor: numerocmConsultor,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gestor-consultores"] });
      queryClient.invalidateQueries({ queryKey: ["produtores"] });
      queryClient.invalidateQueries({ queryKey: ["fazendas"] });
      toast({
        title: "Consultor associado",
        description: "O consultor foi associado com sucesso ao gestor.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao associar consultor",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeConsultor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("gestor_consultores")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gestor-consultores"] });
      queryClient.invalidateQueries({ queryKey: ["produtores"] });
      queryClient.invalidateQueries({ queryKey: ["fazendas"] });
      toast({
        title: "Associação removida",
        description: "A associação com o consultor foi removida.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover associação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    consultores: data ?? [],
    isLoading,
    error,
    addConsultor: addConsultor.mutate,
    removeConsultor: removeConsultor.mutate,
    isAdding: addConsultor.isPending,
    isRemoving: removeConsultor.isPending,
  };
};
