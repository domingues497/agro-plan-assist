import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export type Usuario = {
  id: string;
  email: string;
  nome: string | null;
  numerocm_consultor: string | null;
  ativo: boolean;
  role: string | null;
  created_at: string;
};

export const useUsuarios = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: usuarios, isLoading, error } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/users`, { credentials: "omit" });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      const items = (json?.items || []) as any[];
      const usuariosComRoles: Usuario[] = items.map((it) => ({
        id: it.id,
        email: it.email,
        nome: it.consultor ?? null,
        numerocm_consultor: it.numerocm_consultor ?? null,
        ativo: !!it.ativo,
        role: it.role ?? null,
        created_at: it.created_at ?? "",
      }));
      return usuariosComRoles;
    },
  });

  const updateUsuario = useMutation({
    mutationFn: async ({
      userId,
      updates,
    }: {
      userId: string;
      updates: {
        nome?: string;
        numerocm_consultor?: string;
        ativo?: boolean;
        role?: string;
      };
    }) => {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const payload: any = {};
      if (typeof updates.role !== "undefined") payload.role = updates.role;
      if (typeof updates.ativo !== "undefined") payload.ativo = updates.ativo;
      if (typeof updates.nome !== "undefined") payload.nome = updates.nome;
      if (typeof updates.numerocm_consultor !== "undefined") payload.numerocm_consultor = updates.numerocm_consultor;
      const res = await fetch(`${baseUrl}/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      toast({
        title: "Usuário atualizado",
        description: "As informações foram salvas com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    usuarios,
    isLoading,
    error,
    updateUsuario: updateUsuario.mutate,
    isUpdating: updateUsuario.isPending,
  };
};
