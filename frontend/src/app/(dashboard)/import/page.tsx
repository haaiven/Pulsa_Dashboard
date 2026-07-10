"use client";

import { useMemo, useRef, useState } from "react";
import type React from "react";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, ChevronDown, Clock3, FileSpreadsheet, Image, Inbox, Loader2, RefreshCw, Upload, XCircle } from "lucide-react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const API_HOST = typeof window !== "undefined" ? window.location.protocol + "//" + window.location.hostname + ":8000" : "http://localhost:8000";

const statusClass: Record<string, string> = {
  SUCCESS: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  FAILED: "bg-red-50 text-red-700 ring-red-200",
  PROCESSING: "bg-amber-50 text-amber-700 ring-amber-200",
  UPLOADED: "bg-blue-50 text-blue-700 ring-blue-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  MISSING: "bg-orange-50 text-orange-700 ring-orange-200",
  PARTIAL: "bg-blue-50 text-blue-700 ring-blue-200",
  RECEIVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

type ReconPair = { id: number; pair_code: string; pair_name: string; category: string };
type MonitoringFile = { id: number; file_type: string; source: string; expected_filename_pattern: string; required: boolean; status: string; received_file_name?: string; received_at?: string };
type MonitoringPair = { pair_id: number; pair_code: string; pair_name: string; category: string; product: string; status: string; progress: number; expected_count: number; received_count: number; missing_count: number; files: MonitoringFile[] };
type MonitoringGroup = { category: string; active_pairs: number; ready_pairs: number; pairs: MonitoringPair[] };

function StatusBadge({ status }: { status: string }) {
  const Icon = status === "SUCCESS" || status === "COMPLETED" || status === "RECEIVED" ? CheckCircle : status === "FAILED" ? XCircle : Clock3;
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClass[status] || "bg-slate-50 text-slate-700 ring-slate-200"}`}><Icon size={13} />{status}</span>;
}

export default function ImportPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [settlementDate, setSettlementDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [category, setCategory] = useState("ALL");
  const [pairId, setPairId] = useState("ALL");
  const [pairStatus, setPairStatus] = useState("ALL");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const { data: pairs = [] } = useQuery<ReconPair[]>({ queryKey: ["recon-pairs"], queryFn: async () => (await api.get("/recon-pairs")).data });
  const { data: monitoring, isLoading: monitoringLoading } = useQuery({
    queryKey: ["file-monitoring", settlementDate, category, pairId, pairStatus],
    queryFn: async () => (await api.get("/file-monitoring", { params: {
      settlement_date: settlementDate || undefined,
      category: category === "ALL" ? undefined : category,
      pair_id: pairId === "ALL" ? undefined : pairId,
      status: pairStatus === "ALL" ? undefined : pairStatus,
    } })).data,
  });
  const { data: history, isLoading: historyLoading } = useQuery({ queryKey: ["import-history"], queryFn: async () => (await api.get("/import/history")).data });

  const categories = useMemo(() => Array.from(new Set(pairs.map((pair) => pair.category))), [pairs]);
  const summary = monitoring?.summary || {};

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["file-monitoring"] });
    queryClient.invalidateQueries({ queryKey: ["import-history"] });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    const isImage = ["png", "jpg", "jpeg", "gif", "bmp", "webp"].includes(ext || "");
    const isExcel = ["xlsx", "xls", "xlsm"].includes(ext || "");
    const isSource = ["csv", "txt"].includes(ext || "");

    if (!isImage && !isExcel && !isSource) {
      alert("Hanya file Excel, CSV/TXT source file, atau gambar yang didukung.");
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_HOST}/import/excel`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
      refreshAll();
    } catch (err: any) {
      setResult({ status: "FAILED", error: err.message });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-950">Daily File Monitoring</h2>
          <p className="mt-2 text-sm text-slate-500">File completeness, readiness, and alerts per recon pair from Master Data Expected Files.</p>
        </div>
        <button onClick={refreshAll} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><RefreshCw size={17} /> Refresh</button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard title="Total Expected Files" value={summary.total_expected_files || 0} helper={`${summary.total_pairs || 0} active pairs`} />
        <KpiCard title="Total Received" value={summary.total_received || 0} helper={`${summary.ready_pairs || 0} ready`} />
        <KpiCard title="Total Missing" value={summary.total_missing || 0} helper="Required files" />
        <KpiCard title="Total Failed" value={summary.total_failed || 0} helper="Failed receipts" />
        <KpiCard title="Pair Readiness" value={`${summary.pair_readiness || 0}%`} helper={`${summary.ready_pairs || 0}/${summary.total_pairs || 0} pairs ready`} accent />
      </div>

      <Card className="border-slate-200 bg-white shadow-sm"><CardContent className="p-5">
        <div className="grid gap-4 lg:grid-cols-5">
          <FilterField label="Settlement Date"><input type="date" value={settlementDate} onChange={(e) => setSettlementDate(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" /></FilterField>
          <FilterField label="Transaction Date"><input type="date" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" /></FilterField>
          <FilterField label="Pair"><select value={pairId} onChange={(e) => setPairId(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"><option value="ALL">All pairs</option>{pairs.map((pair) => <option key={pair.id} value={pair.id}>{pair.pair_name}</option>)}</select></FilterField>
          <FilterField label="Category"><select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"><option value="ALL">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></FilterField>
          <FilterField label="Pair Status"><select value={pairStatus} onChange={(e) => setPairStatus(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"><option value="ALL">All statuses</option><option value="COMPLETED">Completed</option><option value="PARTIAL">Partial</option><option value="MISSING">Missing</option></select></FilterField>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-slate-500">Quick:</span><button onClick={() => setSettlementDate(format(new Date(), "yyyy-MM-dd"))} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold">Today</button><button onClick={() => setPairStatus("MISSING")} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold">Missing Only</button><button onClick={() => setPairStatus("COMPLETED")} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold">Completed Only</button></div>
      </CardContent></Card>

      <section className="space-y-4">
        <h3 className="text-xl font-bold text-slate-950">Reconciliation Pair Monitoring</h3>
        {monitoringLoading ? <div className="rounded-3xl bg-white p-10 text-center text-slate-500 shadow-sm">Loading monitoring data...</div> : (monitoring?.groups || []).map((group: MonitoringGroup) => (
          <div key={group.category} className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3"><div className="flex items-center gap-3"><span className="rounded-lg bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700 ring-1 ring-blue-200">{group.category} Reconciliation</span><span className="text-sm text-slate-500">{group.active_pairs} active</span></div><span className="text-sm font-semibold text-emerald-700">{group.ready_pairs} ready</span></div>
            {group.pairs.map((pair) => {
              const isOpen = expanded[pair.pair_id] ?? false;
              return <Card key={pair.pair_id} className="overflow-hidden border-slate-200 bg-white shadow-sm"><CardContent className="p-0"><button onClick={() => setExpanded({ ...expanded, [pair.pair_id]: !isOpen })} className="flex w-full items-center gap-4 p-5 text-left"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="text-lg font-bold text-slate-950">{pair.pair_name}</h4><span className="font-mono text-xs text-slate-500">{pair.pair_code}</span><span className="rounded-lg border border-slate-300 px-2 py-0.5 text-xs font-semibold text-slate-600">{pair.product}</span></div><p className="mt-1 text-sm text-slate-500">{pair.received_count}/{pair.expected_count} files received · {pair.missing_count} missing</p></div><div className="hidden w-56 items-center gap-3 sm:flex"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-slate-950" style={{ width: `${pair.progress}%` }} /></div><span className="w-12 text-right text-sm font-semibold text-slate-500">{pair.progress}%</span></div><StatusBadge status={pair.status} /><ChevronDown size={18} className={`text-slate-500 transition ${isOpen ? "rotate-180" : ""}`} /></button>{isOpen && <div className="border-t border-slate-100 bg-slate-50/60 p-4"><div className="grid gap-3 lg:grid-cols-2">{pair.files.map((file) => <div key={file.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-sm font-semibold text-slate-900">{file.file_type}</p><p className="mt-1 text-sm text-slate-500">{file.source} · {file.expected_filename_pattern}</p>{file.received_file_name && <p className="mt-2 text-xs text-emerald-700">Received: {file.received_file_name}</p>}</div><StatusBadge status={file.status} /></div></div>)}</div>{pair.files.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">No Expected Files configured for this pair.</div>}</div>}</CardContent></Card>;
            })}
          </div>
        ))}
        {!monitoringLoading && (!monitoring?.groups || monitoring.groups.length === 0) && <div className="rounded-3xl bg-white p-10 text-center text-slate-400 shadow-sm">No monitoring data found.</div>}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="overflow-hidden border-slate-200 bg-white shadow-sm"><CardHeader className="border-b border-slate-100 bg-gradient-to-r from-white to-blue-50/60"><CardTitle className="text-base font-bold text-slate-950">Upload Source or Reconciliation File</CardTitle><p className="text-sm text-slate-500">Source files use Expected Files matching. recon_*.xlsx keeps the existing parser flow.</p></CardHeader><CardContent className="p-6"><div className={`group relative overflow-hidden rounded-3xl border-2 border-dashed p-8 text-center transition ${uploading ? "border-blue-300 bg-blue-50" : "cursor-pointer border-slate-200 bg-slate-50/70 hover:border-blue-400 hover:bg-blue-50/60"}`} onClick={() => !uploading && fileInputRef.current?.click()}><div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-blue-600 to-indigo-500 opacity-80" />{uploading ? <div className="flex flex-col items-center gap-4"><Loader2 size={34} className="animate-spin text-blue-600" /><div><p className="font-bold text-slate-950">Memproses file</p><p className="text-sm text-slate-500">Matching konfigurasi dan import sedang berjalan.</p></div></div> : <div className="flex flex-col items-center gap-4"><div className="grid h-16 w-16 place-items-center rounded-3xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-200"><Upload size={30} /></div><div><p className="text-lg font-bold text-slate-950">Click to upload</p><p className="mt-1 text-sm text-slate-500">Excel, CSV/TXT source file, atau image.</p></div><div className="flex flex-wrap justify-center gap-2"><Chip icon={<FileSpreadsheet size={13} />} text=".xlsx .xls .xlsm .csv" /><Chip icon={<Image size={13} />} text=".png .jpg .webp" /></div></div>}<input ref={fileInputRef} type="file" accept=".xlsx,.xls,.xlsm,.csv,.txt,.png,.jpg,.jpeg,.gif,.bmp,.webp" onChange={handleFileUpload} className="hidden" /></div>{result && <div className={`mt-5 rounded-3xl border p-4 ${result.status === "SUCCESS" ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}><div className="flex items-start gap-3"><div className={`grid h-10 w-10 place-items-center rounded-2xl ${result.status === "SUCCESS" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{result.status === "SUCCESS" ? <CheckCircle size={20} /> : <AlertCircle size={20} />}</div><div><div className="flex items-center gap-2"><p className="font-bold">{result.status === "SUCCESS" ? "Import berhasil" : "Import gagal"}</p><StatusBadge status={result.status} /></div>{result.status === "SUCCESS" ? <p className="mt-2 text-sm text-emerald-700">Batch {result.batch_no} · {result.records} records</p> : <p className="mt-2 text-sm text-red-700">{result.error || "Terjadi kesalahan"}</p>}</div></div></div>}</CardContent></Card>
        <Card className="border-slate-200 bg-white shadow-sm"><CardHeader><CardTitle className="text-base font-bold text-slate-950">Import Readiness</CardTitle></CardHeader><CardContent className="space-y-4"><div className="rounded-3xl bg-slate-950 p-5 text-white"><p className="text-sm text-slate-300">Dynamic config</p><p className="mt-2 text-2xl font-bold">Expected Files</p><p className="mt-2 text-xs leading-5 text-slate-400">Monitoring dihitung dari Master Data, bukan daftar hardcode.</p></div><div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Latest Import</p><p className="mt-1 truncate text-sm font-bold text-slate-950">{history?.[0]?.file_name || "-"}</p></div></CardContent></Card>
      </div>

      <Card className="overflow-hidden border-slate-200 bg-white shadow-sm"><CardHeader className="border-b border-slate-100"><CardTitle className="text-base font-bold text-slate-950">Import History</CardTitle><p className="text-sm text-slate-500">Riwayat batch file yang sudah diterima sistem.</p></CardHeader><CardContent className="p-0">{historyLoading ? <div className="flex items-center justify-center gap-2 p-10 text-slate-500"><Loader2 size={18} className="animate-spin" /> Loading history...</div> : <div className="overflow-auto"><Table><TableHeader><TableRow className="bg-slate-50"><TableHead>Batch No</TableHead><TableHead>File</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Records</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{(history || []).map((row: any) => <TableRow key={row.id} className="hover:bg-slate-50/80"><TableCell className="font-mono text-xs text-slate-600">{row.batch_no}</TableCell><TableCell><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-700"><FileSpreadsheet size={16} /></span><span className="font-medium text-slate-900">{row.file_name}</span></div></TableCell><TableCell className="text-sm text-slate-500">{new Date(row.created_at).toLocaleString()}</TableCell><TableCell className="text-right font-semibold tabular-nums">{row.records}</TableCell><TableCell><StatusBadge status={row.status} /></TableCell></TableRow>)}{(!history || history.length === 0) && <TableRow><TableCell colSpan={5} className="py-12 text-center text-slate-400">No imports yet</TableCell></TableRow>}</TableBody></Table></div>}</CardContent></Card>
    </div>
  );
}

function KpiCard({ title, value, helper, accent }: { title: string; value: string | number; helper: string; accent?: boolean }) {
  return <Card className="border-slate-200 bg-white shadow-sm"><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-slate-500">{title}</p><p className={`mt-3 text-3xl font-bold ${accent ? "text-red-600" : "text-slate-950"}`}>{value}</p><p className="mt-2 text-sm text-slate-500">{helper}</p></div><Inbox size={20} className="text-slate-400" /></div></CardContent></Card>;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-slate-500">{label}<div className="mt-1">{children}</div></label>;
}

function Chip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">{icon}{text}</span>;
}
