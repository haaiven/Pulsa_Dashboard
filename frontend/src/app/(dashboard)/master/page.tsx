"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const tabs = ["Providers", "Aggregators", "Switch Platforms", "Agents", "Channels", "Products", "Routes"];

function MasterTable({ endpoint, columns }: { endpoint: string; columns: string[] }) {
  const { data, isLoading } = useQuery({
    queryKey: [endpoint],
    queryFn: async () => (await api.get(endpoint)).data,
  });

  if (isLoading) return <div className="p-6 text-slate-500">Loading...</div>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead key={col}>{col.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {(data || []).map((row: any, i: number) => (
          <TableRow key={row.id || i}>
            {columns.map((col) => (
              <TableCell key={col}>
                {typeof row[col] === "boolean" ? (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${row[col] ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {row[col] ? "Active" : "Inactive"}
                  </span>
                ) : (
                  String(row[col] ?? "-")
                )}
              </TableCell>
            ))}
          </TableRow>
        ))}
        {(!data || data.length === 0) && <TableRow><TableCell colSpan={columns.length} className="text-center text-slate-400">No data</TableCell></TableRow>}
      </TableBody>
    </Table>
  );
}

const masterConfig: Record<string, { endpoint: string; columns: string[] }> = {
  Providers: { endpoint: "/providers", columns: ["id", "code", "name", "active"] },
  Aggregators: { endpoint: "/aggregators", columns: ["id", "code", "name", "active"] },
  "Switch Platforms": { endpoint: "/switch-platforms", columns: ["id", "code", "name", "location", "active"] },
  Agents: { endpoint: "/agents", columns: ["id", "code", "name", "active"] },
  Channels: { endpoint: "/channels", columns: ["id", "agent_id", "code", "name", "active"] },
  Products: { endpoint: "/products", columns: ["id", "provider_id", "category", "code", "name", "nominal", "active"] },
  Routes: { endpoint: "/routes", columns: ["id", "provider_id", "aggregator_id", "switch_platform_id", "agent_id", "channel_id", "product_id", "priority", "active"] },
};

export default function MasterPage() {
  const [activeTab, setActiveTab] = useState("Providers");
  const config = masterConfig[activeTab];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Master Data</h2>
      <div className="flex gap-1 mb-4 border-b overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <Card>
        <CardContent className="p-0">
          <MasterTable endpoint={config.endpoint} columns={config.columns} />
        </CardContent>
      </Card>
    </div>
  );
}
