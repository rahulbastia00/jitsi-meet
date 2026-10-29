"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { useMeeting } from "@/contexts/meeting-context";
import { useAuth } from "@/contexts/auth-context";
import { NotificationDrawer } from "@/components/notifications/notification-drawer";
import { ScheduleMeetingModal } from "@/components/modals/schedule-meeting-modal";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Notification02Icon,
  PlusSignIcon,
  Calendar03Icon,
  Video01Icon,
} from "@hugeicons/core-free-icons";

export function TopHeader() {
  const pathname = usePathname();
  const { startInstantMeeting } = useMeeting();
  const { activeOrg } = useAuth();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [instantLoading, setInstantLoading] = useState(false);

  // Dynamic breadcrumb generation
  const getBreadcrumbs = () => {
    if (pathname === "/meetings/teams") {
      return { parent: "Meetings", current: "Team Management", parentHref: "/meetings" };
    }
    if (pathname === "/meetings/calendar") {
      return { parent: "Meetings", current: "Calendar", parentHref: "/meetings" };
    }
    if (pathname === "/settings") {
      return { parent: "Settings", current: "General", parentHref: "/settings" };
    }
    return { parent: "Meetings", current: "Overview", parentHref: "/meetings" };
  };

  const breadcrumbs = getBreadcrumbs();

  const handleInstantMeeting = async () => {
    setInstantLoading(true);
    try {
      await startInstantMeeting("Instant Sync", activeOrg?.id);
    } catch {
      // error toast handled in context
    } finally {
      setInstantLoading(false);
    }
  };

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#e4e1dd] bg-white px-4">
        {/* Left: Sidebar trigger & Dynamic Breadcrumb */}
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1 size-8 rounded-[4px] border border-[#e4e1dd] text-[#312d2a] hover:bg-[#f5f4f2]" />
          <Separator orientation="vertical" className="h-4 bg-[#e4e1dd]" />

          <Breadcrumb>
            <BreadcrumbList className="text-xs">
              <BreadcrumbItem className="hidden sm:inline-flex">
                <BreadcrumbLink
                  href={breadcrumbs.parentHref}
                  className="text-[#68635d] hover:text-[#161513]"
                >
                  {breadcrumbs.parent}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:inline-flex text-[#aea8a2]" />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-semibold text-[#161513]">
                  {breadcrumbs.current}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Right: Action controls & Notification Bell */}
        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            onClick={handleInstantMeeting}
            disabled={instantLoading}
            className="h-8 rounded-[4px] border-0 bg-[#312d2a] px-3 text-xs font-semibold text-white shadow-none transition-colors hover:bg-[#47423e]"
          >
            <HugeiconsIcon icon={PlusSignIcon} className="mr-1 size-3.5" />
            {instantLoading ? "Starting..." : "Instant Meeting"}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => setScheduleModalOpen(true)}
            className="h-8 rounded-[4px] border-[#d4cfca] bg-white px-3 text-xs font-semibold text-[#161513] shadow-none hover:bg-[#f5f4f2]"
          >
            <HugeiconsIcon icon={Calendar03Icon} className="mr-1 size-3.5 text-[#312d2a]" />
            Schedule Meeting
          </Button>

          <button
            type="button"
            onClick={() => setNotificationOpen(true)}
            aria-label="Open notifications"
            className="relative flex size-8 items-center justify-center rounded-[4px] border border-[#d4cfca] bg-white text-[#312d2a] transition hover:bg-[#f5f4f2]"
          >
            <HugeiconsIcon icon={Notification02Icon} className="size-4" />
            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-[#312d2a] text-[10px] font-bold text-white">
              2
            </span>
          </button>
        </div>
      </header>

      {/* Notification Drawer */}
      <NotificationDrawer
        open={notificationOpen}
        onOpenChange={setNotificationOpen}
      />

      {/* Schedule Meeting Modal */}
      <ScheduleMeetingModal
        open={scheduleModalOpen}
        onOpenChange={setScheduleModalOpen}
      />
    </>
  );
}
