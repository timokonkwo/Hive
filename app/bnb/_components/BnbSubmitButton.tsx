"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { BnbButtonLoader } from "@/app/bnb/_components/BnbButtonLoader";

type BnbSubmitButtonProps = Omit<ComponentProps<"button">, "children" | "type"> & {
  children: ReactNode;
  pendingLabel: string;
};

export function BnbSubmitButton({ children, disabled, pendingLabel, ...props }: BnbSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending || props["aria-busy"] === true}
    >
      {pending ? <BnbButtonLoader /> : children}
      {pending ? pendingLabel : null}
    </button>
  );
}
