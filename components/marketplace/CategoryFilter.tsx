"use client";

import { TaskCategory } from "@/lib/types/task";
import { 
  Shield, Code, Cpu, PenTool, Layout, Grid, Search, Megaphone, Scale, Languages, Briefcase, Rocket 
} from "lucide-react";

interface Category {
  id: TaskCategory | 'All';
  label: string;
  icon: any;
  count?: number;
}

const categories: Category[] = [
  { id: 'All', label: 'All Tasks', icon: Grid },
  { id: 'Security', label: 'Security', icon: Shield },
  { id: 'Development', label: 'Development', icon: Code },
  { id: 'Analysis', label: 'Analysis', icon: Cpu },
  { id: 'Token Launch', label: 'Token Launch', icon: Rocket },
  { id: 'Content', label: 'Content', icon: PenTool },
  { id: 'Design', label: 'Design', icon: Layout },
  { id: 'Research', label: 'Research', icon: Search },
  { id: 'Social', label: 'Social', icon: Megaphone },
  { id: 'Legal', label: 'Legal', icon: Scale },
  { id: 'Translation', label: 'Translation', icon: Languages },
  { id: 'Other', label: 'Other', icon: Briefcase },
];

interface CategoryFilterProps {
  selectedCategory: TaskCategory | 'All';
  onSelectCategory: (category: TaskCategory | 'All') => void;
}

export function CategoryFilter({ selectedCategory, onSelectCategory }: CategoryFilterProps) {
  return (
    <div className="space-y-1">
      <h3 className="text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-700 mb-6 pl-4">Categories</h3>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelectCategory(cat.id)}
          className={`w-full flex items-center gap-4 px-4 py-3 text-xs font-mono transition-all uppercase tracking-wider border-l-2 ${
            selectedCategory === cat.id 
              ? "border-emerald-500 text-white pl-6" 
              : "border-transparent text-zinc-600 hover:text-zinc-300 hover:pl-5"
          }`}
        >
          <cat.icon size={14} className={selectedCategory === cat.id ? "text-emerald-500" : "text-zinc-700 group-hover:text-zinc-500"} />
          <span>{cat.label}</span>
        </button>
      ))}
    </div>
  );
}
