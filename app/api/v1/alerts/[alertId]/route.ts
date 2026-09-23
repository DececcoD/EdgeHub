import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { deleteAlert, setAlertStatus } from "@/lib/mock/user-data";
import { apiError, parseBody } from "@/lib/api/error";
import { updateAlertStatusSchema } from "@/lib/api/schemas";

export async function PATCH(request: Request, { params }: { params: { alertId: string } }) {
  const session = await getSessionOrDemo();
  const parsed = await parseBody(request, updateAlertStatusSchema);
  if (!parsed.ok) return parsed.response;
  const updated = setAlertStatus(session.userId, params.alertId, parsed.body.status);
  if (!updated) return apiError("NOT_FOUND", "Alert not found.", 404);
  return NextResponse.json({ data: updated });
}

export async function DELETE(_request: Request, { params }: { params: { alertId: string } }) {
  const session = await getSessionOrDemo();
  const ok = deleteAlert(session.userId, params.alertId);
  if (!ok) return apiError("NOT_FOUND", "Alert not found.", 404);
  return NextResponse.json({ data: { deleted: true } });
}
