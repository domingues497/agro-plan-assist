import { useMutation } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";

export function useImportMutation() {
  return useMutation({
    mutationFn: async ({ endpoint, items, userId, fileName }: { endpoint: string, items: any[], userId: string, fileName: string }) => {
      const baseUrl = getApiBaseUrl();
      const token = sessionStorage.getItem("auth_token");
      
      const res = await fetch(`${baseUrl}${endpoint}`, {
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
        throw new Error(txt || `Falha na importação para ${endpoint}`);
      }
      return res.json();
    },
  });
}
