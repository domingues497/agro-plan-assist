import { useState } from "react";
import { useUsuarios } from "@/hooks/useUsuarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";

export const ListUsuarios = () => {
  const { usuarios, isLoading, updateUsuario } = useUsuarios();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<any>(null);
  const [passwordValue, setPasswordValue] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    senha: "",
    nome: "",
    numerocm_consultor: "",
    role: "user",
  });

  const handleEdit = (usuario: any) => {
    setEditingUser({
      id: usuario.id,
      nome: usuario.nome || "",
      numerocm_consultor: usuario.numerocm_consultor || "",
      ativo: usuario.ativo,
      role: usuario.role || "user",
    });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!editingUser) return;

    updateUsuario(
      {
        userId: editingUser.id,
        updates: {
          nome: editingUser.nome,
          numerocm_consultor: editingUser.numerocm_consultor,
          ativo: editingUser.ativo,
          role: editingUser.role,
        },
      },
      {
        onSuccess: () => {
          setIsDialogOpen(false);
          setEditingUser(null);
        },
      }
    );
  };

  const handleCreateUser = async () => {
    try {
      const baseUrl = getApiBaseUrl();

      const importRes = await fetch(`${baseUrl}/consultores/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              email: (newUser.email || "").toLowerCase(),
              consultor: newUser.nome,
              numerocm_consultor: newUser.numerocm_consultor,
            },
          ],
        }),
      });
      if (!importRes.ok) {
        const txt = await importRes.text();
        throw new Error(txt);
      }

      const getRes = await fetch(`${baseUrl}/consultores/by_email?email=${encodeURIComponent((newUser.email || "").toLowerCase())}`);
      if (!getRes.ok) {
        const txt = await getRes.text();
        throw new Error(txt);
      }
      const getJson = await getRes.json();
      const item = getJson?.item;
      const userId = item?.id;
      if (!userId) throw new Error("Usuário criado, porém não foi possível obter o ID");

      const updRes = await fetch(`${baseUrl}/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newUser.role, ativo: true }),
      });
      if (!updRes.ok) {
        const txt = await updRes.text();
        throw new Error(txt);
      }

      if ((newUser.senha || "").length >= 6) {
        const token = sessionStorage.getItem("auth_token") || "";
        const passRes = await fetch(`${baseUrl}/users/${userId}/password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ password: newUser.senha }),
        });
        if (!passRes.ok) {
          const txt = await passRes.text();
          throw new Error(txt);
        }
      }

      toast({
        title: "Usuário criado",
        description: "O novo usuário foi criado com sucesso.",
      });

      setIsCreateDialogOpen(false);
      setNewUser({
        email: "",
        senha: "",
        nome: "",
        numerocm_consultor: "",
        role: "user",
      });
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    } catch (error: any) {
      toast({
        title: "Erro ao criar usuário",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSetPassword = async () => {
    try {
      if (!editingUser) return;
      if ((passwordValue || "").length < 6) {
        toast({ title: "Senha muito curta", description: "Use ao menos 6 caracteres.", variant: "destructive" });
        return;
      }
      const baseUrl = getApiBaseUrl();
      const token = sessionStorage.getItem("auth_token") || "";
      const res = await fetch(`${baseUrl}/users/${editingUser.id}/password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ password: passwordValue }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      toast({ title: "Senha atualizada", description: "A senha foi definida com sucesso." });
      setPasswordValue("");
    } catch (error: any) {
      toast({ title: "Erro ao definir senha", description: error.message, variant: "destructive" });
    }
  };
              <div className="space-y-2">
                <Label htmlFor="new-senha">Senha (mín. 6 caracteres)</Label>
                <Input
                  id="new-senha"
                  type="password"
                  value={newUser.senha}
                  onChange={(e) =>
                    setNewUser({ ...newUser, senha: e.target.value })
                  }
                />
              </div>
  if (isLoading) {
    return <div>Carregando usuários...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gerenciar Usuários</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Usuário</DialogTitle>
              <DialogDescription>
                Preencha os dados do novo usuário
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-email">Email</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser({ ...newUser, email: e.target.value })
                  }
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="new-nome">Nome</Label>
                <Input
                  id="new-nome"
                  value={newUser.nome}
                  onChange={(e) =>
                    setNewUser({ ...newUser, nome: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-numerocm">Número CM</Label>
                <Input
                  id="new-numerocm"
                  value={newUser.numerocm_consultor}
                  onChange={(e) =>
                    setNewUser({ ...newUser, numerocm_consultor: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-role">Papel</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value) =>
                    setNewUser({ ...newUser, role: value })
                  }
                >
                  <SelectTrigger id="new-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="consultor">Consultor</SelectItem>
                    <SelectItem value="gestor">Gestor</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreateUser}>Criar Usuário</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Número CM</TableHead>
            <TableHead>Papel</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usuarios?.map((usuario) => (
            <TableRow key={usuario.id}>
              <TableCell>{usuario.email}</TableCell>
              <TableCell>{usuario.nome || "-"}</TableCell>
              <TableCell>{usuario.numerocm_consultor || "-"}</TableCell>
              <TableCell>
                {usuario.role === "admin" 
                  ? "Administrador" 
                  : usuario.role === "gestor"
                  ? "Gestor"
                  : usuario.role === "consultor"
                  ? "Consultor"
                  : "Usuário"}
              </TableCell>
              <TableCell>
                <span
                  className={
                    usuario.ativo
                      ? "text-green-600 font-medium"
                      : "text-red-600 font-medium"
                  }
                >
                  {usuario.ativo ? "Ativo" : "Inativo"}
                </span>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEdit(usuario)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Altere as informações do usuário
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={editingUser.nome}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, nome: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numerocm">Número CM</Label>
                <Input
                  id="numerocm"
                  value={editingUser.numerocm_consultor}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      numerocm_consultor: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Papel</Label>
                <Select
                  value={editingUser.role}
                  onValueChange={(value) =>
                    setEditingUser({ ...editingUser, role: value })
                  }
                >
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="consultor">Consultor</SelectItem>
                    <SelectItem value="gestor">Gestor</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="ativo">Usuário Ativo</Label>
                <Switch
                  id="ativo"
                  checked={editingUser.ativo}
                  onCheckedChange={(checked) =>
                    setEditingUser({ ...editingUser, ativo: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-password">Definir/Resetar Senha</Label>
                <Input
                  id="reset-password"
                  type="password"
                  value={passwordValue}
                  onChange={(e) => setPasswordValue(e.target.value)}
                  placeholder="Nova senha (mín. 6 caracteres)"
                />
                <div className="flex justify-end">
                  <Button variant="secondary" onClick={handleSetPassword}>
                    Definir/Resetar senha
                  </Button>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
