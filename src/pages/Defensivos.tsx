import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Copy, Trash2, Plus, Pencil, Check, ChevronsUpDown, Search, Shield } from "lucide-react";
import { useAplicacoesDefensivos, AplicacaoDefensivo } from "@/hooks/useAplicacoesDefensivos";
import { FormAplicacaoDefensivo } from "@/components/defensivos/FormAplicacaoDefensivo";
import { useProdutores } from "@/hooks/useProdutores";
import { useProgramacoes } from "@/hooks/useProgramacoes";
import { useProgramacaoCultivares } from "@/hooks/useProgramacaoCultivares";
import { useProgramacaoAdubacao } from "@/hooks/useProgramacaoAdubacao";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useFazendas } from "@/hooks/useFazendas";
import { useSafras } from "@/hooks/useSafras";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfile } from "@/hooks/useProfile";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useConsultores } from "@/hooks/useConsultores";
import { GlobalLoading } from "@/components/ui/global-loading";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { useAreasCalc } from "@/hooks/useAreasCalc";

const Defensivos = () => {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AplicacaoDefensivo | null>(null);
  const { aplicacoes, isLoading, create, remove, update, isCreating, isUpdating, replicate, isReplicating } = useAplicacoesDefensivos();
  const { data: produtores = [], isLoading: produtoresLoading } = useProdutores();
  const { programacoes = [], isLoading: programacoesLoading } = useProgramacoes();
  const { programacoes: cultProgramacoes = [], isLoading: cultProgramacoesLoading } = useProgramacaoCultivares();
  const { programacoes: adubProgramacoes = [], isLoading: adubProgramacoesLoading } = useProgramacaoAdubacao();

  const temProgramacoes = programacoes.length > 0;
  const [replicateOpen, setReplicateOpen] = useState(false);
  const [replicateTargetId, setReplicateTargetId] = useState<string | null>(null);
  const [replicateProdutorNumerocm, setReplicateProdutorNumerocm] = useState<string>("");
  const [replicateTargets, setReplicateTargets] = useState<Array<{ produtor_numerocm: string; area: string }>>([]);
  const [openReplicateProdutorPopover, setOpenReplicateProdutorPopover] = useState(false);
  const [openReplicateFazendaPopover, setOpenReplicateFazendaPopover] = useState(false);
  const [selectedAreaPairs, setSelectedAreaPairs] = useState<Array<{ produtor_numerocm: string; area: string }>>([]);
  const { data: fazendas = [] } = useFazendas(replicateProdutorNumerocm);
  const { data: fazendasAll = [] } = useFazendas();
  const { profile } = useProfile();
  const { data: adminRole } = useAdminRole();
  const { data: consultores = [] } = useConsultores();
  const isAdmin = !!adminRole?.isAdmin;
  const isConsultor = !!profile?.numerocm_consultor && !isAdmin;
  const consultorRow = consultores.find((c: any) => String(c.numerocm_consultor) === String(profile?.numerocm_consultor || ""));
  const canEditDefensivos = isAdmin || (!!consultorRow && !!consultorRow.pode_editar_programacao);
  const { data: areasCalc = {} } = useAreasCalc(aplicacoes, programacoes, fazendasAll);
  const [searchTerm, setSearchTerm] = useState("");
  const { safras, isLoading: safrasLoading } = useSafras();
  const [selectedSafra, setSelectedSafra] = useState<string>("all");



  const filteredAplicacoes = useMemo(() => {
    let filtered = aplicacoes;

    if (selectedSafra && selectedSafra !== "all") {
      filtered = filtered.filter(ap => {
        const safraId = ap.safra_id;
        // Se não tiver safra definida, exibe para evitar sumiço de dados antigos
        return !safraId || String(safraId) === String(selectedSafra);
      });
    }

    if (!searchTerm) return filtered;
    const lower = searchTerm.toLowerCase();
    return filtered.filter((ap) => {
      const produtor = produtores.find(p => p.numerocm === ap.produtor_numerocm);
      const matchNumerocm = String(ap.produtor_numerocm || "").toLowerCase().includes(lower);
      const matchNome = String(produtor?.nome || "").toLowerCase().includes(lower);
      const matchArea = String(ap.area || "").toLowerCase().includes(lower);
      return matchNumerocm || matchNome || matchArea;
    });
  }, [aplicacoes, searchTerm, produtores, selectedSafra]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, aplicacoes.length]);

  const paginatedAplicacoes = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAplicacoes.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAplicacoes, currentPage]);

  const totalPages = Math.ceil(filteredAplicacoes.length / itemsPerPage);

  const produtoresComCultivar = useMemo(() => {
    const set = new Set<string>();
    for (const p of cultProgramacoes) {
      const cm = String(p.produtor_numerocm || "").trim();
      if (cm) set.add(cm);
    }
    return set;
  }, [cultProgramacoes]);

  const produtoresComAdubacao = useMemo(() => {
    const set = new Set<string>();
    for (const p of adubProgramacoes) {
      const cm = String(p.produtor_numerocm || "").trim();
      if (cm) set.add(cm);
    }
    return set;
  }, [adubProgramacoes]);

  const produtoresComCultivarOuAdubacao = useMemo(() => {
    const set = new Set<string>();
    for (const cm of produtoresComCultivar) {
      set.add(cm);
    }
    for (const cm of produtoresComAdubacao) {
      set.add(cm);
    }
    return set;
  }, [produtoresComCultivar, produtoresComAdubacao]);

  const areasCultivarPorProdutor = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const p of cultProgramacoes) {
      const cm = String(p.produtor_numerocm || "").trim();
      const area = String(p.area || "").trim();
      if (!cm || !area) continue;
      if (!map.has(cm)) map.set(cm, new Set<string>());
      map.get(cm)!.add(area);
    }
    return map;
  }, [cultProgramacoes]);

  const areasAdubacaoPorProdutor = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const p of adubProgramacoes) {
      const cm = String(p.produtor_numerocm || "").trim();
      const area = String(p.area || "").trim();
      if (!cm || !area) continue;
      if (!map.has(cm)) map.set(cm, new Set<string>());
      map.get(cm)!.add(area);
    }
    return map;
  }, [adubProgramacoes]);

  // Aplicação origem (não deve aparecer como destino)
  const sourceAplicacao = useMemo(() => {
    if (!replicateTargetId) return null;
    return aplicacoes.find((a) => a.id === replicateTargetId) || null;
  }, [aplicacoes, replicateTargetId]);

  // Safra da aplicação origem (usada para validar destinos por safra)
  const safraIdAplicacao = useMemo(() => {
    if (!sourceAplicacao) return "";
    const d = (sourceAplicacao.defensivos || []).find((it: any) => it && it.safra_id);
    return String(d?.safra_id || "").trim();
  }, [sourceAplicacao]);

  const handleSubmit = async (data: any) => {
    try {
      await create(data);
      setShowForm(false);
    } catch (error) {
      console.error(error);
    }
  };

  const isPageLoading =
    (isLoading && aplicacoes.length === 0) ||
    (produtoresLoading && produtores.length === 0) ||
    (programacoesLoading && programacoes.length === 0) ||
    (cultProgramacoesLoading && cultProgramacoes.length === 0) ||
    (adubProgramacoesLoading && adubProgramacoes.length === 0) ||
    (safrasLoading && safras.length === 0);

  return (
    <div className="min-h-screen bg-background">
      <GlobalLoading isVisible={isPageLoading} message="Carregando defensivos..." />
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Defensivos</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Programação de Defensivos</h2>
            <p className="text-muted-foreground">Programação planejadas por área</p>
          </div>
          <Button 
            onClick={() => setShowForm(!showForm)}
            disabled={!temProgramacoes}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova Programação
          </Button>
        </div>

        <div className="flex justify-end items-center gap-2 mb-6">
          <Select value={selectedSafra} onValueChange={setSelectedSafra}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecione a safra" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as safras</SelectItem>
              {safras.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, área ou CM..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {!temProgramacoes && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 font-medium">
              ⚠️ É necessário ter programação de cultivares ou adubação antes de programar defensivos.
            </p>
          </div>
        )}

        <Dialog open={showForm || !!editing} onOpenChange={(open) => {
          if (!open) {
            setShowForm(false);
            setEditing(null);
          }
        }}>
          <DialogContent className="max-w-[90vw] w-full max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Programação de Defensivo" : "Nova Programação de Defensivo"}</DialogTitle>
            </DialogHeader>
            {showForm && !editing && (
              <FormAplicacaoDefensivo
                title=""
                onSubmit={handleSubmit}
                onCancel={() => setShowForm(false)}
                isLoading={isCreating}
              />
            )}

            {editing && (
              <FormAplicacaoDefensivo
                title=""
                submitLabel="Salvar alterações"
                initialData={{
                  id: editing.id,
                  produtor_numerocm: editing.produtor_numerocm || "",
                  area: editing.area,
                  safra_id: editing.safra_id,
                  tipo: editing.tipo,
                  epoca_id: editing.epoca_id,
                  cultura: editing.cultura || "",
                  defensivos: editing.defensivos,
                }}
                readOnly={isConsultor && !canEditDefensivos}
                onSubmit={async (data) => {
                  await update({ id: editing.id, ...data });
                  setEditing(null);
                }}
                onCancel={() => setEditing(null)}
                isLoading={isUpdating}
              />
            )}
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <p className="text-muted-foreground">Carregando programação...</p>
        ) : (
          <div className="grid gap-4">
            {filteredAplicacoes.length === 0 ? (
              <Card className="p-6">
                <p className="text-muted-foreground">Nenhuma programação cadastrada.</p>
              </Card>
            ) : (
              paginatedAplicacoes.map((aplicacao) => (
                <Card key={aplicacao.id} className="hover:shadow-lg transition-shadow">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1" className="border-none">
                      <div className="flex items-center justify-between p-6 pb-0">
                        <div className="flex items-center gap-3 flex-1">
                          <Shield className="h-5 w-5 text-primary" />
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{aplicacao.produtor_numerocm} - {produtores.find(p => p.numerocm === aplicacao.produtor_numerocm)?.nome || ""} </h3>
                            {(() => {
                              const defs = (aplicacao.defensivos || []) as any[];
                              const safraId = String(aplicacao.safra_id || "").trim();
                              const key = `${String(aplicacao.produtor_numerocm)}|${String(aplicacao.area)}|${safraId}`;
                              const areaHa = Number(areasCalc[key] ?? 0);
                              const safraNome = aplicacao.safra_nome || safras.find(s => String(s.id) === String(safraId))?.nome || "—";
                              const totalGeral = defs.reduce((acc: number, d: any) => {
                                const dose = Number(d?.dose || 0);
                                const area = Number(d?.area_hectares || 0);
                                const cobertura = Math.min(100, Math.max(0, Number(d?.porcentagem_salva ?? 100))) / 100;
                                const t = typeof d?.total === "number" ? Number(d.total) : dose * area * cobertura;
                                return acc + (isNaN(t) ? 0 : t);
                              }, 0);

                              return (
                                <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">Safra:</span>
                                  <span>{safraNome}</span>
                                  <span className="text-muted-foreground/30">|</span>
                                  <span className="font-medium">Área:</span>
                                  <span>
                                    {aplicacao.area}
                                    {areaHa > 0 ? ` (${areaHa.toFixed(2)} ha)` : ""}
                                  </span>
                                  <span className="text-muted-foreground/30">|</span>
                                  <span className="font-medium">Total:</span>
                                  <span>{totalGeral.toFixed(2)}</span>
                                </p>
                              );
                            })()}
                            <p className="text-xs text-muted-foreground">
                              {aplicacao.defensivos.length} defensivo(s) programado(s)
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setEditing(aplicacao)}
                            title="Editar programação"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              setReplicateTargetId(aplicacao.id);
                              setReplicateProdutorNumerocm("");
                              setReplicateOpen(true);
                            }}
                            title="Replicar programação"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={async () => await remove(aplicacao.id)}
                            title="Excluir programação"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <AccordionTrigger className="px-6 py-4 hover:no-underline">
                        <span className="text-sm font-medium">Ver defensivos aplicados</span>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-6">
                        {(() => {
                          const defs = aplicacao.defensivos || [];
                          const calcTotal = (d: any) => {
                            const dose = Number(d?.dose || 0);
                            const area = Number(d?.area_hectares || 0);
                            const cobertura = Math.min(100, Math.max(0, Number(d?.porcentagem_salva ?? 100))) / 100;
                            const t = typeof d?.total === "number" ? Number(d.total) : dose * area * cobertura;
                            return isNaN(t) ? 0 : t;
                          };
                          const classeMap = new Map<string, { count: number; total: number }>();
                          const aplicMap = new Map<string, { count: number; total: number }>();
                          for (const d of defs) {
                            const total = calcTotal(d);
                            const cls = String(d?.classe || "").trim() || "Sem classe";
                            const ap = String(d?.alvo || "").trim() || "Sem aplicação";
                            const c = classeMap.get(cls) || { count: 0, total: 0 };
                            c.count += 1;
                            c.total += total;
                            classeMap.set(cls, c);
                            const a = aplicMap.get(ap) || { count: 0, total: 0 };
                            a.count += 1;
                            a.total += total;
                            aplicMap.set(ap, a);
                          }
                          const classeArr = Array.from(classeMap.entries()).map(([nome, info]) => ({ nome, ...info })).sort((x, y) => x.nome.localeCompare(y.nome));
                          const aplicArr = Array.from(aplicMap.entries()).map(([nome, info]) => ({ nome, ...info })).sort((x, y) => x.nome.localeCompare(y.nome));
                          return (
                            <div className="grid gap-3 mb-3 md:grid-cols-2">
                              <Card className="p-4 bg-muted/50">
                                <h4 className="text-sm font-semibold mb-2">Resumo por classe</h4>
                                <div className="space-y-1">
                                  {classeArr.map((r) => (
                                    <div key={r.nome} className="flex items-center justify-between text-sm">
                                      <span className="text-muted-foreground">{r.nome}</span>
                                      <span className="font-semibold">{r.count} • {r.total.toFixed(2)}</span>
                                    </div>
                                  ))}
                                  {classeArr.length === 0 && (<p className="text-sm text-muted-foreground">Sem dados</p>)}
                                </div>
                              </Card>
                              <Card className="p-4 bg-muted/50">
                                <h4 className="text-sm font-semibold mb-2">Resumo por aplicação</h4>
                                <div className="space-y-1">
                                  {aplicArr.map((r) => (
                                    <div key={r.nome} className="flex items-center justify-between text-sm">
                                      <span className="text-muted-foreground">{r.nome}</span>
                                      <span className="font-semibold">{r.count} • {r.total.toFixed(2)}</span>
                                    </div>
                                  ))}
                                  {aplicArr.length === 0 && (<p className="text-sm text-muted-foreground">Sem dados</p>)}
                                </div>
                              </Card>
                            </div>
                          );
                        })()}
                        <div className="grid gap-3 pt-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {aplicacao.defensivos.map((def, idx) => (
                            <div key={def.id || idx} className="bg-muted/50 p-4 rounded-md">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-semibold">{def.defensivo}</span>
                                {def.produto_salvo && (
                                  <Badge variant="secondary" className="text-xs">Produto Salvo</Badge>
                                )}
                              </div>
                              <div className="text-sm">
                                <p className="truncate">
                                  <span className="text-muted-foreground">Dose:</span> {def.dose} {def.unidade}
                                  {def.alvo ? (
                                    <>
                                      {" "}• <span className="text-muted-foreground">Alvo:</span> {def.alvo}
                                    </>
                                  ) : null}
                                  {def.produto_salvo && def.porcentagem_salva > 0 ? (
                                    <>
                                      {" "}• <span className="text-muted-foreground">% Salva:</span> {def.porcentagem_salva}%
                                    </>
                                  ) : null}
                                  {" "}• <span className="text-muted-foreground">Total:</span> {(
                                    typeof def.total === "number"
                                      ? Number(def.total)
                                      : (Number(def.dose || 0) * Number(def.area_hectares || 0) * (Math.min(100, Math.max(0, Number(def.porcentagem_salva ?? 100))) / 100))
                                  ).toFixed(2)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </Card>
              ))
            )}
            {totalPages > 1 && (
              <div className="flex items-center justify-between py-4">
                <div className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      {/* Dialog de Replicação */}
      <Dialog open={replicateOpen} onOpenChange={(o) => setReplicateOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replicar programação</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Produtor</label>
              <Popover open={openReplicateProdutorPopover} onOpenChange={setOpenReplicateProdutorPopover}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between">
                    {replicateProdutorNumerocm
                      ? `${replicateProdutorNumerocm} - ${produtores.find(p => p.numerocm === replicateProdutorNumerocm)?.nome || ""}`
                      : "Selecione produtor..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Buscar produtor..." />
                    <CommandList>
                      <CommandEmpty>Nenhum produtor encontrado.</CommandEmpty>
                      <CommandGroup>
                        {produtores
                          .filter((produtor) => produtoresComCultivarOuAdubacao.has(String(produtor.numerocm)))
                          .filter((produtor) => {
                            // Oculta o produtor origem inteiro
                            return !sourceAplicacao || String(produtor.numerocm) !== String(sourceAplicacao.produtor_numerocm);
                          })
                          .map((produtor) => (
                          <CommandItem
                            key={produtor.id}
                            value={`${produtor.numerocm} ${produtor.nome}`}
                            onSelect={() => {
                              setReplicateProdutorNumerocm(produtor.numerocm);
                              setSelectedAreaPairs([]);
                              // Não limpar destinos ao trocar de produtor; permite acumular múltiplos
                              setOpenReplicateProdutorPopover(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                replicateProdutorNumerocm === produtor.numerocm ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {produtor.numerocm} - {produtor.nome}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Áreas (fazendas)</label>
              <Popover open={openReplicateFazendaPopover} onOpenChange={setOpenReplicateFazendaPopover}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openReplicateFazendaPopover}
                    className="w-full justify-between"
                    disabled={!replicateProdutorNumerocm}
                  >
                    {selectedAreaPairs.length > 0
                      ? `${selectedAreaPairs.length} área(s) selecionada(s)`
                      : "Selecione áreas..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Buscar área..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma área encontrada.</CommandEmpty>
                      <CommandGroup>
                        {fazendas
                          .filter((f) => {
                            const areaNome = String(f.nomefazenda);
                            const hasArea = Number(f.area_cultivavel || 0) > 0;
                            const allowedCult = areasCultivarPorProdutor.get(String(replicateProdutorNumerocm));
                            const allowedAdub = areasAdubacaoPorProdutor.get(String(replicateProdutorNumerocm));
                            const isAllowedByCultivar = !!allowedCult && allowedCult.has(areaNome);
                            const isAllowedByAdubacao = !!allowedAdub && allowedAdub.has(areaNome);
                            const isSameSafraCultOk = !safraIdAplicacao
                              ? true
                              : cultProgramacoes.some((p) =>
                                  String(p.produtor_numerocm) === String(replicateProdutorNumerocm) &&
                                  String(p.area) === areaNome &&
                                  String(p.safra || "") === String(safraIdAplicacao)
                                );
                            const isSameSafraAdubOk = !safraIdAplicacao
                              ? true
                              : adubProgramacoes.some((p: any) =>
                                  String(p.produtor_numerocm) === String(replicateProdutorNumerocm) &&
                                  String(p.area) === areaNome &&
                                  String(p.safra_id || "") === String(safraIdAplicacao)
                                );
                            const isSourcePair = !!sourceAplicacao &&
                              String(replicateProdutorNumerocm) === String(sourceAplicacao.produtor_numerocm) &&
                              areaNome === String(sourceAplicacao.area);
                            return isAllowedByCultivar && isAllowedByAdubacao && isSameSafraCultOk && isSameSafraAdubOk && hasArea && !isSourcePair;
                          })
                          .map((f) => {
                          const produtorNome = produtores.find(p => p.numerocm === f.numerocm)?.nome || "";
                          const checked = selectedAreaPairs.some((ap) => ap.produtor_numerocm === replicateProdutorNumerocm && ap.area === f.nomefazenda);
                          return (
                            <CommandItem
                              key={`${f.id}-${f.numerocm}`}
                              value={`${f.numerocm} ${produtorNome} / ${f.nomefazenda}`}
                              onSelect={() => {
                                // Evita adicionar par igual ao origem
                                const isSourcePair = !!sourceAplicacao &&
                                  String(replicateProdutorNumerocm) === String(sourceAplicacao.produtor_numerocm) &&
                                  String(f.nomefazenda) === String(sourceAplicacao.area);
                                if (isSourcePair) return;
                                setSelectedAreaPairs((prev) => {
                                  const exists = prev.some((ap) => ap.produtor_numerocm === replicateProdutorNumerocm && ap.area === f.nomefazenda);
                                  if (exists) {
                                    return prev.filter((ap) => !(ap.produtor_numerocm === replicateProdutorNumerocm && ap.area === f.nomefazenda));
                                  }
                                  return [...prev, { produtor_numerocm: replicateProdutorNumerocm, area: f.nomefazenda }];
                                });
                              }}
                            >
                              <Checkbox checked={checked} className="mr-2 h-4 w-4" />
                              <span className="flex items-center gap-2">
                                <span>{f.numerocm} - {produtorNome} / {f.nomefazenda}</span>
                                {Number(f.area_cultivavel || 0) > 0 ? (
                                  <span className="ml-2 text-xs text-muted-foreground">({Number(f.area_cultivavel || 0)} ha)</span>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">sem área(há)</Badge>
                                )}
                              </span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (selectedAreaPairs.length === 0) return;
                const current = [...replicateTargets];
                for (const ap of selectedAreaPairs) {
                  const exists = current.some((t) => t.produtor_numerocm === ap.produtor_numerocm && t.area === ap.area);
                  if (!exists) current.push(ap);
                }
                setReplicateTargets(current);
                setSelectedAreaPairs([]);
              }}
              disabled={selectedAreaPairs.length === 0}
            >
              Adicionar destino
            </Button>
          </div>
          {replicateTargets.length > 0 && (
            <div className="mt-2 space-y-2">
              <label className="text-sm font-medium">Destinos selecionados</label>
              <div className="space-y-2">
                {replicateTargets.map((t, idx) => (
                  <div
                    key={`${t.produtor_numerocm}-${t.area}-${idx}`}
                    className="flex items-center justify-between rounded-md border p-2"
                  >
                    <div className="text-sm">
                      <span className="font-medium">
                        {t.produtor_numerocm} - {produtores.find(p => p.numerocm === t.produtor_numerocm)?.nome || ""}
                      </span>
                      <span className="ml-2 text-muted-foreground">/ {t.area}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setReplicateTargets(replicateTargets.filter((rt, i) => i !== idx));
                      }}
                      title="Remover destino"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setReplicateOpen(false);
                setReplicateTargetId(null);
                setReplicateProdutorNumerocm("");
                setReplicateTargets([]);
                setSelectedAreaPairs([]);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!replicateTargetId || replicateTargets.length === 0) return;
                const results = await Promise.allSettled(
                  replicateTargets.map((t) =>
                    replicate({ id: replicateTargetId!, produtor_numerocm: t.produtor_numerocm, area: t.area })
                  )
                );
                const ok = results.filter((r) => r.status === "fulfilled").length;
                const fail = results.filter((r) => r.status === "rejected").length;
                if (ok > 0) toast.success(`Replicação concluída: ${ok} sucesso(s)`);
                if (fail > 0) toast.error(`Falhas em ${fail} destino(s)`);
                setReplicateOpen(false);
                setReplicateTargetId(null);
                setReplicateProdutorNumerocm("");
                setSelectedAreaPairs([]);
                setReplicateTargets([]);
              }}
              disabled={isReplicating || !replicateTargetId || replicateTargets.length === 0}
            >
              Replicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Defensivos;
