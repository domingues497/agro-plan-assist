import { useEffect, useState } from "react";
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
import { useFazendas } from "@/hooks/useFazendas";

type FormAdubacaoProps = {
  onSubmit: (data: CreateProgramacaoAdubacao) => void;
  onCancel: () => void;
  isLoading?: boolean;
  initialData?: Partial<CreateProgramacaoAdubacao>;
  title?: string;
  submitLabel?: string;
};

export const FormAdubacao = ({ onSubmit, onCancel, isLoading, initialData, title = "Nova Adubação", submitLabel = "Salvar adubação" }: FormAdubacaoProps) => {
  const [open, setOpen] = useState(false);
  const { data: fertilizantes } = useFertilizantesCatalog();
  const { data: produtores } = useProdutores();
  const [openProdutor, setOpenProdutor] = useState(false);
  const [openFazenda, setOpenFazenda] = useState(false);
  
  const normalizeNumerocm = (v?: string) => (v || "").trim().toLowerCase();
  const parseNumber = (v: string | number | null | undefined) => {
    const s = typeof v === "string" ? v.replace(",", ".") : v?.toString() || "";
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  };
  const [lastEdited, setLastEdited] = useState<"area" | "dose" | "total" | null>(null);
  
  const [formData, setFormData] = useState<CreateProgramacaoAdubacao>({
    formulacao: initialData?.formulacao ?? "",
    area: initialData?.area ?? "",
    produtor_numerocm: (initialData?.produtor_numerocm ?? "").trim(),
    dose: initialData?.dose ?? 0,
    total: initialData?.total ?? null,
    data_aplicacao: initialData?.data_aplicacao ?? null,
    responsavel: initialData?.responsavel ?? null,
    fertilizante_salvo: initialData?.fertilizante_salvo ?? false,
    deve_faturar: initialData?.deve_faturar ?? true,
    porcentagem_salva: initialData?.porcentagem_salva ?? 0,
  });

  const { data: fazendas } = useFazendas(formData.produtor_numerocm);

  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({
        ...prev,
        ...initialData,
        produtor_numerocm: (initialData.produtor_numerocm ?? prev.produtor_numerocm)?.trim() || "",
        formulacao: initialData.formulacao ?? prev.formulacao,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.produtor_numerocm, initialData?.formulacao]);

  useEffect(() => {
    const areaNum = parseNumber(formData.area);
    if (!formData.total && Number.isFinite(areaNum) && formData.dose > 0) {
      const computed = areaNum * formData.dose;
      setFormData((prev) => ({ ...prev, total: computed }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
                            setFormData({ ...formData, produtor_numerocm: currentValue.trim(), area: "" });
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
            <Label htmlFor="fazenda">Fazenda *</Label>
            <Popover open={openFazenda} onOpenChange={setOpenFazenda}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openFazenda}
                  className="w-full justify-between"
                  disabled={!formData.produtor_numerocm}
                >
                  {formData.area
                    ? fazendas.find(f => f.nomefazenda === formData.area)?.nomefazenda || formData.area
                    : "Selecione uma fazenda..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Buscar fazenda..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma fazenda encontrada.</CommandEmpty>
                    <CommandGroup>
                      {fazendas?.map((f) => (
                        <CommandItem
                          key={f.id}
                          value={f.nomefazenda}
                          onSelect={(currentValue) => {
                            setFormData({ ...formData, area: currentValue });
                            setOpenFazenda(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.area === f.nomefazenda ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {f.nomefazenda} {f.area_cultivavel && `(${f.area_cultivavel} ha)`}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="area_ha">Área (ha) *</Label>
            <Input
              id="area_ha"
              type="number"
              step="0.01"
              placeholder="Digite a área em hectares"
              onChange={(e) => {
                const areaVal = e.target.value;
                const areaNum = parseNumber(areaVal);
                if (Number.isFinite(areaNum)) {
                  if (lastEdited === "total") {
                    const dose = areaNum > 0 && formData.total ? (formData.total as number) / areaNum : 0;
                    setFormData({ ...formData, dose });
                  } else {
                    const total = formData.dose > 0 ? areaNum * formData.dose : null;
                    setFormData({ ...formData, total });
                  }
                }
                setLastEdited("area");
              }}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dose">Dose (kg/ha) *</Label>
            <Input
              id="dose"
              type="text"
              inputMode="decimal"
              value={formData.dose}
              onChange={(e) => {
                const doseNum = parseNumber(e.target.value);
                if (Number.isFinite(doseNum)) {
                  const areaNum = parseNumber(formData.area);
                  const total = Number.isFinite(areaNum) ? areaNum * doseNum : null;
                  setFormData({ ...formData, dose: doseNum, total });
                } else {
                  setFormData({ ...formData, dose: 0 });
                }
                setLastEdited("dose");
              }}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="total">Total (kg)</Label>
            <Input
              id="total"
              type="text"
              inputMode="decimal"
              value={formData.total || ""}
              onChange={(e) => {
                const val = e.target.value;
                const totalNum = val ? parseNumber(val) : NaN;
                const areaNum = parseNumber(formData.area);
                if (val === "") {
                  setFormData({ ...formData, total: null });
                } else if (Number.isFinite(totalNum) && Number.isFinite(areaNum) && areaNum > 0) {
                  const dose = totalNum / areaNum;
                  setFormData({ ...formData, total: totalNum, dose });
                } else if (Number.isFinite(totalNum)) {
                  setFormData({ ...formData, total: totalNum });
                }
                setLastEdited("total");
              }}
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
