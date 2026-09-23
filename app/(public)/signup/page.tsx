import { SignupFlow } from "@/components/onboarding/signup-flow";

export const metadata = { title: "Start free - EdgeHub" };

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <SignupFlow />
    </div>
  );
}
