import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export type GestorConsultor = {
  id: string;
  user_id: string;
  numerocm_consultor: string;
  created_at: string;
};

export const useGestorConsultores = (userId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["gestor-consultores", userId],
    queryFn: async () => {
      if (!userId) return [];
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/gestor_consultores?user_id=${encodeURIComponent(userId)}`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      return (json?.items || []) as GestorConsultor[];
    },
    enabled: !!userId,
  });

  const addConsultor = useMutation({
    mutationFn: async ({ userId, numerocmConsultor }: { userId: string; numerocmConsultor: string; }) => {
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/gestor_consultores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, numerocm_consultor: numerocmConsultor }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gestor-consultores"] });
      queryClient.invalidateQueries({ queryKey: ["produtores"] });
      queryClient.invalidateQueries({ queryKey: ["fazendas"] });
      toast({
        title: "Consultor associado",
        description: "O consultor foi associado com sucesso ao gestor.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao associar consultor",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeConsultor = useMutation({
    mutationFn: async (id: string) => {
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/gestor_consultores/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gestor-consultores"] });
      queryClient.invalidateQueries({ queryKey: ["produtores"] });
      queryClient.invalidateQueries({ queryKey: ["fazendas"] });
      toast({
        title: "Associação removida",
        description: "A associação com o consultor foi removida.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover associação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    consultores: data ?? [],
    isLoading,
    error,
    addConsultor: addConsultor.mutate,
    removeConsultor: removeConsultor.mutate,
    isAdding: addConsultor.isPending,
    isRemoving: removeConsultor.isPending,
  };
};
