import { useQuery } from "@tanstack/react-query";

export const useDefensivosCatalog = () => {
  return useQuery({
    queryKey: ["defensivos-catalog"],
    queryFn: async () => {
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/defensivos`, { credentials: "omit" });
      if (!res.ok) throw new Error(`Erro ao carregar defensivos: ${res.status}`);
      const json = await res.json();
      return (json?.items ?? []) as any[];
    },
  });
};
