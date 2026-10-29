"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/contexts/auth-context";
import { useMeeting } from "@/contexts/meeting-context";
import { api, type Member, type Team } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  MoreHorizontalIcon,
  PlusSignIcon,
  UserGroupIcon,
  ArrowDown01Icon,
  Cancel01Icon,
  Shield01Icon,
  CheckmarkBadge01Icon,
  Video01Icon,
  UserCheck01Icon,
  DragDropVerticalIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";

export default function TeamManagementPage() {
  const { activeOrg } = useAuth();
  const { startInstantMeeting } = useMeeting();
  const [members, setMembers] = useState<Member[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  // Modals state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [selectedMemberForReassign, setSelectedMemberForReassign] =
    useState<Member | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteTeamId, setInviteTeamId] = useState<string>("");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  // Reassign form state
  const [targetTeamId, setTargetTeamId] = useState<string>("");
  const [reassignSubmitting, setReassignSubmitting] = useState(false);

  // Batch action state
  const [batchInviting, setBatchInviting] = useState(false);

  const loadData = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    try {
      const [membersData, teamsData] = await Promise.all([
        api.organizations.members(activeOrg.id),
        api.organizations.teams(activeOrg.id),
      ]);
      setMembers(membersData);
      setTeams(teamsData);

      // Seed default teams if none exist yet
      if (teamsData.length === 0) {
        try {
          const t1 = await api.organizations.createTeam(activeOrg.id, {
            name: "Backend",
            color_tag: "#3B82F6",
          });
          const t2 = await api.organizations.createTeam(activeOrg.id, {
            name: "Frontend",
            color_tag: "#10B981",
          });
          const t3 = await api.organizations.createTeam(activeOrg.id, {
            name: "DevOps",
            color_tag: "#F59E0B",
          });
          setTeams([t1, t2, t3]);
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load team data");
    } finally {
      setLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle IAM Permission toggles
  const handleTogglePermission = async (
    member: Member,
    field: "can_create_meeting" | "can_delete_meeting" | "can_use_ai",
    currentValue: boolean
  ) => {
    if (!activeOrg || member.is_owner) return;
    const nextVal = !currentValue;

    // Optimistic update
    setMembers((prev) =>
      prev.map((m) => (m.id === member.id ? { ...m, [field]: nextVal } : m))
    );

    try {
      await api.organizations.updatePermissions(activeOrg.id, member.id, {
        [field]: nextVal,
      });
      toast.success(
        `Updated ${field.replaceAll("_", " ")} for ${
          member.user.first_name || member.user.email
        }`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update permission");
      // Revert on error
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, [field]: currentValue } : m))
      );
    }
  };

  // Handle member invitation
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg || !inviteEmail.trim()) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setInviteSubmitting(true);
    try {
      await api.organizations.inviteMember(activeOrg.id, {
        email: inviteEmail.trim(),
        first_name: inviteFirstName.trim() || undefined,
        last_name: inviteLastName.trim() || undefined,
        team_id: inviteTeamId || null,
      });
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteModalOpen(false);
      setInviteEmail("");
      setInviteFirstName("");
      setInviteLastName("");
      setInviteTeamId("");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to invite member");
    } finally {
      setInviteSubmitting(false);
    }
  };

  // Handle member reallocation
  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg || !selectedMemberForReassign) return;

    setReassignSubmitting(true);
    try {
      await api.organizations.moveTeam(
        activeOrg.id,
        selectedMemberForReassign.id,
        targetTeamId || null
      );
      toast.success("Team reassigned successfully");
      setReassignModalOpen(false);
      setSelectedMemberForReassign(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to reassign team");
    } finally {
      setReassignSubmitting(false);
    }
  };

  // Handle remove member
  const handleRemoveMember = async (member: Member) => {
    if (!activeOrg || member.is_owner) return;
    if (
      !confirm(
        `Are you sure you want to remove ${
          member.user.first_name || member.user.email
        } from the organization?`
      )
    ) {
      return;
    }

    try {
      await api.organizations.removeMember(activeOrg.id, member.id);
      toast.success("Member removed");
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch (err: any) {
      toast.error(err.message || "Failed to remove member");
    }
  };

  // Handle batch instant meeting invite for selected team
  const handleBatchTeamInvite = async () => {
    if (!activeOrg || selectedTeamFilter === "all") return;
    const team = teams.find((t) => t.id === selectedTeamFilter);
    if (!team) return;

    setBatchInviting(true);
    try {
      const res = await api.organizations.inviteTeamInstant(activeOrg.id, team.id, {
        title: `${team.name} Sync`,
      });
      toast.success(
        `Invited ${res.invited_count} members of ${team.name} to instant meeting!`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to invite team to instant meeting");
    } finally {
      setBatchInviting(false);
    }
  };

  // Filter members
  const filteredMembers = members.filter((m) => {
    if (selectedTeamFilter === "all") return true;
    return m.team?.id === selectedTeamFilter;
  });

  const selectedTeamObject = teams.find((t) => t.id === selectedTeamFilter);

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header section with Linear Backlog styling */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#e4e1dd] pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wider text-[#006b8f] uppercase">
                Directory & Access
              </span>
            </div>
            <h1 className="mt-1 font-serif text-2xl font-normal text-[#161513]">
              Team Management
            </h1>
            <p className="mt-0.5 text-xs text-[#68635d]">
              Sprint Backlog roster with AWS IAM-style policy governance
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Team Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    className="h-8 rounded-[4px] border-[#d4cfca] bg-white px-3 text-xs font-medium text-[#161513] shadow-none hover:bg-[#f5f4f2]"
                  />
                }
              >
                <HugeiconsIcon icon={UserGroupIcon} className="mr-1.5 size-3.5 text-[#312d2a]" />
                <span>
                  {selectedTeamFilter === "all"
                    ? "All Teams"
                    : selectedTeamObject?.name || "Filter Team"}
                </span>
                <HugeiconsIcon icon={ArrowDown01Icon} className="ml-1.5 size-3 text-[#8a847f]" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 rounded-[4px] border border-[#e4e1dd] bg-white p-1 text-xs shadow-none"
              >
                <DropdownMenuItem
                  onClick={() => setSelectedTeamFilter("all")}
                  className={`cursor-pointer rounded-[4px] px-2.5 py-1.5 text-xs ${
                    selectedTeamFilter === "all"
                      ? "bg-[#f1efed] font-semibold text-[#161513]"
                      : "text-[#312d2a] hover:bg-[#f5f4f2]"
                  }`}
                >
                  All Teams ({members.length})
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 bg-[#e4e1dd]" />
                {teams.map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    onClick={() => setSelectedTeamFilter(t.id)}
                    className={`flex items-center gap-2 cursor-pointer rounded-[4px] px-2.5 py-1.5 text-xs ${
                      selectedTeamFilter === t.id
                        ? "bg-[#f1efed] font-semibold text-[#161513]"
                        : "text-[#312d2a] hover:bg-[#f5f4f2]"
                    }`}
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: t.color_tag }}
                    />
                    <span>{t.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Batch Action: Invite Entire Team to Instant Meeting */}
            {selectedTeamFilter !== "all" && selectedTeamObject && (
              <Button
                type="button"
                onClick={handleBatchTeamInvite}
                disabled={batchInviting}
                className="h-8 rounded-[4px] border border-[#d4cfca] bg-white px-3 text-xs font-semibold text-[#006b8f] shadow-none transition-colors hover:bg-[#f5f4f2]"
              >
                <HugeiconsIcon icon={Video01Icon} className="mr-1.5 size-3.5" />
                {batchInviting
                  ? "Inviting..."
                  : `Invite Entire ${selectedTeamObject.name} to Instant Meeting`}
              </Button>
            )}

            {/* Action: + Invite Member */}
            <Button
              type="button"
              onClick={() => setInviteModalOpen(true)}
              className="h-8 rounded-[4px] border-0 bg-[#312d2a] px-3.5 text-xs font-semibold text-white shadow-none transition-colors hover:bg-[#47423e]"
            >
              <HugeiconsIcon icon={PlusSignIcon} className="mr-1.5 size-3.5" />
              Invite Member
            </Button>
          </div>
        </div>

        {/* Linear Backlog Style Data Table */}
        <div className="rounded-[4px] border border-[#e4e1dd] bg-white overflow-hidden shadow-none">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#e4e1dd] bg-[#f5f4f2] text-[11px] font-semibold text-[#68635d] uppercase tracking-wider">
                  <th className="w-10 px-3 py-3 text-center">#</th>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3">Permissions (AWS IAM-Style)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="w-12 px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e4e1dd] text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#8a847f]">
                      Loading team roster...
                    </td>
                  </tr>
                ) : filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#8a847f]">
                      No members found for this team. Click &quot;Invite Member&quot; to add someone.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member, index) => {
                    const fullName =
                      member.user.first_name || member.user.last_name
                        ? `${member.user.first_name || ""} ${
                            member.user.last_name || ""
                          }`.trim()
                        : member.user.email.split("@")[0];

                    const initials = fullName
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();

                    return (
                      <tr
                        key={member.id}
                        className="group transition-colors hover:bg-[#fbf9f8]"
                      >
                        {/* Drag handle & Index */}
                        <td className="px-3 py-3.5 text-center text-[#aea8a2]">
                          <div className="flex items-center justify-center gap-1">
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                              <HugeiconsIcon
                                icon={DragDropVerticalIcon}
                                className="size-3.5 text-[#8a847f]"
                              />
                            </span>
                            <span className="font-mono text-[11px] text-[#8a847f]">
                              {index + 1}
                            </span>
                          </div>
                        </td>

                        {/* Member */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8 rounded-[4px] border border-[#e4e1dd]">
                              <AvatarFallback className="bg-[#f1efed] text-xs font-semibold text-[#161513]">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col min-w-0">
                              <span className="truncate font-semibold text-[#161513]">
                                {fullName}
                              </span>
                              <span className="truncate text-[11px] text-[#68635d]">
                                {member.user.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Team */}
                        <td className="px-4 py-3.5">
                          {member.team ? (
                            <span
                              className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-0.5 text-xs font-medium border"
                              style={{
                                borderColor: `${member.team.color_tag}40`,
                                backgroundColor: `${member.team.color_tag}15`,
                                color: member.team.color_tag,
                              }}
                            >
                              <span
                                className="size-1.5 rounded-full"
                                style={{ backgroundColor: member.team.color_tag }}
                              />
                              {member.team.name}
                            </span>
                          ) : (
                            <span className="text-[#aea8a2] text-[11px]">
                              Unassigned
                            </span>
                          )}
                        </td>

                        {/* Permissions (AWS IAM-Style Multi-Select Popover) */}
                        <td className="px-4 py-3.5">
                          {member.is_owner ? (
                            <span className="inline-flex items-center gap-1 rounded-[4px] border border-[#312d2a] bg-[#312d2a] px-2 py-0.5 text-[11px] font-semibold text-white">
                              <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-3" />
                              Owner (Full Privileges)
                            </span>
                          ) : (
                            <Popover>
                              <PopoverTrigger
                                render={
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#d4cfca] bg-white px-2 py-1 text-xs font-medium text-[#312d2a] hover:bg-[#f5f4f2] transition"
                                  />
                                }
                              >
                                <HugeiconsIcon
                                  icon={Shield01Icon}
                                  className="size-3.5 text-[#006b8f]"
                                />
                                <span>
                                  {[
                                    member.can_create_meeting && "Create",
                                    member.can_delete_meeting && "Delete",
                                    member.can_use_ai && "AI",
                                  ]
                                    .filter(Boolean)
                                    .join(", ") || "No Policies"}
                                </span>
                                <HugeiconsIcon
                                  icon={ArrowDown01Icon}
                                  className="size-3 text-[#8a847f]"
                                />
                              </PopoverTrigger>

                              <PopoverContent
                                align="start"
                                className="w-56 rounded-[4px] border border-[#e4e1dd] bg-white p-3 text-xs shadow-none space-y-2"
                              >
                                <div className="border-b border-[#e4e1dd] pb-1.5 font-semibold text-[#161513]">
                                  IAM Policy Toggles
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer py-0.5 text-xs text-[#312d2a]">
                                  <input
                                    type="checkbox"
                                    checked={member.can_create_meeting}
                                    onChange={() =>
                                      handleTogglePermission(
                                        member,
                                        "can_create_meeting",
                                        member.can_create_meeting
                                      )
                                    }
                                    className="size-3.5 accent-[#312d2a]"
                                  />
                                  <span>can_create_meeting</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer py-0.5 text-xs text-[#312d2a]">
                                  <input
                                    type="checkbox"
                                    checked={member.can_delete_meeting}
                                    onChange={() =>
                                      handleTogglePermission(
                                        member,
                                        "can_delete_meeting",
                                        member.can_delete_meeting
                                      )
                                    }
                                    className="size-3.5 accent-[#312d2a]"
                                  />
                                  <span>can_delete_meeting</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer py-0.5 text-xs text-[#312d2a]">
                                  <input
                                    type="checkbox"
                                    checked={member.can_use_ai}
                                    onChange={() =>
                                      handleTogglePermission(
                                        member,
                                        "can_use_ai",
                                        member.can_use_ai
                                      )
                                    }
                                    className="size-3.5 accent-[#312d2a]"
                                  />
                                  <span>can_use_ai</span>
                                </label>
                              </PopoverContent>
                            </Popover>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              member.status === "active"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : member.status === "invited"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-zinc-100 text-zinc-600 border border-zinc-200"
                            }`}
                          >
                            {member.status.charAt(0).toUpperCase() +
                              member.status.slice(1)}
                          </span>
                        </td>

                        {/* Actions (...) */}
                        <td className="px-3 py-3.5 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <button
                                  type="button"
                                  className="inline-flex size-7 items-center justify-center rounded-[4px] text-[#68635d] hover:bg-[#f1efed] hover:text-[#161513]"
                                />
                              }
                            >
                              <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-52 rounded-[4px] border border-[#e4e1dd] bg-white p-1 text-xs shadow-none"
                            >
                              <DropdownMenuItem
                                onClick={() =>
                                  startInstantMeeting(
                                    `Meeting with ${fullName}`,
                                    activeOrg?.id
                                  )
                                }
                                className="cursor-pointer rounded-[4px] px-2.5 py-1.5 text-xs text-[#312d2a] hover:bg-[#f5f4f2]"
                              >
                                <HugeiconsIcon icon={Video01Icon} className="mr-2 size-3.5 text-[#312d2a]" />
                                Send Instant Meeting Invite
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedMemberForReassign(member);
                                  setTargetTeamId(member.team?.id || "");
                                  setReassignModalOpen(true);
                                }}
                                className="cursor-pointer rounded-[4px] px-2.5 py-1.5 text-xs text-[#312d2a] hover:bg-[#f5f4f2]"
                              >
                                <HugeiconsIcon icon={UserGroupIcon} className="mr-2 size-3.5 text-[#312d2a]" />
                                Reassign Team
                              </DropdownMenuItem>

                              <DropdownMenuSeparator className="my-1 bg-[#e4e1dd]" />

                              <DropdownMenuItem
                                disabled={member.is_owner}
                                onClick={() => handleRemoveMember(member)}
                                className={`cursor-pointer rounded-[4px] px-2.5 py-1.5 text-xs ${
                                  member.is_owner
                                    ? "opacity-50 cursor-not-allowed text-[#aea8a2]"
                                    : "text-red-600 hover:bg-red-50"
                                }`}
                              >
                                <HugeiconsIcon icon={Cancel01Icon} className="mr-2 size-3.5 text-red-600" />
                                Remove Member
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invite Member Modal */}
        {inviteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-[4px] border border-[#e4e1dd] bg-white p-6 shadow-none">
              <div className="flex items-center justify-between border-b border-[#e4e1dd] pb-4">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-[4px] bg-[#f1efed] text-[#312d2a]">
                    <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
                  </div>
                  <div>
                    <h3 className="font-serif text-xl font-normal text-[#161513]">
                      Invite Team Member
                    </h3>
                    <p className="text-xs text-[#68635d]">
                      Add colleagues to {activeOrg?.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="rounded p-1 text-[#68635d] hover:bg-[#f5f4f2] hover:text-[#161513]"
                >
                  <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                </button>
              </div>

              <form onSubmit={handleInviteSubmit} className="mt-5 flex flex-col gap-4">
                <div>
                  <Label htmlFor="invite-email" className="mb-1 block text-xs font-semibold text-[#161513]">
                    Email Address *
                  </Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@company.com"
                    required
                    className="h-10 rounded-[4px] border-[#d4cfca] bg-white text-sm text-[#161513] shadow-none focus-visible:border-[#227e9e] focus-visible:ring-1 focus-visible:ring-[#227e9e]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="invite-fname" className="mb-1 block text-xs font-semibold text-[#161513]">
                      First Name
                    </Label>
                    <Input
                      id="invite-fname"
                      value={inviteFirstName}
                      onChange={(e) => setInviteFirstName(e.target.value)}
                      placeholder="Jane"
                      className="h-10 rounded-[4px] border-[#d4cfca] bg-white text-sm text-[#161513] shadow-none focus-visible:border-[#227e9e] focus-visible:ring-1 focus-visible:ring-[#227e9e]"
                    />
                  </div>
                  <div>
                    <Label htmlFor="invite-lname" className="mb-1 block text-xs font-semibold text-[#161513]">
                      Last Name
                    </Label>
                    <Input
                      id="invite-lname"
                      value={inviteLastName}
                      onChange={(e) => setInviteLastName(e.target.value)}
                      placeholder="Doe"
                      className="h-10 rounded-[4px] border-[#d4cfca] bg-white text-sm text-[#161513] shadow-none focus-visible:border-[#227e9e] focus-visible:ring-1 focus-visible:ring-[#227e9e]"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="invite-team" className="mb-1 block text-xs font-semibold text-[#161513]">
                    Assign Team
                  </Label>
                  <select
                    id="invite-team"
                    value={inviteTeamId}
                    onChange={(e) => setInviteTeamId(e.target.value)}
                    className="h-10 w-full rounded-[4px] border border-[#d4cfca] bg-white px-3 text-xs text-[#161513] shadow-none outline-none focus:border-[#227e9e]"
                  >
                    <option value="">No Team Assigned</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2 border-t border-[#e4e1dd] pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setInviteModalOpen(false)}
                    className="h-9 rounded-[4px] border-[#d4cfca] bg-white px-4 text-xs font-medium text-[#161513] shadow-none hover:bg-[#f5f4f2]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={inviteSubmitting}
                    className="h-9 rounded-[4px] border-0 bg-[#312d2a] px-4 text-xs font-medium text-white shadow-none hover:bg-[#47423e]"
                  >
                    {inviteSubmitting ? "Sending..." : "Dispatch Invitation"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reassign Team Modal */}
        {reassignModalOpen && selectedMemberForReassign && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-[4px] border border-[#e4e1dd] bg-white p-6 shadow-none">
              <div className="flex items-center justify-between border-b border-[#e4e1dd] pb-4">
                <h3 className="font-serif text-lg font-normal text-[#161513]">
                  Reassign Team
                </h3>
                <button
                  type="button"
                  onClick={() => setReassignModalOpen(false)}
                  className="rounded p-1 text-[#68635d] hover:bg-[#f5f4f2] hover:text-[#161513]"
                >
                  <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                </button>
              </div>

              <form onSubmit={handleReassignSubmit} className="mt-4 flex flex-col gap-4">
                <p className="text-xs text-[#68635d]">
                  Select new department for{" "}
                  <strong className="text-[#161513]">
                    {selectedMemberForReassign.user.first_name ||
                      selectedMemberForReassign.user.email}
                  </strong>
                  :
                </p>

                <select
                  value={targetTeamId}
                  onChange={(e) => setTargetTeamId(e.target.value)}
                  className="h-10 w-full rounded-[4px] border border-[#d4cfca] bg-white px-3 text-xs text-[#161513] shadow-none outline-none focus:border-[#227e9e]"
                >
                  <option value="">Unassigned</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>

                <div className="mt-3 flex items-center justify-end gap-2 border-t border-[#e4e1dd] pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setReassignModalOpen(false)}
                    className="h-9 rounded-[4px] border-[#d4cfca] bg-white px-3 text-xs font-medium text-[#161513] shadow-none hover:bg-[#f5f4f2]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={reassignSubmitting}
                    className="h-9 rounded-[4px] border-0 bg-[#312d2a] px-3.5 text-xs font-medium text-white shadow-none hover:bg-[#47423e]"
                  >
                    {reassignSubmitting ? "Saving..." : "Update Team"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
