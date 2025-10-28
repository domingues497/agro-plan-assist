import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type DefensivoItem = {
  id?: string;
  defensivo: string;
  dose: number;
  unidade: string;
  alvo: string | null;
  produto_salvo: boolean;
  deve_faturar: boolean;
  porcentagem_salva: number;
};

export type AplicacaoDefensivo = {
  id: string;
  user_id: string;
  produtor_numerocm: string | null;
  area: string;
  created_at: string;
  updated_at: string;
  defensivos: DefensivoItem[];
};

export type CreateAplicacaoDefensivo = {
  produtor_numerocm: string;
  area: string;
  defensivos: Omit<DefensivoItem, "id">[];
};

export const useAplicacoesDefensivos = () => {
  const queryClient = useQueryClient();

  // Fetch all aplicacoes with their defensivos
  const { data: aplicacoes = [], isLoading, error } = useQuery({
    queryKey: ["aplicacoes-defensivos"],
    queryFn: async () => {
      const { data: aplicacoesData, error: aplicacoesError } = await supabase
        .from("aplicacoes_defensivos")
        .select("*")
        .order("created_at", { ascending: false });

      if (aplicacoesError) throw aplicacoesError;

      // Fetch defensivos for each aplicacao
      const aplicacoesComDefensivos = await Promise.all(
        aplicacoesData.map(async (aplicacao) => {
          const { data: defensivos, error: defensivosError } = await supabase
            .from("programacao_defensivos")
            .select("*")
            .eq("aplicacao_id", aplicacao.id)
            .order("created_at", { ascending: true });

          if (defensivosError) throw defensivosError;

          return {
            ...aplicacao,
            defensivos: defensivos || [],
          };
        })
      );

      return aplicacoesComDefensivos as AplicacaoDefensivo[];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateAplicacaoDefensivo) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Create aplicacao
      const { data: aplicacao, error: aplicacaoError } = await supabase
        .from("aplicacoes_defensivos")
        .insert({
          user_id: user.id,
          produtor_numerocm: data.produtor_numerocm,
          area: data.area,
        })
        .select()
        .single();

      if (aplicacaoError) throw aplicacaoError;

      // Create defensivos
      const defensivosToInsert = data.defensivos.map((def) => ({
        aplicacao_id: aplicacao.id,
        user_id: user.id,
        defensivo: def.defensivo,
        dose: def.dose,
        unidade: def.unidade,
        alvo: def.alvo,
        produto_salvo: def.produto_salvo,
        deve_faturar: def.deve_faturar,
        porcentagem_salva: def.porcentagem_salva,
      }));

      const { error: defensivosError } = await supabase
        .from("programacao_defensivos")
        .insert(defensivosToInsert);

      if (defensivosError) throw defensivosError;

      return aplicacao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aplicacoes-defensivos"] });
      toast.success("Aplicação criada com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao criar aplicação: " + error.message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & CreateAplicacaoDefensivo) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Update aplicacao
      const { error: aplicacaoError } = await supabase
        .from("aplicacoes_defensivos")
        .update({
          produtor_numerocm: data.produtor_numerocm,
          area: data.area,
        })
        .eq("id", id);

      if (aplicacaoError) throw aplicacaoError;

      // Delete existing defensivos
      await supabase
        .from("programacao_defensivos")
        .delete()
        .eq("aplicacao_id", id);

      // Insert new defensivos
      const defensivosToInsert = data.defensivos.map((def) => ({
        aplicacao_id: id,
        user_id: user.id,
        defensivo: def.defensivo,
        dose: def.dose,
        unidade: def.unidade,
        alvo: def.alvo,
        produto_salvo: def.produto_salvo,
        deve_faturar: def.deve_faturar,
        porcentagem_salva: def.porcentagem_salva,
      }));

      const { error: defensivosError } = await supabase
        .from("programacao_defensivos")
        .insert(defensivosToInsert);

      if (defensivosError) throw defensivosError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aplicacoes-defensivos"] });
      toast.success("Aplicação atualizada com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar aplicação: " + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("aplicacoes_defensivos")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aplicacoes-defensivos"] });
      toast.success("Aplicação excluída com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao excluir aplicação: " + error.message);
    },
  });

  // Duplicate mutation
  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      const aplicacao = aplicacoes.find((a) => a.id === id);
      if (!aplicacao) throw new Error("Aplicação não encontrada");

      return createMutation.mutateAsync({
        produtor_numerocm: aplicacao.produtor_numerocm || "",
        area: aplicacao.area,
        defensivos: aplicacao.defensivos.map(({ id, ...def }) => def),
      });
    },
  });

  // Replicate mutation: copy defensivos but allow selecting target produtor and fazenda
  const replicateMutation = useMutation({
    mutationFn: async ({ id, produtor_numerocm, area }: { id: string; produtor_numerocm: string; area: string }) => {
      const aplicacao = aplicacoes.find((a) => a.id === id);
      if (!aplicacao) throw new Error("Aplicação não encontrada");

      return createMutation.mutateAsync({
        produtor_numerocm,
        area,
        defensivos: aplicacao.defensivos.map(({ id, ...def }) => def),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aplicacoes-defensivos"] });
      toast.success("Aplicação replicada com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao replicar aplicação: " + error.message);
    },
  });

  return {
    aplicacoes,
    isLoading,
    error,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    duplicate: duplicateMutation.mutateAsync,
    replicate: replicateMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isDuplicating: duplicateMutation.isPending,
    isReplicating: replicateMutation.isPending,
  };
};
