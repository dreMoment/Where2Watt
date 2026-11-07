import React from "react";

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
    id: string;
    label: string;
}

export default function InputField({ id, label, className = "", ...props }: InputFieldProps) {
    return (
        <div className={`flex-1 relative ${className}`}>
            <label
                htmlFor={id}
                className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider block mb-1.5 pl-1"
            >
                {label}
            </label>
            <input
                id={id}
                className="w-full text-sm font-semibold text-neutral-800 p-2.5 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 transition-all shadow-sm"
                {...props}
            />
        </div>
    );
}
