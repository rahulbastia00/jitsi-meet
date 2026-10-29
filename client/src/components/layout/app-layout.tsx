"use client";

import React from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopHeader } from "@/components/layout/top-header";
import { FloatingMeetingPlayer } from "@/components/meetings/floating-meeting-player";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-[#fbf9f8]">
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col bg-[#fbf9f8] min-w-0">
          <TopHeader />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
          <FloatingMeetingPlayer />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
