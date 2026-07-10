"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import Link from "next/link";
import {
  ArrowRightLeft,
  Bell,
  BriefcaseBusiness,
  Calculator,
  Database,
  FileCheck2,
  Layers3,
  LogOut,
  Menu,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";

const mainItems = [
  {
    href: "/",
    label: "Reconciliation",
    description: "Dashboard & Overview",
    icon: ArrowRightLeft,
    disabled: false,
  },
  {
    label: "Settlement",
    description: "Settlement Monitoring",
    icon: WalletCards,
    disabled: true,
  },
  {
    label: "Allocating",
    description: "Allocation Monitoring",
    icon: Layers3,
    disabled: true,
  },
  {
    label: "Pricing",
    description: "Pricing Governance",
    icon: Calculator,
    disabled: true,
  },
];

const operationItems = [
  {
    href: "/import",
    label: "File Monitoring",
    description: "File Completeness",
    icon: FileCheck2,
    disabled: false,
  },
  {
    href: "/master",
    label: "Master Data",
    description: "Reference & Configuration",
    icon: BriefcaseBusiness,
    disabled: false,
  },
];

type MenuItem = {
  href?: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  disabled: boolean;
};

function SidebarSection({ title, items, onNavigate }: { title: string; items: MenuItem[]; onNavigate: () => void }) {
  return (
    <div className="space-y-2">
      <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{title}</p>
      <nav className="space-y-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const content = (
            <>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <Icon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-5">{item.label}</span>
                <span className="block truncate text-xs text-slate-400">{item.description}</span>
              </span>
            </>
          );

          if (item.disabled || !item.href) {
            return (
              <div
                key={item.label}
                className="flex cursor-not-allowed items-center gap-3 rounded-2xl px-3 py-2.5 text-slate-500 opacity-70"
                aria-disabled="true"
              >
                {content}
              </div>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-slate-200 transition hover:bg-white/10 hover:text-white"
            >
              {content}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    try {
      const decoded = jwtDecode(token);
      setUser(decoded);
    } catch {
      localStorage.removeItem("token");
      router.push("/login");
    }
  }, [router]);

  const logout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  if (!user) return null;

  return (
    <div className="flex h-screen bg-[#f5f7fb] text-slate-950">
      {sidebarOpen && (
        <button
          aria-label="Close sidebar overlay"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
        />
      )}

      <aside
        className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#061b38] text-white shadow-2xl transition-transform duration-300 lg:static lg:translate-x-0`}
      >
        <div className="flex items-center justify-between px-5 py-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-400/15 ring-1 ring-cyan-300/30">
              <Database size={21} className="text-cyan-300" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">ReconManager</h1>
              <p className="text-xs text-slate-400">Financial Operations</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 lg:hidden">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-3 py-2">
          <SidebarSection title="Main Menu" items={mainItems} onNavigate={() => setSidebarOpen(false)} />
          <SidebarSection title="Operations" items={operationItems} onNavigate={() => setSidebarOpen(false)} />
        </div>

        <div className="space-y-3 border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-700 text-sm font-semibold">
              {(user as any)?.sub?.slice(0, 2)?.toUpperCase() || "FN"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Finance Team</p>
              <p className="truncate text-xs text-slate-400">{(user as any)?.role || "Finance"}</p>
            </div>
            <ShieldCheck size={17} className="text-emerald-300" />
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-xl lg:px-7">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="rounded-xl border border-slate-200 p-2 text-slate-600 lg:hidden">
              <Menu size={20} />
            </button>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Operations Console</p>
              <p className="text-sm font-semibold text-slate-700">BAS x DANA Reconciliation</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm">
              <Bell size={18} />
              <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-[10px] font-bold text-white">3</span>
            </button>
            <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm sm:flex">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">FN</div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Finance Team</p>
                <p className="text-xs text-slate-500">{(user as any)?.sub || "Finance"}</p>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-7">{children}</main>
      </div>
    </div>
  );
}
