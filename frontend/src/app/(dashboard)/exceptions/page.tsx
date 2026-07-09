"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const fmt = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(n);

export default function ExceptionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["exceptions"],
    queryFn: async () => (await api.get("/exceptions")).data,
  });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Exception Details</h2>
      {isLoading ? <div className="text-center py-10 text-slate-500">Loading...</div> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead><TableHead>Reference</TableHead><TableHead>Product</TableHead>
                <TableHead className="text-right">Amount</TableHead><TableHead>Reason</TableHead><TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data || []).map((row: any) => (
                <TableRow key={row.id}>
                  <TableCell><span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700">{row.exception_type}</span></TableCell>
                  <TableCell>{row.reference_number}</TableCell>
                  <TableCell>{row.product_code}</TableCell>
                  <TableCell className="text-right">{fmt(row.amount)}</TableCell>
                  <TableCell className="max-w-xs truncate">{row.reason}</TableCell>
                  <TableCell className="text-xs text-slate-500">{row.created_at ? new Date(row.created_at).toLocaleDateString() : "-"}</TableCell>
                </TableRow>
              ))}
              {(!data || data.length === 0) && <TableRow><TableCell colSpan={6} className="text-center text-slate-400">No exceptions</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
