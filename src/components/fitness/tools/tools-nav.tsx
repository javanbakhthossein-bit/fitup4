"use client";

import { Dumbbell, Calculator, Apple, Home } from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { pushScreen, replaceScreen, type NavScreen } from "@/lib/fitness/navigation";

const TOOLS = [
  { id: "tool-tdee" as const, label: "محاسبه‌گر کالری", icon: Calculator, url: "tdee" },
  { id: "tool-exercises" as const, label: "بانک حرکات", icon: Dumbbell, url: "exercises" },
  { id: "tool-foods" as const, label: "کالری غذاها", icon: Apple, url: "foods" },
];

export function ToolsNav() {
  const { screen, setScreen } = useAppStore();

  function goToTool(toolId: typeof TOOLS[number]["id"], toolUrl: string) {
    setScreen(toolId);
    pushScreen(toolId, { tool: toolUrl });
  }

  function goHome() {
    setScreen("landing");
    replaceScreen("landing");
  }

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-xl border-b shadow-sm" style={{ borderColor: "#fed7aa" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Right: logo + home */}
          <div className="flex items-center gap-2.5">
            <button onClick={goHome} className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md overflow-hidden" style={{ background: "linear-gradient(135deg, #fb923c, #f97316)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/fitup-logo.png" alt="فیتاپ" className="w-full h-full object-cover" />
              </div>
              <span className="font-black text-base text-slate-900">فیتاپ</span>
            </button>
          </div>

          {/* Center: tool links */}
          <nav className="hidden sm:flex items-center gap-1">
            {TOOLS.map(t => (
              <button
                key={t.id}
                onClick={() => goToTool(t.id, t.url)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition ${
                  screen === t.id ? "text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
                style={screen === t.id ? { background: "linear-gradient(135deg, #f59e0b, #f97316)" } : {}}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </nav>

          {/* Left: home */}
          <button onClick={goHome} className="p-2 rounded-lg hover:bg-slate-100 transition">
            <Home className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Mobile tool links */}
        <div className="flex sm:hidden items-center gap-1 pb-2 overflow-x-auto no-scrollbar">
          {TOOLS.map(t => (
            <button
              key={t.id}
              onClick={() => goToTool(t.id, t.url)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                screen === t.id ? "text-white" : "text-slate-600 bg-slate-100"
              }`}
              style={screen === t.id ? { background: "linear-gradient(135deg, #f59e0b, #f97316)" } : {}}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
