import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Droplet, ArrowLeft, Plus } from "lucide-react";
import { fetchAdubacoes } from "@/lib/api";

const Adubacao = () => {
  const {
    data: adubacoes,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["adubacoes", { limit: 100 }],
    queryFn: () => fetchAdubacoes(100),
  });

  const adubacoesList = adubacoes ?? [];

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
              <Droplet className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Adubacao</h1>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              Atualizar
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Programacao de adubacao</h2>
            <p className="text-muted-foreground">Planejar formulacoes NPK e doses por hectare</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nova adubacao
          </Button>
        </div>

        <Card className="p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Filtros</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Safra</Label>
              <Input placeholder="2024/2025" />
            </div>
            <div className="space-y-2">
              <Label>Cultura</Label>
              <Input placeholder="Soja, Milho..." />
            </div>
            <div className="space-y-2">
              <Label>Formulacao</Label>
              <Input placeholder="NPK 10-20-20..." />
            </div>
          </div>
          <Button className="mt-4">Buscar</Button>
        </Card>

        {isLoading ? (
          <p className="text-muted-foreground">Carregando adubacoes...</p>
        ) : error ? (
          <Card className="p-6 border-destructive text-destructive">
            Ocorreu um erro ao carregar os dados. Tente novamente.
          </Card>
        ) : (
          <div className="grid gap-4">
            {adubacoesList.length === 0 ? (
              <Card className="p-6">
                <p className="text-muted-foreground">Nenhuma programacao de adubacao encontrada.</p>
              </Card>
            ) : (
              adubacoesList.map((item, index) => (
                <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Droplet className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-lg">
                          {String(item.formulacao ?? item.FORMULACAO ?? "Formulacao nao informada")}
                        </h3>
                      </div>
                      <div className="grid gap-2 text-sm text-muted-foreground">
                        <p>
                          <span className="font-medium">Area:</span>{" "}
                          {String(item.area ?? item.AREA ?? "-")}
                        </p>
                        <p>
                          <span className="font-medium">Dose:</span>{" "}
                          {String(item.dose ?? item.DOSE ?? "-")}
                        </p>
                        <p>
                          <span className="font-medium">Total:</span>{" "}
                          {String(item.total ?? item.TOTAL ?? "-")}
                        </p>
                        <p>
                          <span className="font-medium">Data aplicacao:</span>{" "}
                          {String(item.data_aplicacao ?? item.DATA_APLICACAO ?? "-")}
                        </p>
                        <p>
                          <span className="font-medium">Responsavel:</span>{" "}
                          {String(item.responsavel ?? item.RESPONSAVEL ?? "-")}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Editar
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Adubacao;

