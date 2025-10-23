import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ProgramacaoCultivar = {
  id: string;
  cultivar: string;
  area: string;
  quantidade: number;
  unidade: string;
  data_plantio: string | null;
  safra: string | null;
  semente_propria: boolean;
  referencia_rnc_mapa: string | null;
  porcentagem_salva: number;
  created_at: string;
  updated_at: string;
};

export type CreateProgramacaoCultivar = Omit<ProgramacaoCultivar, "id" | "created_at" | "updated_at">;

export const useProgramacaoCultivares = () => {
  const queryClient = useQueryClient();

  const { data: programacoes, isLoading, error } = useQuery({
    queryKey: ["programacao-cultivares"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programacao_cultivares")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ProgramacaoCultivar[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (programacao: CreateProgramacaoCultivar) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("programacao_cultivares")
        .insert({ ...programacao, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programacao-cultivares"] });
      toast.success("Programação criada com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar programação: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProgramacaoCultivar> & { id: string }) => {
      const { data, error } = await supabase
        .from("programacao_cultivares")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programacao-cultivares"] });
      toast.success("Programação atualizada com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar programação: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("programacao_cultivares")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programacao-cultivares"] });
      toast.success("Programação excluída com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir programação: ${error.message}`);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      const original = programacoes?.find((p) => p.id === id);
      if (!original) throw new Error("Programação não encontrada");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { id: _, created_at, updated_at, ...duplicateData } = original;
      
      const { data, error } = await supabase
        .from("programacao_cultivares")
        .insert({ ...duplicateData, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programacao-cultivares"] });
      toast.success("Programação duplicada com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao duplicar programação: ${error.message}`);
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
