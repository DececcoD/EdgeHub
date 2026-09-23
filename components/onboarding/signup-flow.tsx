"use client";

import { AUTH_MODE } from "@/lib/auth/client-mode";
import { SignupFlowMock } from "./signup-flow-mock";
import { SignupFlowClerk } from "./signup-flow-clerk";

export function SignupFlow() {
  return AUTH_MODE === "clerk" ? <SignupFlowClerk /> : <SignupFlowMock />;
}
