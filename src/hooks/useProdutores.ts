import { useQuery } from "@tanstack/react-query";

export type Produtor = {
  id: string;
  numerocm: string;
  nome: string;
  numerocm_consultor: string;
  consultor: string | null;
  tipocooperado: string | null;
  assistencia: string | null;
  compra_insumos?: boolean;
  entrega_producao?: boolean;
  entrega_producao_destino?: string;
  paga_assistencia?: boolean;
  observacao_flags?: string;
  cod_empresa?: string;
  created_at: string | null;
  updated_at: string | null;
};

export const useProdutores = () => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["produtores", "by-consultor"],
    queryFn: async () => {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();

      const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
      const url = `${baseUrl}/produtores`;

      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      const items = (json?.items || []) as Produtor[];
      return items;
    },
  });

  return { data: data ?? [], isLoading, error, refetch };
};
