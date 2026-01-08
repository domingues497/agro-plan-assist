import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type DefensivoFazenda = {
  id?: string;
  aplicacao: string;
  defensivo: string;
  cod_item?: string;
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

  const { data: programacoes, isLoading, error } = useQuery({
    queryKey: ["programacao-cultivares"],
    queryFn: async () => {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/programacao_cultivares`);
      if (!res.ok) throw new Error(`Erro ao carregar cultivares: ${res.status}`);
      const json = await res.json();
      const list = (json?.items ?? []) as ProgramacaoCultivar[];
      return list;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (programacao: CreateProgramacaoCultivar) => {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/programacao_cultivares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(programacao as any)
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const data = await res.json();
      return { ...programacao, id: data.id } as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programacao-cultivares"] });
      toast.success("Programação de cultivar criada com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar programação: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProgramacaoCultivar> & { id: string }) => {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/programacao_cultivares/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates as any)
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      return { id, ...(updates as any) } as any;
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
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/programacao_cultivares/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Erro ao excluir programação: ${res.status}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["programacao-cultivares"] });
      toast.success("Programação excluída com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir programação: ${error.message}`);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const original = programacoes?.find((p) => p.id === id);
      if (!original) throw new Error("Programação não encontrada");
      const { id: _, created_at, updated_at, ...duplicateData } = original as any;
      const res = await fetch(`${baseUrl}/programacao_cultivares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(duplicateData)
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const data = await res.json();
      return { ...duplicateData, id: data.id } as any;
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
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const original = programacoes?.find((p) => p.id === id);
      if (!original) throw new Error("Programação não encontrada");
      const { id: _, created_at, updated_at, user_id, produtor_numerocm: _cm, area: _area, ...rest } = original as any;
      const payload = { ...rest, produtor_numerocm, area } as CreateProgramacaoCultivar;
      const res = await fetch(`${baseUrl}/programacao_cultivares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const data = await res.json();
      return { ...payload, id: data.id } as any;
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
