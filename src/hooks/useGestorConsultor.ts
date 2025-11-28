import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useGestorConsultor = (userId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["gestor-consultor", userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("numerocm_consultor_gestor")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return data?.numerocm_consultor_gestor || null;
    },
    enabled: !!userId,
  });

  const associarConsultor = useMutation({
    mutationFn: async ({
      userId,
      numerocmConsultor,
    }: {
      userId: string;
      numerocmConsultor: string;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ numerocm_consultor_gestor: numerocmConsultor })
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gestor-consultor"] });
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

  const removerConsultor = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ numerocm_consultor_gestor: null })
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gestor-consultor"] });
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
    numerocmConsultor: data,
    isLoading,
    error,
    associarConsultor: associarConsultor.mutate,
    removerConsultor: removerConsultor.mutate,
    isAssociating: associarConsultor.isPending,
    isRemoving: removerConsultor.isPending,
  };
};
