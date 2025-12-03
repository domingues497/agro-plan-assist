import { useQuery } from "@tanstack/react-query";
// Migração para API Flask

export type Epoca = {
  id: string;
  nome: string;
  descricao: string | null;
  ativa: boolean;
  created_at: string;
  updated_at: string;
};

export const useEpocas = () => {
  return useQuery({
    queryKey: ["epocas"],
    queryFn: async () => {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/epocas?ativas=true`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      return (json?.items || []) as Epoca[];
    },
  });
};
