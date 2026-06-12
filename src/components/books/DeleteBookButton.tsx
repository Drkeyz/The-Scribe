"use client";

import { useTransition } from "react";
import { deleteBook } from "@/app/books/actions";

/** Quiet, deliberate destructive control with a hard confirm. */
export function DeleteBookButton(props: { bookId: string; title: string }) {
  const [pending, startTransition] = useTransition();

  function onDelete() {
    const sure = confirm(
      `Delete "${props.title}"?\n\nThis permanently removes the book, all its chapters, and every margin note. This cannot be undone.`
    );
    if (!sure) return;
    startTransition(() => deleteBook(props.bookId));
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={pending}
      className="text-sm text-ink-300 transition-colors hover:text-oxblood-600 disabled:opacity-50"
    >
      {pending ? "Removing from the shelf…" : "Delete book"}
    </button>
  );
}
