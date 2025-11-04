import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ProgramacaoCultivar = {
  id: string;
  user_id?: string;
  cultivar: string;
  area: string;
  produtor_numerocm: string;
  quantidade: number;
  area_hectares: number;
  unidade: string;
  data_plantio: string | null;
  safra: string | null;
  semente_propria: boolean;
  referencia_rnc_mapa: string | null;
  porcentagem_salva: number;
  populacao_recomendada: number;
  sementes_por_saca: number;
  created_at: string;
  updated_at: string;
};

export type CreateProgramacaoCultivar = Omit<ProgramacaoCultivar, "id" | "created_at" | "updated_at">;

export const useProgramacaoCultivares = () => {
  const queryClient = useQueryClient();

  const setProdutorMapping = (id: string | undefined, numerocm: string | undefined) => {
    try {
      if (!id || !numerocm) return;
      const key = "programacao_cultivares_produtor_map";
      const raw = localStorage.getItem(key);
      const map = raw ? JSON.parse(raw) : {};
      map[id] = numerocm;
      localStorage.setItem(key, JSON.stringify(map));
    } catch (e) {
      // silencioso: armazenamento local pode não estar disponível
    }
  };
  const removeProdutorMapping = (id: string | undefined) => {
    try {
      if (!id) return;
      const key = "programacao_cultivares_produtor_map";
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
    queryKey: ["programacao-cultivares"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programacao_cultivares")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      // Sincroniza produtor_numerocm do localStorage para BD quando ausente
      const list = (data as ProgramacaoCultivar[]) || [];
      const key = "programacao_cultivares_produtor_map";
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
                  .from("programacao_cultivares")
                  .update({ produtor_numerocm: fallback })
                  .eq("id", item.id)
              )
            );
            return { ...item, produtor_numerocm: fallback } as ProgramacaoCultivar;
          }
        }
        return item;
      });
      try {
        if (updates.length) await Promise.all(updates);
      } catch (_) {
        // silencioso
      }
      return hydrated;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (programacao: CreateProgramacaoCultivar) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      const payload = { ...programacao, user_id: user.id } as any;
      const { data, error } = await supabase
        .from("programacao_cultivares")
        .insert(payload)
        .select()
        .single();

      if (error) {
        const missingColumn = /schema cache/i.test(error.message) && /produtor_numerocm/.test(error.message);
        if (missingColumn) {
          const { produtor_numerocm, ...rest } = payload as any;
          const fallback = await supabase
            .from("programacao_cultivares")
            .insert(rest as any)
            .select()
            .single();
          if (fallback.error) throw fallback.error;
          // Persistimos o vínculo localmente até o schema estar atualizado
          setProdutorMapping(fallback.data?.id, programacao.produtor_numerocm);
          toast.message("Migração pendente: vínculo com produtor será aplicado após atualização do schema.");
          return fallback.data;
        }
        throw error;
      }
      // Em cenários normais, também persistimos o vínculo para consistência
      setProdutorMapping(data?.id, programacao.produtor_numerocm);
      return data;
    },
    onSuccess: (_data, _variables) => {
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
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        const missingColumn = /schema cache/i.test(error.message) && /produtor_numerocm/.test(error.message);
        if (missingColumn) {
          const { produtor_numerocm, ...rest } = updates as any;
          const fallback = await supabase
            .from("programacao_cultivares")
            .update(rest as any)
            .eq("id", id)
            .select()
            .single();
          if (fallback.error) throw fallback.error;
          setProdutorMapping(id, (updates as any)?.produtor_numerocm);
          toast.message("Migração pendente: vínculo com produtor será aplicado após atualização do schema.");
          return fallback.data;
        }
        throw error;
      }
      setProdutorMapping(id, (updates as any)?.produtor_numerocm);
      return data;
    },
    onSuccess: (_data, _variables) => {
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
    onSuccess: (_data, variables) => {
      removeProdutorMapping(variables);
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
      const payload = { ...duplicateData, user_id: user.id } as any;
      const { data, error } = await supabase
        .from("programacao_cultivares")
        .insert(payload)
        .select()
        .single();

      if (error) {
        const missingColumn = /schema cache/i.test(error.message) && /produtor_numerocm/.test(error.message);
        if (missingColumn) {
          const { produtor_numerocm, ...rest } = payload;
          const fallback = await supabase
            .from("programacao_cultivares")
            .insert(rest as any)
            .select()
            .single();
          if (fallback.error) throw fallback.error;
          setProdutorMapping(fallback.data?.id, original.produtor_numerocm);
          toast.message("Migração pendente: duplicação realizada sem vínculo de produtor.");
          return fallback.data;
        }
        throw error;
      }
      setProdutorMapping(data?.id, original.produtor_numerocm);
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

  // Replicate mutation: cria uma cópia em outro produtor/fazenda
  const replicateMutation = useMutation({
    mutationFn: async ({ id, produtor_numerocm, area }: { id: string; produtor_numerocm: string; area: string }) => {
      const original = programacoes?.find((p) => p.id === id);
      if (!original) throw new Error("Programação não encontrada");

      const { id: _, created_at, updated_at, user_id, produtor_numerocm: _cm, area: _area, ...rest } = original as any;
      const payload = { ...rest, produtor_numerocm, area } as CreateProgramacaoCultivar;
      return createMutation.mutateAsync(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programacao-cultivares"] });
      toast.success("Programação replicada com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao replicar programação: ${error.message}`);
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
    replicate: replicateMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isDuplicating: duplicateMutation.isPending,
    isReplicating: replicateMutation.isPending,
  };
};
