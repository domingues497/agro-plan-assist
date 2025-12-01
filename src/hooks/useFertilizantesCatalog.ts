import { useQuery } from "@tanstack/react-query";

export const useFertilizantesCatalog = () => {
  return useQuery({
    queryKey: ["fertilizantes-catalog"],
    queryFn: async () => {
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/fertilizantes`, { credentials: "omit" });
      if (!res.ok) throw new Error(`Erro ao carregar fertilizantes: ${res.status}`);
      const json = await res.json();
      return (json?.items ?? []) as any[];
    },
  });
};
