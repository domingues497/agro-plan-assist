import { useState } from "react";
import { useUsuarios } from "@/hooks/useUsuarios";
import { useGestorConsultores } from "@/hooks/useGestorConsultores";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

export const GerenciarGestores = () => {
  const { usuarios, isLoading: loadingUsuarios } = useUsuarios();
  const { data: consultores, isLoading: loadingConsultores } = useConsultores();

  const [selectedGestor, setSelectedGestor] = useState<string>("");
  const [selectedConsultores, setSelectedConsultores] = useState<string[]>([]);

  const {
    consultores: gestorConsultores,
    addConsultor,
    removeConsultor,
    isAdding,
  } = useGestorConsultores(selectedGestor);

  const gestores = usuarios?.filter((u) => u.role === "gestor") ?? [];

  const availableConsultores = consultores?.filter(
    (c) => !gestorConsultores.some((gc) => gc.numerocm_consultor === c.numerocm_consultor)
  ) ?? [];

  const handleToggleConsultor = (numerocm: string) => {
    setSelectedConsultores((prev) =>
      prev.includes(numerocm)
        ? prev.filter((id) => id !== numerocm)
        : [...prev, numerocm]
    );
  };

  const handleSelectAllConsultores = () => {
    if (selectedConsultores.length === availableConsultores.length) {
      setSelectedConsultores([]);
    } else {
      setSelectedConsultores(availableConsultores.map((c) => c.numerocm_consultor));
    }
  };

  const handleAddConsultores = async () => {
    if (selectedGestor && selectedConsultores.length > 0) {
      for (const numerocmConsultor of selectedConsultores) {
        addConsultor({
          userId: selectedGestor,
          numerocmConsultor,
        });
      }
      setSelectedConsultores([]);
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
                <h3 className="text-lg font-semibold mb-2">
                  Consultores Associados
                </h3>
                
                {availableConsultores.length > 0 && (
                  <div className="mb-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="select-all-consultores"
                          checked={
                            selectedConsultores.length ===
                              availableConsultores.length &&
                            availableConsultores.length > 0
                          }
                          onCheckedChange={handleSelectAllConsultores}
                        />
                        <label
                          htmlFor="select-all-consultores"
                          className="text-sm font-medium cursor-pointer"
                        >
                          Selecionar todos ({availableConsultores.length})
                        </label>
                      </div>
                      <Button
                        onClick={handleAddConsultores}
                        disabled={
                          selectedConsultores.length === 0 || isAdding
                        }
                        size="sm"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar ({selectedConsultores.length})
                      </Button>
                    </div>
                    <ScrollArea className="h-[200px] border rounded-md p-2 bg-muted/30">
                      <div className="space-y-2">
                        {availableConsultores.map((consultor) => (
                          <div
                            key={consultor.id}
                            className={`flex items-center gap-2 p-2 rounded hover:bg-accent transition-colors ${
                              selectedConsultores.includes(consultor.numerocm_consultor)
                                ? "bg-primary/10"
                                : ""
                            }`}
                          >
                            <Checkbox
                              id={`consultor-${consultor.id}`}
                              checked={selectedConsultores.includes(
                                consultor.numerocm_consultor
                              )}
                              onCheckedChange={() =>
                                handleToggleConsultor(consultor.numerocm_consultor)
                              }
                            />
                            <label
                              htmlFor={`consultor-${consultor.id}`}
                              className="text-sm cursor-pointer flex-1"
                            >
                              {consultor.consultor} - {consultor.email}
                            </label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {gestorConsultores.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Consultor</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead className="w-[100px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gestorConsultores.map((gc) => {
                        const consultor = consultores?.find(
                          (c) => c.numerocm_consultor === gc.numerocm_consultor
                        );
                        return (
                          <TableRow key={gc.id}>
                            <TableCell>
                              {consultor?.consultor || gc.numerocm_consultor}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {consultor?.email || "-"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {gc.numerocm_consultor}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeConsultor(gc.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Nenhum consultor associado
                  </p>
                )}

                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    💡 O gestor terá acesso a todos os produtores, fazendas,
                    talhões e programações dos consultores associados.
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
