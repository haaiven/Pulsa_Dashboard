"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import Link from "next/link";
import {
  LayoutDashboard,
  TrendingUp,
  CalendarDays,
  CalendarRange,
  Calendar,
  Upload,
  Database,
  AlertTriangle,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const sidebarItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/daily", label: "Harian", icon: Calendar },
  { href: "/weekly", label: "Mingguan", icon: CalendarRange },
  { href: "/monthly", label: "Bulanan", icon: CalendarDays },
  { href: "/trend", label: "Trend", icon: TrendingUp },
  { href: "/recon", label: "Recon", icon: Database },
  { href: "/exceptions", label: "Exception", icon: AlertTriangle },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/master", label: "Master Data", icon: Database },
];

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
    <div className="flex h-screen">
      <aside className={`${sidebarOpen ? "block" : "hidden"} lg:block fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white p-4 overflow-y-auto`}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-bold">Pulsa Recon</h1>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden"><X size={20} /></button>
        </div>
        <nav className="space-y-1">
          {sidebarItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-4 left-4 right-4">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-800 hover:text-white w-full transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b px-6 py-3 flex items-center gap-4 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden"><Menu size={20} /></button>
          <span className="text-sm text-slate-500">{(user as any)?.role || "user"} | {(user as any)?.sub || ""}</span>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
