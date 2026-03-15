"use client";

import { useState } from "react";
import { TaskCategory } from "@/lib/types/task";
import { 
  Shield, Code, Cpu, PenTool, Layout, Grid, Search, Megaphone, Scale, Languages, Briefcase, Rocket, ChevronDown 
} from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";

interface Category {
  id: TaskCategory | 'All';
  label: string;
  icon: any;
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
  variant?: 'sidebar' | 'dropdown';
}

export function CategoryFilter({ selectedCategory, onSelectCategory, variant = 'sidebar' }: CategoryFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { theme } = useTheme();
  const isDark = true;

  const selectedCat = categories.find(c => c.id === selectedCategory) || categories[0];
  const SelectedIcon = selectedCat.icon;

  // Dropdown variant for mobile
  if (variant === 'dropdown') {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-sm font-mono uppercase tracking-wider transition-colors"
          style={{
            background: isDark ? '#0A0A0A' : '#F4F4F5',
            border: `1px solid ${isDark ? '#27272A' : '#D4D4D8'}`,
            color: isDark ? '#fff' : '#09090B',
          }}
        >
          <div className="flex items-center gap-3">
            <SelectedIcon size={14} className="text-emerald-500" />
            <span>{selectedCat.label}</span>
          </div>
          <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: isDark ? '#71717A' : '#A1A1AA' }} />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-lg overflow-hidden shadow-2xl max-h-72 overflow-y-auto" style={{
              background: isDark ? '#0A0A0A' : '#FFFFFF',
              border: `1px solid ${isDark ? '#27272A' : '#D4D4D8'}`,
            }}>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    onSelectCategory(cat.id);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-xs font-mono uppercase tracking-wider transition-colors"
                  style={{
                    background: selectedCategory === cat.id ? (isDark ? 'rgba(16,185,129,0.1)' : 'rgba(5,150,105,0.08)') : 'transparent',
                    color: selectedCategory === cat.id ? '#10B981' : (isDark ? '#A1A1AA' : '#52525B'),
                  }}
                >
                  <cat.icon size={14} style={{ color: selectedCategory === cat.id ? '#10B981' : (isDark ? '#52525B' : '#A1A1AA') }} />
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // Sidebar variant for desktop
  return (
    <div className="space-y-1">
      <h3 className="text-[10px] font-bold font-mono uppercase tracking-widest mb-6 pl-4" style={{ color: isDark ? '#3F3F46' : '#A1A1AA' }}>Categories</h3>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelectCategory(cat.id)}
          className={`w-full flex items-center gap-4 px-4 py-3 text-xs font-mono transition-all uppercase tracking-wider border-l-2 ${
            selectedCategory === cat.id 
              ? "border-emerald-500 pl-6" 
              : "border-transparent hover:pl-5"
          }`}
          style={{
            color: selectedCategory === cat.id ? (isDark ? '#fff' : '#09090B') : (isDark ? '#52525B' : '#71717A'),
          }}
        >
          <cat.icon size={14} style={{ color: selectedCategory === cat.id ? '#10B981' : (isDark ? '#3F3F46' : '#A1A1AA') }} />
          <span>{cat.label}</span>
        </button>
      ))}
    </div>
  );
}
