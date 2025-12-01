import { useQuery } from "@tanstack/react-query";

export type TratamentoSemente = {
  id: string;
  nome: string;
  cultura: "MILHO" | "SOJA";
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export const useTratamentosSementes = (cultura?: string) => {
  return useQuery({
    queryKey: ["tratamentos-sementes", cultura],
    queryFn: async () => {
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const params = new URLSearchParams();
      params.set("ativo", "true");
      if (cultura) params.set("cultura", String(cultura).toUpperCase());
      const res = await fetch(`${baseUrl}/tratamentos_sementes?${params.toString()}`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      return (json?.items || []) as TratamentoSemente[];
    },
  });
};
