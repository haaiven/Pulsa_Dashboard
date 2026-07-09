"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format, subDays } from "date-fns";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const fmt = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(n);

export default function MonthlyPage() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 365), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-monthly", startDate, endDate],
    queryFn: async () => (await api.get("/dashboard/monthly", { params: { start_date: startDate, end_date: endDate } })).data,
  });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard Bulanan</h2>
      <div className="flex gap-4 mb-4">
        <div><label className="block text-xs text-slate-500 mb-1">Start</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border rounded px-3 py-1.5 text-sm" /></div>
        <div><label className="block text-xs text-slate-500 mb-1">End</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border rounded px-3 py-1.5 text-sm" /></div>
      </div>
      {isLoading ? <div className="text-center py-10 text-slate-500">Loading...</div> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Success</TableHead><TableHead className="text-right">Pending</TableHead><TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">Gross</TableHead><TableHead className="text-right">Settlement</TableHead><TableHead className="text-right">Difference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data || []).map((row: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{row.month}</TableCell>
                  <TableCell className="text-right">{row.total_transaction?.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-green-600">{row.success_transaction?.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-yellow-600">{row.pending_transaction?.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-red-600">{row.failed_transaction?.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{fmt(row.gross_amount)}</TableCell>
                  <TableCell className="text-right">{fmt(row.settlement_amount)}</TableCell>
                  <TableCell className="text-right text-orange-600">{fmt(row.difference_amount)}</TableCell>
                </TableRow>
              ))}
              {(!data || data.length === 0) && <TableRow><TableCell colSpan={8} className="text-center text-slate-400">No data</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
