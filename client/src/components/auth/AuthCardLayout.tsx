import Link from "next/link";
import type { ReactNode } from "react";

type AuthCardLayoutProps = {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  footer: ReactNode;
};

function BrandPattern() {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full opacity-15"
      viewBox="0 0 640 720"
      fill="none"
      preserveAspectRatio="none"
    >
      <path d="M-40 130C120 10 200 240 390 100S650 20 710 170" stroke="white" strokeWidth="1" />
      <path d="M-60 220C100 100 220 330 420 170S650 110 720 250" stroke="white" strokeWidth="1" />
      <path d="M-70 315C90 190 250 430 430 260S670 210 730 350" stroke="white" strokeWidth="1" />
      <path d="M-80 420C100 280 260 530 460 360S670 320 740 450" stroke="white" strokeWidth="1" />
      <path d="M-90 540C90 390 280 650 480 470S680 430 750 560" stroke="white" strokeWidth="1" />
      <path d="M-100 660C80 500 300 760 500 580S690 550 760 670" stroke="white" strokeWidth="1" />
    </svg>
  );
}

export function AuthCardLayout({
  children,
  eyebrow,
  title,
  description,
  footer,
}: AuthCardLayoutProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f1efed] px-4 py-8 text-[#161513] sm:px-6 lg:py-12">
      <div className="grid w-full max-w-[1120px] overflow-hidden rounded-[8px] border border-[#e4e1dd] bg-white shadow-none md:grid-cols-[0.9fr_1.1fr]">
        <aside className="relative flex min-h-[300px] flex-col justify-between overflow-hidden bg-[#211e1c] p-8 text-white sm:p-12 md:min-h-[640px]">
          <BrandPattern />
          <div className="relative">
            <Link href="/" className="inline-flex items-center gap-2 text-[21px] font-extrabold tracking-[-1px]">
              <span className="text-[32px] leading-none text-[#f15a24]">◒</span>
              CodeRabbit
            </Link>
          </div>
          <div className="relative mt-16 max-w-[380px] md:mt-0">
            <p className="mb-4 text-[13px] font-bold text-[#f0cc71]">{eyebrow}</p>
            <h1 className="font-serif text-[38px] font-normal leading-[1.1] tracking-[-0.7px] sm:text-[48px]">
              {title}
            </h1>
            <div className="my-6 h-[4px] w-[40px] bg-[#f0cc71]" />
            <p className="max-w-[330px] text-[16px] leading-6 text-[#e9e7e4]">{description}</p>
          </div>
          <p className="relative mt-12 text-xs text-[#aea8a2]">Better code, together.</p>
        </aside>
        <section className="flex min-h-[560px] items-center bg-white p-6 sm:p-12 lg:p-16">
          <div className="mx-auto w-full max-w-[440px]">{children}{footer}</div>
        </section>
      </div>
    </main>
  );
}
