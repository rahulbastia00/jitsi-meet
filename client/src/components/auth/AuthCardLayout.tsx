import Link from "next/link";
import type { ReactNode } from "react";

type AuthCardLayoutProps = {
  children: ReactNode;
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
  footer,
}: AuthCardLayoutProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f1efed] px-4 py-8 text-[#161513] sm:px-6 lg:py-12">
      <div className="flex w-full max-w-[1120px] flex-col items-stretch md:relative md:min-h-[680px] md:flex-row md:items-center">
        <aside className="relative z-20 flex min-h-[350px] flex-col justify-between overflow-hidden rounded-[8px] border border-[#312d2a] bg-[#211e1c] p-8 text-white shadow-[0_20px_50px_rgba(0,0,0,0.35)] sm:p-12 md:my-12 md:mr-[-48px] md:min-h-[520px] md:w-[43%] md:shrink-0 md:p-12">
          <BrandPattern />
          <div className="relative">
            <Link href="/" className="inline-flex items-center gap-2 text-[21px] font-extrabold tracking-[-1px]">
              <span className="text-[32px] leading-none text-[#f15a24]">◒</span>
              Hrnbyl
            </Link>
          </div>
          <div className="relative mt-16 max-w-[380px] md:mt-0">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[#f7e0a1]">
              AI Project Intelligence
            </p>
            <h1 className="font-serif text-3xl font-normal leading-tight text-white md:text-[34px]">
              Never ask for a status report again.
            </h1>
            <div className="my-4 h-[4px] w-[40px] bg-[#f0cc71]" />
            <p className="max-w-sm text-[14px] leading-relaxed text-[#d4cfca]">
              Connect your sprint meetings directly to Jira. Get real-time answers on bandwidth,
              active blockers, and delivery timelines—during calls or via phone when you&apos;re offline.
            </p>
          </div>
          <div className="relative mt-12 flex items-center justify-between gap-3" aria-label="Brand panel slides">
            <span className="text-[12px] tracking-normal text-[#aea8a2]">
              Zero manual sync. Real-time Jira clarity.
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <span className="h-1 w-6 rounded-full bg-[#f0cc71]" />
              <span className="h-1 w-1 rounded-full bg-[#59534e]" />
              <span className="h-1 w-1 rounded-full bg-[#59534e]" />
            </div>
          </div>
        </aside>
        <section className="relative z-10 flex min-h-[560px] items-center rounded-[8px] border border-[#e4e1dd] bg-white px-6 py-10 shadow-[0_15px_35px_rgba(0,0,0,0.06)] sm:px-12 sm:py-16 md:min-h-[680px] md:w-[70%] md:pl-[112px] md:pr-16 lg:pr-20">
          <div className="mx-auto w-full max-w-[440px]">{children}{footer}</div>
        </section>
      </div>
    </main>
  );
}
