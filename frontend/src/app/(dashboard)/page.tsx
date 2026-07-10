"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Eye, Filter, Search, ShieldCheck, TrendingUp, WalletCards } from "lucide-react";

type SummaryRow = {
  id: number;
  row_order: number;
  no: string;
  description: string;
  unit: string;
  bas_value: number | null;
  dana_value: number | null;
  chksum_value: number | null;
  is_section: boolean;
};

type ExceptionCategory = {
  label: string;
  type?: string;
  keywords: string[];
  color: string;
  bg: string;
};

const categories: ExceptionCategory[] = [
  { label: "Amount Difference", type: "PRICE_MISMATCH", keywords: ["BEDA HARGA", "AMOUNT DIFFERENCE", "HARGA BERBEDA"], color: "#f97316", bg: "bg-orange-50 text-orange-700 ring-orange-200" },
  { label: "Missing in Dataset A", type: "ONLY_IN_DANA", keywords: ["ADA DI DANA", "MISSING IN BAS", "TIDAK DI BAS"], color: "#ef4444", bg: "bg-red-50 text-red-700 ring-red-200" },
  { label: "Missing in Dataset B", type: "ONLY_IN_DB", keywords: ["ADA DI BAS", "MISSING IN DANA", "TIDAK DI DANA"], color: "#2563eb", bg: "bg-blue-50 text-blue-700 ring-blue-200" },
  { label: "Cutoff H+1", keywords: ["CUTOFF", "H+1"], color: "#eab308", bg: "bg-yellow-50 text-yellow-700 ring-yellow-200" },
  { label: "Force Failed", type: "FORCE_FAILED", keywords: ["FORCE FAILED"], color: "#64748b", bg: "bg-slate-50 text-slate-700 ring-slate-200" },
];

const fmtNumber = (value: number | null | undefined) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value || 0);
const fmtCurrency = (value: number | null | undefined) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);

function normalize(value: string) {
  return value.toUpperCase().replace(/\s+/g, " ").trim();
}

function rowValue(row?: SummaryRow, prefer: "bas" | "dana" | "diff" = "bas") {
  if (!row) return 0;
  if (prefer === "dana") return row.dana_value ?? row.bas_value ?? row.chksum_value ?? 0;
  if (prefer === "diff") return Math.abs(row.chksum_value ?? 0);
  return row.bas_value ?? row.dana_value ?? row.chksum_value ?? 0;
}

function findRow(rows: SummaryRow[], keywords: string[], unit?: string) {
  return rows.find((row) => {
    const description = normalize(row.description);
    const unitMatches = !unit || normalize(row.unit) === normalize(unit);
    return unitMatches && keywords.some((keyword) => description.includes(normalize(keyword)));
  });
}

function buildDrilldownUrl(date?: string, type?: string) {
  if (!date) return "/drilldown";
  const params = new URLSearchParams({ date });
  if (type) params.set("type", type);
  return `/drilldown?${params.toString()}`;
}

