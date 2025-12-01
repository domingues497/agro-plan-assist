import { useQuery } from "@tanstack/react-query";

export const useCultivaresCatalog = () => {
  return useQuery({
    queryKey: ["cultivares-catalog"],
    queryFn: async () => {
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/cultivares_catalog`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      return json?.items || [];
    },
  });
};
