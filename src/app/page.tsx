import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="chapter-eyebrow mb-3">The Scribe</p>
      <h1 className="font-display max-w-xl text-4xl font-medium leading-tight text-ink-900">
        Write the message you carry, in the voice you were given.
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-400">
        A writing companion for apostolic and prophetic voices. It learns how
        you write, then helps you write it.
      </p>
      <Link
        href="/auth/sign-in"
        className="mt-8 rounded-lg bg-oxblood-600 px-6 py-3 text-sm font-medium text-vellum-50 transition-colors hover:bg-oxblood-500"
      >
        Enter the writing room
      </Link>
    </main>
  );
}
