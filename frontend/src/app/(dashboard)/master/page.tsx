"use client";

import { useState } from "react";
import type React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, Plus, Power, Trash2, X } from "lucide-react";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ReconPair = {
  id: number;
  pair_code: string;
  pair_name: string;
  category: string;
  product: string;
  source_a: string;
  source_b: string;
  active: boolean;
};

type ExpectedFile = {
  id: number;
  recon_pair_id: number;
  pair_code?: string;
  pair_name?: string;
  file_type: string;
  source: string;
  expected_filename_pattern: string;
  required: boolean;
  active: boolean;
};

const emptyPair = { pair_code: "", pair_name: "", category: "Partner", product: "pulsa", source_a: "", source_b: "", active: true };
const emptyExpectedFile = { recon_pair_id: 0, file_type: "INTERNAL_RECON_FILE", source: "", expected_filename_pattern: "", required: true, active: true };

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex rounded-lg px-3 py-1 text-sm font-semibold ring-1 ${active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-white text-slate-900 ring-slate-900"}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const classes: Record<string, string> = {
    Internal: "bg-purple-50 text-purple-700 ring-purple-200",
    Partner: "bg-blue-50 text-blue-700 ring-blue-200",
    Vendor: "bg-amber-50 text-amber-700 ring-amber-200",
  };
  return <span className={`rounded-lg px-3 py-1 text-xs font-bold uppercase ring-1 ${classes[category] || "bg-slate-50 text-slate-700 ring-slate-200"}`}>{category}</span>;
}

