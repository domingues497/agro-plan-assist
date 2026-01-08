import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/utils";

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
  embalagem: string | null;
  justificativa_nao_adubacao_id?: string | null;
  fertilizante_salvo: boolean;
  porcentagem_salva: number;
  total: number | null;
  safra_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateProgramacaoAdubacao = Omit<ProgramacaoAdubacao, "id" | "created_at" | "updated_at">;

export const useProgramacaoAdubacao = () => {
  const queryClient = useQueryClient();

  const { data: programacoes, isLoading, error } = useQuery({
    queryKey: ["programacao-adubacao"],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl();
      const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
      const res = await fetch(`${baseUrl}/programacao_adubacao`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Erro ao carregar adubação: ${res.status}`);
      const json = await res.json();
      const list = (json?.items ?? []) as ProgramacaoAdubacao[];
      return list;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (programacao: CreateProgramacaoAdubacao) => {
      const baseUrl = getApiBaseUrl();
      const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
      const res = await fetch(`${baseUrl}/programacao_adubacao`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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
      queryClient.invalidateQueries({ queryKey: ["programacao-adubacao"] });
      toast.success("Adubação criada com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar adubação: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProgramacaoAdubacao> & { id: string }) => {
      const baseUrl = getApiBaseUrl();
      const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
      const res = await fetch(`${baseUrl}/programacao_adubacao/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(updates as any)
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      return { id, ...(updates as any) } as any;
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
      const baseUrl = getApiBaseUrl();
      const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
      const res = await fetch(`${baseUrl}/programacao_adubacao/${id}`, { 
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error(`Erro ao excluir adubação: ${res.status}`);
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
      const baseUrl = getApiBaseUrl();
      const original = programacoes?.find((p) => p.id === id);
      if (!original) throw new Error("Adubação não encontrada");
      const { id: _, created_at, updated_at, ...duplicateData } = original as any;
      const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
      const res = await fetch(`${baseUrl}/programacao_adubacao`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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
    replicate: replicateMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isDuplicating: duplicateMutation.isPending,
    isReplicating: replicateMutation.isPending,
  };
};
