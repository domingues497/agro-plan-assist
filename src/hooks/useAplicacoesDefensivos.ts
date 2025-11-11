import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type DefensivoItem = {
  id?: string;
  defensivo: string;
  dose: number;
  unidade: string;
  alvo: string | null;
  aplicacoes?: string[]; // Array de descrições de aplicação selecionadas
  produto_salvo: boolean;
  deve_faturar: boolean;
  porcentagem_salva: number;
  area_hectares: number;
  total?: number;
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

  // Mapeamento local para manter vínculo de produtor quando a coluna
  // não existir ou registros antigos não possuírem o valor
  const setProdutorMapping = (id: string | undefined, numerocm: string | undefined) => {
    try {
      if (!id || !numerocm) return;
      const key = "aplicacoes_defensivos_produtor_map";
      const raw = localStorage.getItem(key);
      const map = raw ? JSON.parse(raw) : {};
      map[id] = (numerocm || "").trim();
      localStorage.setItem(key, JSON.stringify(map));
    } catch (e) {
      // armazenamento local pode não estar disponível
    }
  };

  const removeProdutorMapping = (id: string | undefined) => {
    try {
      if (!id) return;
      const key = "aplicacoes_defensivos_produtor_map";
      const raw = localStorage.getItem(key);
      const map = raw ? JSON.parse(raw) : {};
      if (map[id]) {
        delete map[id];
        localStorage.setItem(key, JSON.stringify(map));
      }
    } catch (e) {
      // silencioso
    }
  };

  // Fetch all aplicacoes with their defensivos
  const { data: aplicacoes = [], isLoading, error } = useQuery({
    queryKey: ["aplicacoes-defensivos"],
    queryFn: async () => {
      const { data: aplicacoesData, error: aplicacoesError } = await supabase
        .from("aplicacoes_defensivos")
        .select("*")
        .order("created_at", { ascending: false });

      if (aplicacoesError) throw aplicacoesError;

      // Carrega mapping local e hidrata produtor_numerocm ausente
      const key = "aplicacoes_defensivos_produtor_map";
      let map: Record<string, string> = {};
      try {
        const raw = localStorage.getItem(key);
        map = raw ? JSON.parse(raw) : {};
      } catch (_) {}

      // Buscar defensivos e hidratar cada aplicação
      const aplicacoesComDefensivos = await Promise.all(
        aplicacoesData.map(async (aplicacao) => {
          const { data: defensivos, error: defensivosError } = await supabase
            .from("programacao_defensivos")
            .select("*")
            .eq("aplicacao_id", aplicacao.id)
            .order("created_at", { ascending: true });

          if (defensivosError) throw defensivosError;

          let cm = String(aplicacao.produtor_numerocm || "").trim();
          if (!cm) {
            const fallback = String(map[aplicacao.id] || "").trim();
            if (fallback) {
              cm = fallback;
              try {
                await supabase
                  .from("aplicacoes_defensivos")
                  .update({ produtor_numerocm: fallback })
                  .eq("id", aplicacao.id);
              } catch (_) {
                // silencioso
              }
            }
          }

          return {
            ...aplicacao,
            produtor_numerocm: cm || aplicacao.produtor_numerocm,
            defensivos: defensivos || [],
          } as AplicacaoDefensivo;
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
        area_hectares: def.area_hectares,
      }));

      const { error: defensivosError } = await supabase
        .from("programacao_defensivos")
        .insert(defensivosToInsert);

      if (defensivosError) throw defensivosError;

      // Persiste vínculo de produtor localmente para edição futura
      setProdutorMapping(aplicacao.id, data.produtor_numerocm);
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
        area_hectares: def.area_hectares,
      }));

      const { error: defensivosError } = await supabase
        .from("programacao_defensivos")
        .insert(defensivosToInsert);

      if (defensivosError) throw defensivosError;

      // Atualiza mapeamento local
      setProdutorMapping(id, data.produtor_numerocm);
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
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["aplicacoes-defensivos"] });
      removeProdutorMapping(variables);
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
