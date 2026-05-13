"use client";

import { TaskCategory } from "@/lib/types/task";
import { Shield, Code, Cpu, PenTool, Layout, Search, Megaphone, Scale, Languages, Briefcase, Clock, Coins, ArrowRight, CheckCircle, Rocket, BadgeCheck } from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/components/providers/ThemeProvider";
import { HolderBadge } from "@/components/ui/HolderBadge";

interface TaskCardProps {
  id: string | number;
  title: string;
  description: string;
  category: TaskCategory;
  budget: string;
  postedTime: string;
  status: "Open" | "In Progress" | "In Review" | "Completed";
  proposalsCount: number;
  clientAddress?: string;
}

const CATEGORY_CONFIG: Record<TaskCategory, { color: string; icon: any }> = {
  Security: { color: "text-zinc-400", icon: Shield },
  Development: { color: "text-zinc-400", icon: Code },
  Analysis: { color: "text-zinc-400", icon: Cpu },
  Content: { color: "text-zinc-400", icon: PenTool },
  Design: { color: "text-zinc-400", icon: Layout },
  Research: { color: "text-zinc-400", icon: Search },
  Social: { color: "text-zinc-400", icon: Megaphone },
  Legal: { color: "text-zinc-400", icon: Scale },
  Translation: { color: "text-zinc-400", icon: Languages },
  'Token Launch': { color: "text-zinc-400", icon: Rocket },
  Other: { color: "text-zinc-400", icon: Briefcase },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon?: any }> = {
  Open: { label: "Open", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  "In Progress": { label: "In Progress", color: "text-zinc-300", bg: "bg-white/5", border: "border-white/10" },
  "In Review": { label: "In Review", color: "text-zinc-400", bg: "bg-white/5", border: "border-white/10", icon: Clock },
  Completed: { label: "Completed", color: "text-zinc-500", bg: "bg-transparent", border: "border-white/5", icon: BadgeCheck },
};

export function TaskCard({ id, title, description, category, budget, postedTime, status, proposalsCount, clientAddress }: TaskCardProps) {
  const { theme } = useTheme();
  const isDark = true;
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.Other;
  const CategoryIcon = config.icon;
  const statusConf = STATUS_CONFIG[status] || STATUS_CONFIG.Open;
  const StatusIcon = statusConf.icon;
  const isCompleted = status === "Completed";

  return (
    <Link href={`/marketplace/${id}`} className="group transition-all p-6 md:p-8 flex flex-col h-full relative cursor-pointer block rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-1" style={{
      background: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF',
      border: `1px solid ${isCompleted ? (isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.15)') : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`,
      opacity: isCompleted ? 0.7 : 1,
    }}>
      
      {/* Header: Category + Status */}
      <div className="flex justify-between items-start mb-6">
        <span className={`text-[12px] font-medium ${config.color} flex items-center gap-1.5`}>
           <CategoryIcon size={14} /> {category}
        </span>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full ${statusConf.bg} border ${statusConf.border} text-[11px] font-medium ${statusConf.color} flex items-center gap-1.5`}>
            {StatusIcon && <StatusIcon size={12} />}
            {statusConf.label}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="mb-8 flex-1">
        <h3 className="text-[18px] font-semibold mb-3 tracking-tight transition-colors group-hover:text-emerald-400" style={{
          color: isCompleted ? (isDark ? '#71717A' : '#A1A1AA') : (isDark ? '#fff' : '#111827')
        }}>
             {title}
        </h3>
        <p className="text-[14px] leading-relaxed line-clamp-4" style={{ color: isDark ? '#A1A1AA' : '#60646c' }}>
          {description}
        </p>
      </div>

      {/* Footer Details */}
      <div className="flex flex-wrap gap-4 items-center justify-between pt-5" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
         <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
            <span className="text-[11px] font-medium" style={{ color: isDark ? '#71717A' : '#A1A1AA' }}>Budget</span>
            <span className="text-[13px] font-semibold" style={{ color: isDark ? '#fff' : '#111827' }}>{budget}</span>
            {clientAddress && <div className="ml-1"><HolderBadge wallet={clientAddress} compact /></div>}
         </div>

         <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
               <span className="text-[11px] font-medium" style={{ color: isDark ? '#71717A' : '#A1A1AA' }}>Bids</span>
               <span className="text-[13px] font-medium" style={{ color: isDark ? '#fff' : '#111827' }}>{proposalsCount}</span>
            </div>
            <span className="text-[12px] font-medium" style={{ color: isDark ? '#71717A' : '#A1A1AA' }}>{postedTime}</span>
         </div>
      </div>
    </Link>
  );
}
