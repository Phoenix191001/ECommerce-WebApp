"use client";

import { startTransition } from "react";

/**
 * A form that runs a useActionState action without React's automatic reset,
 * so people don't lose what they typed when the server returns an error.
 */
export function KeepForm({
  action,
  children,
  ...rest
}: Omit<React.FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit"> & { action: (fd: FormData) => void }) {
  return (
    <form
      {...rest}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      {children}
    </form>
  );
}
