import { useState } from "react";
import { useUsuarios } from "@/hooks/useUsuarios";
import { useGestorConsultor } from "@/hooks/useGestorConsultor";
import { useConsultores } from "@/hooks/useConsultores";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const GerenciarGestores = () => {
  const { usuarios, isLoading: loadingUsuarios } = useUsuarios();
  const { data: consultores, isLoading: loadingConsultores } = useConsultores();

  const [selectedGestor, setSelectedGestor] = useState<string>("");
  const [selectedConsultor, setSelectedConsultor] = useState<string>("");

  const {
    numerocmConsultor,
    associarConsultor,
    removerConsultor,
    isAssociating,
    isRemoving,
  } = useGestorConsultor(selectedGestor);

  const gestores = usuarios?.filter((u) => u.role === "gestor") ?? [];

  const consultorAtual = consultores?.find(
    (c) => c.numerocm_consultor === numerocmConsultor
  );

  const handleAssociarConsultor = () => {
    if (selectedGestor && selectedConsultor) {
      associarConsultor({
        userId: selectedGestor,
        numerocmConsultor: selectedConsultor,
      });
    }
  };

  const handleRemoverConsultor = () => {
    if (selectedGestor) {
      removerConsultor(selectedGestor);
    }
  };

  if (loadingUsuarios || loadingConsultores) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Associações de Gestores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Selecione um Gestor
            </label>
            <Select value={selectedGestor} onValueChange={setSelectedGestor}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um gestor" />
              </SelectTrigger>
              <SelectContent>
                {gestores.map((gestor) => (
                  <SelectItem key={gestor.id} value={gestor.id}>
                    {gestor.nome || gestor.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedGestor && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Consultor Associado</h3>
                
                {consultorAtual ? (
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{consultorAtual.consultor}</p>
                        <p className="text-sm text-muted-foreground">
                          {consultorAtual.email}
                        </p>
                        <Badge variant="outline" className="mt-2">
                          {consultorAtual.numerocm_consultor}
                        </Badge>
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={handleRemoverConsultor}
                        disabled={isRemoving}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border rounded-lg p-4 space-y-3">
                    <p className="text-sm text-muted-foreground mb-3">
                      Nenhum consultor associado. Selecione um consultor para associar:
                    </p>
                    <div className="flex gap-2">
                      <Select
                        value={selectedConsultor}
                        onValueChange={setSelectedConsultor}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Escolha um consultor" />
                        </SelectTrigger>
                        <SelectContent>
                          {consultores?.map((consultor) => (
                            <SelectItem
                              key={consultor.id}
                              value={consultor.numerocm_consultor}
                            >
                              {consultor.consultor} - {consultor.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={handleAssociarConsultor}
                        disabled={!selectedConsultor || isAssociating}
                      >
                        Associar
                      </Button>
                    </div>
                  </div>
                )}

                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    💡 O gestor terá acesso a todos os produtores e fazendas
                    associados ao consultor selecionado.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
