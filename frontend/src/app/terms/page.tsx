import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f9fafb] px-4 py-12 text-neutral-900">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight">Terms of Use</h1>
        <p className="mt-2 text-xs text-neutral-500 sm:text-sm">Last updated: March 7, 2026</p>

        <section className="mt-6 space-y-3 text-sm leading-relaxed text-neutral-700 sm:text-base">
          <p>
            Where2Watt is provided &quot;as is&quot; for informational purposes to help cyclists discover and evaluate interval
            segments.
          </p>
          <p>You are responsible for your own route choices, traffic awareness, and ride safety.</p>
          <p>
            You agree not to abuse the service, attempt unauthorized access, or submit misleading content intentionally.
          </p>
        </section>

        <section className="mt-6 space-y-3 text-sm leading-relaxed text-neutral-700 sm:text-base">
          <h2 className="text-lg font-semibold text-neutral-900">Strava Integration</h2>
          <p>
            Where2Watt uses the Strava API and is not endorsed by Strava. Strava account access can be revoked at any time
            using the in-app disconnect flow or directly from your Strava account settings.
          </p>
        </section>

        <section className="mt-6 space-y-3 text-sm leading-relaxed text-neutral-700 sm:text-base">
          <h2 className="text-lg font-semibold text-neutral-900">Support</h2>
          <p>
            Contact:{" "}
            <a className="underline decoration-neutral-300 underline-offset-4" href="mailto:ndrmntn@gmail.com">
              ndrmntn@gmail.com
            </a>
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
