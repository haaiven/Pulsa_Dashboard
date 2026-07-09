"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const fmt = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(n);

export default function ReconPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-recon"],
    queryFn: async () => (await api.get("/dashboard/recon")).data,
  });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Reconciliation Results</h2>
      {isLoading ? <div className="text-center py-10 text-slate-500">Loading...</div> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead><TableHead>Description</TableHead>
                <TableHead className="text-right">System Value</TableHead><TableHead className="text-right">External Value</TableHead>
                <TableHead className="text-right">Difference</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data || []).map((row: any) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.recon_type}</TableCell>
                  <TableCell className="max-w-xs truncate">{row.description}</TableCell>
                  <TableCell className="text-right">{fmt(row.system_value)}</TableCell>
                  <TableCell className="text-right">{fmt(row.external_value)}</TableCell>
                  <TableCell className="text-right text-red-600">{fmt(row.difference)}</TableCell>
                  <TableCell><span className={`px-2 py-0.5 rounded-full text-xs ${row.status === "MATCH" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{row.status}</span></TableCell>
                </TableRow>
              ))}
              {(!data || data.length === 0) && <TableRow><TableCell colSpan={6} className="text-center text-slate-400">No data</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
