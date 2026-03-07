import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#f9fafb] px-4 py-12 text-neutral-900">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-xs text-neutral-500 sm:text-sm">Last updated: March 7, 2026</p>

        <p className="mt-6 text-sm leading-relaxed text-neutral-700 sm:text-base">
          Where2Watt is built to minimize personal data collection. I do not persist user data that can be traced back to a real person.
        </p>

        <p className="mt-4 text-sm leading-relaxed text-neutral-700 sm:text-base">
          If this policy changes in the future, this page will be updated accordingly.
        </p>

        <div className="mt-8">
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
