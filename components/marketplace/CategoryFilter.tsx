"use client";

import React, { useState } from "react";
import { TaskCategory } from "@/lib/types/task";
import { 
  Shield, Code, Cpu, PenTool, Layout, Grid, Search, 
  Megaphone, Scale, Languages, Briefcase, Rocket, ChevronDown 
} from "lucide-react";

interface Category {
  id: TaskCategory | "All";
  label: string;
  icon: React.ElementType;
}

const CATEGORIES: Category[] = [
  { id: "All", label: "All Tasks", icon: Grid },
  { id: "Development", label: "Development", icon: Code },
  { id: "Security", label: "Security", icon: Shield },
  { id: "Analysis", label: "Analysis", icon: Cpu },
  { id: "Research", label: "Research", icon: Search },
  { id: "Token Launch", label: "Token Launch", icon: Rocket },
  { id: "Content", label: "Content", icon: PenTool },
  { id: "Design", label: "Design", icon: Layout },
  { id: "Social", label: "Social", icon: Megaphone },
  { id: "Legal", label: "Legal", icon: Scale },
  { id: "Translation", label: "Translation", icon: Languages },
  { id: "Other", label: "Other", icon: Briefcase },
];

interface CategoryFilterProps {
  selectedCategory: TaskCategory | "All";
  onSelectCategory: (category: TaskCategory | "All") => void;
  variant?: "horizontal" | "sidebar" | "dropdown";
}

export function CategoryFilter({
  selectedCategory,
  onSelectCategory,
  variant = "horizontal",
}: CategoryFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedCat = CATEGORIES.find((c) => c.id === selectedCategory) || CATEGORIES[0];
  const SelectedIcon = selectedCat.icon;

  // Dropdown variant for compact mobile views
  if (variant === "dropdown") {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-full text-xs font-medium border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <SelectedIcon size={14} className="text-[var(--accent-green)]" />
            <span>{selectedCat.label}</span>
          </div>
          <ChevronDown size={14} className={`transition-transform text-[var(--text-tertiary)] ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            <div className="absolute top-full left-0 right-0 mt-2 z-20 rounded-2xl p-1.5 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-xl max-h-72 overflow-y-auto">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      onSelectCategory(cat.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[var(--accent-green)] text-black font-bold"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-pill)]"
                    }`}
                  >
                    <Icon size={14} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // Horizontal scrollable segmented pill bar (Default)
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const isSelected = selectedCategory === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer ${
              isSelected
                ? "bg-[var(--accent-green)] text-black font-bold shadow-sm"
                : "border border-[var(--border-subtle)] bg-[var(--bg-pill)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
            }`}
          >
            <Icon size={12} className={isSelected ? "text-black" : "text-[var(--text-tertiary)]"} />
            <span>{cat.label}</span>
          </button>
        );
      })}
    </div>
  );
}
