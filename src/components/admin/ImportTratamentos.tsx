import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Trash2, Plus, Edit2 } from "lucide-react";
import { getApiBaseUrl } from "@/lib/utils";
import { useCultivaresCatalog } from "@/hooks/useCultivaresCatalog";
import { useTratamentosSementesMutation } from "@/hooks/useTratamentosSementesMutation";
import { useTratamentosSementes } from "@/hooks/useTratamentosSementes";

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
  const [nome, setNome] = useState("");
  const { data: cultivares = [] } = useCultivaresCatalog();
  const { create, update, remove, isCreating, isUpdating, isDeleting } = useTratamentosSementesMutation();

  const culturasDisponiveis = Array.from(new Set(
    (cultivares as any[])
      .map((c: any) => c.cultura ? String(c.cultura).toUpperCase().trim() : "")
      .filter((c: string) => c.length > 0)
  )).sort() as string[];

  const { data: tratamentos = [] } = useTratamentosSementes(undefined, false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Digite o nome do tratamento");
      return;
    }
    create(nome, {
      onSuccess: () => setNome(""),
    });
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
              <Button type="submit" className="w-full" disabled={isCreating}>
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
                      onSave={(id, cultura) => update({ id, cultura })}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={t.ativo ? "secondary" : "default"}
                        onClick={() => update({ id: t.id, ativo: !t.ativo })}
                        disabled={isUpdating}
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
                      onClick={() => remove(t.id)}
                      disabled={isDeleting}
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
