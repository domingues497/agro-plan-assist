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
import { useCultivaresCatalog } from "@/hooks/useCultivaresCatalog";
import { CreateProgramacaoCultivar } from "@/hooks/useProgramacaoCultivares";
import { useProdutores } from "@/hooks/useProdutores";
import { useFazendas } from "@/hooks/useFazendas";

type FormProgramacaoProps = {
  onSubmit: (data: CreateProgramacaoCultivar) => void;
  onCancel: () => void;
  isLoading?: boolean;
  initialData?: Partial<CreateProgramacaoCultivar>;
  title?: string;
  submitLabel?: string;
};

export const FormProgramacao = ({ onSubmit, onCancel, isLoading, initialData, title = "Nova Programação", submitLabel = "Salvar programação" }: FormProgramacaoProps) => {
  const [open, setOpen] = useState(false);
  const { data: cultivares } = useCultivaresCatalog();
  const { data: produtores } = useProdutores();
  const [openProdutor, setOpenProdutor] = useState(false);
  const [openGrupo, setOpenGrupo] = useState(false);
  const [openFazenda, setOpenFazenda] = useState(false);
  const [filtroGrupo, setFiltroGrupo] = useState("");
  const [searchCultivar, setSearchCultivar] = useState("");
  const normalizeCM = (v: string | undefined | null) => String(v ?? "").trim().toLowerCase();
  const BIGBAG_5M = 5_000_000;
  const SACA_200K = 200_000;
  const SACA_160K = 160_000;
  type EmbalagemPreferida = "auto" | "bigbag_5m" | "saca_200k" | "saca_160k";
  const [embalagemPreferida, setEmbalagemPreferida] = useState<EmbalagemPreferida>("auto");
  const [openEmbalagem, setOpenEmbalagem] = useState(false);
  const [resultadoEmbalagens, setResultadoEmbalagens] = useState<string>("");
  
  const [formData, setFormData] = useState<CreateProgramacaoCultivar>({
    cultivar: initialData?.cultivar ?? "",
    area: initialData?.area ?? "",
    produtor_numerocm: initialData?.produtor_numerocm ?? "",
    quantidade: initialData?.quantidade ?? 0,
    area_hectares: initialData?.area_hectares ?? 0,
    unidade: initialData?.unidade ?? "kg",
    data_plantio: initialData?.data_plantio ?? null,
    safra: initialData?.safra ?? null,
    semente_propria: initialData?.semente_propria ?? false,
    referencia_rnc_mapa: initialData?.referencia_rnc_mapa ?? null,
    porcentagem_salva: initialData?.porcentagem_salva ?? 0,
    populacao_recomendada: initialData?.populacao_recomendada ?? 0,
    sementes_por_saca: initialData?.sementes_por_saca ?? 0,
  });

  // Calcula automaticamente a quantidade conforme preferência de embalagem
  useEffect(() => {
    const { populacao_recomendada, area_hectares } = formData;
    const plantasHa = populacao_recomendada > 0 ? populacao_recomendada * 10000 : 0;
    const totalSementes = plantasHa > 0 && area_hectares > 0 ? plantasHa * area_hectares : 0;

    // Atualiza quantidade conforme preferência de embalagem
    if (totalSementes > 0) {
      if (embalagemPreferida === "bigbag_5m") {
        const qtd = Math.ceil(totalSementes / BIGBAG_5M);
        setFormData(prev => ({ ...prev, quantidade: qtd, unidade: "bigbag" }));
      } else if (embalagemPreferida === "saca_200k") {
        const qtd = Math.ceil(totalSementes / SACA_200K);
        setFormData(prev => ({ ...prev, quantidade: qtd, unidade: "saca 200k" }));
      } else if (embalagemPreferida === "saca_160k") {
        const qtd = Math.ceil(totalSementes / SACA_160K);
        setFormData(prev => ({ ...prev, quantidade: qtd, unidade: "saca 160k" }));
      } else {
        // Modo automático: não define quantidade numérica única; exibe breakdown
        setFormData(prev => ({ ...prev, quantidade: 0, unidade: "misto" }));
      }
    }

    // Gera breakdown textual para modo automático (cascata)
    if (embalagemPreferida === "auto" && totalSementes > 0) {
      const bigbags = Math.floor(totalSementes / BIGBAG_5M);
      let resto = totalSementes - bigbags * BIGBAG_5M;
      const sacas200 = Math.floor(resto / SACA_200K);
      resto -= sacas200 * SACA_200K;
      let sacas160 = 0;
      if (resto > 0) {
        sacas160 = Math.ceil(resto / SACA_160K);
        resto = 0;
      }
      const partes: string[] = [];
      if (bigbags > 0) partes.push(`${bigbags} BigBag${bigbags > 1 ? "s" : ""}`);
      if (sacas200 > 0) partes.push(`${sacas200} Saca${sacas200 > 1 ? "s" : ""} de 200k`);
      if (sacas160 > 0) partes.push(`${sacas160} Saca${sacas160 > 1 ? "s" : ""} de 160k`);
      setResultadoEmbalagens(partes.length ? partes.join(", ") : "Sem cálculo disponível");
    } else {
      // Quando embalagem específica, mostra apenas aquela
      if (totalSementes > 0) {
        if (embalagemPreferida === "bigbag_5m") {
          setResultadoEmbalagens(`${Math.ceil(totalSementes / BIGBAG_5M)} BigBag(s)`);
        } else if (embalagemPreferida === "saca_200k") {
          setResultadoEmbalagens(`${Math.ceil(totalSementes / SACA_200K)} Saca(s) de 200k`);
        } else if (embalagemPreferida === "saca_160k") {
          setResultadoEmbalagens(`${Math.ceil(totalSementes / SACA_160K)} Saca(s) de 160k`);
        } else {
          setResultadoEmbalagens("");
        }
      } else {
        setResultadoEmbalagens("");
      }
    }
  }, [formData.populacao_recomendada, formData.area_hectares, embalagemPreferida]);

  const { data: fazendas } = useFazendas(formData.produtor_numerocm);

  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({
        ...prev,
        ...initialData,
        produtor_numerocm: typeof initialData.produtor_numerocm === "string" ? initialData.produtor_numerocm.trim() : prev.produtor_numerocm,
        cultivar: initialData.cultivar ?? prev.cultivar,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.produtor_numerocm, initialData?.cultivar]);

  // Preenche automaticamente o filtro de "Grupo" quando estamos editando
  // e o catálogo de cultivares já está carregado.
  useEffect(() => {
    if (!formData.cultivar) return;
    if (filtroGrupo) return; // evita sobrescrever escolhas do usuário
    const target = (formData.cultivar || "").trim().toLowerCase();
    const match = (cultivares || []).find(
      (c) => (c.item || "").trim().toLowerCase() === target
    );
    if (match?.cultivar) {
      setFiltroGrupo(match.cultivar);
    }
  }, [formData.cultivar, cultivares, filtroGrupo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const cultivaresFiltrados = (cultivares || []).filter((c) => {
    // Filtro por grupo (agora mostra cultivar)
    if (filtroGrupo) {
      const cultivar = (c.cultivar || "").toLowerCase();
      if (!cultivar.includes(filtroGrupo.toLowerCase())) {
        return false;
      }
    }
    
    // Filtro por busca de texto
    if (searchCultivar) {
      const searchTerm = searchCultivar.toLowerCase();
      const itemMatch = (c.item || "").toLowerCase().includes(searchTerm);
      const cultivarMatch = (c.cultivar || "").toLowerCase().includes(searchTerm);
      const marcaMatch = (c.marca || "").toLowerCase().includes(searchTerm);
      const codItemMatch = (c.cod_item || "").toLowerCase().includes(searchTerm);
      return itemMatch || cultivarMatch || marcaMatch || codItemMatch;
    }
    
    return true;
  });
  const grupos = Array.from(
    new Set((cultivares || []).map((c) => (c.cultivar || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
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
                    ? `${formData.produtor_numerocm} - ${(produtores.find(p => normalizeCM(p.numerocm) === normalizeCM(formData.produtor_numerocm))?.nome) || ""}`
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
                          value={`${p.numerocm} ${p.nome}`}
                          onSelect={() => {
                            setFormData({ ...formData, produtor_numerocm: p.numerocm.trim(), area: "" });
                            setOpenProdutor(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              normalizeCM(formData.produtor_numerocm) === normalizeCM(p.numerocm) ? "opacity-100" : "opacity-0"
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
              value={formData.area_hectares || ""}
              onChange={(e) => setFormData({ ...formData, area_hectares: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="populacao_recomendada">População Recomendada (plantas/m²)</Label>
            <Input
              id="populacao_recomendada"
              type="number"
              step="0.01"
              placeholder="Ex: 28"
              value={formData.populacao_recomendada || ""}
              onChange={(e) => setFormData({ ...formData, populacao_recomendada: parseFloat(e.target.value) || 0 })}
            />
            <p className="text-xs text-muted-foreground">
              {formData.populacao_recomendada > 0 && `${(formData.populacao_recomendada * 10000).toLocaleString('pt-BR')} plantas/ha`}
            </p>
          </div>

          {/* Removido bloco de "Unidades" quando embalagem específica; usamos apenas o breakdown textual */}

          <div className="space-y-2">
            <Label>Embalagem</Label>
            <Popover open={openEmbalagem} onOpenChange={setOpenEmbalagem}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openEmbalagem}
                  className="w-full justify-between"
                >
                  {embalagemPreferida === "auto" && "Automático (cascata)"}
                  {embalagemPreferida === "bigbag_5m" && "BigBag 5M"}
                  {embalagemPreferida === "saca_200k" && "Saca 200k"}
                  {embalagemPreferida === "saca_160k" && "Saca 160k"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandList>
                    <CommandEmpty>Nenhuma opção</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        key="auto"
                        value="auto"
                        onSelect={() => {
                          setEmbalagemPreferida("auto");
                          setOpenEmbalagem(false);
                          // Mantém unidade anterior ou padrão
                          setFormData(prev => ({ ...prev, unidade: prev.unidade || "kg" }));
                        }}
                      >
                        Automático (cascata)
                      </CommandItem>
                      <CommandItem
                        key="bigbag"
                        value="bigbag_5m"
                        onSelect={() => {
                          setEmbalagemPreferida("bigbag_5m");
                          setOpenEmbalagem(false);
                          setFormData(prev => ({ ...prev, unidade: "bigbag" }));
                        }}
                      >
                        BigBag 5M
                      </CommandItem>
                      <CommandItem
                        key="s200"
                        value="saca_200k"
                        onSelect={() => {
                          setEmbalagemPreferida("saca_200k");
                          setOpenEmbalagem(false);
                          setFormData(prev => ({ ...prev, unidade: "saca 200k" }));
                        }}
                      >
                        Saca 200k
                      </CommandItem>
                      <CommandItem
                        key="s160"
                        value="saca_160k"
                        onSelect={() => {
                          setEmbalagemPreferida("saca_160k");
                          setOpenEmbalagem(false);
                          setFormData(prev => ({ ...prev, unidade: "saca 160k" }));
                        }}
                      >
                        Saca 160k
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="resultado_embalagens">Resultado por Embalagem</Label>
            <Input
              id="resultado_embalagens"
              placeholder="Mostrado automaticamente"
              value={resultadoEmbalagens}
              readOnly
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Em modo automático, usa cascata: BigBag 5M → Saca 200k → Saca 160k.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="safra">Safra</Label>
            <Input
              id="safra"
              placeholder="2024/2025"
              value={formData.safra || ""}
              onChange={(e) => setFormData({ ...formData, safra: e.target.value || null })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="grupo">Cultivar</Label>
            <Popover open={openGrupo} onOpenChange={setOpenGrupo}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openGrupo}
                  className="w-full justify-between"
                >
                  {filtroGrupo ? filtroGrupo : "Selecione a cultivar..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Buscar cultivar..." />
                  <CommandList>
                    <CommandEmpty>Nenhum cultivar encontrado.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        key="todos"
                        value=""
                        onSelect={() => {
                          setFiltroGrupo("");
                          setOpenGrupo(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", !filtroGrupo ? "opacity-100" : "opacity-0")} />
                        Todos
                      </CommandItem>
                      {grupos.map((grupo) => (
                        <CommandItem
                          key={grupo}
                          value={grupo}
                          onSelect={(currentValue) => {
                            setFiltroGrupo(currentValue);
                            setOpenGrupo(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              filtroGrupo.toLowerCase() === grupo.toLowerCase()
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {grupo}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cultivar">Item  *</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between"
                >
                  {formData.cultivar || "Selecione um cultivar..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command shouldFilter={false}>
                  <CommandInput 
                    placeholder="Buscar cultivar..." 
                    value={searchCultivar}
                    onValueChange={setSearchCultivar}
                  />
                  <CommandList>
                    <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                    <CommandGroup>
                      {cultivaresFiltrados?.map((cultivar) => (
                        <CommandItem
                          key={cultivar.cod_item}
                          value={cultivar.item || ""}
                          onSelect={() => {
                            setFormData({ ...formData, cultivar: cultivar.item || "" });
                            setSearchCultivar("");
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.cultivar === cultivar.item ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {cultivar.item}
                          {cultivar.marca && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({cultivar.marca})
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
            <Label htmlFor="unidade">Unidade</Label>
            <Select value={formData.unidade} onValueChange={(value) => setFormData({ ...formData, unidade: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">kg</SelectItem>
                <SelectItem value="sc">sc (sacas)</SelectItem>
                <SelectItem value="un">un (unidades)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="data_plantio">Data Plantio</Label>
            <Input
              id="data_plantio"
              type="date"
              value={formData.data_plantio || ""}
              onChange={(e) => setFormData({ ...formData, data_plantio: e.target.value || null })}
            />
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="semente_propria"
              checked={formData.semente_propria}
              onCheckedChange={(checked) => setFormData({ ...formData, semente_propria: !!checked })}
            />
            <Label htmlFor="semente_propria" className="font-medium">
              Semente própria
            </Label>
          </div>

          {formData.semente_propria && (
            <div className="space-y-2 pl-6">
              <Label htmlFor="referencia_rnc_mapa">Cultivar RNC</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {formData.referencia_rnc_mapa || "Selecione o cultivar..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Buscar cultivar..." />
                    <CommandList>
                      <CommandEmpty>Nenhum cultivar encontrado.</CommandEmpty>
                      <CommandGroup>
                        {cultivares?.map((cultivar) => (
                          <CommandItem
                            key={cultivar.cod_item}
                            value={cultivar.item || ""}
                            onSelect={() => {
                              setFormData({ ...formData, referencia_rnc_mapa: cultivar.item || null });
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.referencia_rnc_mapa === cultivar.item ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {cultivar.item}
                            {cultivar.marca && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                ({cultivar.marca})
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
          )}

          {formData.semente_propria && (
            <div className="space-y-2 pl-6">
              <Label htmlFor="porcentagem_salva">% de semente salva</Label>
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
                Porcentagem da área que usará semente salva
              </p>
            </div>
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
