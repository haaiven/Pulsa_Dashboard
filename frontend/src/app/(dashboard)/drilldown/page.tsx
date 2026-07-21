"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, CheckCircle2, ChevronDown, Clock3, Database, Eye, Search, X, XCircle } from "lucide-react";

const fixedCols_BASE = ["#", "Reference", "Kategori", "Nilai A", "Nilai B", "Selisih", "Action"];

const TYPE_COLUMNS: Record<string, string[]> = {
  PRICE_MISMATCH: ["master_code", "partner_sku", "price", "hpp_partner", "settle_amount_idr", "selisih", "customer_id"],
  DANA_ONLY_EXT_CHECK: ["MERCHANT_TRANS_ID", "TXN_DATE", "TXN_AMOUNT", "SETTLE_AMOUNT", "settle_amount_idr", "PAY_METHOD", "MERCHANT_NAME"],
  DB_ONLY_EXT_CHECK: ["master_code", "partner_sku", "price", "hpp_partner", "reff_trxid", "customer_id"],
  FORCE_FAILED: ["master_code", "partner_sku", "price", "hpp_partner", "customer_id", "result", "message"],
  ONLY_IN_DANA: ["MERCHANT_TRANS_ID", "TXN_DATE", "TXN_AMOUNT", "SETTLE_AMOUNT", "settle_amount_idr", "PAY_METHOD", "MERCHANT_NAME"],
  ONLY_IN_DB: ["master_code", "partner_sku", "price", "hpp_partner", "reff_trxid", "customer_id"],
};

const fmt = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

