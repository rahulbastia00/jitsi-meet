import { AuthCardLayout } from "@/components/auth/AuthCardLayout";
import { SignUpMultiStepForm } from "@/components/auth/SignUpMultiStepForm";

export default function SignupPage() {
  return (
    <AuthCardLayout
      footer={null}
    >
      <SignUpMultiStepForm />
    </AuthCardLayout>
  );
}
