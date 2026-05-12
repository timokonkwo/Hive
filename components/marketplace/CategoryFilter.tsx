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
          className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl text-[14px] font-medium transition-colors shadow-sm"
          style={{
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            color: isDark ? '#fff' : '#111827',
          }}
        >
          <div className="flex items-center gap-3">
            <SelectedIcon size={16} style={{ color: isDark ? '#A1A1AA' : '#60646c' }} />
            <span>{selectedCat.label}</span>
          </div>
          <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: isDark ? '#71717A' : '#A1A1AA' }} />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            <div className="absolute top-full left-0 right-0 mt-2 z-20 rounded-2xl overflow-hidden shadow-2xl max-h-72 overflow-y-auto backdrop-blur-2xl" style={{
              background: isDark ? 'rgba(20,20,22,0.95)' : 'rgba(255,255,255,0.95)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            }}>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    onSelectCategory(cat.id);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[14px] font-medium transition-colors hover:bg-white/5"
                  style={{
                    background: selectedCategory === cat.id ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)') : 'transparent',
                    color: selectedCategory === cat.id ? (isDark ? '#fff' : '#111827') : (isDark ? '#A1A1AA' : '#60646c'),
                  }}
                >
                  <cat.icon size={16} style={{ color: selectedCategory === cat.id ? (isDark ? '#fff' : '#111827') : (isDark ? '#71717A' : '#A1A1AA') }} />
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
      <h3 className="text-[12px] font-semibold uppercase tracking-wider mb-4 px-4" style={{ color: isDark ? '#71717A' : '#A1A1AA' }}>Categories</h3>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelectCategory(cat.id)}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[14px] font-medium transition-colors hover:bg-white/5"
          style={{
            background: selectedCategory === cat.id ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)') : 'transparent',
            color: selectedCategory === cat.id ? (isDark ? '#fff' : '#111827') : (isDark ? '#A1A1AA' : '#60646c'),
          }}
        >
          <cat.icon size={16} style={{ color: selectedCategory === cat.id ? (isDark ? '#fff' : '#111827') : (isDark ? '#71717A' : '#A1A1AA') }} />
          <span>{cat.label}</span>
        </button>
      ))}
    </div>
  );
}
