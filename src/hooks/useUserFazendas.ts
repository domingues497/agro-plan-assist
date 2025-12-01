import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export type UserFazenda = {
  id: string;
  user_id: string;
  fazenda_id: string;
  created_at: string;
};

export const useUserFazendas = (userId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["user-fazendas", userId],
    queryFn: async () => {
      if (!userId) return [];
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/user_fazendas?user_id=${encodeURIComponent(userId)}`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      return (json?.items || []) as UserFazenda[];
    },
    enabled: !!userId,
  });

  const addFazenda = useMutation({
    mutationFn: async ({ userId, fazendaId }: { userId: string; fazendaId: string; }) => {
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/user_fazendas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, fazenda_id: fazendaId }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-fazendas"] });
      toast({
        title: "Fazenda associada",
        description: "A fazenda foi associada com sucesso ao gestor.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao associar fazenda",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeFazenda = useMutation({
    mutationFn: async (id: string) => {
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/user_fazendas/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-fazendas"] });
      toast({
        title: "Associação removida",
        description: "A associação com a fazenda foi removida.",
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
    fazendas: data ?? [],
    isLoading,
    error,
    addFazenda: addFazenda.mutate,
    removeFazenda: removeFazenda.mutate,
    isAdding: addFazenda.isPending,
    isRemoving: removeFazenda.isPending,
  };
};
