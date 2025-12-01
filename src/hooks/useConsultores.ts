import { useQuery } from "@tanstack/react-query";
// Migração para API Flask

export type Consultor = {
  id: string;
  numerocm_consultor: string;
  consultor: string;
  email: string;
  created_at: string | null;
  updated_at: string | null;
};

export const useConsultores = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["consultores"],
    queryFn: async () => {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/consultores`);
      if (!res.ok) throw new Error(`Erro ao carregar consultores: ${res.status}`);
      const json = await res.json();
      return (json?.items ?? []) as Consultor[];
    },
  });

  return { data: data ?? [], isLoading, error };
};
