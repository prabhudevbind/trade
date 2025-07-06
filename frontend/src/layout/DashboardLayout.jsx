"use client";

import DashboardSidebar from "./DashboardSidebar";
import DashboardHeader from "./DashboardHeader";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { useThemeClasses } from "@/hooks/colorThem";
import {
  Home,
  BarChart3,
  Clock,
  Settings,
  Menu,
  Bell,
  Search,
  Briefcase,
  Users,
  Trophy,
  Sliders,
  MoreHorizontal,
  Sun,
  Moon,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
export default function DashboardLayout({ children }) {
  const themecolor = useThemeClasses();

  const [activeTab, setActiveTab] = useState("portfolio");
  const [isDark, setIsDark] = useState(false);

  const handleThemeToggle = () => {
    setIsDark((prev) => !prev);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", !isDark);
    }
  };

  const navigationItems = [
    { icon: Briefcase, label: "Portfolio", id: "portfolio" },
    { icon: Users, label: "Leaderboard", id: "leaderboard" },
    { icon: Trophy, label: "My Contest", id: "mycontest" },
    { icon: Sliders, label: "Options", id: "options" },
    { icon: MoreHorizontal, label: "Other", id: "other" },
  ];
  return (
    <div
      className={cn(
        "flex w-full overflow-hidden",
        isDark ? "bg-slate-950" : "bg-white"
      )}
    >
      <DashboardSidebar />
      <SidebarInset className="flex w-full flex-col">
        {/* <DashboardHeader /> */}
        <main className="sm:p-6">{children}</main>
      </SidebarInset>

      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-950 border-t border-gray-200 dark:border-slate-800 px-4 py-2">
        <div className="flex items-center justify-around">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-w-[60px] py-2",
                  isActive
                    ? isDark
                      ? "text-yellow-300"
                      : "text-blue-600"
                    : isDark
                    ? "text-gray-400 hover:text-yellow-200"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Icon className="w-6 h-6" />

                <span className="text-xs font-medium">{item.label}</span>
                {isActive && (
                  <div
                    className={cn(
                      "w-1 h-1 rounded-full mt-1",
                      isDark
                        ? "bg-yellow-300"
                        : "bg-blue-600"
                    )}
                  />
                )}
              </button>
            );
          })}
          {/* Theme Toggle Button */}
          <button
            onClick={handleThemeToggle}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-w-[60px] py-2",
              isDark ? "text-yellow-300" : "text-blue-600"
            )}
            aria-label="Toggle theme"
          >
            {isDark ? (
              <Sun className="w-6 h-6" />
            ) : (
              <Moon className="w-6 h-6" />
            )}
            <span className="text-xs font-medium">
              {isDark ? "Day" : "Night"}
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
}
