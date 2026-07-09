"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";

type SummaryRow = {
  id: number;
  row_order: number;
  no: string;
  description: string;
  unit: string;
  bas_value: number | null;
  dana_value: number | null;
  is_section: boolean;
};

const formatNumber = (value: number | null) => {
  if (value === null || value === undefined) return "";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value);
};

const isHighlightedRow = (row: SummaryRow) => {
  if (row.is_section) return true;
  if (!row.no) return false;
  return !row.description.startsWith("  ");
};

export default function OverviewPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: async () => (await api.get("/dashboard/overview")).data,
  });

  if (isLoading) return <div className="text-center py-10 text-slate-500">Loading...</div>;

  const rows: SummaryRow[] = data?.rows || [];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Dashboard Overview</h2>
        <p className="text-sm text-slate-500 mt-1">Data Overview mengikuti sheet summary Excel.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b">
            <h3 className="font-bold text-slate-900">{data?.title || "REKONSILIASI BAS x DANA"}</h3>
            <p className="text-sm text-slate-600 mt-1">
              Tanggal Transaksi: {data?.trx_date || "-"}
            </p>
          </div>

          <div className="overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-blue-700 text-white">
                  <th className="border border-slate-500 px-2 py-2 text-left w-16">No.</th>
                  <th className="border border-slate-500 px-2 py-2 text-left min-w-96">DESKRIPSI</th>
                  <th className="border border-slate-500 px-2 py-2 text-center w-20">Unit</th>
                  <th className="border border-slate-500 px-2 py-2 text-right min-w-44">BAS (DANABAS)</th>
                  <th className="border border-slate-500 px-2 py-2 text-right min-w-52">DANA (DASHBOARD DANA)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const highlighted = isHighlightedRow(row);
                  return (
                    <tr key={row.id} className={highlighted ? "bg-blue-100 font-semibold" : "bg-white"}>
                      <td className="border border-slate-400 px-2 py-1 text-right align-middle">{row.no}</td>
                      <td className="border border-slate-400 px-2 py-1 align-middle whitespace-pre-wrap">{row.description}</td>
                      <td className="border border-slate-400 px-2 py-1 text-center align-middle">{row.unit}</td>
                      <td className="border border-slate-400 px-2 py-1 text-right align-middle tabular-nums">{formatNumber(row.bas_value)}</td>
                      <td className="border border-slate-400 px-2 py-1 text-right align-middle tabular-nums">{formatNumber(row.dana_value)}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="border border-slate-300 px-4 py-10 text-center text-slate-400">
                      Belum ada data. Upload file Excel melalui menu Import.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
