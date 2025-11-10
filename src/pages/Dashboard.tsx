import { useMemo, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sprout, Droplet, Shield, FileText, Plus, Settings, Calendar } from "lucide-react";
import { useProgramacaoCultivares } from "@/hooks/useProgramacaoCultivares";
import { useProgramacaoAdubacao } from "@/hooks/useProgramacaoAdubacao";
import { useAplicacoesDefensivos } from "@/hooks/useAplicacoesDefensivos";
import { useProfile } from "@/hooks/useProfile";
import { useFazendas } from "@/hooks/useFazendas";
import { useProdutores } from "@/hooks/useProdutores";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

const Dashboard = () => {
  const {
    programacoes: cultivaresProgramacoes,
    isLoading: cultivaresLoading,
    error: cultivaresError,
  } = useProgramacaoCultivares();

  const {
    programacoes: adubacoesProgramacoes,
    isLoading: adubacoesLoading,
    error: adubacoesError,
  } = useProgramacaoAdubacao();

  const {
    aplicacoes: defensivosProgramacoes,
    isLoading: defensivosLoading,
    error: defensivosError,
  } = useAplicacoesDefensivos();

  const cultivaresList = cultivaresProgramacoes ?? [];
  const adubacoesList = adubacoesProgramacoes ?? [];
  const defensivosList = defensivosProgramacoes ?? [];

  const lastSync = useMemo(() => new Date().toLocaleString(), []);
  const showSummaryCards = String(import.meta.env.VITE_DASHBOARD_SUMMARY_ENABLED || "")
    .toLowerCase() === "true";

  // Modal obrigatório: preenchimento de área cultivável ao logar
  const { profile, updateProfile } = useProfile();
  const { data: allFazendas = [] } = useFazendas();
  const { data: allProdutores = [] } = useProdutores();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Verificar e preencher numerocm_consultor se estiver vazio
  useEffect(() => {
    const preencherConsultor = async () => {
      if (profile && !profile.numerocm_consultor) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          const { data: consultor } = await supabase
            .from("consultores")
            .select("numerocm_consultor, consultor")
            .eq("email", user.email.toLowerCase())
            .maybeSingle();
          
          if (consultor) {
            await supabase
              .from("profiles")
              .update({
                numerocm_consultor: consultor.numerocm_consultor,
                nome: consultor.consultor,
              })
              .eq("user_id", user.id);
            
            queryClient.invalidateQueries({ queryKey: ["profile"] });
          }
        }
      }
    };
    preencherConsultor();
  }, [profile, queryClient]);

  const [openAreaModal, setOpenAreaModal] = useState(false);
  const [modalDismissed, setModalDismissed] = useState(false);
  const [areasEdicao, setAreasEdicao] = useState<Record<string, string>>({});
  const areaKey = (numerocm: string, idfazenda: string) => `${String(numerocm)}:${String(idfazenda)}`;

  const produtoresDoConsultor = useMemo(() => {
    if (!profile?.numerocm_consultor) return [];
    return allProdutores.filter((p) => p.numerocm_consultor === profile.numerocm_consultor);
  }, [allProdutores, profile]);

  const fazendasPorProdutor = useMemo(() => {
    const grouped: Record<string, typeof allFazendas> = {};
    produtoresDoConsultor.forEach((produtor) => {
      grouped[produtor.numerocm] = allFazendas.filter(
        (f) => f.numerocm === produtor.numerocm
      );
    });
    return grouped;
  }, [produtoresDoConsultor, allFazendas]);

  const hasFazendasSemArea = useMemo(() => {
    return Object.values(fazendasPorProdutor).some((fazendas) =>
      fazendas.some((f) => !f.area_cultivavel || f.area_cultivavel === 0)
    );
  }, [fazendasPorProdutor]);

  const pendentesCount = useMemo(() => {
    let count = 0;
    Object.values(fazendasPorProdutor).forEach((fazendas) => {
      fazendas.forEach((f) => {
        const key = areaKey(f.numerocm, f.idfazenda);
        if (Number(areasEdicao[key] ?? 0) <= 0) count++;
      });
    });
    return count;
  }, [fazendasPorProdutor, areasEdicao]);

  useEffect(() => {
    if (!modalDismissed && produtoresDoConsultor.length > 0 && hasFazendasSemArea) {
      // Pré-preenche todas as fazendas: as que têm área usam o valor; pendentes ficam vazias
      const initial: Record<string, string> = {};
      Object.values(fazendasPorProdutor).forEach((fazendas) => {
        fazendas.forEach((f) => {
          // Traz exatamente o valor do banco, incluindo 0, por produtor+fazenda
          const key = areaKey(f.numerocm, f.idfazenda);
          initial[key] = f.area_cultivavel !== null && f.area_cultivavel !== undefined
            ? String(f.area_cultivavel)
            : "";
        });
      });
      setAreasEdicao(initial);
      setOpenAreaModal(true);
    } else {
      setOpenAreaModal(false);
    }
  }, [produtoresDoConsultor, hasFazendasSemArea, fazendasPorProdutor, modalDismissed]);

  const handleAreaChange = (key: string, value: string) => {
    setAreasEdicao((prev) => ({ ...prev, [key]: value }));
  };

  const salvarAreas = async () => {
    // Identifica apenas as fazendas que realmente mudaram
    const mudancas: Array<{ numerocm: string; idfazenda: string; valor: number }> = [];

    for (const f of allFazendas) {
      const key = areaKey(f.numerocm, f.idfazenda);
      const val = areasEdicao[key];
      if (val === undefined) continue;
      const novoValor = Number(val);
      const valorAtual = Number(f.area_cultivavel || 0);
      if (novoValor >= 0 && novoValor !== valorAtual) {
        mudancas.push({ numerocm: f.numerocm, idfazenda: f.idfazenda, valor: novoValor });
      }
    }

    // Se não houver mudanças, apenas fecha o modal
    if (mudancas.length === 0) {
      setOpenAreaModal(false);
      setModalDismissed(true);
      return;
    }

    try {
      let sucesso = 0;
      let falha = 0;
      for (const item of mudancas) {
        const { data, error } = await supabase
          .from("fazendas")
          .update({ area_cultivavel: item.valor })
          .eq("idfazenda", item.idfazenda)
          .eq("numerocm", item.numerocm)
          .select("id");
        if (error) throw error;
        if (data && data.length > 0) {
          sucesso += 1;
        } else {
          falha += 1;
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["fazendas"] });
      if (sucesso > 0) {
        toast({
          title: "Áreas atualizadas",
          description: `${sucesso} fazenda${sucesso > 1 ? 's' : ''} atualizada${sucesso > 1 ? 's' : ''} com sucesso.`
        });
        setOpenAreaModal(false);
        setModalDismissed(true);
      }
      if (falha > 0) {
        toast({
          title: "Algumas áreas não foram atualizadas",
          description: `${falha} atualização${falha > 1 ? 's' : ''} sem permissão ou sem correspondência. Caso esteja logado como consultor, atualize via Admin.`,
          variant: "destructive"
        });
      }
    } catch (err: any) {
      toast({ title: "Erro ao salvar áreas", description: err.message, variant: "destructive" });
    }
  };

  const loadingCounter = (isLoading: boolean, value: number) => {
    if (isLoading) {
      return "...";
    }
    return value.toString();
  };

  const renderError = (error: unknown) =>
    error ? <p className="text-sm text-destructive mt-2">Erro ao carregar dados.</p> : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sprout className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">AgroPlan</h1>
            </div>
            <div className="flex gap-2">
              <Link to="/admin">
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Admin
                </Button>
              </Link>
              <Button variant="outline" size="sm">Sair</Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Modal obrigatório de preenchimento da área cultivável */}
        <AlertDialog open={openAreaModal}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Preencha a área cultivável das fazendas</AlertDialogTitle>
              <AlertDialogDescription>
                Antes de iniciar as programações, é necessário informar a área (hectares)
                das fazendas abaixo vinculadas ao seu consultor.
              </AlertDialogDescription>
              <div className="text-sm mb-4">Fazendas pendentes: <span className="font-semibold">{pendentesCount}</span></div>
            </AlertDialogHeader>
            <div className="max-h-[400px] overflow-y-auto pr-2">
              <Accordion type="multiple" className="w-full">
                {produtoresDoConsultor.map((produtor) => {
                  const fazendas = fazendasPorProdutor[produtor.numerocm] || [];
                  const fazendasPendentes = fazendas.filter(
                    (f) => Number(areasEdicao[areaKey(f.numerocm, f.idfazenda)] ?? 0) <= 0
                  ).length;

                  return (
                    <AccordionItem key={produtor.numerocm} value={produtor.numerocm}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="font-medium">{produtor.numerocm} - {produtor.nome}</span>
                          {fazendasPendentes > 0 && (
                            <Badge variant="destructive" className="ml-2">
                              {fazendasPendentes} pendente{fazendasPendentes > 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pt-2">
                          {fazendas.map((f) => (
                            <div key={f.idfazenda} className="grid grid-cols-1 md:grid-cols-2 gap-2 items-end pl-4">
                              <div className="space-y-1">
                                <Label>Fazenda</Label>
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-medium">{f.nomefazenda}-{f.idfazenda}</div>
                                  {Number(areasEdicao[areaKey(f.numerocm, f.idfazenda)] ?? 0) <= 0 && (
                                    <Badge variant="destructive">pendente</Badge>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label>Área (hectares)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={areasEdicao[areaKey(f.numerocm, f.idfazenda)] ?? (f.area_cultivavel != null ? String(f.area_cultivavel) : "")}
                                  onChange={(e) => handleAreaChange(areaKey(f.numerocm, f.idfazenda), e.target.value)}
                                  placeholder="0.00"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
            <AlertDialogFooter>
              <AlertDialogAction onClick={salvarAreas}>Salvar e continuar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">Dashboard</h2>
          <p className="text-muted-foreground">Gerencie programacoes agricolas e cultivos</p>
        </div>

        {showSummaryCards && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <Sprout className="h-10 w-10 text-primary" />
                <span className="text-2xl font-bold text-primary">
                  {loadingCounter(cultivaresLoading, cultivaresList.length)}
                </span>
              </div>
              <h3 className="font-semibold text-lg mb-1">Cultivares ativos</h3>
              <p className="text-sm text-muted-foreground">Programacoes de plantio cadastradas</p>
              {renderError(cultivaresError)}
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <Droplet className="h-10 w-10 text-primary" />
                <span className="text-2xl font-bold text-primary">
                  {loadingCounter(adubacoesLoading, adubacoesList.length)}
                </span>
              </div>
              <h3 className="font-semibold text-lg mb-1">Adubacoes</h3>
              <p className="text-sm text-muted-foreground">Programacoes de fertilizacao</p>
              {renderError(adubacoesError)}
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <Shield className="h-10 w-10 text-primary" />
                <span className="text-2xl font-bold text-primary">
                  {loadingCounter(defensivosLoading, defensivosList.length)}
                </span>
              </div>
              <h3 className="font-semibold text-lg mb-1">Defensivos</h3>
              <p className="text-sm text-muted-foreground">Aplicacoes defensivas planejadas</p>
              {renderError(defensivosError)}
            </Card>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Link to="/programacao">
            <Card className="p-6 hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer group">
              <Calendar className="h-8 w-8 mb-4 text-primary group-hover:text-primary-foreground" />
              <h3 className="font-semibold text-lg mb-2">Programação</h3>
              <p className="text-sm text-muted-foreground group-hover:text-primary-foreground">
                Planejamento completo de cultivares e adubação
              </p>
            </Card>
          </Link>

          <Link to="/defensivos">
            <Card className="p-6 hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer group">
              <Shield className="h-8 w-8 mb-4 text-primary group-hover:text-primary-foreground" />
              <h3 className="font-semibold text-lg mb-2">Defensivos</h3>
              <p className="text-sm text-muted-foreground group-hover:text-primary-foreground">
                Programar aplicacoes
              </p>
            </Card>
          </Link>

          <Link to="/relatorios">
            <Card className="p-6 hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer group">
              <FileText className="h-8 w-8 mb-4 text-primary group-hover:text-primary-foreground" />
              <h3 className="font-semibold text-lg mb-2">Relatorios</h3>
              <p className="text-sm text-muted-foreground group-hover:text-primary-foreground">
                Visualizar dados consolidados
              </p>
            </Card>
          </Link>
        </div>

        <Card className="mt-8 p-6 bg-secondary">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg mb-1">Safra atual</h3>
            </div>
            <Link to="/programacao">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova programacao
              </Button>
            </Link>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;

