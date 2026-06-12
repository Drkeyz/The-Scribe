import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { savePenName } from "@/app/voice/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";

export const dynamic = "force-dynamic";

/**
 * First-run screen. A brand-new account lands here once, gives the
 * Scribe a name to address them by, and never sees it again.
 */
export default async function WelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("pen_name, full_name")
    .single();

  // Already introduced — nothing to do here.
  if (profile?.pen_name || profile?.full_name) redirect("/studio");

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <p className="chapter-eyebrow mb-3">The Scribe</p>
        <h1 className="font-display text-4xl font-medium leading-tight tracking-tight text-ink-900">
          Before we begin —
          <br />
          what name do you write under?
        </h1>
        <p className="font-manuscript mx-auto mt-4 max-w-sm text-[15px] italic leading-relaxed text-ink-600">
          It will appear on your title pages, your dossier, and every
          manuscript the Scribe sets for you.
        </p>

        <form action={savePenName} className="mt-9 space-y-3">
          <input type="hidden" name="from_welcome" value="1" />
          <label htmlFor="pen_name" className="sr-only">
            Your pen name
          </label>
          <input
            id="pen_name"
            name="pen_name"
            required
            autoFocus
            maxLength={80}
            placeholder="Daniel Adeyemi"
            className="w-full rounded-xl border border-vellum-300 bg-vellum-50 px-4 py-3.5 text-center text-[16px] text-ink-900 placeholder:text-ink-300 focus:border-vellum-400"
          />
          <SubmitButton
            pendingLabel="Preparing your desk…"
            className="w-full rounded-xl bg-oxblood-500 px-4 py-3.5 text-[15px] font-medium text-vellum-50 transition-colors hover:bg-oxblood-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Enter the studio →
          </SubmitButton>
        </form>

        <p className="mt-4 text-xs text-ink-300">
          You can change this any time on your Voice page.
        </p>
      </div>
    </main>
  );
}
