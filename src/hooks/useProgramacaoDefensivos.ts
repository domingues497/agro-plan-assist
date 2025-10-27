import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ProgramacaoDefensivo = {
  id: string;
  user_id: string;
  defensivo: string;
  area: string;
  dose: number;
  unidade?: string | null;
  data_aplicacao?: string | null;
  alvo?: string | null;
  produto_salvo?: boolean;
  deve_faturar?: boolean;
  porcentagem_salva?: number;
  created_at: string;
  updated_at: string;
};

export type CreateProgramacaoDefensivo = Omit<
  ProgramacaoDefensivo,
  "id" | "user_id" | "created_at" | "updated_at"
>;

export const useProgramacaoDefensivos = () => {
  const queryClient = useQueryClient();

  const { data: programacoes, isLoading, error } = useQuery({
    queryKey: ["programacao-defensivos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programacao_defensivos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ProgramacaoDefensivo[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newDefensivo: CreateProgramacaoDefensivo) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("programacao_defensivos")
        .insert({ ...newDefensivo, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programacao-defensivos"] });
      toast.success("Programação de defensivo criada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao criar programação: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProgramacaoDefensivo> & { id: string }) => {
      const { data, error } = await supabase
        .from("programacao_defensivos")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programacao-defensivos"] });
      toast.success("Programação atualizada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar programação: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("programacao_defensivos")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programacao-defensivos"] });
      toast.success("Programação excluída com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir programação: " + error.message);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: original, error: fetchError } = await supabase
        .from("programacao_defensivos")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      const { id: _, user_id, created_at, updated_at, ...defensivoData } = original;
      
      const { data, error } = await supabase
        .from("programacao_defensivos")
        .insert({ ...defensivoData, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programacao-defensivos"] });
      toast.success("Programação duplicada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao duplicar programação: " + error.message);
    },
  });

  return {
    programacoes: programacoes ?? [],
    isLoading,
    error,
    create: createMutation.mutate,
    update: updateMutation.mutate,
    remove: deleteMutation.mutate,
    duplicate: duplicateMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isDuplicating: duplicateMutation.isPending,
  };
};
