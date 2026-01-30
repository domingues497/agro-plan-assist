import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type Safra = {
  id: string;
  nome: string;
  is_default: boolean;
  ativa: boolean;
  ano_inicio: number | null;
  ano_fim: number | null;
  data_corte_programacao: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateSafra = Omit<Safra, "id" | "created_at" | "updated_at">;

export const useSafras = () => {
  const queryClient = useQueryClient();

  const getHeaders = () => {
    const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
    return {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    };
  };

  const { data: safras, isLoading, error } = useQuery({
    queryKey: ["safras"],
    queryFn: async () => {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const pathSafras = "/safras";
      const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${baseUrl}${pathSafras}`, { 
        headers 
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      return (json?.items || []) as Safra[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (safra: CreateSafra) => {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const pathSafras = "/safras";
      const res = await fetch(`${baseUrl}${pathSafras}`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(safra),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safras"] });
      toast.success("Safra criada com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar safra: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Safra> & { id: string }) => {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const pathSafras = "/safras";
      const res = await fetch(`${baseUrl}${pathSafras}/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safras"] });
      toast.success("Safra atualizada com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar safra: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const pathSafras = "/safras";
      const headers = getHeaders();
      const { "Content-Type": _, ...deleteHeadersObj } = headers;

      const res = await fetch(`${baseUrl}${pathSafras}/${encodeURIComponent(id)}`, { 
        method: "DELETE",
        headers: deleteHeadersObj
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safras"] });
      toast.success("Safra excluída com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir safra: ${error.message}`);
    },
  });

  const defaultSafra = safras?.find((s) => s.is_default);

  return {
    safras: safras ?? [],
    isLoading,
    error,
    create: createMutation.mutate,
    update: updateMutation.mutate,
    remove: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    defaultSafra,
  };
};
