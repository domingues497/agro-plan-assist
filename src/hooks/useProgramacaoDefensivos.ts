import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ProgramacaoDefensivo = {
  id: string;
  user_id: string;
  defensivo: string;
  area: string;
  produtor_numerocm: string;
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

  const setProdutorMapping = (id: string | undefined, numerocm: string | undefined) => {
    try {
      if (!id || !numerocm) return;
      const key = "programacao_defensivos_produtor_map";
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
      const key = "programacao_defensivos_produtor_map";
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
    queryKey: ["programacao-defensivos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programacao_defensivos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      // Sincroniza produtor_numerocm do localStorage para BD quando ausente
      const list = (data as ProgramacaoDefensivo[]) || [];
      const key = "programacao_defensivos_produtor_map";
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
              supabase
                .from("programacao_defensivos")
                .update({ produtor_numerocm: fallback })
                .eq("id", item.id)
            );
            return { ...item, produtor_numerocm: fallback } as ProgramacaoDefensivo;
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
    mutationFn: async (newDefensivo: CreateProgramacaoDefensivo) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const payload = { ...newDefensivo, user_id: user.id } as any;
      const { data, error } = await supabase
        .from("programacao_defensivos")
        .insert(payload)
        .select()
        .single();

      if (error) {
        const missingColumn = /schema cache/i.test(error.message) && /produtor_numerocm/.test(error.message);
        if (missingColumn) {
          const { produtor_numerocm, ...rest } = payload;
          const fallback = await supabase
            .from("programacao_defensivos")
            .insert(rest as any)
            .select()
            .single();
          if (fallback.error) throw fallback.error;
          toast.message("Migração pendente: vínculo com produtor será aplicado após atualização do schema.");
          setProdutorMapping(fallback.data?.id, newDefensivo.produtor_numerocm);
          return fallback.data;
        }
        throw error;
      }
      setProdutorMapping(data?.id, newDefensivo.produtor_numerocm);
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

      if (error) {
        const missingColumn = /schema cache/i.test(error.message) && /produtor_numerocm/.test(error.message);
        if (missingColumn) {
          const { produtor_numerocm, ...rest } = updates;
          const fallback = await supabase
            .from("programacao_defensivos")
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
      // remoção do mapeamento será tratada no wrapper de remove
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
      const payload = { ...defensivoData, user_id: user.id } as any;
      const { data, error } = await supabase
        .from("programacao_defensivos")
        .insert(payload)
        .select()
        .single();

      if (error) {
        const missingColumn = /schema cache/i.test(error.message) && /produtor_numerocm/.test(error.message);
        if (missingColumn) {
          const { produtor_numerocm, ...rest } = payload;
          const fallback = await supabase
            .from("programacao_defensivos")
            .insert(rest as any)
            .select()
            .single();
          if (fallback.error) throw fallback.error;
          toast.message("Migração pendente: duplicação realizada sem vínculo de produtor.");
          setProdutorMapping(fallback.data?.id, (defensivoData as any).produtor_numerocm);
          return fallback.data;
        }
        throw error;
      }
      setProdutorMapping(data?.id, (defensivoData as any).produtor_numerocm);
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
    remove: (id: string) => {
      deleteMutation.mutate(id, {
        onSuccess: () => removeProdutorMapping(id),
      });
    },
    duplicate: duplicateMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isDuplicating: duplicateMutation.isPending,
  };
};
