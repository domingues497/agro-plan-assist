import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";

export function useImportFazendasMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ items, userId, fileName }: { items: any[], userId: string, fileName: string }) => {
      const baseUrl = getApiBaseUrl();
      const token = sessionStorage.getItem("auth_token");
      
      const res = await fetch(`${baseUrl}/fazendas/bulk`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: token ? `Bearer ${token}` : "" 
        },
        body: JSON.stringify({
          items,
          user_id: userId,
          arquivo_nome: fileName,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Falha na importação de fazendas");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fazendas"] });
    }
  });
}
