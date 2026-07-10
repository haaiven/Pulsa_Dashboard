"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, CheckCircle2, Clock3, Database, Eye, Search, X, XCircle } from "lucide-react";

const FIXED_COLS = ["Reference", "Kategori", "BAS (Nilai A)", "DANA (Nilai B)", "Selisih", "Action"];

const fmt = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

const typeLabelMap: Record<string, string> = {
  PRICE_MISMATCH: "Amount Difference",
  ONLY_IN_DANA: "Missing in Dataset A",
  ONLY_IN_DB: "Missing in Dataset B",
  FORCE_FAILED: "Force Failed",
  DB_ONLY_EXT_CHECK: "External Check (BAS)",
  DANA_ONLY_EXT_CHECK: "External Check (DANA)",
};

const RAW_COL_BLACKLIST = new Set([
  "reff_trxid", "merchant_trans_id",
  "id", "master_code", "partner_sku", "vendor_code",
  "price", "hpp_partner", "settle", "amount",
  "selisih", "difference", "diff", "dana", "bas",
  "pay_method", "customer_id",
  "status", "result", "created_at",
  "txn_date", "date", "merchant_name",
  "found_in_db_h_minus_1", "found_in_db_h_plus_1",
  "settle_amount_idr", "setttle_amount", "txn_amount",
]);

function getRecommendation(row: any) {
  switch (row?.exception_type) {
    case "PRICE_MISMATCH":
      return "Validate pricing configuration and settlement amount between BAS and DANA before adjustment.";
    case "ONLY_IN_DANA":
      return "Trace source ingestion in BAS and verify whether the transaction was delayed or rejected upstream.";
    case "ONLY_IN_DB":
      return "Confirm DANA settlement availability and check cutoff or dashboard ingestion schedule.";
    case "FORCE_FAILED":
      return "Review failed transaction policy and confirm whether manual reversal or partner follow-up is required.";
    default:
      return "Review source records, compare both datasets, and assign the item to operations for resolution.";
  }
}

function getRootCause(row: any) {
  if (row?.reason) return row.reason;
  switch (row?.exception_type) {
    case "PRICE_MISMATCH":
      return "Settlement amount differs between Dataset A and Dataset B.";
    case "ONLY_IN_DANA":
      return "Transaction exists in Dataset B but is not found in Dataset A.";
    case "ONLY_IN_DB":
      return "Transaction exists in Dataset A but is not found in Dataset B.";
    case "FORCE_FAILED":
      return "Transaction was marked under force failed handling.";
    default:
      return "Difference requires operational review.";
  }
}

