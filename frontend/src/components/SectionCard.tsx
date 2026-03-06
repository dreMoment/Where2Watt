import React from "react";

interface SectionCardProps {
    title: string;
    children: React.ReactNode;
    headerContent?: React.ReactNode;
}

export default function SectionCard({ title, children, headerContent }: SectionCardProps) {
    return (
        <div className="bg-white/50 border border-neutral-200/60 p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2 text-[13px] uppercase tracking-widest font-bold text-neutral-400">
                    {title}
                </div>
                {headerContent && <div className="shrink-0">{headerContent}</div>}
            </div>
            {children}
        </div>
    );
}
