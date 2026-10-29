"use client";

import React, { useState } from "react";
import { useMeeting } from "@/contexts/meeting-context";
import { useAuth } from "@/contexts/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  CallEnd01Icon,
  Video01Icon,
  Calendar03Icon,
  UserGroupIcon,
  CheckmarkCircle02Icon,
  Settings05Icon,
} from "@hugeicons/core-free-icons";

interface NotificationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NotificationItem {
  id: string;
  senderName: string;
  senderAvatar?: string;
  actionText: string;
  detailText?: string;
  timeAgo: string;
  type: "meeting" | "mention" | "reply" | "invite";
  unread: boolean;
  actionLabel?: string;
  roomName?: string;
}

export function NotificationDrawer({
  open,
  onOpenChange,
}: NotificationDrawerProps) {
  const { activeMeeting, endMeeting, joinMeeting } = useMeeting();
  const { user } = useAuth();
  const [tab, setTab] = useState<"all" | "unread" | "mentions">("all");

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: "n-1",
      senderName: "Jenny Wilson",
      senderAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
      actionText: "scheduled a team sync for next week.",
      detailText: "Reviewing Sprint Roadmap and agent workflow milestones.",
      timeAgo: "12 min ago",
      type: "meeting",
      unread: true,
      actionLabel: "View Details",
    },
    {
      id: "n-2",
      senderName: "Robert Fox",
      senderAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
      actionText: "invited you to DevOps architecture review.",
      detailText: "Please ensure your microphone and screen share are ready.",
      timeAgo: "25 min ago",
      type: "invite",
      unread: true,
      actionLabel: "Join",
      roomName: "DevOpsArchitectureSync",
    },
    {
      id: "n-3",
      senderName: "Emily Chen",
      senderAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
      actionText: "mentioned you in Meeting Notes.",
      detailText: "@you can you confirm the Jitsi Prosody token expiration window?",
      timeAgo: "1 hour ago",
      type: "mention",
      unread: false,
      actionLabel: "Reply",
    },
    {
      id: "n-4",
      senderName: "David Kim",
      senderAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
      actionText: "reassigned member policies in Frontend team.",
      timeAgo: "2 hours ago",
      type: "invite",
      unread: false,
    },
  ]);

  if (!open) return null;

  const filteredNotifications = notifications.filter((n) => {
    if (tab === "unread") return n.unread;
    if (tab === "mentions") return n.type === "mention";
    return true;
  });

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/25">
      <div
        className="fixed inset-0"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      <section
        aria-label="Notification center"
        className="fixed inset-y-0 right-0 flex w-full max-w-[420px] flex-col border-l border-[#e4e1dd] bg-white text-[#161513] shadow-none animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#e4e1dd] px-5">
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-lg font-medium text-[#161513]">
              Notifications
            </h2>
            {unreadCount > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-[#312d2a] text-[11px] font-semibold text-white">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[#68635d]">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-[4px] p-1.5 transition hover:bg-[#f5f4f2] hover:text-[#161513]"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-[#e4e1dd] bg-[#fbf9f8] px-5 py-2.5">
          <button
            type="button"
            onClick={() => setTab("all")}
            className={`rounded-[4px] px-3 py-1 text-xs font-semibold transition ${
              tab === "all"
                ? "bg-[#312d2a] text-white"
                : "text-[#68635d] hover:bg-[#f1efed] hover:text-[#161513]"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setTab("unread")}
            className={`rounded-[4px] px-3 py-1 text-xs font-semibold transition ${
              tab === "unread"
                ? "bg-[#312d2a] text-white"
                : "text-[#68635d] hover:bg-[#f1efed] hover:text-[#161513]"
            }`}
          >
            Unread ({unreadCount})
          </button>
          <button
            type="button"
            onClick={() => setTab("mentions")}
            className={`rounded-[4px] px-3 py-1 text-xs font-semibold transition ${
              tab === "mentions"
                ? "bg-[#312d2a] text-white"
                : "text-[#68635d] hover:bg-[#f1efed] hover:text-[#161513]"
            }`}
          >
            Mentions
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Live Meeting Action Card */}
          {activeMeeting && activeMeeting.isActive && activeMeeting.isHost && (
            <div className="rounded-[4px] border border-[#e4e1dd] bg-[#fbf9f8] p-4 text-[#161513]">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block size-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-xs font-bold tracking-wider uppercase text-emerald-800">
                    Live Session Active
                  </span>
                </div>
                <span className="rounded bg-[#f1efed] px-2 py-0.5 text-[10px] font-mono text-[#68635d]">
                  {activeMeeting.roomName}
                </span>
              </div>

              <p className="mt-2 text-sm font-medium leading-snug">
                &ldquo;{activeMeeting.title}&rdquo; is currently live with{" "}
                <span className="font-bold">{activeMeeting.participantsCount}</span> participant
                {activeMeeting.participantsCount === 1 ? "" : "s"}
              </p>

              <div className="mt-3 flex items-center justify-end gap-2 border-t border-[#e4e1dd] pt-3">
                <Button
                  type="button"
                  onClick={endMeeting}
                  className="h-8 rounded-[4px] border-0 bg-red-600 px-3 text-xs font-medium text-white shadow-none transition-colors hover:bg-red-700"
                >
                  <HugeiconsIcon icon={CallEnd01Icon} className="mr-1 size-3.5" />
                  End Meeting
                </Button>
              </div>
            </div>
          )}

          {/* Regular notifications */}
          {filteredNotifications.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#8a847f]">
              No notifications in this view.
            </div>
          ) : (
            filteredNotifications.map((item) => (
              <div
                key={item.id}
                className={`relative flex items-start gap-3 rounded-[4px] border border-[#e4e1dd] p-3.5 transition ${
                  item.unread ? "bg-white" : "bg-[#fbf9f8]"
                }`}
              >
                <Avatar className="size-8 shrink-0 rounded-full border border-[#e4e1dd]">
                  {item.senderAvatar && <AvatarImage src={item.senderAvatar} alt={item.senderName} />}
                  <AvatarFallback className="bg-[#f1efed] text-xs font-medium text-[#161513]">
                    {item.senderName
                      .split(" ")
                      .map((p) => p[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="truncate text-xs font-semibold text-[#161513]">
                      {item.senderName}{" "}
                      <span className="font-normal text-[#68635d]">
                        {item.actionText}
                      </span>
                    </p>
                    {item.unread && (
                      <span className="size-1.5 shrink-0 rounded-full bg-[#006b8f]" />
                    )}
                  </div>

                  {item.detailText && (
                    <div className="mt-2 rounded-[4px] border border-[#e4e1dd] bg-[#f5f4f2] p-2.5 text-xs text-[#312d2a] leading-relaxed">
                      {item.detailText}
                    </div>
                  )}

                  <div className="mt-2 flex items-center justify-between text-[11px] text-[#8a847f]">
                    <span>{item.timeAgo}</span>
                    {item.actionLabel && (
                      <button
                        type="button"
                        onClick={() => {
                          if (item.roomName) {
                            joinMeeting(item.roomName, item.actionText);
                            onOpenChange(false);
                          }
                        }}
                        className="text-xs font-semibold text-[#006b8f] hover:underline"
                      >
                        {item.actionLabel}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
