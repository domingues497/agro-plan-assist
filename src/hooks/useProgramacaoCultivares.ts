import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type DefensivoFazenda = {
  id?: string;
  aplicacao: string;
  defensivo: string;
  dose: number;
  cobertura: number;
  total: number;
  produto_salvo: boolean;
};

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
  // IDs dos tratamentos vinculados via tabela de junção
  tratamento_ids?: string[];
  // Defensivos aplicados na fazenda para tratamento de sementes
  defensivos_fazenda?: DefensivoFazenda[];
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
      // Buscar tratamentos vinculados em lote e hidratar tratamento_ids
      const ids = hydrated.map((h) => h.id).filter(Boolean);
      let joinMap: Record<string, string[]> = {};
      if (ids.length > 0) {
        const { data: joinRows, error: joinErr } = await supabase
          .from("programacao_cultivares_tratamentos")
          .select("programacao_cultivar_id, tratamento_id")
          .in("programacao_cultivar_id", ids);
        if (joinErr) throw joinErr;
        (joinRows || []).forEach((r: any) => {
          const key = r.programacao_cultivar_id as string;
          const tid = r.tratamento_id as string;
          if (!key || !tid) return;
          if (!joinMap[key]) joinMap[key] = [];
          joinMap[key].push(tid);
        });
      }
      
      // Buscar defensivos da fazenda vinculados
      let defensivosMap: Record<string, DefensivoFazenda[]> = {};
      if (ids.length > 0) {
        const { data: defensivosRows, error: defErr } = await supabase
          .from("programacao_cultivares_defensivos")
          .select("*")
          .in("programacao_cultivar_id", ids);
        if (defErr) throw defErr;
        (defensivosRows || []).forEach((d: any) => {
          const key = d.programacao_cultivar_id as string;
          if (!key) return;
          if (!defensivosMap[key]) defensivosMap[key] = [];
          defensivosMap[key].push({
            id: d.id,
            aplicacao: d.aplicacao,
            defensivo: d.defensivo,
            dose: d.dose,
            cobertura: d.cobertura,
            total: d.total,
            produto_salvo: d.produto_salvo,
          });
        });
      }
      
      return hydrated.map((item) => ({
        ...item,
        tratamento_ids: joinMap[item.id] || [],
        defensivos_fazenda: defensivosMap[item.id] || [],
      }));
    },
  });

  const createMutation = useMutation({
    mutationFn: async (programacao: CreateProgramacaoCultivar) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      
      const { defensivos_fazenda, ...cultivarData } = programacao as any;
      const payload = { ...cultivarData, user_id: user.id } as any;
      
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
          setProdutorMapping(fallback.data?.id, programacao.produtor_numerocm);
          toast.message("Migração pendente: vínculo com produtor será aplicado após atualização do schema.");
          return fallback.data;
        }
        throw error;
      }
      
      setProdutorMapping(data?.id, programacao.produtor_numerocm);
      
      // Salvar defensivos da fazenda se houver
      if (defensivos_fazenda && Array.isArray(defensivos_fazenda) && defensivos_fazenda.length > 0) {
        const defensivosPayload = defensivos_fazenda
          .filter((d: any) => d.defensivo && d.defensivo.trim())
          .map((d: any) => ({
            programacao_cultivar_id: data.id,
            aplicacao: d.aplicacao || "Tratamento de Semente - TS",
            defensivo: d.defensivo,
            dose: d.dose || 0,
            cobertura: d.cobertura || 100,
            total: d.total || 0,
            produto_salvo: d.produto_salvo || false,
          }));
        
        if (defensivosPayload.length > 0) {
          const { error: defError } = await supabase
            .from("programacao_cultivares_defensivos")
            .insert(defensivosPayload);
          if (defError) throw defError;
        }
      }
      
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
      const { defensivos_fazenda, ...cultivarUpdates } = updates as any;
      
      const { data, error } = await supabase
        .from("programacao_cultivares")
        .update(cultivarUpdates)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        const missingColumn = /schema cache/i.test(error.message) && /produtor_numerocm/.test(error.message);
        if (missingColumn) {
          const { produtor_numerocm, ...rest } = cultivarUpdates;
          const fallback = await supabase
            .from("programacao_cultivares")
            .update(rest)
            .eq("id", id)
            .select()
            .single();
          if (fallback.error) throw fallback.error;
          setProdutorMapping(id, cultivarUpdates?.produtor_numerocm);
          toast.message("Migração pendente: vínculo com produtor será aplicado após atualização do schema.");
          return fallback.data;
        }
        throw error;
      }
      
      setProdutorMapping(id, cultivarUpdates?.produtor_numerocm);
      
      // Atualizar defensivos da fazenda: deletar antigos e inserir novos
      if (defensivos_fazenda !== undefined) {
        // Deletar defensivos antigos
        await supabase
          .from("programacao_cultivares_defensivos")
          .delete()
          .eq("programacao_cultivar_id", id);
        
        // Inserir novos defensivos se houver
        if (Array.isArray(defensivos_fazenda) && defensivos_fazenda.length > 0) {
          const defensivosPayload = defensivos_fazenda
            .filter((d: any) => d.defensivo && d.defensivo.trim())
            .map((d: any) => ({
              programacao_cultivar_id: id,
              aplicacao: d.aplicacao || "Tratamento de Semente - TS",
              defensivo: d.defensivo,
              dose: d.dose || 0,
              cobertura: d.cobertura || 100,
              total: d.total || 0,
              produto_salvo: d.produto_salvo || false,
            }));
          
          if (defensivosPayload.length > 0) {
            const { error: defError } = await supabase
              .from("programacao_cultivares_defensivos")
              .insert(defensivosPayload);
            if (defError) throw defError;
          }
        }
      }
      
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
      // Busca a programação de cultivar para validar bloqueios
      const { data: original, error: fetchErr } = await supabase
        .from("programacao_cultivares")
        .select("id, produtor_numerocm, area, safra")
        .eq("id", id)
        .single();
      if (fetchErr) throw fetchErr;

      const produtor = String(original?.produtor_numerocm || "").trim();
      const area = String(original?.area || "").trim();
      const safraCultivar = String(original?.safra || "").trim();

      // Verifica se existem aplicações de defensivos nesta mesma área/produtor
      const { data: aplicacoes, error: appErr } = await supabase
        .from("aplicacoes_defensivos")
        .select("id")
        .eq("produtor_numerocm", produtor)
        .eq("area", area);
      if (appErr) throw appErr;

      const aplicacaoIds = (aplicacoes || []).map((a: any) => a.id);
      let existeDefensivo = false;
      if (aplicacaoIds.length > 0) {
        const { data: defensivos, error: defErr } = await supabase
          .from("programacao_defensivos")
          .select("id, safra_id, aplicacao_id")
          .in("aplicacao_id", aplicacaoIds);
        if (defErr) throw defErr;

        // Regra: bloquear exclusão se existir qualquer defensivo.
        // Se safra do cultivar estiver definida, bloquear somente se algum defensivo tiver mesma safra.
        if (safraCultivar) {
          existeDefensivo = (defensivos || []).some((d: any) => String(d.safra_id || "") === safraCultivar);
        } else {
          existeDefensivo = (defensivos || []).length > 0;
        }
      }

      if (existeDefensivo) {
        throw new Error("Não é possível excluir: há programação de defensivos vinculada nesta área/safra.");
      }

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
