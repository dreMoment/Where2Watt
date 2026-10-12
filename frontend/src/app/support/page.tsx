import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  alternates: { canonical: "/support" },
};

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-[#f9fafb] px-4 py-12 text-neutral-900">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight">Support</h1>
        <p className="mt-2 text-xs text-neutral-500 sm:text-sm">Last updated: March 9, 2026</p>



        <section className="mt-6 space-y-3 text-sm leading-relaxed text-neutral-700 sm:text-base">
          <h2 className="text-lg font-semibold text-neutral-900">Contact Information</h2>
          <p>
            Email:{" "}
            <a className="underline decoration-neutral-300 underline-offset-4" href="mailto:ndrmntn@gmail.com">
              ndrmntn@gmail.com
            </a>
          </p>
        </section>

        <section className="mt-6 space-y-3 text-sm leading-relaxed text-neutral-700 sm:text-base">
          <h2 className="text-lg font-semibold text-neutral-900">Common Issues</h2>
          <p>
            If Strava login fails, retry from the app home screen and ensure your browser is not blocking redirects.
          </p>
          <p>
            If ratings or reports seem outdated, refresh after a few seconds while the API sync completes.
          </p>
        </section>

        <section className="mt-6 space-y-3 text-sm leading-relaxed text-neutral-700 sm:text-base">
          <h2 className="text-lg font-semibold text-neutral-900">Disconnect Strava and Delete Data</h2>
          <p>
            In the app, open the profile menu and choose <strong>Disconnect Strava</strong>.
          </p>
          <p>
            This deauthorizes your Strava connection and deletes account-linked records in Where2Watt.
          </p>
          <p>
            You can also revoke access directly from your Strava account settings.
          </p>
        </section>

        <section className="mt-6 space-y-3 text-sm leading-relaxed text-neutral-700 sm:text-base">
          <h2 className="text-lg font-semibold text-neutral-900">Strava Account Help</h2>
          <p>
            If you need assistance with your Strava account, please visit the{" "}
            <a
              className="underline decoration-neutral-300 underline-offset-4"
              href="https://support.strava.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Strava Support Center
            </a>.
          </p>
        </section>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/privacy-policy"
            className="inline-flex items-center rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className="inline-flex items-center rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            Terms of Use
          </Link>
          <Link
            href="/"
            className="inline-flex items-center rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            Back to app
          </Link>
        </div>
      </div>
    </main>
  );
}
