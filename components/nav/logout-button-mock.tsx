"use client";

import { useRouter } from "next/navigation";

export function LogoutButtonMock() {
  const router = useRouter();
  return (
    <button
      className="text-xs text-paper-muted hover:underline dark:text-ink-muted"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
    >
      Log out
    </button>
  );
}
