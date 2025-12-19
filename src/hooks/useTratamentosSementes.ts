import { useQuery } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";

export type TratamentoSemente = {
  id: string;
  nome: string;
  cultura: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export const useTratamentosSementes = (cultura?: string) => {
  return useQuery({
    queryKey: ["tratamentos-sementes", cultura],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl();
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