export default function OverviewPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: async () => (await api.get("/dashboard/overview")).data,
  });

  const rows: SummaryRow[] = data?.rows || [];
  const trxDate: string | undefined = data?.trx_date;

  const { data: drilldown } = useQuery({
    queryKey: ["overview-drilldown", trxDate],
    queryFn: async () => (await api.get("/dashboard/drilldown", { params: { trx_date: trxDate, limit: 500, offset: 0 } })).data,
    enabled: !!trxDate,
  });

  const totalTransactions = rowValue(findRow(rows, ["TOTAL TRANSAKSI", "TOTAL TRANSACTION"], "#"));
  const matchedTransactions = rowValue(findRow(rows, ["STATUS: SUCCESS", "SUCCESS"], "#"));
  const exceptionRows = useMemo(() => {
    return categories.map((category) => {
      const row = findRow(rows, category.keywords, "#") || findRow(rows, category.keywords);
      const amountRow = findRow(rows, category.keywords, "RP.") || row;
      return {
        ...category,
        count: rowValue(row),
        exposure: rowValue(amountRow, "diff") || rowValue(amountRow, "dana") || rowValue(amountRow, "bas"),
      };
    });
  }, [rows]);
  const totalExceptions = rowValue(findRow(rows, ["TOTAL EXCEPTION", "TOTAL SELISIH", "TOTAL DATA SELISIH"], "#")) || exceptionRows.reduce((sum, row) => sum + row.count, 0);
  const totalExposure = rowValue(findRow(rows, ["TOTAL EXPOSURE", "TOTAL SELISIH", "TOTAL CHKSUM"], "RP."), "diff") || exceptionRows.reduce((sum, row) => sum + row.exposure, 0);
  const chartRows = exceptionRows.filter((row) => row.count > 0 || row.exposure > 0);

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

  if (isLoading) return <div className="py-16 text-center text-slate-500">Loading reconciliation dashboard...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight text-slate-950">Reconciliation Overview</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle2 size={13} /> Completed
            </span>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-600">BAS (DANABAS) <span className="mx-2 text-slate-400">↔</span> DANA (DASHBOARD DANA)</p>
          <p className="mt-1 text-sm text-slate-500">Tanggal Transaksi: {trxDate || "-"}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Total Transactions" value={fmtNumber(totalTransactions)} helper="100% dari total data" icon={<TrendingUp size={23} />} tone="blue" />
        <KpiCard title="Matched Transactions" value={fmtNumber(matchedTransactions)} helper={`${totalTransactions ? ((matchedTransactions / totalTransactions) * 100).toFixed(2) : "0.00"}% dari total`} icon={<ShieldCheck size={23} />} tone="emerald" />
        <KpiCard title="Total Exceptions" value={fmtNumber(totalExceptions)} helper={`${totalTransactions ? ((totalExceptions / totalTransactions) * 100).toFixed(2) : "0.00"}% dari total`} icon={<AlertTriangle size={23} />} tone="orange" />
        <KpiCard title="Total Exposure" value={fmtCurrency(totalExposure)} helper="Total selisih transaksi" icon={<WalletCards size={23} />} tone="violet" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-950">Exception Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {exceptionRows.map((category) => {
              const percent = totalExceptions ? Math.min(100, (category.count / totalExceptions) * 100) : 0;
              return (
                <button
                  key={category.label}
                  onClick={() => { window.location.href = buildDrilldownUrl(trxDate, category.type); }}
                  className="group w-full rounded-2xl border border-slate-100 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50/40"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${category.bg}`}>{category.label}</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: category.color }} />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold tabular-nums text-slate-950">{fmtNumber(category.count)} trx</p>
                      <p className="text-xs text-slate-500">{percent.toFixed(2)}%</p>
                    </div>
                    <ArrowUpRight size={17} className="text-slate-400 transition group-hover:text-blue-600" />
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-950">Root Cause Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartRows} dataKey="count" nameKey="label" innerRadius={72} outerRadius={104} paddingAngle={2}>
                    {chartRows.map((entry) => <Cell key={entry.label} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${fmtNumber(value)} trx`, "Total"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {chartRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />{row.label}</span>
                  <span className="font-semibold text-slate-950">{fmtNumber(row.count)}</span>
                </div>
              ))}
              {chartRows.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No exception distribution available</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-950">Top Exception Table</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Data transaksi memakai sumber drilldown yang sudah tersedia.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search transaction, product, reason..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none ring-blue-500 transition focus:ring-2 sm:w-80"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-500 transition focus:ring-2"
              >
                <option value="ALL">All Categories</option>
                {categories.filter((category) => category.type).map((category) => (
                  <option key={category.type} value={category.type}>{category.label}</option>
                ))}
              </select>
              <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">
                <Filter size={15} /> Filters
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
                  <TableHead>Dataset A (BAS)</TableHead>
                  <TableHead>Dataset B (DANA)</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topExceptions.map((row: any) => {
                  const category = categories.find((item) => item.type === row.exception_type);
                  return (
                    <TableRow key={row.id} className="hover:bg-slate-50/80">
                      <TableCell className="max-w-[240px] truncate font-mono text-xs text-slate-700">{row.reference_number || "-"}</TableCell>
                      <TableCell><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${category?.bg || "bg-slate-50 text-slate-700 ring-slate-200"}`}>{category?.label || row.exception_type}</span></TableCell>
                      <TableCell><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">Review</span></TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-red-600">{fmtCurrency(Math.abs(row.diff_value || row.amount || 0))}</TableCell>
                      <TableCell className="text-sm text-slate-600">{row.bas_value ? fmtCurrency(row.bas_value) : "Not Found"}</TableCell>
                      <TableCell className="text-sm text-slate-600">{row.dana_value ? fmtCurrency(row.dana_value) : "Not Found"}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-slate-600">{row.reason || "Requires reconciliation review"}</TableCell>
                      <TableCell className="text-right">
                        <button
                          onClick={() => { window.location.href = buildDrilldownUrl(trxDate, row.exception_type); }}
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
                    <TableCell colSpan={8} className="py-12 text-center text-slate-400">No exception transactions available</TableCell>
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

function KpiCard({ title, value, helper, icon, tone }: { title: string; value: string; helper: string; icon: React.ReactNode; tone: "blue" | "emerald" | "orange" | "violet" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    orange: "bg-orange-50 text-orange-700 ring-orange-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
  };

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-600">{title}</p>
          <p className="mt-3 truncate text-2xl font-bold tracking-tight text-slate-950">{value}</p>
          <p className="mt-2 text-sm text-slate-500">{helper}</p>
        </div>
        <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-full ring-1 ${tones[tone]}`}>{icon}</div>
      </CardContent>
    </Card>
  );
}
