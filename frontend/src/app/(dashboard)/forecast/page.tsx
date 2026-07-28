"use client";

import { useState } from "react";
import { TrendingUp, Loader2, CalendarDays, Package } from "lucide-react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ForecastRow = {
  sku: string;
  stok: number;
  total_kebutuhan: number;
  selisih: number;
  new_qty: number;
};

type ForecastResult = {
  days_used: string[];
  total_hari: number;
  forecast: ForecastRow[];
};

export default function ForecastPage() {
  const [startDate, setStartDate] = useState("2026-07-28");
  const [endDate, setEndDate] = useState("2026-07-31");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ForecastResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await api.post("/forecast", {
        start_date: startDate,
        end_date: endDate,
      });
      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Gagal mendapat hasil forecast");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-950">Pulsa Forecast</h2>
        <p className="mt-1 text-sm text-slate-500">Proyeksi kebutuhan inventory pulsa per SKU berdasarkan rentang tanggal</p>
      </div>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="p-5">
          <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <TrendingUp size={16} />}
              {loading ? "Memproses..." : "Forecast"}
            </button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-red-700">{error}</p>
            {error.includes("DEEPSEEK_API_KEY") && (
              <p className="mt-2 text-xs text-red-500">Pastikan environment variable DEEPSEEK_API_KEY sudah dikonfigurasi di Railway.</p>
            )}
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-base font-bold text-slate-950">Hasil Proyeksi</CardTitle>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-200">
                <CalendarDays size={14} />
                {result.total_hari} hari
              </span>
              <span className="text-xs text-slate-500">
                {result.days_used.join(" · ")}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-mono text-xs font-semibold">SKU</TableHead>
                    <TableHead className="text-right text-xs">Stok</TableHead>
                    <TableHead className="text-right text-xs">Total Kebutuhan ({result.total_hari} Hari)</TableHead>
                    <TableHead className="text-right text-xs">Selisih</TableHead>
                    <TableHead className="text-right text-xs">New Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.forecast.map((row) => (
                    <TableRow key={row.sku} className="hover:bg-slate-50/80">
                      <TableCell>
                        <span className="inline-flex items-center gap-2 font-mono text-sm font-semibold text-slate-900">
                          <Package size={15} className="text-slate-400" />
                          {row.sku}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-slate-700">
                        {row.stok.toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-slate-700">
                        {row.total_kebutuhan.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums text-sm font-semibold ${row.selisih > 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {row.selisih > 0 ? "+" : ""}{row.selisih.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={`inline-flex rounded-lg px-2.5 py-1 text-sm font-bold ${row.new_qty > 0 ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200" : "bg-slate-100 text-slate-500"}`}>
                          {row.new_qty.toLocaleString("id-ID")}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {!result && !error && !loading && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-slate-100 text-slate-400">
            <TrendingUp size={30} />
          </div>
          <p className="mt-4 text-sm font-medium text-slate-500">Pilih rentang tanggal dan klik Forecast untuk melihat hasil proyeksi</p>
        </div>
      )}
    </div>
  );
}