export default function DrilldownPage() {
  const router = useRouter();
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const date = params?.get("date") ?? null;
  const exceptionType = params?.get("type") ?? undefined;

  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const limit = 500;

  const { data, isLoading } = useQuery({
    queryKey: ["drilldown", date, exceptionType, offset, search],
    queryFn: async () => {
      const q = new URLSearchParams({ trx_date: date!, limit: String(limit), offset: String(offset) });
      if (exceptionType) q.set("exception_type", exceptionType);
      if (search) q.set("q", search);
      return (await api.get(`/dashboard/drilldown?${q.toString()}`)).data;
    },
    enabled: !!date,
  });

  const dynamicCols = useMemo(() => {
    return (data?.columns || []).filter((c: string) => !RAW_COL_BLACKLIST.has(c.toLowerCase().replace(/\s+/g, "_")));
  }, [data]);

  const typeLabel = exceptionType ? (typeLabelMap[exceptionType] || exceptionType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())) : null;
  const exceptions = data?.exceptions || [];
  const totalExposure = exceptions.reduce((sum: number, row: any) => sum + Math.abs(row.diff_value || 0), 0);

  if (!date) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
        Tanggal tidak ditemukan. Kembali ke <button onClick={() => router.push("/")} className="font-semibold text-blue-600 hover:underline">Overview</button>.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <button onClick={() => router.push("/")} className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:text-slate-950">
            <ArrowLeft size={16} /> Back to overview
          </button>
          <h2 className="text-3xl font-bold tracking-tight text-slate-950">Transaction Drilldown</h2>
          <p className="mt-2 text-sm text-slate-500">
            {typeLabel ? `Focused review for ${typeLabel}` : "All transactions requiring reconciliation review"} on {date}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">Dataset A: BAS</span>
          <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">Dataset B: DANA</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200 bg-white shadow-sm"><CardContent className="p-5"><p className="text-sm text-slate-500">Loaded Records</p><p className="mt-2 text-2xl font-bold text-slate-950">{data?.exceptions?.length || 0}</p></CardContent></Card>
        <Card className="border-slate-200 bg-white shadow-sm"><CardContent className="p-5"><p className="text-sm text-slate-500">Total Available</p><p className="mt-2 text-2xl font-bold text-slate-950">{data?.total || 0}</p></CardContent></Card>
        <Card className="border-slate-200 bg-white shadow-sm"><CardContent className="p-5"><p className="text-sm text-slate-500">Current Page Exposure</p><p className="mt-2 text-2xl font-bold text-red-600">{fmt(totalExposure)}</p></CardContent></Card>
      </div>

      <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col gap-4 border-b border-slate-100 bg-white p-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h3 className="font-bold text-slate-950">Exception Transactions</h3>
              <p className="mt-1 text-xs text-slate-500">
                {search ? `Search: "${search}" · ` : ""}{typeLabel ? `Filter: ${typeLabel} · ` : ""}{exceptions.length} dari {data?.total || 0} data
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-96">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari reference, product, customer_id, atau nilai..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none ring-blue-500 transition focus:bg-white focus:ring-2"
                />
              </div>
              {search && (
                <button onClick={() => { setSearch(""); setOffset(0); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900">
                  Reset
                </button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-slate-500">Loading transaction details...</div>
          ) : (
            <>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      {FIXED_COLS.map((col) => (
                        <TableHead key={col} className="whitespace-nowrap">{col}</TableHead>
                      ))}
                      {dynamicCols.map((col: string) => (
                        <TableHead key={col} className="whitespace-nowrap">{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exceptions.map((row: any) => (
                      <TableRow key={row.id} className="hover:bg-slate-50/80">
                        <TableCell className="max-w-[220px] truncate font-mono text-xs text-slate-700">{row.reference_number || "-"}</TableCell>
                        <TableCell>
                          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700 ring-1 ring-orange-200 whitespace-nowrap">
                            {typeLabelMap[row.exception_type] || row.exception_type}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-slate-700">{fmt(row.bas_value)}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-slate-700">{fmt(row.dana_value)}</TableCell>
                        <TableCell className={`text-right tabular-nums font-bold ${row.diff_value < 0 ? "text-red-600" : row.diff_value > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                          {fmt(row.diff_value)}
                        </TableCell>
                        <TableCell>
                          <button onClick={() => setSelected(row)} className="inline-flex h-9 items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-100">
                            <Eye size={15} /> Review
                          </button>
                        </TableCell>
                        {dynamicCols.map((col: string) => (
                          <TableCell key={col} className="max-w-xs truncate font-mono text-xs text-slate-500">
                            {row.raw_data?.[col] ?? "-"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {exceptions.length === 0 && (
                      <TableRow><TableCell colSpan={FIXED_COLS.length + dynamicCols.length || 1} className="py-12 text-center text-slate-400">Tidak ada data</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {data && data.total > limit && (
                <div className="flex items-center justify-center gap-4 border-t border-slate-100 p-4">
                  <button
                    onClick={() => setOffset((o) => Math.max(0, o - limit))}
                    disabled={offset === 0}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                  >
                    Sebelumnya
                  </button>
                  <span className="text-sm text-slate-500">{(offset / limit) + 1} dari {Math.ceil(data.total / limit)}</span>
                  <button
                    onClick={() => setOffset((o) => o + limit)}
                    disabled={offset + limit >= data.total}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                  >
                    Selanjutnya
                  </button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {selected && <TransactionDrawer row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function TransactionDrawer({ row, onClose }: { row: any; onClose: () => void }) {
  const rawEntries = Object.entries(row.raw_data || {}).filter(([key]) => !RAW_COL_BLACKLIST.has(key.toLowerCase().replace(/\s+/g, "_"))).slice(0, 12);

  return (
    <div className="fixed inset-0 z-[70]">
      <button aria-label="Close transaction detail overlay" onClick={onClose} className="absolute inset-0 bg-slate-950/40" />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 p-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Transaction Review</p>
            <h3 className="mt-2 truncate text-xl font-bold text-slate-950">{row.reference_number || "Unknown transaction"}</h3>
            <p className="mt-1 text-sm text-slate-500">{typeLabelMap[row.exception_type] || row.exception_type}</p>
          </div>
          <button onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:text-slate-900">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          <div className="grid grid-cols-3 gap-3">
            <Metric label="Dataset A" value={fmt(row.bas_value)} icon={<Database size={16} />} />
            <Metric label="Dataset B" value={fmt(row.dana_value)} icon={<Database size={16} />} />
            <Metric label="Difference" value={fmt(row.diff_value)} danger icon={<AlertIcon value={row.diff_value} />} />
          </div>

          <section className="rounded-3xl border border-slate-200 p-5">
            <h4 className="font-bold text-slate-950">Root Cause</h4>
            <p className="mt-2 text-sm leading-6 text-slate-600">{getRootCause(row)}</p>
            <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-blue-800">
              <span className="font-bold">Recommendation:</span> {getRecommendation(row)}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 p-5">
            <h4 className="font-bold text-slate-950">Dataset A vs Dataset B Comparison</h4>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ComparisonCard title="BAS / Dataset A" value={row.bas_value ? fmt(row.bas_value) : "Not Found"} found={!!row.bas_value} />
              <ComparisonCard title="DANA / Dataset B" value={row.dana_value ? fmt(row.dana_value) : "Not Found"} found={!!row.dana_value} />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 p-5">
            <h4 className="font-bold text-slate-950">Timeline</h4>
            <div className="mt-4 space-y-4">
              <TimelineItem icon={<Clock3 size={15} />} title="Transaction captured" detail={row.raw_data?.TXN_DATE || row.raw_data?.date || "Timestamp unavailable"} />
              <TimelineItem icon={<AlertIcon value={row.diff_value} />} title="Exception detected" detail={row.created_at ? new Date(row.created_at).toLocaleString() : "During reconciliation import"} />
              <TimelineItem icon={<CheckCircle2 size={15} />} title="Pending operations review" detail="Use this drawer to compare source records before settlement action." />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 p-5">
            <h4 className="font-bold text-slate-950">Related Information</h4>
            <div className="mt-4 grid gap-2">
              {rawEntries.map(([key, value]) => (
                <div key={key} className="flex justify-between gap-4 rounded-2xl bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-slate-500">{key}</span>
                  <span className="max-w-[260px] truncate font-mono text-slate-800">{String(value || "-")}</span>
                </div>
              ))}
              {rawEntries.length === 0 && <p className="text-sm text-slate-400">No additional raw fields available.</p>}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function Metric({ label, value, icon, danger }: { label: string; value: string; icon: React.ReactNode; danger?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className={`mb-3 grid h-8 w-8 place-items-center rounded-xl ${danger ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>{icon}</div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 truncate text-sm font-bold ${danger ? "text-red-600" : "text-slate-950"}`}>{value}</p>
    </div>
  );
}

function ComparisonCard({ title, value, found }: { title: string; value: string; found: boolean }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        {found ? <CheckCircle2 size={16} className="text-emerald-600" /> : <XCircle size={16} className="text-red-500" />}
      </div>
      <p className="mt-3 font-bold tabular-nums text-slate-950">{value}</p>
    </div>
  );
}

function TimelineItem({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="flex gap-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-sm text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

function AlertIcon({ value }: { value: number }) {
  return value ? <XCircle size={16} /> : <CheckCircle2 size={16} />;
}
