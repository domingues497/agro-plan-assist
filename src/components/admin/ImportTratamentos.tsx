import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, Edit2 } from "lucide-react";
import { getApiBaseUrl } from "@/lib/utils";
import { useCultivaresCatalog } from "@/hooks/useCultivaresCatalog";

const TratamentoCulturaEdit = ({ tratamento, culturasDisponiveis, onSave }: { tratamento: any, culturasDisponiveis: string[], onSave: (id: string, cultura: string | null) => void }) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  // Sincroniza estado quando abre
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      const current = tratamento.cultura 
        ? String(tratamento.cultura).split(",").map((s: string) => s.trim()).filter(Boolean)
        : [];
      setSelected(current);
    }
    setOpen(isOpen);
  };

  const handleToggle = (cultura: string) => {
    setSelected(prev => 
      prev.includes(cultura) 
        ? prev.filter(c => c !== cultura)
        : [...prev, cultura]
    );
  };

  const handleSave = () => {
    const newVal = selected.length > 0 ? selected.join(", ") : null;
    onSave(tratamento.id, newVal);
    setOpen(false);
  };

  const displayValue = tratamento.cultura || "Sem cultura";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-auto py-1 px-2 min-w-[120px] justify-start text-left font-normal whitespace-normal">
          {displayValue}
          <Edit2 className="ml-2 h-3 w-3 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4" align="start">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Culturas</h4>
            <p className="text-sm text-muted-foreground">Selecione as culturas para este tratamento.</p>
          </div>
          <div className="grid gap-2 max-h-[200px] overflow-y-auto">
            {culturasDisponiveis.map((c) => (
              <div key={c} className="flex items-center space-x-2">
                <Checkbox 
                  id={`treat-${tratamento.id}-${c}`}
                  checked={selected.includes(c)}
                  onCheckedChange={() => handleToggle(c)}
                />
                <Label htmlFor={`treat-${tratamento.id}-${c}`} className="cursor-pointer font-normal">
                  {c}
                </Label>
              </div>
            ))}
          </div>
          <Button onClick={handleSave} className="w-full size-sm">
            Salvar Alterações
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const ImportTratamentos = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const { data: cultivares = [] } = useCultivaresCatalog();

  const culturasDisponiveis = Array.from(new Set(
    (cultivares as any[])
      .map((c: any) => c.cultura ? String(c.cultura).toUpperCase().trim() : "")
      .filter((c: string) => c.length > 0)
  )).sort() as string[];

  const { data: tratamentos = [] } = useQuery({
    queryKey: ["admin-tratamentos"],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/tratamentos_sementes`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      return (json?.items || []) as any[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ativo, cultura }: { id: string; ativo?: boolean; cultura?: string | null }) => {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/tratamentos_sementes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo, cultura }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tratamentos"] });
      toast({ title: "Tratamento atualizado" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar tratamento", description: error.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/tratamentos_sementes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, ativo: true }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tratamentos"] });
      toast({ title: "Tratamento cadastrado com sucesso!" });
      setNome("");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao cadastrar tratamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/tratamentos_sementes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tratamentos"] });
      toast({ title: "Tratamento excluído com sucesso!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir tratamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast({
        title: "Erro",
        description: "Digite o nome do tratamento",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciar Tratamentos de Sementes</CardTitle>
        <CardDescription>
          Cadastre e gerencie os tratamentos disponíveis para milho e soja
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Tratamento</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Tratamento Premium"
                required
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>
          </div>
        </form>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cultura(s)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tratamentos.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.nome}</TableCell>
                  <TableCell>
                    <TratamentoCulturaEdit 
                      tratamento={t} 
                      culturasDisponiveis={culturasDisponiveis}
                      onSave={(id, cultura) => updateMutation.mutate({ id, cultura })}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={t.ativo ? "secondary" : "default"}
                        onClick={() => updateMutation.mutate({ id: t.id, ativo: !t.ativo })}
                        disabled={updateMutation.isPending}
                        size="sm"
                      >
                        {t.ativo ? "Desativar" : "Ativar"}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => deleteMutation.mutate(t.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
