import React from "react";

interface SectionCardProps {
    title: string;
    children: React.ReactNode;
    headerContent?: React.ReactNode;
}

export default function SectionCard({ title, children, headerContent }: SectionCardProps) {
    return (
        <div className="border-b border-neutral-100 bg-white p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-neutral-600">
                    {title}
                </h2>
                {headerContent && <div className="shrink-0">{headerContent}</div>}
            </div>
            {children}
        </div>
    );
}
