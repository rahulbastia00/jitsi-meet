import { AuthCardLayout } from "@/components/auth/AuthCardLayout";
import { SignUpMultiStepForm } from "@/components/auth/SignUpMultiStepForm";

export default function SignupPage() {
  return (
    <AuthCardLayout
      eyebrow="Join the movement"
      title="Your best code is ahead."
      description="Create your free account and give every pull request the review it deserves."
      footer={null}
    >
      <SignUpMultiStepForm />
    </AuthCardLayout>
  );
}
