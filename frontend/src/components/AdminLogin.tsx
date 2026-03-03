"use client";

import { useState } from "react";
import { verifyAdminPassword } from "@/utils/api";

interface AdminLoginProps {
    onLogin: (password: string) => void;
}

export default function AdminLogin({ onLogin }: AdminLoginProps) {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const isValid = await verifyAdminPassword(password);
            if (isValid) {
                onLogin(password);
            } else {
                setError("Invalid password");
            }
        } catch (err) {
            setError("Error verifying password");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
            <div className="bg-gray-900/50 backdrop-blur-xl p-8 rounded-2xl border border-gray-800 w-full max-w-md shadow-2xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Admin Access</h1>
                    <p className="text-gray-400">Enter password to manage segments</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-gray-800/50 border border-gray-700 hover:border-gray-600 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200"
                            placeholder="Password"
                            required
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-center">
                            <p className="text-red-400 text-sm font-medium">{error}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        {loading ? "Verifying..." : "Login to Dashboard"}
                    </button>

                    <div className="text-center pt-4">
                        <a href="/" className="inline-flex items-center text-gray-400 hover:text-white text-sm font-medium transition-colors">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                            Return to Application
                        </a>
                    </div>
                </form>
            </div>
        </div>
    );
}
