"use client";

import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

/** Only ever rendered when AUTH_MODE === "clerk" - useClerk() requires a ClerkProvider ancestor. */
export function LogoutButtonClerk() {
  const { signOut } = useClerk();
  const router = useRouter();
  return (
    <button
      className="text-xs text-paper-muted hover:underline dark:text-ink-muted"
      onClick={async () => {
        await signOut();
        router.push("/");
        router.refresh();
      }}
    >
      Log out
    </button>
  );
}
