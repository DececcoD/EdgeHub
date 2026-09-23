"use client";

import { AUTH_MODE } from "@/lib/auth/client-mode";
import { LoginFormMock } from "./login-form-mock";
import { LoginFormClerk } from "./login-form-clerk";

export function LoginForm() {
  return AUTH_MODE === "clerk" ? <LoginFormClerk /> : <LoginFormMock />;
}
