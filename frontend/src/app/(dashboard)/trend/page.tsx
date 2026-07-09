"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format, subDays } from "date-fns";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function TrendPage() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-trend", startDate, endDate],
    queryFn: async () => (await api.get("/dashboard/trend", { params: { start_date: startDate, end_date: endDate } })).data,
  });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Transaction Trend</h2>
      <div className="flex gap-4 mb-4">
        <div><label className="block text-xs text-slate-500 mb-1">Start</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border rounded px-3 py-1.5 text-sm" /></div>
        <div><label className="block text-xs text-slate-500 mb-1">End</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border rounded px-3 py-1.5 text-sm" /></div>
      </div>
      {isLoading ? <div className="text-center py-10 text-slate-500">Loading...</div> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Transaction Volume</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#3b82f6" name="Total" strokeWidth={2} />
                  <Line type="monotone" dataKey="success" stroke="#22c55e" name="Success" strokeWidth={2} />
                  <Line type="monotone" dataKey="pending" stroke="#eab308" name="Pending" strokeWidth={2} />
                  <Line type="monotone" dataKey="failed" stroke="#ef4444" name="Failed" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
