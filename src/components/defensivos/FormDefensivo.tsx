import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDefensivosCatalog } from "@/hooks/useDefensivosCatalog";
import { CreateProgramacaoDefensivo } from "@/hooks/useProgramacaoDefensivos";
import { useProdutores } from "@/hooks/useProdutores";

type FormDefensivoProps = {
  onSubmit: (data: CreateProgramacaoDefensivo) => void;
  onCancel: () => void;
  isLoading?: boolean;
  initialData?: Partial<CreateProgramacaoDefensivo>;
  title?: string;
  submitLabel?: string;
};

export const FormDefensivo = ({ onSubmit, onCancel, isLoading, initialData, title = "Nova Aplicação de Defensivo", submitLabel = "Salvar aplicação" }: FormDefensivoProps) => {
  const [open, setOpen] = useState(false);
  const { data: defensivos } = useDefensivosCatalog();
  const { data: produtores } = useProdutores();
  const [openProdutor, setOpenProdutor] = useState(false);
  
  const normalizeNumerocm = (v?: string) => (v || "").trim().toLowerCase();
  const parseNumber = (val: string | number): number => {
    if (typeof val === "number") return val;
    const s = (val || "").trim().replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  };
  
  const [formData, setFormData] = useState<CreateProgramacaoDefensivo>({
    defensivo: initialData?.defensivo ?? "",
    area: initialData?.area ?? "",
    produtor_numerocm: (initialData?.produtor_numerocm ?? "").trim(),
    dose: initialData?.dose ?? 0,
    unidade: initialData?.unidade ?? "L/ha",
    data_aplicacao: initialData?.data_aplicacao ?? null,
    alvo: initialData?.alvo ?? null,
    produto_salvo: initialData?.produto_salvo ?? false,
    deve_faturar: initialData?.deve_faturar ?? true,
    porcentagem_salva: initialData?.porcentagem_salva ?? 0,
  });

  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({
        ...prev,
        ...initialData,
        produtor_numerocm: (initialData.produtor_numerocm ?? prev.produtor_numerocm)?.trim() || "",
        defensivo: initialData.defensivo ?? prev.defensivo,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.produtor_numerocm, initialData?.defensivo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card className="p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
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
                    ? (() => {
                        const selected = produtores.find(
                          (p) => normalizeNumerocm(p.numerocm) === normalizeNumerocm(formData.produtor_numerocm)
                        );
                        return `${formData.produtor_numerocm} - ${selected?.nome || ""}`;
                      })()
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
                            setFormData({ ...formData, produtor_numerocm: currentValue.trim() });
                            setOpenProdutor(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              normalizeNumerocm(formData.produtor_numerocm) === normalizeNumerocm(p.numerocm)
                                ? "opacity-100"
                                : "opacity-0"
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
            <Label htmlFor="defensivo">Defensivo *</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between"
                >
                  {formData.defensivo || "Selecione um defensivo..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Buscar defensivo..." />
                  <CommandList>
                    <CommandEmpty>Nenhum defensivo encontrado.</CommandEmpty>
                    <CommandGroup>
                      {defensivos?.map((defensivo) => (
                        <CommandItem
                          key={defensivo.cod_item}
                          value={defensivo.item || ""}
                          onSelect={(currentValue) => {
                            setFormData({ ...formData, defensivo: currentValue });
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.defensivo === defensivo.item ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {defensivo.item}
                          {defensivo.marca && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({defensivo.marca})
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
            <Label htmlFor="dose">Dose *</Label>
            <Input
              id="dose"
              type="text"
              inputMode="decimal"
              value={formData.dose}
              onChange={(e) => {
                const n = parseNumber(e.target.value);
                setFormData({ ...formData, dose: Number.isFinite(n) ? n : 0 });
              }}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="unidade">Unidade</Label>
            <Select value={formData.unidade || "L/ha"} onValueChange={(value) => setFormData({ ...formData, unidade: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="L/ha">L/ha</SelectItem>
                <SelectItem value="kg/ha">kg/ha</SelectItem>
                <SelectItem value="ml/ha">ml/ha</SelectItem>
                <SelectItem value="g/ha">g/ha</SelectItem>
              </SelectContent>
            </Select>
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
            <Label htmlFor="alvo">Alvo</Label>
            <Input
              id="alvo"
              placeholder="Ex: Lagarta, Ferrugem..."
              value={formData.alvo || ""}
              onChange={(e) => setFormData({ ...formData, alvo: e.target.value || null })}
            />
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="produto_salvo"
              checked={formData.produto_salvo}
              onCheckedChange={(checked) => setFormData({ ...formData, produto_salvo: !!checked })}
            />
            <Label htmlFor="produto_salvo" className="font-medium">
              Produto salvo de safra anterior (RN012)
            </Label>
          </div>

          {formData.produto_salvo && (
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
              <Label htmlFor="porcentagem_salva">% de produto salvo (RN013)</Label>
              <Input
                id="porcentagem_salva"
                type="text"
                inputMode="decimal"
                value={formData.porcentagem_salva}
                onChange={(e) => {
                  const n = parseNumber(e.target.value);
                  const clamped = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
                  setFormData({ ...formData, porcentagem_salva: clamped });
                }}
              />
              <p className="text-xs text-muted-foreground">
                Porcentagem da área que usará produto salvo
              </p>
            </div>
            </>
          )}
        </div>

        <div className="flex gap-2 pt-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Salvando..." : submitLabel}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
};
