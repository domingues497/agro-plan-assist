import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import * as XLSX from "xlsx";
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
import { getApiBaseUrl } from "@/lib/utils";

export function ImportFazendas() {
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

      const baseUrl = getApiBaseUrl();
      const token = typeof localStorage !== "undefined" ? localStorage.getItem("auth_token") : null;
      if (!token) throw new Error("Usuário não autenticado");
      const meRes = await fetch(`${baseUrl}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (!meRes.ok) throw new Error("Falha ao obter usuário");
      const meJson = await meRes.json();
      const user = meJson?.user;
      if (!user?.user_id && !user?.id) throw new Error("Usuário inválido");

      let deletedRecords = 0;
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      const payload = rows.map((row) => ({
        numerocm: String(row.NUMEROCM ?? row.numerocm ?? "").trim(),
        idfazenda: String(row.IDFAZENDA ?? row.idfazenda ?? "").trim(),
        nomefazenda: String(row.NOMEFAZENDA ?? row.nomefazenda ?? "").trim(),
        numerocm_consultor: String(row.NUMEROCMCONSULTOR ?? row.numerocm_consultor ?? "").trim(),
      })).filter((r) => r.numerocm && r.idfazenda && r.nomefazenda && r.numerocm_consultor);

      if (payload.length === 0) {
        toast.error("Nenhuma linha válida encontrada (precisa de NUMEROCM, IDFAZENDA, NOMEFAZENDA, NUMEROCMCONSULTOR)");
        setIsImporting(false);
        return;
      }

      // Deduplicar por numerocm + idfazenda
      const dedupMap = new Map<string, typeof payload[0]>();
      for (const item of payload) {
        const key = `${item.numerocm}|${item.idfazenda}`;
        dedupMap.set(key, item);
      }
      const uniquePayload = Array.from(dedupMap.values());
      const removed = payload.length - uniquePayload.length;
      if (removed > 0) {
        toast.info(`${removed} registros duplicados foram ignorados`);
      }

      setTotalRows(uniquePayload.length);

      const res = await fetch(`${baseUrl}/fazendas/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : undefined as any },
        body: JSON.stringify({
          items: uniquePayload,
          limparAntes,
          user_id: user.user_id || user.id,
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

      toast.success(`Importação de fazendas concluída (${imported} de ${uniquePayload.length})`);
      setShowSummary(true);
      setLimparAntes(false);
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao importar fazendas: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar Fazendas</CardTitle>
        <CardDescription>Planilha com colunas: NUMEROCM, IDFAZENDA, NOMEFAZENDA, NUMEROCMCONSULTOR</CardDescription>
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
