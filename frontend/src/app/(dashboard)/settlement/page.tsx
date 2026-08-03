"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, Calculator, TrendingDown, TrendingUp } from "lucide-react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ReconPair = { id: number; pair_code: string; pair_name: string; category: string; active: boolean };

type OverviewData = {
  trx_date: string | null;
  source_a: string;
  source_b: string;
  pair_code: string | null;
  pair_name: string | null;
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
};

export default function SettlementPage() {
  const [selectedPairId, setSelectedPairId] = useState<number>(1);

  const { data: pairs = [] } = useQuery<ReconPair[]>({
    queryKey: ["recon-pairs"],
    queryFn: async () => (await api.get("/recon-pairs")).data,
  });

  const activePairs = useMemo(() => pairs.filter((p) => p.active), [pairs]);

  const { data, isLoading } = useQuery<OverviewData>({
    queryKey: ["settlement-overview", selectedPairId],
    queryFn: async () => (await api.get("/dashboard/overview", { params: { pair_id: selectedPairId } })).data,
    enabled: selectedPairId > 0,
  });

  const formatCurrency = (v: number | null | undefined) => {
    if (v == null || v === 0) return "-";
    return `Rp ${Math.abs(v).toLocaleString("id-ID")}`;
  };

  const formatNumber = (v: number | null | undefined) => {
    if (v == null) return "-";
    return v.toLocaleString("id-ID");
  };

  const internalTotal = (data?.settlement_source_a || 0) + (data?.settlement_source_b || 0);
  const partnerSettlement = data?.source_b_settlement_total || 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-950">Settlement Monitoring</h2>
        <p className="mt-1 text-sm text-slate-500">Perbandingan internal settlement vs partner settlement</p>
      </div>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500">Select Pair</span>
              <select
                value={selectedPairId}
                onChange={(e) => setSelectedPairId(Number(e.target.value))}
                className="h-10 w-64 rounded-xl border border-slate-200 px-3 text-sm shadow-sm"
              >
                {activePairs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.pair_name} ({p.pair_code})
                  </option>
                ))}
              </select>
            </label>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-12 text-center text-slate-500">Loading...</CardContent>
        </Card>
      ) : data && data.trx_date ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-slate-500">Transaction Date</p>
                <p className="mt-2 text-xl font-bold text-slate-950">{data.trx_date}</p>
                <p className="mt-1 text-xs text-slate-400">{data.pair_name}</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft size={16} className="text-blue-500" />
                  <p className="text-xs font-medium text-slate-500">Total Transactions</p>
                </div>
                <p className="mt-2 text-xl font-bold text-slate-950">{formatNumber(data.total_transaction_source_a)}</p>
                <p className="text-xs text-slate-400">{data.source_a} side</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Calculator size={16} className="text-amber-500" />
                  <p className="text-xs font-medium text-slate-500">Internal Settlement</p>
                </div>
                <p className="mt-2 text-xl font-bold text-slate-950">{formatCurrency(internalTotal)}</p>
                <p className="text-xs text-slate-400">{data.source_a} settlement</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Calculator size={16} className="text-emerald-500" />
                  <p className="text-xs font-medium text-slate-500">Partner Settlement</p>
                </div>
                <p className="mt-2 text-xl font-bold text-slate-950">{formatCurrency(partnerSettlement)}</p>
                <p className="text-xs text-slate-400">{data.source_b_file_name || "-"}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-slate-500">{data.source_a} Settlement</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{formatCurrency(data.settlement_source_a)}</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-slate-500">{data.source_b} Settlement</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{formatCurrency(data.settlement_source_b)}</p>
              </CardContent>
            </Card>

            <Card className={`shadow-sm ${data.settlement_difference >= 0 ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  {data.settlement_difference >= 0 ? <TrendingUp size={16} className="text-emerald-600" /> : <TrendingDown size={16} className="text-red-600" />}
                  <p className="text-xs font-medium text-slate-600">Difference</p>
                </div>
                <p className={`mt-2 text-2xl font-bold ${data.settlement_difference >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatCurrency(data.settlement_difference)}</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-slate-500">Difference %</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{data.settlement_difference_percent}%</p>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-12 text-center">
            <p className="text-lg font-medium text-slate-400">No settlement data available</p>
            <p className="mt-1 text-sm text-slate-400">Upload recon files and merchant settlement to see comparison</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
