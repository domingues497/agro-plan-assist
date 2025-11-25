import { useMemo, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sprout, Droplet, Shield, FileText, Plus, Settings, Calendar } from "lucide-react";
import { useProgramacaoCultivares } from "@/hooks/useProgramacaoCultivares";
import { useProgramacaoAdubacao } from "@/hooks/useProgramacaoAdubacao";
import { useAplicacoesDefensivos } from "@/hooks/useAplicacoesDefensivos";
import { useProfile } from "@/hooks/useProfile";
import { useFazendas } from "@/hooks/useFazendas";
import { useProdutores } from "@/hooks/useProdutores";
import { useAdminRole } from "@/hooks/useAdminRole";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

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

  // Estados do modal de área removidos - agora gerenciado via talhões

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

  // Área agora é calculada pelos talhões - modal de edição removido

  const loadingCounter = (isLoading: boolean, value: number) => {
    if (isLoading) {
      return "...";
    }
    return value.toString();
  };

  const renderError = (error: unknown) =>
    error ? <p className="text-sm text-destructive mt-2">Erro ao carregar dados.</p> : null;

  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      // Limpa todo cache de queries/mutações para evitar dados de sessão anterior
      queryClient.clear();
      navigate("/auth", { replace: true });
    } catch (err) {
      console.error("Erro ao fazer logout", err);
      toast({ title: "Erro ao sair", description: "Tente novamente.", variant: "destructive" });
    }
  };

  const { data: roleData } = useAdminRole();

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
              {roleData?.isAdmin && (
                <Link to="/admin">
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Admin
                  </Button>
                </Link>
              )}
              <Button variant="outline" size="sm" onClick={handleLogout}>Sair</Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Modal de área cultivável removido - agora gerenciado via talhões */}
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