export default function MasterPage() {
  const [activeTab, setActiveTab] = useState<"pairs" | "files">("pairs");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-950">Reconciliation Master Data</h2>
        <p className="mt-2 text-sm text-slate-500">Manage recon pairs and expected-file registry as dynamic reconciliation configuration.</p>
      </div>

      <div className="inline-flex rounded-2xl bg-slate-100 p-1">
        <button onClick={() => setActiveTab("pairs")} className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${activeTab === "pairs" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>Recon Pair</button>
        <button onClick={() => setActiveTab("files")} className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${activeTab === "files" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>Expected Files</button>
      </div>

      {activeTab === "pairs" ? <ReconPairTab /> : <ExpectedFilesTab />}
    </div>
  );
}

function ReconPairTab() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ReconPair | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const { data = [], isLoading } = useQuery<ReconPair[]>({
    queryKey: ["recon-pairs"],
    queryFn: async () => (await api.get("/recon-pairs")).data,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/recon-pairs/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recon-pairs"] }),
  });

  const toggleMutation = useMutation({
    mutationFn: async (row: ReconPair) => api.patch(`/recon-pairs/${row.id}/active`, null, { params: { active: !row.active } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recon-pairs"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setEditing(null); setFormOpen(true); }} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">
          <Plus size={17} /> New Pair
        </button>
      </div>
      <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-slate-500">Loading...</div> : (
            <div className="overflow-auto">
              <Table>
                <TableHeader><TableRow className="bg-slate-50"><TableHead>Pair Code</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Sources</TableHead><TableHead>Product</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.map((row) => (
                    <TableRow key={row.id} className="hover:bg-slate-50/80">
                      <TableCell className="font-mono font-semibold text-slate-900">{row.pair_code}</TableCell>
                      <TableCell className="font-semibold text-slate-900">{row.pair_name}</TableCell>
                      <TableCell><CategoryBadge category={row.category} /></TableCell>
                      <TableCell className="text-slate-500">{row.source_a} ↔ {row.source_b}</TableCell>
                      <TableCell>{row.product}</TableCell>
                      <TableCell><StatusBadge active={row.active} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => toggleMutation.mutate(row)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" title="Activate / Deactivate"><Power size={17} /></button>
                          <button onClick={() => { setEditing(row); setFormOpen(true); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><Edit3 size={17} /></button>
                          <button onClick={() => { if (confirm("Delete this recon pair?")) deleteMutation.mutate(row.id); }} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={17} /></button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {formOpen && <ReconPairForm initial={editing} onClose={() => setFormOpen(false)} />}
    </div>
  );
}

function ReconPairForm({ initial, onClose }: { initial: ReconPair | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<any>(initial || emptyPair);
  const saveMutation = useMutation({
    mutationFn: async () => initial ? api.put(`/recon-pairs/${initial.id}`, form) : api.post("/recon-pairs", form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["recon-pairs"] }); onClose(); },
  });

  return (
    <Modal title={initial ? "Edit Recon Pair" : "New Recon Pair"} onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Pair Code" value={form.pair_code} onChange={(v) => setForm({ ...form, pair_code: v })} />
        <Field label="Pair Name" value={form.pair_name} onChange={(v) => setForm({ ...form, pair_name: v })} />
        <SelectField label="Category" value={form.category} options={["Internal", "Partner", "Vendor"]} onChange={(v) => setForm({ ...form, category: v })} />
        <Field label="Product" value={form.product} onChange={(v) => setForm({ ...form, product: v })} />
        <Field label="Source A" value={form.source_a} onChange={(v) => setForm({ ...form, source_a: v })} />
        <Field label="Source B" value={form.source_b} onChange={(v) => setForm({ ...form, source_b: v })} />
      </div>
      <Toggle label="Active" checked={form.active} onChange={(active) => setForm({ ...form, active })} />
      <FormActions onCancel={onClose} onSave={() => saveMutation.mutate()} saving={saveMutation.isPending} />
    </Modal>
  );
}

function ExpectedFilesTab() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ExpectedFile | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const { data: pairs = [] } = useQuery<ReconPair[]>({ queryKey: ["recon-pairs"], queryFn: async () => (await api.get("/recon-pairs")).data });
  const { data = [], isLoading } = useQuery<ExpectedFile[]>({ queryKey: ["expected-files"], queryFn: async () => (await api.get("/expected-files")).data });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/expected-files/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expected-files"] }),
  });
  const toggleMutation = useMutation({
    mutationFn: async (row: ExpectedFile) => api.patch(`/expected-files/${row.id}/active`, null, { params: { active: !row.active } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expected-files"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setEditing(null); setFormOpen(true); }} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">
          <Plus size={17} /> New Expected File
        </button>
      </div>
      <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-slate-500">Loading...</div> : (
            <div className="overflow-auto">
              <Table>
                <TableHeader><TableRow className="bg-slate-50"><TableHead>Pair</TableHead><TableHead>File Type</TableHead><TableHead>Source</TableHead><TableHead>Filename Pattern</TableHead><TableHead>Required</TableHead><TableHead>Active</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.map((row) => (
                    <TableRow key={row.id} className="hover:bg-slate-50/80">
                      <TableCell className="font-mono font-semibold text-slate-900">{row.pair_code || row.recon_pair_id}</TableCell>
                      <TableCell className="font-mono text-sm">{row.file_type}</TableCell>
                      <TableCell>{row.source}</TableCell>
                      <TableCell className="font-mono text-sm text-slate-500">{row.expected_filename_pattern}</TableCell>
                      <TableCell>{row.required ? "Yes" : "No"}</TableCell>
                      <TableCell><StatusBadge active={row.active} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => toggleMutation.mutate(row)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><Power size={17} /></button>
                          <button onClick={() => { setEditing(row); setFormOpen(true); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><Edit3 size={17} /></button>
                          <button onClick={() => { if (confirm("Delete this expected file?")) deleteMutation.mutate(row.id); }} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={17} /></button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {formOpen && <ExpectedFileForm initial={editing} pairs={pairs} onClose={() => setFormOpen(false)} />}
    </div>
  );
}

function ExpectedFileForm({ initial, pairs, onClose }: { initial: ExpectedFile | null; pairs: ReconPair[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<any>(initial || { ...emptyExpectedFile, recon_pair_id: pairs[0]?.id || 0 });
  const saveMutation = useMutation({
    mutationFn: async () => initial ? api.put(`/expected-files/${initial.id}`, form) : api.post("/expected-files", form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["expected-files"] }); onClose(); },
  });

  return (
    <Modal title={initial ? "Edit Expected File" : "New Expected File"} onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Recon Pair" value={String(form.recon_pair_id)} options={pairs.map((pair) => ({ label: `${pair.pair_code} - ${pair.pair_name}`, value: String(pair.id) }))} onChange={(v) => setForm({ ...form, recon_pair_id: Number(v) })} />
        <Field label="File Type" value={form.file_type} onChange={(v) => setForm({ ...form, file_type: v })} />
        <Field label="Source" value={form.source} onChange={(v) => setForm({ ...form, source: v })} />
        <Field label="Filename Pattern" value={form.expected_filename_pattern} onChange={(v) => setForm({ ...form, expected_filename_pattern: v })} />
      </div>
      <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-700">Supported tokens: DDMMYYYY, YYYYMMDD, DD_MON_YYYY, {'{MID}'}, *</p>
      <div className="mt-4 flex gap-6"><Toggle label="Required" checked={form.required} onChange={(required) => setForm({ ...form, required })} /><Toggle label="Active" checked={form.active} onChange={(active) => setForm({ ...form, active })} /></div>
      <FormActions onCancel={onClose} onSave={() => saveMutation.mutate()} saving={saveMutation.isPending} />
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/40 p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-5"><h3 className="text-lg font-bold text-slate-950">{title}</h3><button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button></div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-semibold text-slate-700">{label}<input value={value || ""} onChange={(e) => onChange(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none ring-blue-500 focus:ring-2" /></label>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<string | { label: string; value: string }>; onChange: (value: string) => void }) {
  return <label className="block text-sm font-semibold text-slate-700">{label}<select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none ring-blue-500 focus:ring-2">{options.map((option) => typeof option === "string" ? <option key={option} value={option}>{option}</option> : <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />{label}</label>;
}

function FormActions({ onCancel, onSave, saving }: { onCancel: () => void; onSave: () => void; saving: boolean }) {
  return <div className="mt-6 flex justify-end gap-3"><button onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button><button onClick={onSave} disabled={saving} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving..." : "Save"}</button></div>;
}
