import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";

export function useImportProdutoresMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ items, userId, fileName }: { items: any[], userId: string, fileName: string }) => {
      const baseUrl = getApiBaseUrl();
      const token = sessionStorage.getItem("auth_token");
      
      const res = await fetch(`${baseUrl}/produtores/bulk`, {
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
        throw new Error(txt || "Falha na importação de produtores");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtores"] });
    }
  });
}
