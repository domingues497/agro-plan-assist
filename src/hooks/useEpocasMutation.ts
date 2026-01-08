import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";
import { toast } from "sonner";

export function useEpocasMutation() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: { nome: string; descricao: string }) => {
      const baseUrl = getApiBaseUrl();
      const token = sessionStorage.getItem("auth_token");
      const res = await fetch(`${baseUrl}/epocas`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ nome: data.nome, descricao: data.descricao || null, ativa: true }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-epocas"] });
      queryClient.invalidateQueries({ queryKey: ["epocas"] });
      toast.success("Época cadastrada com sucesso");
    },
    onError: (error: any) => {
      toast.error(`Erro ao cadastrar época: ${error.message}`);
    },
  });

  return {
    create: createMutation.mutate,
    isCreating: createMutation.isPending,
  };
}
