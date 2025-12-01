import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export type Profile = {
  id: string;
  user_id: string;
  numerocm_consultor: string | null;
  nome: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export const useProfile = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const token = localStorage.getItem("auth_token") || "";
      const res = await fetch(`${baseUrl}/auth/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Falha ao obter perfil");
      }
      const json = await res.json();
      const user = (json?.user || {}) as any;
      const prof: Profile = {
        id: user.id,
        user_id: user.id,
        numerocm_consultor: user.numerocm_consultor ?? null,
        nome: user.consultor ?? null,
        created_at: user.created_at ?? null,
        updated_at: user.updated_at ?? null,
      };
      return prof;
    },
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const token = localStorage.getItem("auth_token") || "";
      const id = (profile as any)?.id;
      if (!id) throw new Error("Usuário não autenticado");
      const body: any = {};
      if (typeof updates.nome !== "undefined") body.consultor = updates.nome;
      if (typeof updates.numerocm_consultor !== "undefined") body.numerocm_consultor = updates.numerocm_consultor;
      const res = await fetch(`${baseUrl}/users/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Falha ao atualizar perfil");
      }
      return { id, ...updates } as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar perfil",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const changePassword = useMutation({
    mutationFn: async (newPassword: string) => {
      if (!newPassword || newPassword.length < 6) throw new Error("Use ao menos 6 caracteres.");
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const token = localStorage.getItem("auth_token") || "";
      const id = (profile as any)?.id;
      if (!id) throw new Error("Usuário não autenticado");
      const res = await fetch(`${baseUrl}/users/${id}/password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Falha ao alterar senha");
      }
      return { ok: true } as any;
    },
    onSuccess: () => {
      toast({ title: "Senha atualizada", description: "A senha foi definida com sucesso." });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao definir senha", description: error.message, variant: "destructive" });
    },
  });

  return {
    profile,
    isLoading,
    error,
    updateProfile: updateProfile.mutate,
    changePassword: changePassword.mutate,
    isUpdating: updateProfile.isPending,
  };
};
