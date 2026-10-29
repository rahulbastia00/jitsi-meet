"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { z } from "zod";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const emailSchema = z.object({ email: z.string().email("Enter a valid email address.") });
const detailsSchema = z
  .object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .regex(/[A-Z]/, "Include at least one uppercase letter.")
      .regex(/[a-z]/, "Include at least one lowercase letter.")
      .regex(/[0-9]/, "Include at least one digit.")
      .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, "Include at least one special character."),
    confirmPassword: z.string(),
    terms: z.boolean().refine((value) => value, "Accept the terms to continue."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

type Step = "email" | "otp" | "details";
type EmailValues = z.infer<typeof emailSchema>;
type DetailsValues = z.infer<typeof detailsSchema>;

const AUTH_INPUT_CLASS =
  "h-12 rounded-[6px] border border-[#d4cfca] bg-white px-4 py-3 text-[15px] text-[#161513] placeholder:text-[#8a847f] shadow-none outline-none focus-visible:border-[#227e9e] focus-visible:ring-1 focus-visible:ring-[#227e9e]";
const AUTH_BUTTON_CLASS =
  "h-11 w-full rounded-[4px] border-0 bg-[#312d2a] px-4 py-[10px] text-[14px] font-medium text-white shadow-none transition-colors hover:bg-[#47423e]";

function FormError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-[#d63b25]">{message}</p> : null;
}

export function SignUpMultiStepForm() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [step, setStep] = useState<Step>("email");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [verificationTicket, setVerificationTicket] = useState("");
  const [otp, setOtp] = useState("");
  const [seconds, setSeconds] = useState(30);
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const emailForm = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const detailsForm = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { firstName: "", lastName: "", password: "", confirmPassword: "", terms: false },
  });

  useEffect(() => {
    if (step !== "otp" || seconds === 0) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [seconds, step]);

  const handleSendEmail = async ({ email }: EmailValues) => {
    setServerError("");
    setLoading(true);
    try {
      await api.auth.sendOtp(email);
      setVerifiedEmail(email);
      setSeconds(30);
      setStep("otp");
      toast.success("Verification code dispatched to your email");
    } catch (err: any) {
      setServerError(err.message || "Failed to send verification code.");
      toast.error(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return;
    setServerError("");
    setLoading(true);
    try {
      const res = await api.auth.verifyOtp(verifiedEmail, otp);
      setVerificationTicket(res.verification_ticket);
      setStep("details");
      toast.success("Email verified successfully");
    } catch (err: any) {
      setServerError(err.message || "Invalid or expired verification code.");
      toast.error(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (values: DetailsValues) => {
    setServerError("");
    setLoading(true);
    try {
      await api.auth.register({
        email: verifiedEmail,
        first_name: values.firstName?.trim() || "",
        last_name: values.lastName?.trim() || "",
        password: values.password,
        password_confirm: values.confirmPassword,
        verification_ticket: verificationTicket,
        terms_accepted: values.terms,
      });

      // Automatically sign in upon registration
      await api.auth.login(verifiedEmail, values.password);
      await refreshUser();
      toast.success("Account created and logged in!");
      router.push("/meetings");
    } catch (err: any) {
      setServerError(err.message || "Failed to create account.");
      toast.error(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {serverError && (
        <div className="rounded-[4px] border border-red-200 bg-red-50 p-3 text-xs text-red-600">
          {serverError}
        </div>
      )}

      {step === "email" && (
        <form className="flex flex-col gap-5" onSubmit={emailForm.handleSubmit(handleSendEmail)} noValidate>
          <Header title="Create your account" description="Start with your work email. We’ll send a verification code to confirm it." />
          <div className="flex flex-col gap-2">
            <Label htmlFor="signup-email" className="mb-2 block text-[14px] font-semibold text-[#161513]">Work email</Label>
            <Input id="signup-email" type="email" autoComplete="email" placeholder="you@company.com" className={AUTH_INPUT_CLASS} {...emailForm.register("email")} />
            <FormError message={emailForm.formState.errors.email?.message} />
          </div>
          <Button type="submit" disabled={loading} className={AUTH_BUTTON_CLASS}>
            {loading ? "Sending Code..." : "Validate Email"}
          </Button>
        </form>
      )}

      {step === "otp" && (
        <div className="flex flex-col gap-5">
          <Header title="Check your inbox" description="Enter the six-digit code we sent to your email." />
          <div className="flex items-center justify-between rounded-[6px] border border-[#e4e1dd] bg-[#fbf9f8] px-3 py-2 text-sm">
            <span className="truncate">{verifiedEmail}</span>
            <button type="button" onClick={() => setStep("email")} className="ml-3 shrink-0 text-xs font-semibold text-[#006b8f]">Edit</button>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="signup-otp" className="mb-2 block text-[14px] font-semibold text-[#161513]">Verification code</Label>
            <InputOTP id="signup-otp" maxLength={6} value={otp} onChange={setOtp} className="w-full" containerClassName="w-full justify-between">
              <InputOTPGroup className="w-full justify-between gap-2 rounded-none">
                {Array.from({ length: 6 }, (_, index) => (
                  <InputOTPSlot key={index} index={index} className="h-12 w-12 rounded-[6px] border border-[#d4cfca] bg-white text-[18px] font-medium text-[#161513] shadow-none first:rounded-[6px] last:rounded-[6px] data-[active=true]:border-[#227e9e] data-[active=true]:ring-1 data-[active=true]:ring-[#227e9e]" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button type="button" onClick={handleVerifyOtp} disabled={otp.length !== 6 || loading} className={AUTH_BUTTON_CLASS}>
            {loading ? "Verifying..." : "Verify OTP"}
          </Button>
          <button type="button" disabled={seconds > 0 || loading} onClick={() => handleSendEmail({ email: verifiedEmail })} className="text-sm text-[#006b8f] disabled:cursor-not-allowed disabled:text-[#aea8a2]">
            {seconds > 0 ? `Resend code in 00:${String(seconds).padStart(2, "0")}` : "Resend Code"}
          </button>
        </div>
      )}

      {step === "details" && (
        <form className="flex flex-col gap-5" onSubmit={detailsForm.handleSubmit(handleCreateAccount)} noValidate>
          <Header title="Finish setting up" description="Provide your name and create a password." />
          <div className="rounded-[6px] border border-[#e4e1dd] bg-[#fbf9f8] px-3 py-2 text-sm text-[#68635d]">
            Verified email: <strong className="font-medium text-[#161513]">{verifiedEmail}</strong>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="signup-first-name" className="text-xs font-semibold text-[#161513]">First Name</Label>
              <Input id="signup-first-name" placeholder="John" className={AUTH_INPUT_CLASS} {...detailsForm.register("firstName")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="signup-last-name" className="text-xs font-semibold text-[#161513]">Last Name</Label>
              <Input id="signup-last-name" placeholder="Doe" className={AUTH_INPUT_CLASS} {...detailsForm.register("lastName")} />
            </div>
          </div>

          <PasswordField id="signup-password" label="Password" register={detailsForm.register("password")} error={detailsForm.formState.errors.password?.message} />
          <PasswordField id="signup-confirm-password" label="Confirm password" register={detailsForm.register("confirmPassword")} error={detailsForm.formState.errors.confirmPassword?.message} />

          <div className="flex items-start gap-2">
            <input id="terms" type="checkbox" className="mt-1 size-4 accent-[#312d2a]" {...detailsForm.register("terms")} />
            <Label htmlFor="terms" className="text-xs leading-5 text-[#68635d]">
              I agree to the <Link href="#" className="text-[#006b8f]">Terms and Conditions</Link> and <Link href="#" className="text-[#006b8f]">Privacy Policy</Link>.
            </Label>
          </div>
          <FormError message={detailsForm.formState.errors.terms?.message} />
          <Button type="submit" disabled={loading} className={AUTH_BUTTON_CLASS}>
            {loading ? "Creating Account..." : "Create Account & Enter Platform"}
          </Button>
        </form>
      )}

      <p className="border-t border-[#e9e7e4] pt-5 text-center text-sm text-[#68635d]">
        Already have an account? <Link href="/login" className="text-[#006b8f] font-semibold hover:underline">Log in</Link>
      </p>
    </div>
  );
}

function Header({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <p className="mb-3 text-[13px] font-bold text-[#006b8f]">Get started</p>
      <h2 className="font-serif text-[36px] font-normal leading-tight">{title}</h2>
      <div className="my-5 h-[4px] w-[40px] bg-[#f0cc71]" />
      <p className="text-sm leading-6 text-[#68635d]">{description}</p>
    </div>
  );
}

function PasswordField({ id, label, register, error }: { id: string; label: string; register: UseFormRegisterReturn; error?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="mb-2 block text-[14px] font-semibold text-[#161513]">{label}</Label>
      <Input id={id} type="password" autoComplete="new-password" className={AUTH_INPUT_CLASS} {...register} />
      <FormError message={error} />
    </div>
  );
}
