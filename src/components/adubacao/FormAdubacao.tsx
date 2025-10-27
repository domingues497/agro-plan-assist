import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFertilizantesCatalog } from "@/hooks/useFertilizantesCatalog";
import { CreateProgramacaoAdubacao } from "@/hooks/useProgramacaoAdubacao";
import { useProdutores } from "@/hooks/useProdutores";

type FormAdubacaoProps = {
  onSubmit: (data: CreateProgramacaoAdubacao) => void;
  onCancel: () => void;
  isLoading?: boolean;
};

export const FormAdubacao = ({ onSubmit, onCancel, isLoading }: FormAdubacaoProps) => {
  const [open, setOpen] = useState(false);
  const { data: fertilizantes } = useFertilizantesCatalog();
  const { data: produtores } = useProdutores();
  const [openProdutor, setOpenProdutor] = useState(false);
  
  const [formData, setFormData] = useState<CreateProgramacaoAdubacao>({
    formulacao: "",
    area: "",
    produtor_numerocm: "",
    dose: 0,
    total: null,
    data_aplicacao: null,
    responsavel: null,
    fertilizante_salvo: false,
    deve_faturar: true,
    porcentagem_salva: 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card className="p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Nova Adubação</h3>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="produtor">Produtor *</Label>
            <Popover open={openProdutor} onOpenChange={setOpenProdutor}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openProdutor}
                  className="w-full justify-between"
                >
                  {formData.produtor_numerocm
                    ? `${formData.produtor_numerocm} - ${(produtores.find(p => p.numerocm === formData.produtor_numerocm)?.nome) || ""}`
                    : "Selecione um produtor..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Buscar produtor..." />
                  <CommandList>
                    <CommandEmpty>Nenhum produtor encontrado.</CommandEmpty>
                    <CommandGroup>
                      {produtores?.map((p) => (
                        <CommandItem
                          key={p.numerocm}
                          value={p.numerocm}
                          onSelect={(currentValue) => {
                            setFormData({ ...formData, produtor_numerocm: currentValue });
                            setOpenProdutor(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.produtor_numerocm === p.numerocm ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {p.numerocm} - {p.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label htmlFor="formulacao">Formulação NPK *</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between"
                >
                  {formData.formulacao || "Selecione uma formulação..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Buscar formulação..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma formulação encontrada.</CommandEmpty>
                    <CommandGroup>
                      {fertilizantes?.map((fertilizante) => (
                        <CommandItem
                          key={fertilizante.cod_item}
                          value={fertilizante.item || ""}
                          onSelect={(currentValue) => {
                            setFormData({ ...formData, formulacao: currentValue });
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.formulacao === fertilizante.item ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {fertilizante.item}
                          {fertilizante.marca && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({fertilizante.marca})
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="area">Área *</Label>
            <Input
              id="area"
              value={formData.area}
              onChange={(e) => setFormData({ ...formData, area: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dose">Dose (kg/ha) *</Label>
            <Input
              id="dose"
              type="number"
              step="0.01"
              value={formData.dose}
              onChange={(e) => setFormData({ ...formData, dose: parseFloat(e.target.value) })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="total">Total (kg)</Label>
            <Input
              id="total"
              type="number"
              step="0.01"
              value={formData.total || ""}
              onChange={(e) => setFormData({ ...formData, total: e.target.value ? parseFloat(e.target.value) : null })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="data_aplicacao">Data Aplicação</Label>
            <Input
              id="data_aplicacao"
              type="date"
              value={formData.data_aplicacao || ""}
              onChange={(e) => setFormData({ ...formData, data_aplicacao: e.target.value || null })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsavel">Responsável</Label>
            <Input
              id="responsavel"
              value={formData.responsavel || ""}
              onChange={(e) => setFormData({ ...formData, responsavel: e.target.value || null })}
            />
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="fertilizante_salvo"
              checked={formData.fertilizante_salvo}
              onCheckedChange={(checked) => setFormData({ ...formData, fertilizante_salvo: !!checked })}
            />
            <Label htmlFor="fertilizante_salvo" className="font-medium">
              Fertilizante salvo de safra anterior (RN012)
            </Label>
          </div>

          {formData.fertilizante_salvo && (
            <>
              <div className="flex items-center space-x-2 pl-6">
                <Checkbox
                  id="deve_faturar"
                  checked={formData.deve_faturar}
                  onCheckedChange={(checked) => setFormData({ ...formData, deve_faturar: !!checked })}
                />
                <Label htmlFor="deve_faturar">
                  Deve faturar
                </Label>
              </div>

              <div className="space-y-2 pl-6">
                <Label htmlFor="porcentagem_salva">% de fertilizante salvo (RN013)</Label>
                <Input
                  id="porcentagem_salva"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.porcentagem_salva}
                  onChange={(e) => setFormData({ ...formData, porcentagem_salva: parseFloat(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">
                  Porcentagem da área que usará fertilizante salvo
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 pt-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Salvando..." : "Salvar adubação"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
};
