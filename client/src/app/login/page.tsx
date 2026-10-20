import Link from "next/link";

import { AuthCardLayout } from "@/components/auth/AuthCardLayout";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <AuthCardLayout
      eyebrow="Welcome back"
      title="Keep building better."
      description="Sign in to bring thoughtful, context-aware code reviews into your team’s workflow."
      footer={<p className="mt-5 text-center text-sm text-[#68635d]">Don&apos;t have an account? <Link href="/signup" className="text-[#006b8f]">Sign up</Link></p>}
    >
      <LoginForm />
    </AuthCardLayout>
  );
}
