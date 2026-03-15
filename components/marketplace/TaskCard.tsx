"use client";

import { TaskCategory } from "@/lib/types/task";
import { Shield, Code, Cpu, PenTool, Layout, Search, Megaphone, Scale, Languages, Briefcase, Clock, Coins, ArrowRight, CheckCircle, Rocket, BadgeCheck } from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/components/providers/ThemeProvider";

interface TaskCardProps {
  id: string | number;
  title: string;
  description: string;
  category: TaskCategory;
  budget: string;
  postedTime: string;
  status: "Open" | "In Progress" | "In Review" | "Completed";
  proposalsCount: number;
}

const CATEGORY_CONFIG: Record<TaskCategory, { color: string; icon: any }> = {
  Security: { color: "text-emerald-500", icon: Shield },
  Development: { color: "text-blue-500", icon: Code },
  Analysis: { color: "text-purple-500", icon: Cpu },
  Content: { color: "text-pink-500", icon: PenTool },
  Design: { color: "text-orange-500", icon: Layout },
  Research: { color: "text-indigo-500", icon: Search },
  Social: { color: "text-red-500", icon: Megaphone },
  Legal: { color: "text-yellow-600", icon: Scale },
  Translation: { color: "text-cyan-500", icon: Languages },
  'Token Launch': { color: "text-violet-500", icon: Rocket },
  Other: { color: "text-gray-500", icon: Briefcase },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon?: any }> = {
  Open: { label: "Open", color: "text-emerald-600", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  "In Progress": { label: "In Progress", color: "text-blue-600", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  "In Review": { label: "In Review", color: "text-amber-600", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: Clock },
  Completed: { label: "Completed", color: "text-green-600", bg: "bg-green-500/10", border: "border-green-500/20", icon: BadgeCheck },
};

export function TaskCard({ id, title, description, category, budget, postedTime, status, proposalsCount }: TaskCardProps) {
  const { theme } = useTheme();
  const isDark = true;
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.Other;
  const CategoryIcon = config.icon;
  const statusConf = STATUS_CONFIG[status] || STATUS_CONFIG.Open;
  const StatusIcon = statusConf.icon;
  const isCompleted = status === "Completed";

  return (
    <Link href={`/marketplace/${id}`} className="group transition-colors p-6 md:p-8 flex flex-col h-full relative cursor-pointer block" style={{
      background: isDark ? '#050505' : '#FFFFFF',
      border: `1px solid ${isCompleted ? (isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.15)') : (isDark ? '#1A1A1A' : '#E4E4E7')}`,
      opacity: isCompleted ? 0.7 : 1,
    }}>
      
      {/* Header: Category + Status */}
      <div className="flex justify-between items-start mb-6">
        <span className={`text-[10px] font-mono uppercase tracking-widest ${config.color} flex items-center gap-2`}>
           <CategoryIcon size={12} /> {category}
        </span>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full ${statusConf.bg} border ${statusConf.border} text-[9px] font-bold font-mono uppercase ${statusConf.color} flex items-center gap-1`}>
            {StatusIcon && <StatusIcon size={9} />}
            {statusConf.label}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="mb-8 flex-1">
        <h3 className="text-lg md:text-xl font-bold mb-3 tracking-tight transition-colors group-hover:text-emerald-500" style={{
          color: isCompleted ? (isDark ? '#71717A' : '#A1A1AA') : (isDark ? '#fff' : '#09090B')
        }}>
             {title}
        </h3>
        <p className="text-xs leading-relaxed font-mono line-clamp-3" style={{ color: isDark ? '#52525B' : '#71717A' }}>
          {description}
        </p>
      </div>

      {/* Footer Details */}
      <div className="flex items-center justify-between pt-6" style={{ borderTop: `1px solid ${isDark ? '#1A1A1A' : '#E4E4E7'}` }}>
         <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase" style={{ color: isDark ? '#3F3F46' : '#A1A1AA' }}>BUDGET</span>
            <span className="text-xs font-mono" style={{ color: isDark ? '#fff' : '#09090B' }}>{budget}</span>
         </div>

         <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
               <span className="text-[10px] font-mono uppercase" style={{ color: isDark ? '#3F3F46' : '#A1A1AA' }}>BIDS</span>
               <span className="text-xs font-mono" style={{ color: isDark ? '#fff' : '#09090B' }}>{proposalsCount}</span>
            </div>
            <span className="text-[10px] font-mono uppercase" style={{ color: isDark ? '#3F3F46' : '#A1A1AA' }}>{postedTime}</span>
         </div>
      </div>
    </Link>
  );
}
