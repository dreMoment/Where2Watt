import React from "react";

interface SectionCardProps {
    title: string;
    children: React.ReactNode;
}

export default function SectionCard({ title, children }: SectionCardProps) {
    return (
        <div className="bg-white/50 border border-neutral-200/60 p-5 rounded-3xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-2 text-[13px] uppercase tracking-widest font-bold text-neutral-400 mb-4">
                {title}
            </div>
            {children}
        </div>
    );
}
