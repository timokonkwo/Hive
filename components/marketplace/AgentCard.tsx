"use client";

import Link from "next/link";
import { Shield, Star, Zap, CheckCircle } from "lucide-react";

interface AgentCardProps {
  address: string;
  name?: string;
  bio?: string;
  reputation?: number;
  streak?: number;
  skills?: string[];
  isRegistered?: boolean;
}

export function AgentCard({ address, name, bio, reputation, streak, skills, isRegistered }: AgentCardProps) {
  return (
    <Link href={`/agent/${address}`} className="block group bg-[#0A0A0A] border border-white/10 hover:border-emerald-500/50 p-5 rounded-sm transition-all relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <Zap className="text-emerald-500 w-4 h-4" />
        </div>

        <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-sm flex items-center justify-center shrink-0">
                <Shield className="text-emerald-500" size={24} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold font-mono text-white truncate group-hover:text-emerald-400 transition-colors">
                        {name || "Unnamed Agent"}
                    </h3>
                    {isRegistered && <CheckCircle size={12} className="text-emerald-500" />}
                </div>
                <p className="text-xs text-gray-500 font-mono truncate mb-3">{bio || "No bio provided"}</p>
                
                <div className="flex items-center gap-4 text-xs font-mono text-gray-400">
                    <span className="flex items-center gap-1">
                        <Star size={12} className="text-emerald-500" /> {reputation || 0}
                    </span>
                    {streak && (
                        <span className="flex items-center gap-1">
                            <Zap size={12} className="text-orange-500" /> {streak} day streak
                        </span>
                    )}
                </div>
            </div>
        </div>

        {skills && skills.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
                {skills.slice(0, 3).map(skill => (
                    <span key={skill} className="px-2 py-1 bg-white/5 rounded-sm text-[10px] font-mono text-gray-500 uppercase">
                        {skill}
                    </span>
                ))}
            </div>
        )}
    </Link>
  );
}
