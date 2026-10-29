"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/contexts/auth-context";
import { useMeeting } from "@/contexts/meeting-context";
import { api, type Meeting, type CalendarResponse } from "@/lib/api";
import {
  EventCalendar,
  type EventCalendarApi,
  type EventCalendarRenderEventProps,
} from "@/components/reui/event-calendar/event-calendar";
import {
  EventCalendarNav,
  EventCalendarToolbar,
} from "@/components/reui/event-calendar/event-calendar-nav";
import type {
  CalendarEvent,
  EventCalendarSlotDraft,
} from "@/components/reui/event-calendar/event-calendar-types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScheduleMeetingModal } from "@/components/modals/schedule-meeting-modal";
import { toast } from "sonner";
import { format, isSameDay } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar03Icon,
  Video01Icon,
  Cancel01Icon,
  UserIcon,
  Time02Icon,
  PlusSignIcon,
  CheckmarkBadge01Icon,
} from "@hugeicons/core-free-icons";

interface MeetingData {
  meetingId: string;
  roomName: string;
  status: "active" | "ended" | "scheduled";
  meetingType: string;
  hostName: string;
  hostEmail: string;
  hostInitials: string;
  scheduledDurationMins: number;
  actualDurationMins: number;
  attendees: Array<{ name: string; role: string; duration?: number }>;
  rawMeeting?: Meeting;
}

