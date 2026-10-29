"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const AUTH_INPUT_CLASS =
  "h-12 rounded-[6px] border border-[#d4cfca] bg-white px-4 py-3 text-[15px] text-[#161513] placeholder:text-[#8a847f] shadow-none outline-none focus-visible:border-[#227e9e] focus-visible:ring-1 focus-visible:ring-[#227e9e]";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginValues) => {
    setServerError("");
    try {
      await login(values.email, values.password);
      toast.success("Signed in successfully");
      router.push("/meetings");
    } catch (err: any) {
      setServerError(err.message || "Invalid email or password.");
      toast.error(err.message || "Sign in failed");
    }
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="mb-2">
        <p className="mb-3 text-[13px] font-bold text-[#006b8f]">Welcome back</p>
        <h2 className="font-serif text-[36px] font-normal leading-tight">Sign in to Platform</h2>
        <div className="mt-5 h-[4px] w-[40px] bg-[#f0cc71]" />
      </div>

      {serverError && (
        <div className="rounded-[4px] border border-red-200 bg-red-50 p-3 text-xs text-red-600">
          {serverError}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="login-email" className="mb-2 block text-[14px] font-semibold text-[#161513]">Email</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          className={AUTH_INPUT_CLASS}
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
        {errors.email && <p className="text-xs text-[#d63b25]">{errors.email.message}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password" className="mb-2 block text-[14px] font-semibold text-[#161513]">Password</Label>
        </div>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          className={AUTH_INPUT_CLASS}
          aria-invalid={Boolean(errors.password)}
          {...register("password")}
        />
        {errors.password && <p className="text-xs text-[#d63b25]">{errors.password.message}</p>}
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-11 w-full rounded-[4px] border-0 bg-[#312d2a] px-4 py-[10px] text-[14px] font-medium text-white shadow-none transition-colors hover:bg-[#47423e]"
      >
        {isSubmitting ? "Signing in..." : "Sign In"}
      </Button>

      <p className="text-center text-xs text-[#68635d]">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold text-[#006b8f] hover:underline">
          Create account
        </Link>
      </p>
    </form>
  );
}
