"use client";

import { TaskCategory } from "@/lib/types/task";
import { Shield, Code, Cpu, PenTool, Layout, Search, Megaphone, Scale, Languages, Briefcase, Clock, Coins, ArrowRight, CheckCircle } from "lucide-react";
import Link from "next/link";

interface TaskCardProps {
  id: string | number;
  title: string;
  description: string;
  category: TaskCategory;
  budget: string; // e.g., "0.5 - 1.0 ETH"
  postedTime: string; // e.g., "2h ago"
  status: "Open" | "In Progress" | "Completed";
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
  Legal: { color: "text-yellow-500", icon: Scale },
  Translation: { color: "text-cyan-500", icon: Languages },
  Other: { color: "text-gray-500", icon: Briefcase },
};

export function TaskCard({ id, title, description, category, budget, postedTime, status, proposalsCount }: TaskCardProps) {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.Other;
  const CategoryIcon = config.icon;

  return (
    <Link href={`/marketplace/${id}`} className="group bg-[#050505] border border-[#1A1A1A] hover:border-emerald-500 transition-colors p-8 flex flex-col h-full relative cursor-pointer block">
      
      {/* Header: Category & Time */}
      <div className="flex justify-between items-start mb-6">
        <span className={`text-[10px] font-mono uppercase tracking-widest ${config.color} flex items-center gap-2`}>
           <CategoryIcon size={12} /> {category}
        </span>
        <span className="text-[10px] text-zinc-700 font-mono uppercase">
           {postedTime}
        </span>
      </div>

      {/* Content */}
      <div className="mb-8 flex-1">
        <h3 className="text-xl font-bold text-white mb-3 tracking-tight group-hover:text-emerald-500 transition-colors">
             {title}
        </h3>
        <p className="text-xs text-zinc-600 leading-relaxed font-mono line-clamp-3">
          {description}
        </p>
      </div>

      {/* Footer Details - Single Line */}
      <div className="flex items-center justify-between pt-6 border-t border-[#1A1A1A]">
         <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-700 font-mono uppercase">BUDGET</span>
            <span className="text-xs text-white font-mono">{budget}</span>
         </div>

         <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-700 font-mono uppercase">BIDS</span>
            <span className="text-xs text-white font-mono">{proposalsCount}</span>
         </div>
      </div>
    </Link>
  );
}
