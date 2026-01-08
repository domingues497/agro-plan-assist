import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";
import { toast } from "sonner";

export function useJustificativasMutation() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (descricao: string) => {
      const baseUrl = getApiBaseUrl();
      const token = sessionStorage.getItem("auth_token");
      const res = await fetch(`${baseUrl}/justificativas_adubacao`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ descricao, ativo: true }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-justificativas"] });
      queryClient.invalidateQueries({ queryKey: ["justificativas-adubacao"] });
      toast.success("Justificativa cadastrada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao cadastrar justificativa: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const baseUrl = getApiBaseUrl();
      const token = sessionStorage.getItem("auth_token");
      const res = await fetch(`${baseUrl}/justificativas_adubacao/${id}`, { 
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
      queryClient.invalidateQueries({ queryKey: ["admin-justificativas"] });
      queryClient.invalidateQueries({ queryKey: ["justificativas-adubacao"] });
      toast.success("Justificativa excluída com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir justificativa: ${error.message}`);
    },
  });

  return {
    create: createMutation.mutate,
    remove: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
