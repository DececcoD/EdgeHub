import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { updatePreferences as updateMockPreferences } from "@/lib/auth/user-store";
import { updatePreferences as updateRealPreferences } from "@/lib/db/user-profile";
import { apiError, parseBody } from "@/lib/api/error";
import { updatePreferencesSchema } from "@/lib/api/schemas";

const IS_CLERK = process.env.AUTH_PROVIDER === "clerk";

export async function PATCH(request: Request) {
  const session = await getSessionOrDemo();
  const parsed = await parseBody(request, updatePreferencesSchema);
  if (!parsed.ok) return parsed.response;

  const updated = IS_CLERK
    ? await updateRealPreferences(session.userId, parsed.body)
    : updateMockPreferences(session.userId, parsed.body);

  if (!updated) return apiError("NOT_FOUND", "Session user not found.", 404);
  return NextResponse.json({ data: updated.preferences });
}
