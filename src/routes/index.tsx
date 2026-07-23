import { createFileRoute, Link } from "@tanstack/react-router";
import { Wallet, ShieldCheck, LineChart, Download } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-display text-lg font-bold text-primary">
          <Wallet className="h-5 w-5" />
          CediTrack
        </div>
        <Link
          to="/auth"
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="max-w-3xl">
          <span className="inline-flex rounded-full border border-accent/40 bg-accent/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-foreground">
            Built for students in Ghana
          </span>
          <h1 className="mt-6 font-display text-5xl font-extrabold leading-[1.05] text-foreground md:text-6xl">
            Know exactly where every <span className="text-primary">cedi</span> goes.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            A simple daily expense tracker for campus life. Log what you spend on food,
            transport, books and more — all in GHC.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition hover:opacity-90"
            >
              Start tracking free
            </Link>
            <Link
              to="/auth"
              className="rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-secondary"
            >
              I already have an account
            </Link>
            <a
              href="/CediTrack.apk"
              download
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-6 py-3 text-sm font-semibold text-primary transition hover:bg-primary/20"
            >
              <Download className="h-4 w-4" />
              Download Android APK
            </a>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Android 7.0+ · Also installable as a PWA on iOS &amp; desktop.
          </p>
        </div>

        <div id="download" className="mt-16 rounded-2xl border border-border bg-card p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-primary/10 p-3 text-primary">
              <Download className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="font-display text-xl font-bold text-foreground">
                Get the Android app
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Install CediTrack directly on your Android phone. Works offline once opened.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href="/CediTrack.apk"
                  download
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
                >
                  <Download className="h-4 w-4" />
                  Download APK
                </a>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                After downloading, open the file and allow &ldquo;Install from unknown sources&rdquo; if prompted.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-20 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Wallet,
              title: "Fast entry",
              body: "Add an expense in seconds. Amount, category, done.",
            },
            {
              icon: LineChart,
              title: "See patterns",
              body: "Daily and monthly totals so you know where your money goes.",
            },
            {
              icon: ShieldCheck,
              title: "Private by default",
              body: "Your data is yours. Protected by secure authentication.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="mx-auto max-w-6xl px-6 py-10 text-sm text-muted-foreground">
        © {new Date().getFullYear()} CediTrack
      </footer>
    </div>
  );
}
