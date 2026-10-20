"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async () => {
    await Promise.resolve();
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="mb-2">
        <p className="mb-3 text-[13px] font-bold text-[#006b8f]">Welcome back</p>
        <h2 className="font-serif text-[36px] font-normal leading-tight">Sign in to CodeRabbit</h2>
        <div className="mt-5 h-[4px] w-[40px] bg-[#f0cc71]" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="login-email" className="text-sm font-semibold text-[#161513]">Email</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          className="h-11 rounded-[6px] border-[#d4cfca] bg-white px-3 text-sm shadow-none focus-visible:border-[#227e9e] focus-visible:ring-[#227e9e]/20"
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
        {errors.email && <p className="text-xs text-[#d63b25]">{errors.email.message}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password" className="text-sm font-semibold text-[#161513]">Password</Label>
          <Link href="/forgot-password" className="text-xs text-[#006b8f]">Forgot password?</Link>
        </div>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          className="h-11 rounded-[6px] border-[#d4cfca] bg-white px-3 text-sm shadow-none focus-visible:border-[#227e9e] focus-visible:ring-[#227e9e]/20"
          aria-invalid={Boolean(errors.password)}
          {...register("password")}
        />
        {errors.password && <p className="text-xs text-[#d63b25]">{errors.password.message}</p>}
      </div>
      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-11 w-full rounded-[4px] bg-[#312d2a] px-4 text-sm font-semibold text-white shadow-none hover:bg-[#47423e]"
      >
        {isSubmitting ? "Signing in..." : "Sign In"}
      </Button>
      <div className="my-1 h-px bg-[#e9e7e4]" />
    </form>
  );
}
