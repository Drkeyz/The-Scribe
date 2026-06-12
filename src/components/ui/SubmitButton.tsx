"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button for server-action forms. Disables itself and swaps its
 * label while the action is pending — double-submission becomes
 * impossible. Must be rendered INSIDE the <form> it guards.
 */
export function SubmitButton(props: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={
        props.className ??
        "rounded-lg bg-oxblood-500 px-4 py-3 text-sm font-medium text-vellum-50 transition-colors hover:bg-oxblood-600 disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      {pending ? props.pendingLabel : props.children}
    </button>
  );
}