export default function CalendarPage() {
  const { activeOrg } = useAuth();
  const { joinMeeting } = useMeeting();
  const [mounted, setMounted] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<CalendarEvent<MeetingData>[]>([]);
  const [loading, setLoading] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [slotDraftDate, setSlotDraftDate] = useState<Date | undefined>(undefined);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingData & { title: string; start: Date; end: Date } | null>(null);

  const apiRef = useRef<EventCalendarApi<MeetingData> | null>(null);

  useEffect(() => {
    setMounted(true);
    setCurrentDate(new Date());
  }, []);

  // Fetch calendar meetings for current year & month
  const fetchCalendar = useCallback(async (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 1-indexed

    setLoading(true);
    try {
      const res: CalendarResponse = await api.meetings.calendar(
        year,
        month,
        activeOrg?.id
      );

      const mappedEvents: CalendarEvent<MeetingData>[] = [];

      // 1. If res.meetings exists, map from full serialized list
      if (res.meetings && res.meetings.length > 0) {
        res.meetings.forEach((m) => {
          const rawStart = m.scheduled_start || m.actual_started_at || m.created_at;
          const rawEnd = m.scheduled_end || m.actual_ended_at;

          const start = rawStart ? new Date(rawStart) : new Date();
          const end = rawEnd
            ? new Date(rawEnd)
            : new Date(start.getTime() + 45 * 60 * 1000);

          const teamColor = m.invited_teams?.[0]?.color_tag;
          const color =
            teamColor ||
            (m.status === "active"
              ? "#10B981"
              : m.status === "scheduled"
              ? "#3B82F6"
              : "#6B7280");

          const hostName =
            m.host.first_name || m.host.last_name
              ? `${m.host.first_name || ""} ${m.host.last_name || ""}`.trim()
              : m.host.email;

          const hostInitials = hostName
            .split(" ")
            .map((s) => s[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();

          const schedMins =
            m.scheduled_start && m.scheduled_end
              ? Math.round(
                  (new Date(m.scheduled_end).getTime() -
                    new Date(m.scheduled_start).getTime()) /
                    60000
                )
              : 45;

          const actualMins = Math.round((m.total_duration_secs || 0) / 60);

          const attendeesList = (m.attendees || []).map((att) => ({
            name: att.user
              ? `${att.user.first_name || ""} ${att.user.last_name || ""}`.trim() || att.user.email
              : att.guest_name || "Guest",
            role: att.role,
            duration: Math.round((att.duration_seconds || 0) / 60),
          }));

          mappedEvents.push({
            id: String(m.id),
            title: m.title || "Team Meeting",
            start,
            end,
            resourceId: m.host.id,
            color,
            data: {
              meetingId: String(m.id),
              roomName: m.jitsi_room_name,
              status: m.status,
              meetingType: m.meeting_type,
              hostName,
              hostEmail: m.host.email,
              hostInitials,
              scheduledDurationMins: schedMins,
              actualDurationMins: actualMins,
              attendees: attendeesList,
              rawMeeting: m,
            },
          });
        });
      } else if (res.days) {
        // Fallback: map from daily breakdown
        res.days.forEach((d) => {
          d.meetings.forEach((m) => {
            const rawStart = m.scheduled_start || m.actual_started_at || `${d.date}T09:00:00Z`;
            const rawEnd = m.scheduled_end || m.actual_ended_at;

            const start = new Date(rawStart);
            const end = rawEnd
              ? new Date(rawEnd)
              : new Date(start.getTime() + 45 * 60 * 1000);

            const color =
              m.status === "active"
                ? "#10B981"
                : m.status === "scheduled"
                ? "#3B82F6"
                : "#6B7280";

            mappedEvents.push({
              id: String(m.id),
              title: m.title,
              start,
              end,
              resourceId: m.host_id || "host",
              color,
              data: {
                meetingId: String(m.id),
                roomName: m.jitsi_room_name || `Room-${m.id.slice(0, 6)}`,
                status: (m.status as any) || "scheduled",
                meetingType: m.type,
                hostName: m.host_name,
                hostEmail: m.host_name,
                hostInitials: m.host_name.slice(0, 2).toUpperCase(),
                scheduledDurationMins: 45,
                actualDurationMins: Math.round((m.duration_seconds || 0) / 60),
                attendees: m.attendees.map((a) => ({ name: a.name, role: a.role })),
              },
            });
          });
        });
      }

      setEvents(mappedEvents);
    } catch (err: any) {
      toast.error(err.message || "Failed to load calendar events");
    } finally {
      setLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    if (currentDate) {
      fetchCalendar(currentDate);
    }
  }, [fetchCalendar, currentDate]);

  // Handle slot selection for rapid scheduling
  const handleSelectSlot = (slot: EventCalendarSlotDraft) => {
    setSlotDraftDate(slot.start);
    setScheduleModalOpen(true);
  };

  // Render chip inside calendar grid
  const renderChip = useCallback(
    ({ occurrence, segment }: EventCalendarRenderEventProps<MeetingData>) => {
      const data = occurrence.event.data;
      if (!data) return undefined;
      const minutes = (segment.endMin ?? 0) - (segment.startMin ?? 0);

      return (
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedMeeting({
              ...data,
              title: occurrence.event.title,
              start: occurrence.event.start,
              end: occurrence.event.end,
            });
          }}
          className="flex h-full w-full min-w-0 flex-col justify-start p-1 cursor-pointer transition hover:opacity-95 text-white"
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <Avatar className="size-4 shrink-0 rounded-full border border-white/40">
              <AvatarFallback className="bg-white/20 text-[8px] font-bold text-white">
                {data.hostInitials}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-xs font-semibold leading-tight">
              {occurrence.event.title}
            </span>
          </div>

          {minutes >= 30 && (
            <div className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-white/80">
              <span className="truncate">{data.hostName}</span>
              {data.status === "active" && (
                <span className="rounded bg-emerald-400 px-1 text-[9px] font-bold text-emerald-950">
                  LIVE
                </span>
              )}
            </div>
          )}
        </div>
      );
    },
    []
  );

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#e4e1dd] pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wider text-[#006b8f] uppercase">
                Time-Grid Scheduling
              </span>
            </div>
            <h1 className="mt-1 font-serif text-2xl font-normal text-[#161513]">
              Meeting Calendar
            </h1>
            <p className="mt-0.5 text-xs text-[#68635d]">
              Live schedule synchronized with monthly meetings endpoint
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              onClick={() => {
                setSlotDraftDate(new Date());
                setScheduleModalOpen(true);
              }}
              className="h-8 rounded-[4px] border-0 bg-[#312d2a] px-3.5 text-xs font-semibold text-white shadow-none transition-colors hover:bg-[#47423e]"
            >
              <HugeiconsIcon icon={PlusSignIcon} className="mr-1.5 size-3.5" />
              Schedule Meeting
            </Button>
          </div>
        </div>

        {/* Time-Grid Calendar Card */}
        <div className="rounded-[4px] border border-[#e4e1dd] bg-white p-4 shadow-none min-h-[720px]">
          {!mounted ? (
            <div className="flex min-h-[680px] w-full flex-col items-center justify-center gap-3 text-xs text-[#8a847f]">
              <div className="size-6 border-2 border-[#312d2a] border-t-transparent rounded-full animate-spin" />
              <span>Initializing calendar time-grid...</span>
            </div>
          ) : (
            <EventCalendar<MeetingData>
              events={events}
              defaultView="week"
              dayStartHour={8}
              dayEndHour={20}
              interval={30}
              snapDuration={15}
              apiRef={apiRef}
              renderEvent={renderChip}
              onSelectSlot={handleSelectSlot}
              interactions={{ drag: true, resize: true, selectSlot: true }}
              className="min-h-[700px] w-full"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#e4e1dd] mb-4">
                <EventCalendarNav className="min-w-0" />
                <EventCalendarToolbar />
              </div>
            </EventCalendar>
          )}
        </div>

        {/* Interactive Event Popover / Detail Modal */}
        {selectedMeeting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-[4px] border border-[#e4e1dd] bg-white p-6 shadow-none animate-in fade-in-0 duration-150">
              <div className="flex items-start justify-between border-b border-[#e4e1dd] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        selectedMeeting.status === "active"
                          ? "bg-emerald-100 text-emerald-800"
                          : selectedMeeting.status === "scheduled"
                          ? "bg-sky-100 text-sky-800"
                          : "bg-zinc-100 text-zinc-700"
                      }`}
                    >
                      {selectedMeeting.status}
                    </span>
                    <span className="font-mono text-xs text-[#8a847f]">
                      {selectedMeeting.roomName}
                    </span>
                  </div>
                  <h3 className="mt-2 font-serif text-xl font-normal text-[#161513]">
                    {selectedMeeting.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMeeting(null)}
                  className="rounded p-1 text-[#68635d] hover:bg-[#f5f4f2] hover:text-[#161513]"
                >
                  <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3.5 text-xs text-[#312d2a]">
                {/* Time & Duration */}
                <div className="flex items-center gap-2 text-[#68635d]">
                  <HugeiconsIcon icon={Time02Icon} className="size-4 text-[#312d2a]" />
                  <span>
                    {format(selectedMeeting.start, "EEE, MMM d, yyyy · h:mm a")} -{" "}
                    {format(selectedMeeting.end, "h:mm a")}
                  </span>
                </div>

                {/* Duration compare */}
                <div className="rounded-[4px] border border-[#e4e1dd] bg-[#fbf9f8] p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#68635d]">Scheduled Duration:</span>
                    <span className="font-medium text-[#161513]">
                      {selectedMeeting.scheduledDurationMins} minutes
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#68635d]">Actual Call Duration:</span>
                    <span className="font-medium text-[#161513]">
                      {selectedMeeting.actualDurationMins > 0
                        ? `${selectedMeeting.actualDurationMins} minutes`
                        : "Not conducted / In progress"}
                    </span>
                  </div>
                </div>

                {/* Host Info */}
                <div className="flex items-center gap-2.5 pt-1">
                  <Avatar className="size-7 rounded-[4px] border border-[#e4e1dd]">
                    <AvatarFallback className="bg-[#f1efed] text-xs font-semibold text-[#161513]">
                      {selectedMeeting.hostInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-[#161513]">
                      Host: {selectedMeeting.hostName}
                    </p>
                    <p className="text-[11px] text-[#68635d]">
                      {selectedMeeting.hostEmail}
                    </p>
                  </div>
                </div>

                {/* Attendees list */}
                {selectedMeeting.attendees && selectedMeeting.attendees.length > 0 && (
                  <div className="pt-2 border-t border-[#e4e1dd]">
                    <p className="font-semibold text-[#161513] mb-2">
                      Attendees ({selectedMeeting.attendees.length})
                    </p>
                    <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                      {selectedMeeting.attendees.map((att, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-[4px] bg-[#f5f4f2] px-2.5 py-1 text-[11px]"
                        >
                          <span className="truncate">{att.name}</span>
                          <span className="text-[#68635d] capitalize">
                            {att.role}
                            {att.duration ? ` · ${att.duration}m` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action: Join Meeting */}
              <div className="mt-5 flex items-center justify-end gap-2 border-t border-[#e4e1dd] pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedMeeting(null)}
                  className="h-8 rounded-[4px] border-[#d4cfca] bg-white px-3 text-xs text-[#161513] shadow-none hover:bg-[#f5f4f2]"
                >
                  Close
                </Button>

                {(selectedMeeting.status === "active" ||
                  isSameDay(selectedMeeting.start, currentDate || selectedMeeting.start)) && (
                  <Button
                    type="button"
                    onClick={() => {
                      joinMeeting(selectedMeeting.roomName, selectedMeeting.title);
                      setSelectedMeeting(null);
                    }}
                    className="h-8 rounded-[4px] border-0 bg-[#312d2a] px-4 text-xs font-semibold text-white shadow-none transition-colors hover:bg-[#47423e]"
                  >
                    <HugeiconsIcon icon={Video01Icon} className="mr-1.5 size-3.5" />
                    Join Meeting
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Schedule Meeting Modal */}
        <ScheduleMeetingModal
          open={scheduleModalOpen}
          onOpenChange={setScheduleModalOpen}
          onScheduled={() => {
            if (currentDate) fetchCalendar(currentDate);
          }}
          initialDate={slotDraftDate}
        />
      </div>
    </AppLayout>
  );
}
