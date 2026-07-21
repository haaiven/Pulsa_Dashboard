"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUpRight, CheckCircle2, Eye, Filter, Layers, Search } from "lucide-react";

type ReconPair = {
  id: number;
  pair_code: string;
  pair_name: string;
  category: string;
  active: boolean;
  source_a: string;
  source_b: string;
};

type ExceptionSummary = {
  exception_type: string;
  label: string;
  transaction_count: number;
  difference_amount: number;
};

type OverviewData = {
  trx_date: string | null;
  pair_code: string | null;
  pair_name: string | null;
  source_a: string;
  source_b: string;
  title: string;
  columns: string[];
  total_transaction_source_a: number;
  total_nominal_source_a: number;
  total_transaction_source_b: number;
  total_nominal_source_b: number;
  settlement_source_a: number;
  settlement_source_b: number;
  settlement_difference: number;
  settlement_difference_percent: number;
  source_b_settlement_total: number | null;
  source_b_file_name: string | null;
  settlement_direction: string;
  exception_summaries: ExceptionSummary[];
  rows: any[];
};

const fmtNumber = (value: number | null | undefined) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value || 0);
const fmtCurrency = (value: number | null | undefined) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);

function diffColor(value: number, direction: string) {
  if (!value) return "text-slate-400";
  const isRed = direction === "PAYABLE" ? value > 0 : value < 0;
  return isRed ? "text-red-600" : "text-emerald-600";
}

function diffBadgeColor(value: number, direction: string) {
  if (value === 0) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  const isRed = direction === "PAYABLE" ? value > 0 : value < 0;
  return isRed ? "bg-red-50 text-red-700 ring-red-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200";
}

function buildDrilldownUrl(date?: string, type?: string, sourceA?: string, sourceB?: string, pairId?: number) {
  if (!date) return "/drilldown";
  const params = new URLSearchParams({ date });
  if (type) params.set("type", type);
  if (sourceA) params.set("source_a", sourceA);
  if (sourceB) params.set("source_b", sourceB);
  if (pairId) params.set("pair_id", String(pairId));
  return `/drilldown?${params.toString()}`;
}

