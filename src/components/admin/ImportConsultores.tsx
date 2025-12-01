import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import * as XLSX from "xlsx";
// Migração para API Flask
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";

export function ImportConsultores() {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [importedRows, setImportedRows] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [limparAntes, setLimparAntes] = useState(false);
  const [deletedRows, setDeletedRows] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Selecione um arquivo XLSX primeiro");
      return;
    }

    try {
      setIsImporting(true);
      setImportedRows(0);
      setDeletedRows(0);
      setShowSummary(false);

      const user = null;

      let deletedRecords = 0;

      // Limpar tabela se checkbox marcado
      // limpeza será feita pelo backend caso solicitado
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      const payload = rows.map((row) => ({
        numerocm_consultor: String(row.NUMEROCMCONSULTOR ?? row.numerocm_consultor ?? "").trim(),
        consultor: String(row.CONSULTOR ?? row.consultor ?? "").trim(),
        email: String(row.EMAIL ?? row.email ?? "").trim().toLowerCase(),
      })).filter((r) => r.numerocm_consultor && r.consultor && r.email);

      if (payload.length === 0) {
        toast.error("Nenhuma linha válida encontrada (precisa de NUMEROCMCONSULTOR, CONSULTOR, EMAIL)");
        setIsImporting(false);
        return;
      }
      // Deduplicar por email (conflito) para evitar erro 21000
      const dedupMap = new Map<string, typeof payload[0]>();
      for (const item of payload) {
        dedupMap.set(item.email, item); // último vence
      }
      const uniquePayload = Array.from(dedupMap.values());
      const removed = payload.length - uniquePayload.length;
      if (removed > 0) {
        toast.info(`${removed} registros duplicados de email foram ignorados`);
      }

      setTotalRows(uniquePayload.length);

      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/consultores/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limpar_antes: limparAntes,
          items: uniquePayload,
          user_id: null,
          arquivo_nome: file.name
        })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      setDeletedRows(json?.deleted ?? 0);
      setImportedRows(json?.imported ?? uniquePayload.length);

      // Registrar no histórico
      // Histórico de importação registrado no back-end

      toast.success(`Importação de consultores concluída (${json?.imported ?? uniquePayload.length} de ${uniquePayload.length})`);
      setShowSummary(true);
      setLimparAntes(false);
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao importar consultores: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar Consultores</CardTitle>
        <CardDescription>Planilha com colunas: NUMEROCMCONSULTOR, CONSULTOR, EMAIL</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Arquivo XLSX</Label>
          <Input type="file" accept=".xlsx,.xls" onChange={handleFileChange} />
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

        <Button onClick={handleImport} disabled={isImporting || !file}>
          {isImporting ? "Importando..." : "Importar"}
        </Button>
        {isImporting && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Importando {importedRows} de {totalRows} linhas...
            </p>
            <Progress value={totalRows ? Math.round((importedRows / totalRows) * 100) : 0} />
          </div>
        )}
      </CardContent>

      <AlertDialog open={showSummary} onOpenChange={setShowSummary}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resumo da Importação</AlertDialogTitle>
            <AlertDialogDescription>
              {deletedRows > 0 && (
                <>
                  Registros removidos: {deletedRows}
                  <br />
                </>
              )}
              Total na planilha: {totalRows}
              <br />
              Linhas importadas: {importedRows}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
