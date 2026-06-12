import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/**
 * Studio chrome, redesigned: dark ink pill for the active page,
 * author initials avatar, sign-out in the nav. Async server component —
 * fetches the profile name itself so pages don't have to pass it.
 */
export async function StudioNav(props: {
  active: "studio" | "interview" | "voice" | "books";
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("pen_name, full_name")
    .single();
  const name = data?.pen_name || data?.full_name || "";
  const initials = name
    ? name
        .split(/\s+/)
        .map((w: string) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "✦";

  const items = [
    { id: "studio", label: "Studio", href: "/studio" },
    { id: "interview", label: "Interview", href: "/interview" },
    { id: "voice", label: "Your voice", href: "/voice" },
    { id: "books", label: "Books", href: "/books" },
  ] as const;

  return (
    <nav className="sticky top-0 z-40 border-b border-vellum-300 bg-vellum-100/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/studio"
          className="font-display text-xl font-medium text-ink-900"
        >
          The Scribe
        </Link>
        <div className="flex items-center gap-1.5">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              aria-current={props.active === item.id ? "page" : undefined}
              className={
                props.active === item.id
                  ? "rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-vellum-50"
                  : "rounded-full px-4 py-2 text-sm text-ink-600 transition-colors hover:text-ink-900"
              }
            >
              {item.label}
            </Link>
          ))}
          <span
            aria-hidden="true"
            className="mx-3 h-6 w-px bg-vellum-300"
          />
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full bg-oxblood-500 text-xs font-medium text-vellum-50"
            title={name || undefined}
          >
            {initials}
          </span>
          <form action="/auth/sign-out" method="post">
            <button
              type="submit"
              className="px-2 text-sm text-ink-400 transition-colors hover:text-ink-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
