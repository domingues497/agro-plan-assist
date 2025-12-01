import { useQuery } from "@tanstack/react-query";

export const useDefensivosCatalog = () => {
  return useQuery({
    queryKey: ["defensivos-catalog"],
    queryFn: async () => {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/defensivos`, { credentials: "omit" });
      if (!res.ok) throw new Error(`Erro ao carregar defensivos: ${res.status}`);
      const json = await res.json();
      return (json?.items ?? []) as any[];
    },
  });
};
