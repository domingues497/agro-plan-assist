import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";

export function useImportTalhoesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ items, limparAntes, userId, fileName }: any) => {
      const baseUrl = getApiBaseUrl();
      const token = sessionStorage.getItem("auth_token");
      
      const res = await fetch(`${baseUrl}/talhoes/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items,
          limpar_antes: limparAntes,
          user_id: userId,
          arquivo_nome: fileName,
        }),
      });
      
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Falha na importação");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["talhoes"] });
      // Invalidate other related queries if necessary, e.g., fazendas or programacao
    }
  });
}
