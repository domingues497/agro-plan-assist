import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import * as XLSX from "xlsx";
// Migração para API Flask
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type CalendarioRow = {
  cod_aplic: string;
  descr_aplicacao: string;
  cod_aplic_ger: string | null;
  cod_classe: string;
  descricao_classe: string;
  trat_sementes: string | null;
};

export const ImportCalendarioAplicacoes = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [limparAntes, setLimparAntes] = useState(false);
  const [deletedCount, setDeletedCount] = useState(0);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Por favor, selecione um arquivo");
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setDeletedCount(0);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const rows: CalendarioRow[] = jsonData
        .map((row: any) => ({
          cod_aplic: String(row["Cód. aplic."] || row["cod_aplic"] || "").trim(),
          descr_aplicacao: String(row["Descr. aplicação"] || row["descr_aplicacao"] || "").trim(),
          cod_aplic_ger: row["Cód. aplic. ger."] || row["cod_aplic_ger"] || null,
          cod_classe: String(row["Cód. classe"] || row["cod_classe"] || "").trim(),
          descricao_classe: String(row["Descrição classe"] || row["descricao_classe"] || "").trim(),
          trat_sementes: row["Trat. sementes"] || row["trat_sementes"] || null,
        }))
        .filter((row) => row.cod_aplic && row.descr_aplicacao);

      // Remove duplicates based on cod_aplic
      const uniqueRows = Array.from(
        new Map(rows.map((row) => [row.cod_aplic, row])).values()
      );

      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/calendario_aplicacoes/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limpar_antes: limparAntes,
          items: uniqueRows,
          user_id: null,
          arquivo_nome: file.name,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      setDeletedCount(Number(json?.deleted || 0));
      setImportedCount(Number(json?.imported || uniqueRows.length));
      setImportProgress(100);

      setShowSummary(true);
      toast.success(`${Number(json?.imported || uniqueRows.length)} registros importados com sucesso!`);
      setFile(null);
      setLimparAntes(false);
    } catch (error) {
      console.error("Erro ao processar arquivo:", error);
      toast.error("Erro ao processar arquivo");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar Calendário de Aplicações</CardTitle>
        <CardDescription>
          Faça upload de uma planilha Excel com as colunas: Cód. aplic., Descr. aplicação, 
          Cód. aplic. ger., Cód. classe, Descrição classe, Trat. sementes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            disabled={isImporting}
          />
          <Button onClick={handleImport} disabled={isImporting || !file}>
            {isImporting ? "Importando..." : "Importar"}
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="limpar-antes"
            checked={limparAntes}
            onCheckedChange={(checked) => setLimparAntes(checked as boolean)}
            disabled={isImporting}
          />
          <Label htmlFor="limpar-antes" className="cursor-pointer text-sm">
            Limpar todos os registros antes de importar
          </Label>
        </div>

        {isImporting && (
          <div className="space-y-2">
            <Progress value={importProgress} />
            <p className="text-sm text-muted-foreground">
              Importando: {importProgress}%
            </p>
          </div>
        )}

        <AlertDialog open={showSummary} onOpenChange={setShowSummary}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Importação Concluída</AlertDialogTitle>
              <AlertDialogDescription>
                {deletedCount > 0 && (
                  <>
                    {deletedCount} registros foram removidos.
                    <br />
                  </>
                )}
                {importedCount} registros foram importados com sucesso.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setShowSummary(false)}>
                OK
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
