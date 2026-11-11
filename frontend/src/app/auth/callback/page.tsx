"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { stravaLoginCallback } from "@/utils/api";
import { Activity, Loader2, AlertCircle } from "lucide-react";

export default function AuthCallbackPage() {
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [errorMsg, setErrorMsg] = useState("");
    const hasFetched = useRef(false);

    useEffect(() => {
        if (hasFetched.current) return;
        hasFetched.current = true;

        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const error = params.get("error");

        if (error || !code) {
            queueMicrotask(() => {
                setStatus("error");
                setErrorMsg(error === "access_denied" ? "You denied access to Strava." : "Missing authorization code.");
            });
            return;
        }

        const redirectUri = `${window.location.origin}/auth/callback`;
        stravaLoginCallback(code, redirectUri)
            .then(({ token, user }) => {
                localStorage.setItem("auth_token", token);
                localStorage.setItem("auth_user", JSON.stringify(user));
                setStatus("success");
                // Redirect to home after a brief moment
                setTimeout(() => {
                    window.location.href = "/";
                }, 1000);
            })
            .catch(() => {
                setStatus("error");
                setErrorMsg("Failed to complete authentication. Please try again.");
            });
    }, []);

    return (
        <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center">
            <div className="bg-white/95 backdrop-blur-2xl p-10 rounded-3xl shadow-2xl w-full max-w-sm text-center border border-white/50">
                {status === "loading" && (
                    <>
                        <div className="w-20 h-20 bg-orange-50 text-[#fc4c02] rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-orange-100 relative">
                            <div className="absolute inset-0 rounded-full bg-orange-400/20 animate-ping"></div>
                            <Loader2 className="w-10 h-10 animate-spin relative z-10" />
                        </div>
                        <h2 className="text-2xl font-black text-neutral-900 mb-2 tracking-tight">Connecting to Strava...</h2>
                        <p className="text-neutral-500 font-medium">Please wait while we log you in.</p>
                    </>
                )}

                {status === "success" && (
                    <>
                        <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-emerald-100 relative">
                            <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping"></div>
                            <Activity className="w-10 h-10 relative z-10" />
                        </div>
                        <h2 className="text-2xl font-black text-neutral-900 mb-2 tracking-tight">You&apos;re In!</h2>
                        <p className="text-neutral-500 font-medium">Redirecting you back...</p>
                    </>
                )}

                {status === "error" && (
                    <>
                        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-red-100">
                            <AlertCircle className="w-10 h-10" />
                        </div>
                        <h2 className="text-2xl font-black text-neutral-900 mb-2 tracking-tight">Login Failed</h2>
                        <p className="text-neutral-500 font-medium mb-6">{errorMsg}</p>
                        <Link
                            href="/"
                            className="inline-block bg-neutral-900 hover:bg-neutral-800 text-white py-3 px-8 rounded-xl font-bold text-sm transition-all shadow-lg"
                        >
                            Back to Home
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
}
