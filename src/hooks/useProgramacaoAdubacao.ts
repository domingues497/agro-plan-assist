import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ProgramacaoAdubacao = {
  id: string;
  user_id?: string;
  formulacao: string;
  area: string;
  produtor_numerocm: string;
  dose: number;
  total: number | null;
  data_aplicacao: string | null;
  responsavel: string | null;
  fertilizante_salvo: boolean;
  deve_faturar: boolean;
  porcentagem_salva: number;
  created_at: string;
  updated_at: string;
};

export type CreateProgramacaoAdubacao = Omit<ProgramacaoAdubacao, "id" | "created_at" | "updated_at">;

export const useProgramacaoAdubacao = () => {
  const queryClient = useQueryClient();

  const { data: programacoes, isLoading, error } = useQuery({
    queryKey: ["programacao-adubacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programacao_adubacao")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ProgramacaoAdubacao[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (programacao: CreateProgramacaoAdubacao) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const payload = { ...programacao, user_id: user.id } as any;
      const { data, error } = await supabase
        .from("programacao_adubacao")
        .insert(payload)
        .select()
        .single();

      if (error) {
        const missingColumn = /schema cache/i.test(error.message) && /produtor_numerocm/.test(error.message);
        if (missingColumn) {
          const { produtor_numerocm, ...rest } = payload;
          const fallback = await supabase
            .from("programacao_adubacao")
            .insert(rest as any)
            .select()
            .single();
          if (fallback.error) throw fallback.error;
          toast.message("Migração pendente: vínculo com produtor será aplicado após atualização do schema.");
          return fallback.data;
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programacao-adubacao"] });
      toast.success("Adubação criada com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar adubação: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProgramacaoAdubacao> & { id: string }) => {
      const { data, error } = await supabase
        .from("programacao_adubacao")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programacao-adubacao"] });
      toast.success("Adubação atualizada com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar adubação: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("programacao_adubacao")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programacao-adubacao"] });
      toast.success("Adubação excluída com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir adubação: ${error.message}`);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      const original = programacoes?.find((p) => p.id === id);
      if (!original) throw new Error("Adubação não encontrada");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { id: _, created_at, updated_at, ...duplicateData } = original;
      const payload = { ...duplicateData, user_id: user.id } as any;
      const { data, error } = await supabase
        .from("programacao_adubacao")
        .insert(payload)
        .select()
        .single();

      if (error) {
        const missingColumn = /schema cache/i.test(error.message) && /produtor_numerocm/.test(error.message);
        if (missingColumn) {
          const { produtor_numerocm, ...rest } = payload;
          const fallback = await supabase
            .from("programacao_adubacao")
            .insert(rest as any)
            .select()
            .single();
          if (fallback.error) throw fallback.error;
          toast.message("Migração pendente: duplicação realizada sem vínculo de produtor.");
          return fallback.data;
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programacao-adubacao"] });
      toast.success("Adubação duplicada com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao duplicar adubação: ${error.message}`);
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
