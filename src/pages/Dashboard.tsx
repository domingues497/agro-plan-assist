import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sprout, Droplet, Shield, FileText, Plus } from "lucide-react";
import { Link } from "react-router-dom";

const Dashboard = () => {
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
          <p className="text-muted-foreground">Gerencie programações agrícolas e cultivos</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <Sprout className="h-10 w-10 text-primary" />
              <span className="text-2xl font-bold text-primary">12</span>
            </div>
            <h3 className="font-semibold text-lg mb-1">Cultivares Ativos</h3>
            <p className="text-sm text-muted-foreground">Programações de plantio</p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <Droplet className="h-10 w-10 text-primary" />
              <span className="text-2xl font-bold text-primary">8</span>
            </div>
            <h3 className="font-semibold text-lg mb-1">Adubações</h3>
            <p className="text-sm text-muted-foreground">Programações planejadas</p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <Shield className="h-10 w-10 text-primary" />
              <span className="text-2xl font-bold text-primary">15</span>
            </div>
            <h3 className="font-semibold text-lg mb-1">Defensivos</h3>
            <p className="text-sm text-muted-foreground">Aplicações químicas</p>
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
              <h3 className="font-semibold text-lg mb-2">Adubação</h3>
              <p className="text-sm text-muted-foreground group-hover:text-primary-foreground">
                Planejar fertilização
              </p>
            </Card>
          </Link>

          <Link to="/defensivos">
            <Card className="p-6 hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer group">
              <Shield className="h-8 w-8 mb-4 text-primary group-hover:text-primary-foreground" />
              <h3 className="font-semibold text-lg mb-2">Defensivos</h3>
              <p className="text-sm text-muted-foreground group-hover:text-primary-foreground">
                Programar aplicações
              </p>
            </Card>
          </Link>

          <Link to="/relatorios">
            <Card className="p-6 hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer group">
              <FileText className="h-8 w-8 mb-4 text-primary group-hover:text-primary-foreground" />
              <h3 className="font-semibold text-lg mb-2">Relatórios</h3>
              <p className="text-sm text-muted-foreground group-hover:text-primary-foreground">
                Visualizar dados consolidados
              </p>
            </Card>
          </Link>
        </div>

        <Card className="mt-8 p-6 bg-secondary">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg mb-1">Safra 2024/2025</h3>
              <p className="text-sm text-muted-foreground">Última sincronização: Hoje, 09:30</p>
            </div>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Programação
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
