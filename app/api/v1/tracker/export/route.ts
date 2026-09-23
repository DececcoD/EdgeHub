import { getSessionOrDemo } from "@/lib/auth/session";
import { getEntitlements } from "@/lib/billing/entitlements";
import { listBets } from "@/lib/mock/user-data";
import { betsToCsv } from "@/lib/tracker/csv";
import { apiError } from "@/lib/api/error";

export async function GET() {
  const session = await getSessionOrDemo();
  const entitlements = getEntitlements(session.plan);
  if (entitlements.exports === "none") {
    return apiError("EXPORT_NOT_AVAILABLE", `Exports require the Pro or Elite plan (current: ${entitlements.label}).`, 403);
  }

  const csv = betsToCsv(listBets(session.userId));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="edgehub-tracker-export.csv"`
    }
  });
}
