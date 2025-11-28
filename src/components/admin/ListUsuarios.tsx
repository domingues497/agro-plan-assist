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
import { supabase } from "@/integrations/supabase/client";

export const ListUsuarios = () => {
  const { usuarios, isLoading, updateUsuario } = useUsuarios();
  const { toast } = useToast();
  const [editingUser, setEditingUser] = useState<any>(null);
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
      // Chamar edge function para criar usuário
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: newUser.email,
          password: newUser.senha,
          nome: newUser.nome,
          numerocm_consultor: newUser.numerocm_consultor,
          role: newUser.role,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
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
      
      // Recarregar lista
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "Erro ao criar usuário",
        description: error.message,
        variant: "destructive",
      });
    }
  };

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
                <Label htmlFor="new-senha">Senha</Label>
                <Input
                  id="new-senha"
                  type="password"
                  value={newUser.senha}
                  onChange={(e) =>
                    setNewUser({ ...newUser, senha: e.target.value })
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
                {usuario.role === "admin" ? "Administrador" : "Usuário"}
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
