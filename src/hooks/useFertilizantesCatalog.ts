import { useQuery } from "@tanstack/react-query";

export const useFertilizantesCatalog = () => {
  return useQuery({
    queryKey: ["fertilizantes-catalog"],
    queryFn: async () => {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/fertilizantes`, { credentials: "omit" });
      if (!res.ok) throw new Error(`Erro ao carregar fertilizantes: ${res.status}`);
      const json = await res.json();
      return (json?.items ?? []) as any[];
    },
  });
};
