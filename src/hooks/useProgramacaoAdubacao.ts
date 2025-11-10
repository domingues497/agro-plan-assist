import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ProgramacaoAdubacao = {
  id: string;
  user_id?: string;
  programacao_id?: string;
  produtor_numerocm: string;
  area: string;
  formulacao: string;
  dose: number;
  percentual_cobertura: number;
  data_aplicacao: string | null;
  responsavel: string | null;
  justificativa_nao_adubacao_id?: string | null;
  fertilizante_salvo: boolean;
  deve_faturar: boolean;
  porcentagem_salva: number;
  total: number | null;
  safra_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateProgramacaoAdubacao = Omit<ProgramacaoAdubacao, "id" | "created_at" | "updated_at">;

export const useProgramacaoAdubacao = () => {
  const queryClient = useQueryClient();

  const setProdutorMapping = (id: string | undefined, numerocm: string | undefined) => {
    try {
      if (!id || !numerocm) return;
      const key = "programacao_adubacao_produtor_map";
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
      const key = "programacao_adubacao_produtor_map";
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

  const { data: programacoes, isLoading, error } = useQuery({
    queryKey: ["programacao-adubacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programacao_adubacao")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      // Sincroniza produtor_numerocm do localStorage para BD quando ausente
      const list = (data as ProgramacaoAdubacao[]) || [];
      const key = "programacao_adubacao_produtor_map";
      let map: Record<string, string> = {};
      try {
        const raw = localStorage.getItem(key);
        map = raw ? JSON.parse(raw) : {};
      } catch (_) {}

      const updates: Promise<any>[] = [];
      const hydrated = list.map((item) => {
        const cm = String(item.produtor_numerocm || "").trim();
        if (!cm) {
          const fallback = String(map[item.id] || "").trim();
          if (fallback) {
            updates.push(
              Promise.resolve(
                supabase
                  .from("programacao_adubacao")
                  .update({ produtor_numerocm: fallback })
                  .eq("id", item.id)
              )
            );
            return { ...item, produtor_numerocm: fallback } as ProgramacaoAdubacao;
          }
        }
        return item;
      });
      try {
        if (updates.length) await Promise.all(updates);
      } catch (_) {
        // silencioso: se falhar, continuamos com dados locais
      }
      return hydrated;
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
          setProdutorMapping(fallback.data?.id, programacao.produtor_numerocm);
          return fallback.data;
        }
        throw error;
      }
      setProdutorMapping(data?.id, programacao.produtor_numerocm);
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

      if (error) {
        const missingColumn = /schema cache/i.test(error.message) && /produtor_numerocm/.test(error.message);
        if (missingColumn) {
          const { produtor_numerocm, ...rest } = updates;
          const fallback = await supabase
            .from("programacao_adubacao")
            .update(rest)
            .eq("id", id)
            .select()
            .single();
          if (fallback.error) throw fallback.error;
          toast.message("Migração pendente: atualização realizada sem vínculo de produtor.");
          if (produtor_numerocm) setProdutorMapping(id, produtor_numerocm as string);
          return fallback.data;
        }
        throw error;
      }
      if (updates.produtor_numerocm) setProdutorMapping(id, updates.produtor_numerocm as string);
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

  // Replicate mutation: copy programação to another produtor/fazenda
  const replicateMutation = useMutation({
    mutationFn: async ({ id, produtor_numerocm, area }: { id: string; produtor_numerocm: string; area: string }) => {
      const original = (programacoes || []).find((p) => p.id === id);
      if (!original) throw new Error("Programação não encontrada");
      const { id: _, created_at, updated_at, user_id, produtor_numerocm: _cm, area: _area, ...rest } = original as any;
      const payload = { ...rest, produtor_numerocm, area } as CreateProgramacaoAdubacao;
      return createMutation.mutateAsync(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programacao-adubacao"] });
      toast.success("Adubação replicada com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao replicar adubação: ${error.message}`);
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
      // remover o mapeamento local
      // como onSuccess não tem id, usamos onSettled no mutate; mas aqui removemos via success handler encadeado usando último id
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
          setProdutorMapping(fallback.data?.id, (duplicateData as any).produtor_numerocm);
          return fallback.data;
        }
        throw error;
      }
      setProdutorMapping(data?.id, (duplicateData as any).produtor_numerocm);
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
    remove: (id: string) => {
      deleteMutation.mutate(id, {
        onSuccess: () => removeProdutorMapping(id),
      });
    },
    duplicate: duplicateMutation.mutate,
    replicate: replicateMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isDuplicating: duplicateMutation.isPending,
    isReplicating: replicateMutation.isPending,
  };
};
