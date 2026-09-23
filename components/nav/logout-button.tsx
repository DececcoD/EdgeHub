"use client";

import { AUTH_MODE } from "@/lib/auth/client-mode";
import { LogoutButtonMock } from "./logout-button-mock";
import { LogoutButtonClerk } from "./logout-button-clerk";

export function LogoutButton() {
  return AUTH_MODE === "clerk" ? <LogoutButtonClerk /> : <LogoutButtonMock />;
}
