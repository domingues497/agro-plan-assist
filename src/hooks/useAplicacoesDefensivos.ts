import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/aplicacoes_defensivos`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      const list = (json?.items || []) as AplicacaoDefensivo[];
      const key = "aplicacoes_defensivos_produtor_map";
      let map: Record<string, string> = {};
      try {
        const raw = localStorage.getItem(key);
        map = raw ? JSON.parse(raw) : {};
      } catch (_) {}
      return list.map((ap) => ({
        ...ap,
        produtor_numerocm: String(ap.produtor_numerocm || map[ap.id] || "").trim() || ap.produtor_numerocm,
      }));
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateAplicacaoDefensivo) => {
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/aplicacoes_defensivos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data as any),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      setProdutorMapping(json?.id, data.produtor_numerocm);
      return { id: json.id, produtor_numerocm: data.produtor_numerocm, area: data.area, defensivos: data.defensivos } as any;
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
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/aplicacoes_defensivos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data as any),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
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
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/aplicacoes_defensivos/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
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