export default function OverviewPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [selectedPairId, setSelectedPairId] = useState<number | undefined>(undefined);
  const [filterDate, setFilterDate] = useState("");

  const { data: pairs = [] } = useQuery<ReconPair[]>({
    queryKey: ["recon-pairs"],
    queryFn: async () => (await api.get("/recon-pairs")).data,
  });

  const activePairs = useMemo(() => pairs.filter((p) => p.active), [pairs]);

  const groupedPairs = useMemo(() => {
    const groups: Record<string, ReconPair[]> = {};
    for (const pair of activePairs) {
      if (!groups[pair.category]) groups[pair.category] = [];
      groups[pair.category].push(pair);
    }
    return groups;
  }, [activePairs]);

  const { data, isLoading } = useQuery<OverviewData>({
    queryKey: ["dashboard-overview", selectedPairId, filterDate],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (selectedPairId) params.pair_id = String(selectedPairId);
      if (filterDate) {
        params.start_date = filterDate;
        params.end_date = filterDate;
      }
      return (await api.get("/dashboard/overview", { params })).data;
    },
  });

  const trxDate: string | undefined = data?.trx_date || undefined;
  const sourceA: string = data?.source_a || "BAS";
  const sourceB: string = data?.source_b || "DANA";
  const settlementDirection: string = data?.settlement_direction || "RECEIVABLE";

  const { data: drilldown } = useQuery({
    queryKey: ["overview-drilldown", trxDate],
    queryFn: async () => (await api.get("/dashboard/drilldown", { params: { trx_date: trxDate, limit: 500, offset: 0 } })).data,
    enabled: !!trxDate,
  });

  const categoryStyles: Record<string, { color: string; bg: string }> = {
    PRICE_MISMATCH: { color: "#f97316", bg: "bg-orange-50 text-orange-700 ring-orange-200" },
    DANA_ONLY_EXT_CHECK: { color: "#ef4444", bg: "bg-red-50 text-red-700 ring-red-200" },
    DB_ONLY_EXT_CHECK: { color: "#2563eb", bg: "bg-blue-50 text-blue-700 ring-blue-200" },
    FORCE_FAILED: { color: "#64748b", bg: "bg-slate-50 text-slate-700 ring-slate-200" },
  };

  const exceptionSummaries = useMemo(() => {
    return (data?.exception_summaries || [])
      .filter((es: ExceptionSummary) => es.exception_type !== "FORCE_FAILED")
      .filter((es: ExceptionSummary) => es.difference_amount !== 0)
      .map((es: ExceptionSummary) => ({
        ...es,
        style: categoryStyles[es.exception_type] || { color: "#94a3b8", bg: "bg-slate-50 text-slate-700 ring-slate-200" },
    }));
  }, [data?.exception_summaries]);

  const totalExceptionCount = exceptionSummaries.reduce((s, e) => s + e.transaction_count, 0);
  const chartRows = useMemo(() => {
    return exceptionSummaries
      .filter((e) => e.transaction_count > 0 && e.exception_type !== "FORCE_FAILED")
      .map((e) => ({ ...e, abs_amount: Math.abs(e.difference_amount) }));
  }, [exceptionSummaries]);

  const categoryOptions = useMemo(() => {
    return exceptionSummaries.map((es) => ({
      type: es.exception_type,
      label: es.label,
    }));
  }, [exceptionSummaries]);

  const topExceptions = useMemo(() => {
    const items = drilldown?.exceptions || [];
    return items
      .filter((row: any) => {
        const term = search.toLowerCase();
        const matchesSearch = !term || [row.reference_number, row.product_code, row.reason, row.exception_type].some((value) => String(value || "").toLowerCase().includes(term));
        const matchesCategory = categoryFilter === "ALL" || row.exception_type === categoryFilter;
        return matchesSearch && matchesCategory;
      })
      .slice(0, 8);
  }, [drilldown, search, categoryFilter]);

  if (isLoading && !data) return <div className="py-16 text-center text-slate-500">Loading reconciliation dashboard...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-slate-950">Reconciliation Overview</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle2 size={12} /> Completed
            </span>
          </div>
          <p className="mt-2 text-xs font-medium text-slate-600">
            {data?.pair_name || `${sourceA} ↔ ${sourceB}`}
          </p>
          <p className="mt-1 text-xs text-slate-500">Tanggal Transaksi: {trxDate || "-"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Transaction Date</span>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none ring-blue-500 transition focus:ring-2"
            />
          </div>
          <Layers size={18} className="text-slate-400" />
          <select
            value={selectedPairId ?? ""}
            onChange={(e) => setSelectedPairId(e.target.value ? Number(e.target.value) : undefined)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none ring-blue-500 transition focus:ring-2 min-w-[200px]"
          ><option value="">All Pairs</option>
            {Object.entries(groupedPairs).sort(([a], [b]) => {
              const order = ["Partner", "Internal", "Vendor"];
              return order.indexOf(a) - order.indexOf(b);
            }).map(([category, categoryPairs]) => (
              <optgroup key={category} label={category}>
                {categoryPairs.map((pair) => (
                  <option key={pair.id} value={pair.id}>
                    {pair.pair_name} ({pair.source_a} ↔ {pair.source_b})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {/* Card 1: Total Transactions Source A */}
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-600">Total Transactions ({sourceA})</p>
            <p className="mt-1.5 text-xl font-bold tracking-tight text-slate-950">{fmtNumber(data?.total_transaction_source_a)}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Total Nominal</p>
            <p className="text-xs font-medium text-slate-700">{fmtCurrency(data?.total_nominal_source_a)}</p>
          </CardContent>
        </Card>

        {/* Card 2: Total Transactions Source B */}
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-600">Total Transactions ({sourceB})</p>
            <p className="mt-1.5 text-xl font-bold tracking-tight text-slate-950">{fmtNumber(data?.total_transaction_source_b)}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Total Nominal</p>
            <p className="text-xs font-medium text-slate-700">{fmtCurrency(data?.total_nominal_source_b)}</p>
          </CardContent>
        </Card>

        {/* Card 3: Total Settlement Source A */}
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-600">Total Settlement ({sourceA})</p>
            <p className="mt-1.5 text-xl font-bold tracking-tight text-emerald-700">{fmtCurrency(data?.settlement_source_a)}</p>
          </CardContent>
        </Card>

        {/* Card 4: Total Settlement Source B */}
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-600">Total Settlement ({sourceB})</p>
            <p className="mt-1.5 text-xl font-bold tracking-tight text-emerald-700">{fmtCurrency(data?.settlement_source_b)}</p>
          </CardContent>
        </Card>

        {/* Card 5: Settlement Difference */}
        <Card
          className="border-slate-200 bg-white shadow-sm cursor-pointer transition hover:border-red-200 hover:shadow-md"
          onClick={() => { window.location.href = buildDrilldownUrl(trxDate, undefined, sourceA, sourceB, selectedPairId) + "&exclude=FORCE_FAILED"; }}
        >
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-600">Settlement Difference</p>
            <p className={`mt-1.5 text-xl font-bold tracking-tight ${diffColor(data?.settlement_difference ?? 0, settlementDirection)}`}>{fmtCurrency(data?.settlement_difference)}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Difference Percentage</p>
            <p className={`text-xs font-medium ${diffColor(data?.settlement_difference ?? 0, settlementDirection)}`}>{data?.settlement_difference_percent ?? 0}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Source B Settlement Verification Card */}
      {data?.source_b_settlement_total != null && (
        <div className="grid gap-4 grid-cols-1">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-600">Source B Settlement ({sourceB})</p>
                  <div className="mt-2 flex items-center gap-6">
                    <div>
                      <p className="text-[11px] text-slate-400">Recon</p>
                      <p className="text-sm font-bold text-slate-950">{fmtCurrency(data?.settlement_source_b)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400">Source B</p>
                      <p className="text-sm font-bold text-slate-950">{fmtCurrency(data?.source_b_settlement_total)}</p>
                    </div>
                    <div className="border-l border-slate-200 pl-4">
                      <p className="text-[11px] text-slate-400">Selisih</p>
                      <p className={`text-sm font-bold ${(data?.settlement_source_b ?? 0) - (data?.source_b_settlement_total ?? 0) !== 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {fmtCurrency(Math.abs((data?.settlement_source_b ?? 0) - (data?.source_b_settlement_total ?? 0)))}
                      </p>
                    </div>
                  </div>
                  {data?.source_b_file_name && (
                    <p className="mt-1.5 text-[10px] text-slate-400 truncate max-w-md">
                      Source file: {data.source_b_file_name}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  {((data?.settlement_source_b ?? 0) - (data?.source_b_settlement_total ?? 0) === 0) ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                      <CheckCircle2 size={12} /> Balanced
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-[11px] font-semibold text-red-700 ring-1 ring-red-200">
                      Difference Detected
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-950">Exception Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {exceptionSummaries.map((es) => {
              const percent = totalExceptionCount ? Math.min(100, (es.transaction_count / totalExceptionCount) * 100) : 0;
              return (
                <button
                  key={es.exception_type}
                  onClick={es.transaction_count > 0 ? () => { window.location.href = buildDrilldownUrl(trxDate, es.exception_type, sourceA, sourceB, selectedPairId); } : undefined}
                  className={`w-full rounded-2xl border border-slate-100 p-4 text-left transition ${es.transaction_count > 0 ? "group hover:border-blue-200 hover:bg-blue-50/40 cursor-pointer" : "opacity-50 cursor-default"}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${es.style.bg}`}>{es.label}</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: es.style.color }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-semibold tabular-nums ${diffColor(es.difference_amount, settlementDirection)}`}>{fmtCurrency(es.difference_amount)}</p>
                      <p className="text-[11px] text-slate-500">{fmtNumber(es.transaction_count)} trx</p>
                    </div>
                    <ArrowUpRight size={17} className="text-slate-400 transition group-hover:text-blue-600" />
                  </div>
                </button>
              );
            })}
            {exceptionSummaries.length > 0 && (
              <div className="mt-2 border-t border-slate-200 pt-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Total</span>
                <div className="text-right">
                  <p className="text-xs font-bold tabular-nums text-slate-950">
                    {fmtCurrency(exceptionSummaries.reduce((s, e) => s + e.difference_amount, 0))}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {fmtNumber(exceptionSummaries.reduce((s, e) => s + e.transaction_count, 0))} trx
                  </p>
                </div>
              </div>
            )}
            {exceptionSummaries.length === 0 && (
              <p className="py-8 text-center text-xs text-slate-400">All data matched — no exceptions</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-950">Root Cause Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartRows} dataKey="abs_amount" nameKey="label" innerRadius={72} outerRadius={104} paddingAngle={2}>
                    {chartRows.map((entry) => <Cell key={entry.label} fill={entry.style.color} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => [fmtCurrency(value), "Total"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {chartRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.style.color }} />{row.label}</span>
                  <span className="font-medium text-slate-950">{fmtCurrency(row.difference_amount)}</span>
                </div>
              ))}
                {chartRows.length === 0 && <p className="py-8 text-center text-xs text-slate-400">All data matched — no exceptions</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-950">Top Exception Table</CardTitle>
              <p className="mt-1 text-xs text-slate-500">Data transaksi memakai sumber drilldown yang sudah tersedia.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search transaction, product, reason..."
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none ring-blue-500 transition focus:ring-2 sm:w-72"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none ring-blue-500 transition focus:ring-2"
              >
                <option value="ALL">All Categories</option>
                {categoryOptions.map((cat) => (
                  <option key={cat.type} value={cat.type}>{cat.label}</option>
                ))}
              </select>
              <button className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700">
                <Filter size={14} /> Filters
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Dataset A ({sourceA})</TableHead>
                  <TableHead>Dataset B ({sourceB})</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topExceptions.map((row: any) => {
                  const cat = exceptionSummaries.find((es) => es.exception_type === row.exception_type);
                  return (
                    <TableRow key={row.id} className="hover:bg-slate-50/80">
                      <TableCell className="max-w-[240px] truncate font-mono text-[11px] text-slate-700">{row.reference_number || "-"}</TableCell>
                      <TableCell><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${cat?.style.bg || "bg-slate-50 text-slate-700 ring-slate-200"}`}>{cat?.label || row.exception_type}</span></TableCell>
                      <TableCell><span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">Review</span></TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-red-600 text-xs">{fmtCurrency(Math.abs(row.diff_value || row.amount || 0))}</TableCell>
                      <TableCell className="text-xs text-slate-600">{row.bas_value ? fmtCurrency(row.bas_value) : "Not Found"}</TableCell>
                      <TableCell className="text-xs text-slate-600">{row.dana_value ? fmtCurrency(row.dana_value) : "Not Found"}</TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-slate-600">{row.reason || "Requires reconciliation review"}</TableCell>
                      <TableCell className="text-right">
                        <button
                          onClick={() => { window.location.href = buildDrilldownUrl(trxDate, row.exception_type, sourceA, sourceB); }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100"
                        >
                          <Eye size={16} />
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {topExceptions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-xs text-slate-400">No exception transactions available</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

