import { useQuery } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";

export type JustificativaAdubacao = {
  id: string;
  descricao: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export const useJustificativasAdubacao = () => {
  return useQuery({
    queryKey: ["justificativas-adubacao"],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/justificativas_adubacao?ativas=true`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      return (json?.items || []) as JustificativaAdubacao[];
    },
  });
};
