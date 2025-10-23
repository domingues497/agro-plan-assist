import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sprout, Droplet, Shield, FileText, Plus } from "lucide-react";
import { fetchAdubacoes, fetchCultivares, fetchDefensivos } from "@/lib/api";

const Dashboard = () => {
  const {
    data: cultivares,
    isLoading: cultivaresLoading,
    error: cultivaresError,
  } = useQuery({
    queryKey: ["cultivares", { limit: 50 }],
    queryFn: () => fetchCultivares(50),
  });

  const {
    data: adubacoes,
    isLoading: adubacoesLoading,
    error: adubacoesError,
  } = useQuery({
    queryKey: ["adubacoes", { limit: 50 }],
    queryFn: () => fetchAdubacoes(50),
  });

  const {
    data: defensivos,
    isLoading: defensivosLoading,
    error: defensivosError,
  } = useQuery({
    queryKey: ["defensivos", { limit: 50 }],
    queryFn: () => fetchDefensivos(50),
  });

  const cultivaresList = cultivares ?? [];
  const adubacoesList = adubacoes ?? [];
  const defensivosList = defensivos ?? [];

  const lastSync = useMemo(() => new Date().toLocaleString(), []);

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
            <Button variant="outline" size="sm">Sair</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">Dashboard</h2>
          <p className="text-muted-foreground">Gerencie programacoes agricolas e cultivos</p>
        </div>

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

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Link to="/cultivares">
            <Card className="p-6 hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer group">
              <Sprout className="h-8 w-8 mb-4 text-primary group-hover:text-primary-foreground" />
              <h3 className="font-semibold text-lg mb-2">Cultivares</h3>
              <p className="text-sm text-muted-foreground group-hover:text-primary-foreground">
                Gerenciar sementes e plantio
              </p>
            </Card>
          </Link>

          <Link to="/adubacao">
            <Card className="p-6 hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer group">
              <Droplet className="h-8 w-8 mb-4 text-primary group-hover:text-primary-foreground" />
              <h3 className="font-semibold text-lg mb-2">Adubacao</h3>
              <p className="text-sm text-muted-foreground group-hover:text-primary-foreground">
                Planejar fertilizacao
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
              <p className="text-sm text-muted-foreground">Ultima sincronizacao: {lastSync}</p>
            </div>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova programacao
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;

