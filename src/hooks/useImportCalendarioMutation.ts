import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";

export function useImportCalendarioMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ items, limparAntes, userId, fileName }: { items: any[], limparAntes: boolean, userId: string | undefined | null, fileName: string }) => {
      const baseUrl = getApiBaseUrl();
      const token = sessionStorage.getItem("auth_token");
      const res = await fetch(`${baseUrl}/calendario_aplicacoes/import`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ items, limpar_antes: limparAntes, user_id: userId, arquivo_nome: fileName }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Erro ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendario-aplicacoes"] });
    }
  });
}
