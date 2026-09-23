import { LoginForm } from "@/components/onboarding/login-form";

export const metadata = { title: "Log in - EdgeHub" };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <LoginForm />
    </div>
  );
}
