import { useQuery } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";

export const useJustificativasAdubacao = (onlyActive: boolean = true) => {
  return useQuery({
    queryKey: ["justificativas-adubacao", onlyActive],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl();
      const token = sessionStorage.getItem("auth_token");
      const params = new URLSearchParams();
      if (onlyActive) params.set("ativo", "true");
      
      const res = await fetch(`${baseUrl}/justificativas_adubacao?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      return (json?.items || []) as any[];
    },
  });
};