const typeLabelMap: Record<string, string> = {
  PRICE_MISMATCH: "Pricing Difference",
  DANA_ONLY_EXT_CHECK: "Missing in Source A",
  DB_ONLY_EXT_CHECK: "Missing in Source B",
  FORCE_FAILED: "Force Failed",
  ONLY_IN_DANA: "Only in DANA (Raw)",
  ONLY_IN_DB: "Only in BAS (Raw)",
};

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
  const excludeType = params?.get("exclude") ?? undefined;
  const sourceA = params?.get("source_a") ?? "BAS";
  const sourceB = params?.get("source_b") ?? "DANA";
  const pairId = params?.get("pair_id") ?? undefined;

  const fixedCols = useMemo(() => {
    return ["#", "Reference", "Kategori", `${sourceA} (Nilai A)`, `${sourceB} (Nilai B)`, "Selisih", "Action"];
  }, [sourceA, sourceB]);

  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [skuFilter, setSkuFilter] = useState("ALL");
  const limit = 500;

  const selectSku = (sku: string) => {
    setSkuFilter(sku);
    setSearch(sku !== "ALL" ? sku : "");
    setOffset(0);
  };

  const { data, isLoading } = useQuery({
    queryKey: ["drilldown", date, exceptionType, offset, search, pairId],
    queryFn: async () => {
      const q = new URLSearchParams({ trx_date: date!, limit: String(limit), offset: String(offset) });
      if (exceptionType) q.set("exception_type", exceptionType);
      if (search) q.set("q", search);
      if (pairId) q.set("pair_id", pairId);
      return (await api.get(`/dashboard/drilldown?${q.toString()}`)).data;
    },
    enabled: !!date,
  });

  const dynamicCols = useMemo(() => {
    const allCols: string[] = data?.columns || [];
    if (exceptionType && TYPE_COLUMNS[exceptionType]) {
      const ordered = TYPE_COLUMNS[exceptionType];
      return ordered.filter((col) => allCols.includes(col));
    }
    return allCols;
  }, [data, exceptionType]);

  const typeLabel = exceptionType ? (typeLabelMap[exceptionType] || exceptionType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())) : null;
  const exceptions = useMemo(() => {
    const raw = data?.exceptions || [];
    return excludeType ? raw.filter((r: any) => r.exception_type !== excludeType) : raw;
  }, [data?.exceptions, excludeType]);

  const filteredExceptions = useMemo(() => {
    return categoryFilter === "ALL" ? exceptions : exceptions.filter((r: any) => r.exception_type === categoryFilter);
  }, [exceptions, categoryFilter]);

  const categoryOptions = useMemo(() => {
    const exclude = new Set(excludeType ? [excludeType] : []);
    return (data?.available_types || [])
      .filter((t: string) => !exclude.has(t))
      .filter((t: string) => !["ONLY_IN_DANA", "ONLY_IN_DB"].includes(t))
      .map((t: string) => ({ type: t, label: typeLabelMap[t] || t }));
  }, [data?.available_types, excludeType]);

  const pricingGroups = useMemo(() => {
    const isPricing = exceptionType === "PRICE_MISMATCH" || categoryFilter === "PRICE_MISMATCH";
    if (!isPricing) return [];
    const groups = new Map<string, { master_code: string; count: number; price: number; hpp_partner: number; settle_amount_idr: number; total_selisih: number; items: any[] }>();
    for (const ex of filteredExceptions) {
      const mc = ex.raw_data?.master_code_db || ex.raw_data?.master_code || "Unknown";
      if (!groups.has(mc)) {
        groups.set(mc, {
          master_code: mc,
          count: 0,
          price: parseFloat(ex.raw_data?.price_db || ex.raw_data?.price || "0"),
          hpp_partner: parseFloat(ex.raw_data?.hpp_partner || "0"),
          settle_amount_idr: parseFloat(ex.raw_data?.settle_amount_idr || "0"),
          total_selisih: 0,
          items: [],
        });
      }
      const g = groups.get(mc)!;
      g.count++;
      g.total_selisih += Math.abs(ex.diff_value || 0);
      g.items.push(ex);
    }
    return [...groups.values()].sort((a, b) => b.count - a.count);
  }, [filteredExceptions, exceptionType, categoryFilter]);

  const filteredGroups = useMemo(() => {
    return skuFilter === "ALL" ? pricingGroups : pricingGroups.filter((g) => g.master_code === skuFilter);
  }, [pricingGroups, skuFilter]);

  const skuOptions = useMemo(() => {
    return pricingGroups.map((g) => ({ value: g.master_code, label: `${g.master_code} (${g.count.toLocaleString("id-ID")} trx)` }));
  }, [pricingGroups]);

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
          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">Dataset A: {sourceA}</span>
          <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">Dataset B: {sourceB}</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200 bg-white shadow-sm"><CardContent className="p-5"><p className="text-sm text-slate-500">Loaded Records</p><p className="mt-2 text-2xl font-bold text-slate-950">{data?.exceptions?.length || 0}</p></CardContent></Card>
        <Card className="border-slate-200 bg-white shadow-sm"><CardContent className="p-5"><p className="text-sm text-slate-500">Total Available</p><p className="mt-2 text-2xl font-bold text-slate-950">{data?.total || 0}</p></CardContent></Card>
        <Card className="border-slate-200 bg-white shadow-sm"><CardContent className="p-5"><p className="text-sm text-slate-500">Category Exposure</p><p className="mt-2 text-2xl font-bold text-red-600">{fmt(data?.summary_exposure ?? 0)}</p></CardContent></Card>
      </div>

      <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col gap-4 border-b border-slate-100 bg-white p-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h3 className="font-bold text-slate-950">Exception Transactions</h3>
              <p className="mt-1 text-xs text-slate-500">
                {search ? `Search: "${search}" · ` : ""}
                {categoryFilter !== "ALL" ? `Filter: ${typeLabelMap[categoryFilter] || categoryFilter} · ` : ""}
                {typeLabel ? `Category: ${typeLabel} · ` : ""}
                {filteredExceptions.length} dari {data?.total || 0} data
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
              {(
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-xs outline-none ring-blue-500 transition focus:ring-2">
                  <option value="ALL">All Categories</option>
                  {categoryOptions.map((cat: { type: string; label: string }) => (
                    <option key={cat.type} value={cat.type}>{cat.label}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-slate-500">Loading transaction details...</div>
          ) : (exceptionType === "PRICE_MISMATCH" || categoryFilter === "PRICE_MISMATCH") && pricingGroups.length > 0 ? (
            skuFilter !== "ALL" ? (
              <>
                {(() => {
                  const breakdown: any[] = data?.pricing_breakdown || [];
                  const b = breakdown.find((x: any) => x.partner_sku === skuFilter);
                  const pageGroup = filteredGroups[0];
                  const items = pageGroup ? pageGroup.items : [];
                  return (
                    <div className="p-4">
                      <button onClick={() => selectSku("ALL")} className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                        <ArrowLeft size={14} /> Back to SKU Summary
                      </button>
                      <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <h4 className="text-sm font-bold text-slate-950">{skuFilter}</h4>
                        {b ? (
                          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
                            <span>Internal Price: {fmt(b.internal_price)}</span>
                            <span>DANA Price: {fmt(b.dana_price)}</span>
                            <span>Diff/Unit: <span className={b.diff_per_unit < 0 ? "text-red-600 font-semibold" : "text-emerald-600 font-semibold"}>{fmt(b.diff_per_unit)}</span></span>
                            <span>Affected: {b.transaction_count.toLocaleString("id-ID")} trx</span>
                            <span>Total Impact: <span className="text-red-600 font-bold">{fmt(b.total_impact)}</span></span>
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-slate-500">Loading SKU details...</div>
                        )}
                      </div>
                      <div className="overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              {fixedCols.map((col) => (
                                <TableHead key={col} className="whitespace-nowrap text-xs">{col}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map((row: any, idx: number) => (
                              <TableRow key={row.id} className="hover:bg-slate-50/80">
                                <TableCell className="text-xs text-slate-400 tabular-nums w-12">{idx + 1}</TableCell>
                                <TableCell className="max-w-[220px] truncate font-mono text-[11px] text-slate-700">{row.reference_number || "-"}</TableCell>
                                <TableCell>
                                  <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700 ring-1 ring-orange-200 whitespace-nowrap">
                                    {typeLabelMap[row.exception_type] || row.exception_type}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-xs font-semibold text-slate-700">{fmt(row.bas_value)}</TableCell>
                                <TableCell className="text-right tabular-nums text-xs font-semibold text-slate-700">{fmt(row.dana_value)}</TableCell>
                                <TableCell className={`text-right tabular-nums text-xs font-bold ${row.diff_value < 0 ? "text-red-600" : row.diff_value > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                                  {fmt(row.diff_value)}
                                </TableCell>
                                <TableCell>
                                  <button onClick={() => setSelected(row)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-2 text-[11px] font-medium text-blue-700 hover:bg-blue-100">
                                    <Eye size={13} /> Review
                                  </button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {data && search && data.total > limit && (
                        <div className="flex items-center justify-center gap-4 border-t border-slate-100 p-4">
                          <button onClick={() => setOffset((o) => Math.max(0, o - limit))} disabled={offset === 0} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50">
                            Previous
                          </button>
                          <span className="text-sm text-slate-500">{(offset / limit) + 1} of {Math.ceil(data.total / limit)}</span>
                          <button onClick={() => setOffset((o) => o + limit)} disabled={offset + limit >= data.total} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50">
                            Next
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="p-4">
                {(() => {
                  const breakdown: any[] = data?.pricing_breakdown || [];
                  const totalTrx = breakdown.reduce((s: number, b: any) => s + b.transaction_count, 0);
                  const totalImpact = breakdown.reduce((s: number, b: any) => s + b.total_impact, 0);
                  return (
                    <>
                      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">{breakdown.length} SKUs</span>
                        <span>{totalTrx.toLocaleString("id-ID")} trx</span>
                        <span>Total Impact <span className="text-red-600 font-bold">{fmt(totalImpact)}</span></span>
                      </div>
                      <div className="overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              <TableHead className="text-xs">Partner SKU</TableHead>
                              <TableHead className="text-xs">Internal Price</TableHead>
                              <TableHead className="text-xs">DANA Price</TableHead>
                              <TableHead className="text-xs">Diff / Unit</TableHead>
                              <TableHead className="text-right text-xs">Jumlah Trx</TableHead>
                              <TableHead className="text-right text-xs">Total Impact</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {breakdown.map((b: any) => (
                              <TableRow key={b.partner_sku} onClick={() => selectSku(b.partner_sku)} className="cursor-pointer hover:bg-blue-50/50">
                                <TableCell className="text-xs font-bold text-slate-950">{b.partner_sku}</TableCell>
                                <TableCell className="text-xs">{fmt(b.internal_price)}</TableCell>
                                <TableCell className="text-xs">{fmt(b.dana_price)}</TableCell>
                                <TableCell className={`text-xs font-semibold ${b.diff_per_unit < 0 ? "text-red-600" : "text-emerald-600"}`}>
                                  {fmt(b.diff_per_unit)}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">{b.transaction_count.toLocaleString("id-ID")}</TableCell>
                                <TableCell className="text-right text-xs font-bold text-red-600">{fmt(b.total_impact)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  );
                })()}
              </div>
            )
          ) : (
            <>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      {fixedCols.map((col) => (
                        <TableHead key={col} className="whitespace-nowrap">{col}</TableHead>
                      ))}
                      {dynamicCols.map((col: string) => (
                        <TableHead key={col} className="whitespace-nowrap">{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExceptions.map((row: any, idx: number) => (
                      <TableRow key={row.id} className="hover:bg-slate-50/80">
                        <TableCell className="text-xs text-slate-400 tabular-nums w-12">{(data?.offset ?? 0) + idx + 1}</TableCell>
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
                    {filteredExceptions.length === 0 && (
                      <TableRow><TableCell colSpan={fixedCols.length + dynamicCols.length || 1} className="py-12 text-center text-slate-400">Tidak ada data</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {data && categoryFilter === "ALL" && data.total > limit && (
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
  const rawEntries = Object.entries(row.raw_data || {}).slice(0, 12);

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
