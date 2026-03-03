"use client";

import { useState, useEffect } from "react";
import AdminLogin from "@/components/AdminLogin";
import AdminDashboard from "@/components/AdminDashboard";

export default function AdminPage() {
    const [password, setPassword] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        const stored = sessionStorage.getItem("adminPassword");
        if (stored) {
            setPassword(stored);
        }
    }, []);

    const handleLogin = (pw: string) => {
        sessionStorage.setItem("adminPassword", pw);
        setPassword(pw);
    };

    const handleLogout = () => {
        sessionStorage.removeItem("adminPassword");
        setPassword(null);
    };

    if (!isClient) return null; // Wait for mount to check sessionStorage to avoid hydration mismatch

    if (!password) {
        return <AdminLogin onLogin={handleLogin} />;
    }

    return <AdminDashboard password={password} onLogout={handleLogout} />;
}
