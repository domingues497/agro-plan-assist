import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Shield, ArrowLeft, Copy, Trash2, Plus, Pencil, ChevronDown, Check, ChevronsUpDown } from "lucide-react";
import { useAplicacoesDefensivos, AplicacaoDefensivo } from "@/hooks/useAplicacoesDefensivos";
import { FormAplicacaoDefensivo } from "@/components/defensivos/FormAplicacaoDefensivo";
import { useProdutores } from "@/hooks/useProdutores";
import { useProgramacoes } from "@/hooks/useProgramacoes";
import { useProgramacaoCultivares } from "@/hooks/useProgramacaoCultivares";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useFazendas } from "@/hooks/useFazendas";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const Defensivos = () => {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AplicacaoDefensivo | null>(null);
  const { aplicacoes, isLoading, create, duplicate, remove, update, isCreating, isUpdating, replicate, isReplicating } = useAplicacoesDefensivos();
  const { data: produtores = [] } = useProdutores();
  const { programacoes = [] } = useProgramacoes();
  const { programacoes: cultProgramacoes = [] } = useProgramacaoCultivares();

  const temProgramacoes = programacoes.length > 0;
  const [replicateOpen, setReplicateOpen] = useState(false);
  const [replicateTargetId, setReplicateTargetId] = useState<string | null>(null);
  const [replicateProdutorNumerocm, setReplicateProdutorNumerocm] = useState<string>("");
  const [replicateArea, setReplicateArea] = useState<string>("");
  const [replicateTargets, setReplicateTargets] = useState<Array<{ produtor_numerocm: string; area: string }>>([]);
  const [openReplicateProdutorPopover, setOpenReplicateProdutorPopover] = useState(false);
  const [openReplicateFazendaPopover, setOpenReplicateFazendaPopover] = useState(false);
  const [selectedAreaPairs, setSelectedAreaPairs] = useState<Array<{ produtor_numerocm: string; area: string }>>([]);
  const { data: fazendas = [] } = useFazendas(replicateProdutorNumerocm);

  // Produtores que possuem programação de cultivar
  const produtoresComCultivar = useMemo(() => {
    const set = new Set<string>();
    for (const p of cultProgramacoes) {
      const cm = String(p.produtor_numerocm || "").trim();
      if (cm) set.add(cm);
    }
    return set;
  }, [cultProgramacoes]);

  // Áreas com programação de cultivar por produtor
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

  const getProdutorNumerocmFallback = (id?: string) => {
    try {
      if (!id) return "";
      const key = "aplicacoes_defensivos_produtor_map";
      const raw = localStorage.getItem(key);
      const map = raw ? JSON.parse(raw) : {};
      return (map[id] || "").trim();
    } catch (e) {
      return "";
    }
  };

  const handleSubmit = (data: any) => {
    create(data);
    setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-background">
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

        {!temProgramacoes && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 font-medium">
              ⚠️ É necessário ter programação de cultivares e adubação antes de programar defensivos.
            </p>
          </div>
        )}

        {showForm && !editing && (
          <FormAplicacaoDefensivo
            onSubmit={handleSubmit}
            onCancel={() => setShowForm(false)}
            isLoading={isCreating}
          />
        )}

        {editing && (
          <FormAplicacaoDefensivo
            title="Editar Programação de Defensivo"
            submitLabel="Salvar alterações"
            initialData={{
              produtor_numerocm: editing.produtor_numerocm || getProdutorNumerocmFallback(editing.id),
              area: editing.area,
              defensivos: editing.defensivos,
            }}
            onSubmit={(data) => {
              update({ id: editing.id, ...data });
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
            isLoading={isUpdating}
          />
        )}

        {isLoading ? (
          <p className="text-muted-foreground">Carregando programação...</p>
        ) : (
          <div className="grid gap-4">
            {aplicacoes.length === 0 ? (
              <Card className="p-6">
                <p className="text-muted-foreground">Nenhuma programação cadastrada.</p>
              </Card>
            ) : (
              aplicacoes.map((aplicacao) => (
                <Card key={aplicacao.id} className="hover:shadow-lg transition-shadow">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1" className="border-none">
                      <div className="flex items-center justify-between p-6 pb-0">
                        <div className="flex items-center gap-3 flex-1">
                          <Shield className="h-5 w-5 text-primary" />
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{aplicacao.produtor_numerocm} - {produtores.find(p => p.numerocm === aplicacao.produtor_numerocm)?.nome || ""} </h3>
                            {aplicacao.produtor_numerocm && (
                              <p className="text-sm text-muted-foreground">
                                 {aplicacao.area}
                              </p>
                            )}
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
                              setReplicateArea("");
                              setReplicateOpen(true);
                            }}
                            title="Replicar programação"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => remove(aplicacao.id)}
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
                        <div className="space-y-3 pt-2">
                          {aplicacao.defensivos.map((def, idx) => (
                            <div key={def.id || idx} className="bg-muted/50 p-4 rounded-md">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-semibold">{def.defensivo}</span>
                                {def.produto_salvo && (
                                  <Badge variant="secondary" className="text-xs">Produto Salvo</Badge>
                                )}
                              </div>
                              <div className="grid gap-1 text-sm">
                                <p>
                                  <span className="text-muted-foreground">Dose:</span>{" "}
                                  {def.dose} {def.unidade}
                                </p>
                                {def.alvo && (
                                  <p>
                                    <span className="text-muted-foreground">Alvo:</span> {def.alvo}
                                  </p>
                                )}
                                {def.produto_salvo && def.porcentagem_salva > 0 && (
                                  <p>
                                    <span className="text-muted-foreground">% Salva:</span> {def.porcentagem_salva}%
                                  </p>
                                )}
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
                          .filter((produtor) => produtoresComCultivar.has(String(produtor.numerocm)))
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
                            const allowedAreas = areasCultivarPorProdutor.get(String(replicateProdutorNumerocm));
                            const areaNome = String(f.nomefazenda);
                            const hasArea = Number(f.area_cultivavel || 0) > 0;
                            const isAllowedByCultivar = !!allowedAreas && allowedAreas.has(areaNome);
                            // Se houver safra na aplicação origem, garantir que exista programação de cultivar na MESMA safra
                            const isSameSafraOk = !safraIdAplicacao
                              ? true
                              : cultProgramacoes.some((p) =>
                                  String(p.produtor_numerocm) === String(replicateProdutorNumerocm) &&
                                  String(p.area) === areaNome &&
                                  String(p.safra || "") === String(safraIdAplicacao)
                                );
                            // Exclui a própria aplicação origem (mesmo produtor + mesma área)
                            const isSourcePair = !!sourceAplicacao &&
                              String(replicateProdutorNumerocm) === String(sourceAplicacao.produtor_numerocm) &&
                              areaNome === String(sourceAplicacao.area);
                            return isAllowedByCultivar && isSameSafraOk && hasArea && !isSourcePair;
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
                setReplicateArea("");
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
                setReplicateArea("");
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
