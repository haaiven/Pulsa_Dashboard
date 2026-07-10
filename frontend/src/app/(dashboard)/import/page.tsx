"use client";

import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const API_HOST = typeof window !== "undefined" ? window.location.protocol + "//" + window.location.hostname + ":8000" : "http://localhost:8000";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, Image, CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function ImportPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["import-history"],
    queryFn: async () => (await api.get("/import/history")).data,
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    const isImage = ["png", "jpg", "jpeg", "gif", "bmp", "webp"].includes(ext || "");
    const isExcel = ["xlsx", "xls", "xlsm"].includes(ext || "");

    if (!isImage && !isExcel) {
      alert("Hanya file Excel (.xlsx/.xls) atau gambar (.png/.jpg) yang didukung.");
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_HOST}/import/excel`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["import-history"] });
    } catch (err: any) {
      setResult({ status: "FAILED", error: err.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Import Data</h2>

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-sm font-medium">
          {uploading ? "Processing..." : "Upload Excel atau Gambar"}
        </CardTitle></CardHeader>
        <CardContent>
          <div
            className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 size={32} className="animate-spin text-blue-500" />
                <p className="text-sm text-slate-500">Memproses file...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload size={32} className="text-slate-400" />
                <p className="text-sm font-medium">Click untuk upload</p>
                <p className="text-xs text-slate-400">Excel (.xlsx, .xls) atau Gambar (.png, .jpg, .jpeg)</p>
                <p className="text-xs text-blue-500 mt-1">Untuk gambar, AI akan mengekstrak data tabel secara otomatis</p>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.xlsm,.png,.jpg,.jpeg,.gif,.bmp,.webp" onChange={handleFileUpload} className="hidden" />
          </div>
          {result && (
            <div className={`mt-4 p-4 rounded-lg ${result.status === "SUCCESS" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              <div className="flex items-center gap-2 mb-2">
                {result.status === "SUCCESS" ? <CheckCircle size={18} className="text-green-600" /> : <XCircle size={18} className="text-red-600" />}
                <span className={`font-medium ${result.status === "SUCCESS" ? "text-green-700" : "text-red-700"}`}>
                  {result.status === "SUCCESS" ? "Import Berhasil" : "Import Gagal"}
                </span>
              </div>
              {result.status === "SUCCESS" ? (
                <div className="text-sm text-green-600">
                  <p>Batch: {result.batch_no}</p>
                  <p>Records: {result.records}</p>
                </div>
              ) : (
                <p className="text-sm text-red-600">{result.error || "Terjadi kesalahan"}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Import History</CardTitle></CardHeader>
        <CardContent className="p-0">
          {historyLoading ? <div className="p-6 text-slate-500">Loading...</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch No</TableHead><TableHead>File</TableHead><TableHead>Date</TableHead>
                  <TableHead className="text-right">Records</TableHead><TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(history || []).map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.batch_no}</TableCell>
                    <TableCell>{row.file_name}</TableCell>
                    <TableCell>{new Date(row.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{row.records}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${row.status === "SUCCESS" ? "bg-green-100 text-green-700" : row.status === "FAILED" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {row.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {(!history || history.length === 0) && <TableRow><TableCell colSpan={5} className="text-center text-slate-400">No imports yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
