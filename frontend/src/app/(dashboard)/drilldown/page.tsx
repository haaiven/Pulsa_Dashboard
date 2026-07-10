"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Search } from "lucide-react";

const FIXED_COLS = ["Reference", "Kategori", "BAS (Nilai A)", "DANA (Nilai B)", "Selisih"];

const fmt = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(n);

const typeLabelMap: Record<string, string> = {
  PRICE_MISMATCH: "Harga Berbeda",
  ONLY_IN_DANA: "Ada di DANA, Tidak di BAS",
  ONLY_IN_DB: "Ada di BAS, Tidak di DANA",
  FORCE_FAILED: "Force Failed",
  DB_ONLY_EXT_CHECK: "Pengecekan Eksternal (BAS)",
  DANA_ONLY_EXT_CHECK: "Pengecekan Eksternal (DANA)",
};

const RAW_COL_BLACKLIST = new Set([
  "reff_trxid", "MERCHANT_TRANS_ID", "merchant_trans_id",
  "id", "master_code", "partner_sku", "vendor_code",
  "price", "hpp_partner", "settle", "amount",
  "selisih", "difference", "diff", "dana", "bas",
  "pay_method", "PAY_METHOD", "customer_id",
  "status", "result", "created_at",
  "TXN_DATE", "date", "MERCHANT_NAME",
  "found_in_db_h_minus_1", "found_in_db_h_plus_1",
  "settle_amount_idr", "SETTLE_AMOUNT", "TXN_AMOUNT",
]);

export default function DrilldownPage() {
  const router = useRouter();
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const date = params?.get("date") ?? null;
  const exceptionType = params?.get("type") ?? undefined;

  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
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

  if (!date) {
    return (
      <div className="text-center py-10 text-slate-500">
        Tanggal tidak ditemukan. Kembali ke <button onClick={() => router.push("/")} className="text-blue-600 hover:underline">Overview</button>.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push("/")} className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft size={16} /> Kembali
        </button>
        <h2 className="text-2xl font-bold">Drilldown Selisih</h2>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        {typeLabel
          ? `Transaksi: ${typeLabel} — ${date}`
          : `Semua transaksi yang memiliki selisih — ${date}`}
      </p>

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari reference, product, customer_id, atau nilai..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {search && (
          <button onClick={() => { setSearch(""); setOffset(0); }} className="text-xs text-slate-500 hover:text-slate-700">
            Reset
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-slate-500">Loading...</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Exception Details</h3>
                <p className="text-xs text-slate-500">
                  {search ? `Pencarian: "${search}" — ` : ""}
                  {typeLabel ? `Filter: ${typeLabel} — ` : ""}
                  {data.exceptions.length} dari {data.total} data
                </p>
              </div>
            </div>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {FIXED_COLS.map((col) => (
                      <TableHead key={col} className="whitespace-nowrap bg-slate-100">{col}</TableHead>
                    ))}
                    {dynamicCols.map((col: string) => (
                      <TableHead key={col} className="whitespace-nowrap">{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.exceptions || []).map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs max-w-[200px] truncate">{row.reference_number || "-"}</TableCell>
                      <TableCell>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700 whitespace-nowrap">
                          {typeLabelMap[row.exception_type] || row.exception_type}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{fmt(row.bas_value)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{fmt(row.dana_value)}</TableCell>
                      <TableCell className={`text-right tabular-nums font-bold ${row.diff_value < 0 ? "text-red-600" : row.diff_value > 0 ? "text-green-600" : "text-slate-400"}`}>
                        {fmt(row.diff_value)}
                      </TableCell>
                      {dynamicCols.map((col: string) => (
                        <TableCell key={col} className="max-w-xs truncate font-mono text-xs">
                          {row.raw_data?.[col] ?? "-"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {(!data?.exceptions || data.exceptions.length === 0) && (
                    <TableRow><TableCell colSpan={FIXED_COLS.length + dynamicCols.length || 1} className="text-center text-slate-400">Tidak ada data</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {data && data.total > limit && (
              <div className="flex items-center justify-center gap-4 p-4 border-t">
                <button
                  onClick={() => setOffset((o) => Math.max(0, o - limit))}
                  disabled={offset === 0}
                  className="px-4 py-1.5 text-sm rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-100"
                >
                  Sebelumnya
                </button>
                <span className="text-sm text-slate-500">
                  {(offset / limit) + 1} dari {Math.ceil(data.total / limit)}
                </span>
                <button
                  onClick={() => setOffset((o) => o + limit)}
                  disabled={offset + limit >= data.total}
                  className="px-4 py-1.5 text-sm rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-100"
                >
                  Selanjutnya
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
