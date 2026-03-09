import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#f9fafb] px-4 py-12 text-neutral-900">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-xs text-neutral-500 sm:text-sm">Last updated: March 7, 2026</p>

        <p className="mt-6 text-sm leading-relaxed text-neutral-700 sm:text-base">
          Where2Watt uses Strava for authentication and segment linking. This policy explains what data is processed,
          why it is processed, and how you can revoke access or request deletion.
        </p>

        <section className="mt-6 space-y-3 text-sm leading-relaxed text-neutral-700 sm:text-base">
          <h2 className="text-lg font-semibold text-neutral-900">Data We Read From Strava</h2>
          <p>When you connect Strava, Where2Watt receives your athlete ID and OAuth tokens required to authorize API calls.</p>
          <p>
            For submitted segment URLs, Where2Watt may read Strava segment metadata such as segment name, distance, average
            gradient, and polyline data.
          </p>
        </section>

        <section className="mt-6 space-y-3 text-sm leading-relaxed text-neutral-700 sm:text-base">
          <h2 className="text-lg font-semibold text-neutral-900">Why We Use This Data</h2>
          <p>To authenticate you and let you submit/rate/report segments.</p>
          <p>Where2Watt does not use Strava data for advertising.</p>
          <p>
            Where2Watt uses a deterministic pseudonymous internal ID derived from your Strava athlete ID using a keyed
            one-way cryptographic function. Your raw Strava athlete ID is not used as your app-facing identifier. While
            connected, authorization records are associated with this pseudonymous ID so core features keep working.
          </p>
        </section>

        <section className="mt-6 space-y-3 text-sm leading-relaxed text-neutral-700 sm:text-base">
          <h2 className="text-lg font-semibold text-neutral-900">Retention and Deletion</h2>
          <p>
            Data linked to your account is retained while your Strava connection remains active. If you choose &quot;Disconnect
            Strava&quot; in the app, Where2Watt deauthorizes with Strava and removes account-linked records from the server.
          </p>
          <p>
            If Strava sends a deauthorization webhook event, the same cleanup is triggered server-side. You can also request
            deletion by email.
          </p>
          <p>
            For security, Where2Watt may retain a minimal pseudonymous revocation marker for up to the JWT session lifetime to
            ensure previously issued sessions are invalidated.
          </p>
        </section>

        <section className="mt-6 space-y-3 text-sm leading-relaxed text-neutral-700 sm:text-base">
          <h2 className="text-lg font-semibold text-neutral-900">How To Revoke Access</h2>
          <p>Use the in-app &quot;Disconnect Strava&quot; action, or revoke access from your Strava account settings.</p>
          <p>
            Support and deletion requests:{" "}
            <a className="underline decoration-neutral-300 underline-offset-4" href="mailto:ndrmntn@gmail.com">
              ndrmntn@gmail.com
            </a>
          </p>
        </section>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/terms"
            className="inline-flex items-center rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            Terms
          </Link>
          <Link
            href="/support"
            className="inline-flex items-center rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            Support
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
