import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type UserFazenda = {
  id: string;
  user_id: string;
  fazenda_id: string;
  created_at: string;
};

export const useUserFazendas = (userId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["user-fazendas", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("user_fazendas")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as UserFazenda[];
    },
    enabled: !!userId,
  });

  const addFazenda = useMutation({
    mutationFn: async ({
      userId,
      fazendaId,
    }: {
      userId: string;
      fazendaId: string;
    }) => {
      const { data, error } = await supabase
        .from("user_fazendas")
        .insert({
          user_id: userId,
          fazenda_id: fazendaId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-fazendas"] });
      toast({
        title: "Fazenda associada",
        description: "A fazenda foi associada com sucesso ao gestor.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao associar fazenda",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeFazenda = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_fazendas")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-fazendas"] });
      toast({
        title: "Associação removida",
        description: "A associação com a fazenda foi removida.",
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
    fazendas: data ?? [],
    isLoading,
    error,
    addFazenda: addFazenda.mutate,
    removeFazenda: removeFazenda.mutate,
    isAdding: addFazenda.isPending,
    isRemoving: removeFazenda.isPending,
  };
};
