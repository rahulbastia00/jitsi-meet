"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { api, type Team } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Calendar03Icon } from "@hugeicons/core-free-icons";

interface ScheduleMeetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScheduled?: () => void;
  initialDate?: Date;
}

export function ScheduleMeetingModal({
  open,
  onOpenChange,
  onScheduled,
  initialDate,
}: ScheduleMeetingModalProps) {
  const { activeOrg } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [allowGuests, setAllowGuests] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && activeOrg) {
      api.organizations
        .teams(activeOrg.id)
        .then((res) => setTeams(res))
        .catch(() => setTeams([]));

      const now = initialDate || new Date();
      // round to next 30 min
      const start = new Date(now.getTime() + 15 * 60 * 1000);
      start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
      const end = new Date(start.getTime() + 45 * 60 * 1000);

      const toLocalISO = (d: Date) => {
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().slice(0, 16);
      };

      setStartDate(toLocalISO(start));
      setEndDate(toLocalISO(end));
      setTitle("Team Sync");
      setDescription("");
      setSelectedTeams([]);
    }
  }, [open, activeOrg, initialDate]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a meeting title.");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Please select start and end times.");
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      toast.error("Start time must be before end time.");
      return;
    }

    setLoading(true);
    try {
      await api.meetings.createScheduled({
        title: title.trim(),
        description: description.trim() || undefined,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        team_ids: selectedTeams,
        allow_guests: allowGuests,
        org_id: activeOrg?.id,
      });
      toast.success("Meeting scheduled successfully");
      onOpenChange(false);
      onScheduled?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to schedule meeting");
    } finally {
      setLoading(false);
    }
  };

  const toggleTeam = (teamId: string) => {
    setSelectedTeams((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-[4px] border border-[#e4e1dd] bg-white p-6 shadow-none">
        <div className="flex items-center justify-between border-b border-[#e4e1dd] pb-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-[4px] bg-[#f1efed] text-[#312d2a]">
              <HugeiconsIcon icon={Calendar03Icon} className="size-4" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-normal text-[#161513]">
                Schedule Meeting
              </h3>
              <p className="text-xs text-[#68635d]">
                Set date, duration, and invited departments
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded p-1 text-[#68635d] hover:bg-[#f5f4f2] hover:text-[#161513]"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
          <div>
            <Label htmlFor="sched-title" className="mb-1 block text-xs font-semibold text-[#161513]">
              Meeting Title *
            </Label>
            <Input
              id="sched-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sprint Backlog Review"
              className="h-10 rounded-[4px] border-[#d4cfca] bg-white text-sm text-[#161513] shadow-none focus-visible:border-[#227e9e] focus-visible:ring-1 focus-visible:ring-[#227e9e]"
            />
          </div>

          <div>
            <Label htmlFor="sched-desc" className="mb-1 block text-xs font-semibold text-[#161513]">
              Description (Optional)
            </Label>
            <Input
              id="sched-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Meeting agenda and discussion topics"
              className="h-10 rounded-[4px] border-[#d4cfca] bg-white text-sm text-[#161513] shadow-none focus-visible:border-[#227e9e] focus-visible:ring-1 focus-visible:ring-[#227e9e]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sched-start" className="mb-1 block text-xs font-semibold text-[#161513]">
                Start Time *
              </Label>
              <Input
                id="sched-start"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 rounded-[4px] border-[#d4cfca] bg-white text-xs text-[#161513] shadow-none focus-visible:border-[#227e9e] focus-visible:ring-1 focus-visible:ring-[#227e9e]"
              />
            </div>
            <div>
              <Label htmlFor="sched-end" className="mb-1 block text-xs font-semibold text-[#161513]">
                End Time *
              </Label>
              <Input
                id="sched-end"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 rounded-[4px] border-[#d4cfca] bg-white text-xs text-[#161513] shadow-none focus-visible:border-[#227e9e] focus-visible:ring-1 focus-visible:ring-[#227e9e]"
              />
            </div>
          </div>

          {teams.length > 0 && (
            <div>
              <Label className="mb-1.5 block text-xs font-semibold text-[#161513]">
                Invite Teams
              </Label>
              <div className="flex flex-wrap gap-2">
                {teams.map((t) => {
                  const isSelected = selectedTeams.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTeam(t.id)}
                      className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2.5 py-1 text-xs font-medium transition ${
                        isSelected
                          ? "border-[#312d2a] bg-[#312d2a] text-white"
                          : "border-[#e4e1dd] bg-[#fbf9f8] text-[#161513] hover:bg-[#f5f4f2]"
                      }`}
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: t.color_tag }}
                      />
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <input
              id="allow-guests"
              type="checkbox"
              checked={allowGuests}
              onChange={(e) => setAllowGuests(e.target.checked)}
              className="size-4 accent-[#312d2a]"
            />
            <Label htmlFor="allow-guests" className="text-xs text-[#68635d]">
              Allow external guest participants to join without account
            </Label>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-[#e4e1dd] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-9 rounded-[4px] border-[#d4cfca] bg-white px-4 text-xs font-medium text-[#161513] shadow-none hover:bg-[#f5f4f2]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="h-9 rounded-[4px] border-0 bg-[#312d2a] px-4 text-xs font-medium text-white shadow-none hover:bg-[#47423e]"
            >
              {loading ? "Scheduling..." : "Confirm Schedule"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
