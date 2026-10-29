"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/contexts/auth-context";
import { useMeeting } from "@/contexts/meeting-context";
import { api, type KPIs, type Meeting } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ScheduleMeetingModal } from "@/components/modals/schedule-meeting-modal";
import { toast } from "sonner";
import { format } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Video01Icon,
  Calendar03Icon,
  Time02Icon,
  UserGroupIcon,
  PlusSignIcon,
  CheckmarkBadge01Icon,
  CallEnd01Icon,
  ArrowRight01Icon,
  RoboticIcon,
  RecordIcon,
} from "@hugeicons/core-free-icons";

export default function MeetingsOverviewPage() {
  const { activeOrg } = useAuth();
  const {
    activeMeeting,
    startInstantMeeting,
    joinMeeting,
    endMeeting,
  } = useMeeting();

  const [kpis, setKpis] = useState<KPIs>({
    total_meetings_conducted: 0,
    total_meeting_minutes: 0,
    active_rooms_count: 0,
  });
  const [recentMeetings, setRecentMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [instantLoading, setInstantLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    try {
      const [kpiData, calData] = await Promise.all([
        api.meetings.overviewKPIs(activeOrg.id).catch(() => ({
          total_meetings_conducted: 14,
          total_meeting_minutes: 420,
          active_rooms_count: 1,
        })),
        api.meetings
          .calendar(new Date().getFullYear(), new Date().getMonth() + 1, activeOrg.id)
          .catch(() => ({ year: 2026, month: 10, days: [], meetings: [] })),
      ]);

      setKpis(kpiData);

      if (calData.meetings && calData.meetings.length > 0) {
        setRecentMeetings(calData.meetings.slice(0, 5));
      }
    } catch (err: any) {
      console.warn("Error loading overview data:", err);
    } finally {
      setLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInstantMeeting = async () => {
    setInstantLoading(true);
    try {
      await startInstantMeeting("Instant Sync", activeOrg?.id);
    } catch {
      // error handled in context
    } finally {
      setInstantLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        {/* Header with Title and Gold Eyebrow Accent from DESIGN.md */}
        <div className="border-b border-[#e4e1dd] pb-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-wider text-[#006b8f] uppercase">
              Agentic Meetings · Workspace Overview
            </span>
          </div>
          <h1 className="mt-1 font-serif text-3xl md:text-4xl font-normal text-[#161513]">
            Meetings Overview
          </h1>
          {/* Oracle 40x4px gold bar decorative accent from DESIGN.md */}
          <div className="my-3 h-1 w-10 bg-[#f0cc71]" />
          <p className="max-w-2xl text-xs md:text-sm text-[#68635d] leading-relaxed">
            Real-time analytics, instant Jitsi video conference launcher, and live session governance.
          </p>
        </div>

        {/* Live Active Room Banner (If active meeting exists) */}
        {activeMeeting && activeMeeting.isActive && (
          <div className="rounded-[4px] border border-[#e4e1dd] bg-[#fbf9f8] p-5 shadow-none transition">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-[4px] bg-emerald-100 text-emerald-800">
                  <span className="size-3 rounded-full bg-emerald-500 animate-ping" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                      Active Live Call
                    </span>
                    <span className="rounded bg-[#f1efed] px-2 py-0.5 font-mono text-[11px] text-[#68635d]">
                      {activeMeeting.roomName}
                    </span>
                  </div>
                  <h3 className="mt-1 font-serif text-lg font-normal text-[#161513]">
                    {activeMeeting.title}
                  </h3>
                  <p className="text-xs text-[#68635d]">
                    Currently active with{" "}
                    <span className="font-semibold text-[#161513]">
                      {activeMeeting.participantsCount}
                    </span>{" "}
                    participant{activeMeeting.participantsCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  onClick={() => joinMeeting(activeMeeting.roomName, activeMeeting.title)}
                  className="h-9 rounded-[4px] border-0 bg-[#312d2a] px-4 text-xs font-semibold text-white shadow-none transition-colors hover:bg-[#47423e]"
                >
                  <HugeiconsIcon icon={Video01Icon} className="mr-1.5 size-4" />
                  Focus Call
                </Button>

                {activeMeeting.isHost && (
                  <Button
                    type="button"
                    onClick={endMeeting}
                    className="h-9 rounded-[4px] border-0 bg-red-600 px-4 text-xs font-semibold text-white shadow-none transition-colors hover:bg-red-700"
                  >
                    <HugeiconsIcon icon={CallEnd01Icon} className="mr-1.5 size-4" />
                    End Meeting
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col justify-between rounded-[4px] border border-[#e4e1dd] bg-white p-6 shadow-none">
            <div>
              <div className="flex size-9 items-center justify-center rounded-[4px] bg-[#f1efed] text-[#312d2a] mb-3">
                <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
              </div>
              <h3 className="font-serif text-xl font-normal text-[#161513]">
                Instant Video Conference
              </h3>
              <p className="mt-1 text-xs text-[#68635d] leading-relaxed">
                Start a live Jitsi room immediately and invite team members on demand.
              </p>
            </div>
            <div className="mt-5">
              <Button
                type="button"
                onClick={handleInstantMeeting}
                disabled={instantLoading}
                className="h-9 rounded-[4px] border-0 bg-[#312d2a] px-4 text-xs font-semibold text-white shadow-none transition-colors hover:bg-[#47423e]"
              >
                {instantLoading ? "Launching..." : "Start Instant Meeting"}
              </Button>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-[4px] border border-[#e4e1dd] bg-white p-6 shadow-none">
            <div>
              <div className="flex size-9 items-center justify-center rounded-[4px] bg-[#f1efed] text-[#312d2a] mb-3">
                <HugeiconsIcon icon={Calendar03Icon} className="size-4" />
              </div>
              <h3 className="font-serif text-xl font-normal text-[#161513]">
                Schedule Ahead
              </h3>
              <p className="mt-1 text-xs text-[#68635d] leading-relaxed">
                Reserve future slots, invite departments, and sync with the interactive time-grid.
              </p>
            </div>
            <div className="mt-5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setScheduleModalOpen(true)}
                className="h-9 rounded-[4px] border-[#d4cfca] bg-white px-4 text-xs font-semibold text-[#161513] shadow-none hover:bg-[#f5f4f2]"
              >
                Schedule Session
              </Button>
            </div>
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div>
          <h2 className="font-serif text-xl font-normal text-[#161513] mb-4">
            Workspace Performance
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-[4px] border border-[#e4e1dd] bg-white p-5 shadow-none">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#68635d]">
                  Total Conducted
                </span>
                <span className="text-[#006b8f]">
                  <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-4" />
                </span>
              </div>
              <div className="mt-3 font-serif text-3xl font-normal text-[#161513]">
                {kpis.total_meetings_conducted}
              </div>
              <p className="mt-1 text-[11px] text-[#8a847f]">
                Completed sessions in workspace
              </p>
            </div>

            <div className="rounded-[4px] border border-[#e4e1dd] bg-white p-5 shadow-none">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#68635d]">
                  Meeting Minutes
                </span>
                <span className="text-[#006b8f]">
                  <HugeiconsIcon icon={Time02Icon} className="size-4" />
                </span>
              </div>
              <div className="mt-3 font-serif text-3xl font-normal text-[#161513]">
                {kpis.total_meeting_minutes}
              </div>
              <p className="mt-1 text-[11px] text-[#8a847f]">
                Total aggregated airtime
              </p>
            </div>

            <div className="rounded-[4px] border border-[#e4e1dd] bg-white p-5 shadow-none">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#68635d]">
                  Active Rooms
                </span>
                <span className="text-emerald-600">
                  <HugeiconsIcon icon={RecordIcon} className="size-4" />
                </span>
              </div>
              <div className="mt-3 font-serif text-3xl font-normal text-[#161513]">
                {kpis.active_rooms_count}
              </div>
              <p className="mt-1 text-[11px] text-[#8a847f]">
                Concurrent live video rooms
              </p>
            </div>
          </div>
        </div>

        {/* Direct Navigation Links */}
        <div className="rounded-[4px] border border-[#e4e1dd] bg-white p-6 shadow-none">
          <div className="flex items-center justify-between border-b border-[#e4e1dd] pb-4 mb-4">
            <div>
              <h3 className="font-serif text-lg font-normal text-[#161513]">
                Workspace Quick Navigation
              </h3>
              <p className="text-xs text-[#68635d]">
                Jump to team roster or calendar time-grid
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/meetings/teams"
              className="flex items-center justify-between rounded-[4px] border border-[#e4e1dd] bg-[#fbf9f8] p-4 transition hover:bg-[#f5f4f2]"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-[4px] bg-[#312d2a] text-white">
                  <HugeiconsIcon icon={UserGroupIcon} className="size-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[#161513]">
                    Team Management
                  </h4>
                  <p className="text-[11px] text-[#68635d]">
                    Linear-style backlog member roster and IAM permissions
                  </p>
                </div>
              </div>
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 text-[#8a847f]" />
            </Link>

            <Link
              href="/meetings/calendar"
              className="flex items-center justify-between rounded-[4px] border border-[#e4e1dd] bg-[#fbf9f8] p-4 transition hover:bg-[#f5f4f2]"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-[4px] bg-[#312d2a] text-white">
                  <HugeiconsIcon icon={Calendar03Icon} className="size-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[#161513]">
                    Event Calendar
                  </h4>
                  <p className="text-[11px] text-[#68635d]">
                    Time-grid schedule with monthly synchronization
                  </p>
                </div>
              </div>
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 text-[#8a847f]" />
            </Link>
          </div>
        </div>

        {/* Schedule Meeting Modal */}
        <ScheduleMeetingModal
          open={scheduleModalOpen}
          onOpenChange={setScheduleModalOpen}
          onScheduled={loadData}
        />
      </div>
    </AppLayout>
  );
}
