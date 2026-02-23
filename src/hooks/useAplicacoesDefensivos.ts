import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";
import { toast } from "sonner";

const isUuid = (s?: string | null) =>
  !!s && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(String(s));

export type DefensivoItem = {
  id?: string;
  defensivo: string;
  dose: number;
  unidade: string;
  alvo: string | null;
  classe?: string; // Classe selecionada (ex.: HERBICIDA, ADUBO FOLIAR)
  aplicacoes?: string[]; // Array de descrições de aplicação selecionadas
  produto_salvo: boolean;
  deve_faturar: boolean;
  porcentagem_salva: number;
  area_hectares: number;
  total?: number;
  // Safra vinculada à programação de defensivos
  safra_id?: string;
};

export type AplicacaoDefensivo = {
  id: string;
  user_id: string;
  produtor_numerocm: string | null;
  area: string;
  safra_nome?: string;
  safra_id?: string;
  tipo?: "PROGRAMACAO" | "PREVIA";
  epoca_id?: string;
   cultura?: string | null;
  created_at: string;
  updated_at: string;
  defensivos: DefensivoItem[];
  talhao_ids?: string[];
};

export type CreateAplicacaoDefensivo = {
  produtor_numerocm: string;
  area: string;
  safra_id?: string;
  tipo?: "PROGRAMACAO" | "PREVIA";
  epoca_id?: string;
  cultura?: string | null;
  talhao_ids?: string[];
  defensivos: Omit<DefensivoItem, "id">[];
};

export const useAplicacoesDefensivos = () => {
  const queryClient = useQueryClient();

  // Fetch all aplicacoes with their defensivos
  const { data: aplicacoes = [], isLoading, error } = useQuery({
    queryKey: ["aplicacoes-defensivos"],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl();
      const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
      const res = await fetch(`${baseUrl}/aplicacoes_defensivos`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      const list = (json?.items || []) as AplicacaoDefensivo[];
      return list;
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateAplicacaoDefensivo) => {
      const baseUrl = getApiBaseUrl();
      const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
      const res = await fetch(`${baseUrl}/aplicacoes_defensivos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(data as any),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      return { id: json.id, produtor_numerocm: data.produtor_numerocm, area: data.area, defensivos: data.defensivos } as any;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["aplicacoes-defensivos"] });
      toast.success("Aplicação criada com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao criar aplicação: " + error.message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & CreateAplicacaoDefensivo) => {
      const baseUrl = getApiBaseUrl();
      const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
      const res = await fetch(`${baseUrl}/aplicacoes_defensivos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(data as any),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["aplicacoes-defensivos"] });
      toast.success("Aplicação atualizada com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar aplicação: " + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const baseUrl = getApiBaseUrl();
      const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
      const res = await fetch(`${baseUrl}/aplicacoes_defensivos/${id}`, { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["aplicacoes-defensivos"] });
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
        safra_id: aplicacao.safra_id,
        tipo: aplicacao.tipo,
        epoca_id: aplicacao.epoca_id,
        cultura: aplicacao.cultura ?? null,
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
        safra_id: aplicacao.safra_id,
        tipo: aplicacao.tipo,
        epoca_id: aplicacao.epoca_id,
        cultura: aplicacao.cultura ?? null,
        defensivos: aplicacao.defensivos.map(({ id, ...def }) => def),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["aplicacoes-defensivos"] });
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
