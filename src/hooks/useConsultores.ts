import { useQuery } from "@tanstack/react-query";
// Migração para API Flask

export type Consultor = {
  id: string;
  numerocm_consultor: string;
  consultor: string;
  email: string;
  created_at: string | null;
  updated_at: string | null;
  pode_editar_programacao?: boolean;
  pode_criar_programacao?: boolean;
  pode_duplicar_programacao?: boolean;
  pode_excluir_programacao?: boolean;
  permite_edicao_apos_corte?: boolean;
};

export const useConsultores = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["consultores"],
    queryFn: async () => {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
      const res = await fetch(`${baseUrl}/consultores`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error(`Erro ao carregar consultores: ${res.status}`);
      const json = await res.json();
      return (json?.items ?? []) as Consultor[];
    },
  });

  return { data: data ?? [], isLoading, error };
};
