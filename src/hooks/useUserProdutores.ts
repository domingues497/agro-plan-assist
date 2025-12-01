import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export type UserProdutor = {
  id: string;
  user_id: string;
  produtor_numerocm: string;
  created_at: string;
};

export const useUserProdutores = (userId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["user-produtores", userId],
    queryFn: async () => {
      if (!userId) return [];
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/user_produtores?user_id=${encodeURIComponent(userId)}`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      return (json?.items || []) as UserProdutor[];
    },
    enabled: !!userId,
  });

  const addProdutor = useMutation({
    mutationFn: async ({ userId, produtorNumerocm }: { userId: string; produtorNumerocm: string; }) => {
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/user_produtores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, produtor_numerocm: produtorNumerocm }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-produtores"] });
      toast({
        title: "Produtor associado",
        description: "O produtor foi associado com sucesso ao gestor.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao associar produtor",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeProdutor = useMutation({
    mutationFn: async (id: string) => {
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/user_produtores/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-produtores"] });
      toast({
        title: "Associação removida",
        description: "A associação com o produtor foi removida.",
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
    produtores: data ?? [],
    isLoading,
    error,
    addProdutor: addProdutor.mutate,
    removeProdutor: removeProdutor.mutate,
    isAdding: addProdutor.isPending,
    isRemoving: removeProdutor.isPending,
  };
};
