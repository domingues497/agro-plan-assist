import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type Safra = {
  id: string;
  nome: string;
  is_default: boolean;
  ativa: boolean;
  ano_inicio: number | null;
  ano_fim: number | null;
  created_at: string;
  updated_at: string;
};

export type CreateSafra = Omit<Safra, "id" | "created_at" | "updated_at">;

export const useSafras = () => {
  const queryClient = useQueryClient();

  const { data: safras, isLoading, error } = useQuery({
    queryKey: ["safras"],
    queryFn: async () => {
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/safras`);
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
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/safras`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/safras/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
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
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/safras/${encodeURIComponent(id)}`, { method: "DELETE" });
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
