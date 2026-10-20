"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const emailSchema = z.object({ email: z.string().email("Enter a valid email address.") });
const detailsSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters."),
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
  const [step, setStep] = useState<Step>("email");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [seconds, setSeconds] = useState(30);
  const emailForm = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });
  const detailsForm = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { password: "", confirmPassword: "", terms: false },
  });

  useEffect(() => {
    if (step !== "otp" || seconds === 0) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [seconds, step]);

  const validateEmail = ({ email }: EmailValues) => {
    setVerifiedEmail(email);
    setSeconds(30);
    setStep("otp");
  };

  const verifyOtp = () => {
    if (otp.length === 6) setStep("details");
  };

  const createAccount = async () => {
    await Promise.resolve();
  };

  return (
    <div className="flex flex-col gap-5">
      {step === "email" && (
        <form className="flex flex-col gap-5" onSubmit={emailForm.handleSubmit(validateEmail)} noValidate>
          <Header title="Create your account" description="Start with your work email. We’ll send a verification code to confirm it." />
          <div className="flex flex-col gap-2">
            <Label htmlFor="signup-email" className="mb-2 block text-[14px] font-semibold text-[#161513]">Work email</Label>
            <Input id="signup-email" type="email" autoComplete="email" placeholder="you@company.com" className={AUTH_INPUT_CLASS} {...emailForm.register("email")} />
            <FormError message={emailForm.formState.errors.email?.message} />
          </div>
          <SubmitButton label="Validate Email" />
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
          <Button type="button" onClick={verifyOtp} disabled={otp.length !== 6} className={AUTH_BUTTON_CLASS}>Verify OTP</Button>
          <button type="button" disabled={seconds > 0} onClick={() => setSeconds(30)} className="text-sm text-[#006b8f] disabled:cursor-not-allowed disabled:text-[#aea8a2]">
            {seconds > 0 ? `Resend code in 00:${String(seconds).padStart(2, "0")}` : "Resend Code"}
          </button>
        </div>
      )}
      {step === "details" && (
        <form className="flex flex-col gap-5" onSubmit={detailsForm.handleSubmit(createAccount)} noValidate>
          <Header title="Finish setting up" description="Create a password and you’re ready to review better code." />
          <div className="rounded-[6px] border border-[#e4e1dd] bg-[#fbf9f8] px-3 py-2 text-sm text-[#68635d]">
            Verified email: <strong className="font-medium text-[#161513]">{verifiedEmail}</strong>
          </div>
          <PasswordField id="signup-password" label="Password" register={detailsForm.register("password")} error={detailsForm.formState.errors.password?.message} />
          <PasswordField id="signup-confirm-password" label="Confirm password" register={detailsForm.register("confirmPassword")} error={detailsForm.formState.errors.confirmPassword?.message} />
          <div className="flex items-start gap-2">
            <input id="terms" type="checkbox" className="mt-1 size-4 accent-[#312d2a]" {...detailsForm.register("terms")} />
            <Label htmlFor="terms" className="text-xs leading-5 text-[#68635d]">
              I agree to the <Link href="/terms" className="text-[#006b8f]">Terms and Conditions</Link> and <Link href="/privacy" className="text-[#006b8f]">Privacy Policy</Link>.
            </Label>
          </div>
          <FormError message={detailsForm.formState.errors.terms?.message} />
          <FormError message={detailsForm.formState.errors.root?.message} />
          <SubmitButton label="Create Account" />
        </form>
      )}
      <p className="border-t border-[#e9e7e4] pt-5 text-center text-sm text-[#68635d]">
        Already have an account? <Link href="/login" className="text-[#006b8f]">Log in</Link>
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

function SubmitButton({ label }: { label: string }) {
  return <Button type="submit" className={AUTH_BUTTON_CLASS}>{label}</Button>;
}
