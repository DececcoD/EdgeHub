import { Sidebar } from "@/components/nav/sidebar";
import { TopBar } from "@/components/nav/topbar";
import { getSessionOrDemo } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionOrDemo();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <TopBar session={session} />
        <main className="flex-1 bg-paper-50 p-4 dark:bg-ink-950 md:p-6">{children}</main>
      </div>
    </div>
  );
}
