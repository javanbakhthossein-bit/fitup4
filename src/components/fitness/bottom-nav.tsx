"use client";

import { motion } from "framer-motion";
import { useAppStore, type MainTab } from "@/lib/fitness/store";

interface NavItem {
  id: MainTab;
  label: string;
  icon: any;
}

const goldGradient = "linear-gradient(135deg, #f59e0b, #f97316)";

export function BottomNav({ navItems }: { navItems: NavItem[] }) {
  const { mainTab, setMainTab } = useAppStore();
  // Show first 5 on mobile bottom nav for ergonomics
  const mobileItems = navItems.slice(0, 5);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-orange-100 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-1">
        {mobileItems.map((tab) => {
          const active = mainTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setMainTab(tab.id)}
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
            >
              {active && (
                <motion.div
                  layoutId="bottomNavActive"
                  className="absolute -top-px h-1 w-9 rounded-full"
                  style={{ background: goldGradient }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon
                className={`w-[22px] h-[22px] transition-colors ${
                  active ? "text-orange-500" : "text-slate-400"
                }`}
                strokeWidth={active ? 2.5 : 2}
              />
              <span
                className={`text-[10px] font-medium transition-colors ${
                  active
                    ? "text-transparent bg-clip-text"
                    : "text-slate-400"
                }`}
                style={
                  active
                    ? {
                        backgroundImage: goldGradient,
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }
                    : undefined
                }
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
