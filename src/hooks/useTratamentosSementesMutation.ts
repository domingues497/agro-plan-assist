import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";
import { toast } from "sonner";

export function useTratamentosSementesMutation() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (nome: string) => {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/tratamentos_sementes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, ativo: true }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tratamentos"] });
      queryClient.invalidateQueries({ queryKey: ["tratamentos-sementes"] });
      toast.success("Tratamento cadastrado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao cadastrar tratamento: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ativo, cultura }: { id: string; ativo?: boolean; cultura?: string | null }) => {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/tratamentos_sementes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo, cultura }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tratamentos"] });
      queryClient.invalidateQueries({ queryKey: ["tratamentos-sementes"] });
      toast.success("Tratamento atualizado");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar tratamento: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const baseUrl = getApiBaseUrl();
      const token = sessionStorage.getItem("auth_token");
      const res = await fetch(`${baseUrl}/tratamentos_sementes/${id}`, { 
        method: "DELETE",
        headers: {
          Authorization: token ? `Bearer ${token}` : ""
        }
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tratamentos"] });
      queryClient.invalidateQueries({ queryKey: ["tratamentos-sementes"] });
      toast.success("Tratamento excluído com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir tratamento: ${error.message}`);
    },
  });

  return {
    create: createMutation.mutate,
    update: updateMutation.mutate,
    remove: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
