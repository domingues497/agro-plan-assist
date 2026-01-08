import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";

export function useImportConsultoresMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ items, fileName }: { items: any[], fileName: string }) => {
      const baseUrl = getApiBaseUrl();
      const token = sessionStorage.getItem("auth_token");
      const res = await fetch(`${baseUrl}/consultores/import`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          items,
          user_id: null,
          arquivo_nome: fileName
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Erro ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consultores"] });
    }
  });
}
