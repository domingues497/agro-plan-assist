import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
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

export function ImportProdutores() {
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

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      let deletedRecords = 0;
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      const payload = rows.map((row) => ({
        numerocm: String(row.NUMEROCM ?? row.numerocm ?? "").trim(),
        nome: String(row.NOME ?? row.nome ?? "").trim(),
        numerocm_consultor: String(row.NUMEROCMCONSULTOR ?? row.numerocm_consultor ?? "").trim(),
        consultor: row.CONSULTOR ? String(row.CONSULTOR).trim() : (row.consultor ? String(row.consultor).trim() : null),
      })).filter((r) => r.numerocm && r.nome && r.numerocm_consultor);

      if (payload.length === 0) {
        toast.error("Nenhuma linha válida encontrada (precisa de NUMEROCM, NOME, NUMEROCMCONSULTOR)");
        setIsImporting(false);
        return;
      }
      // Deduplicar por numerocm (conflito) para evitar erro 21000
      const dedupMap = new Map<string, typeof payload[0]>();
      for (const item of payload) {
        dedupMap.set(item.numerocm, item); // último vence
      }
      const uniquePayload = Array.from(dedupMap.values());
      const removed = payload.length - uniquePayload.length;
      if (removed > 0) {
        toast.info(`${removed} registros duplicados de numerocm foram ignorados`);
      }

      setTotalRows(uniquePayload.length);

      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/produtores/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: uniquePayload,
          limparAntes,
          user_id: user.id,
          arquivo_nome: file.name,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      const imported = Number(json?.imported || uniquePayload.length);
      deletedRecords = Number(json?.deleted || 0);
      setImportedRows(imported);
      setDeletedRows(deletedRecords);

      toast.success(`Importação de produtores concluída (${imported} de ${uniquePayload.length})`);
      setShowSummary(true);
      setLimparAntes(false);
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao importar produtores: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar Produtores</CardTitle>
        <CardDescription>Planilha com colunas: NUMEROCM, NOME, NUMEROCMCONSULTOR, CONSULTOR</CardDescription>
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
