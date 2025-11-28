import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type UserProdutor = {
  id: string;
  user_id: string;
  produtor_numerocm: string;
  created_at: string;
};

export const useUserProdutores = (userId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["user-produtores", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("user_produtores")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as UserProdutor[];
    },
    enabled: !!userId,
  });

  const addProdutor = useMutation({
    mutationFn: async ({
      userId,
      produtorNumerocm,
    }: {
      userId: string;
      produtorNumerocm: string;
    }) => {
      const { data, error } = await supabase
        .from("user_produtores")
        .insert({
          user_id: userId,
          produtor_numerocm: produtorNumerocm,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-produtores"] });
      toast({
        title: "Produtor associado",
        description: "O produtor foi associado com sucesso ao gestor.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao associar produtor",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeProdutor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_produtores")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-produtores"] });
      toast({
        title: "Associação removida",
        description: "A associação com o produtor foi removida.",
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
    produtores: data ?? [],
    isLoading,
    error,
    addProdutor: addProdutor.mutate,
    removeProdutor: removeProdutor.mutate,
    isAdding: addProdutor.isPending,
    isRemoving: removeProdutor.isPending,
  };
};
