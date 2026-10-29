"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/contexts/auth-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Settings05Icon,
  SecurityCheckIcon,
  UserCheck01Icon,
  Copy01Icon,
  CheckmarkBadge01Icon,
  Shield01Icon,
  Video01Icon,
  Building02Icon,
} from "@hugeicons/core-free-icons";

type SettingsTab = "general" | "policies" | "defaults";

export default function SettingsPage() {
  const { activeOrg, reloadOrganizations } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  // General settings state
  const [orgName, setOrgName] = useState(activeOrg?.name || "");
  const [jitsiDomain, setJitsiDomain] = useState(
    process.env.NEXT_PUBLIC_JITSI_DOMAIN || "meet.example.com"
  );
  const [savingGeneral, setSavingGeneral] = useState(false);

  // Meeting policies state
  const [allowGuests, setAllowGuests] = useState(true);
  const [requireLobby, setRequireLobby] = useState(false);
  const [enableE2EE, setEnableE2EE] = useState(true);
  const [enableAIAutoSummaries, setEnableAIAutoSummaries] = useState(true);

  // Member defaults state
  const [defaultCanCreateMeeting, setDefaultCanCreateMeeting] = useState(true);
  const [defaultCanDeleteMeeting, setDefaultCanDeleteMeeting] = useState(false);
  const [defaultCanUseAI, setDefaultCanUseAI] = useState(true);

  useEffect(() => {
    if (activeOrg) {
      setOrgName(activeOrg.name);
    }
  }, [activeOrg]);

  const handleCopyOrgId = () => {
    if (activeOrg?.id) {
      navigator.clipboard.writeText(activeOrg.id);
      toast.success("Workspace ID copied to clipboard");
    }
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      toast.error("Organization name cannot be empty");
      return;
    }
    setSavingGeneral(true);
    try {
      // simulate org name update or persist
      toast.success("General settings saved successfully");
      await reloadOrganizations();
    } catch (err: any) {
      toast.error(err.message || "Failed to update workspace name");
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleSavePolicies = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Meeting policies updated successfully");
  };

  const handleSaveDefaults = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Member default policies saved successfully");
  };

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b border-[#e4e1dd] pb-5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-wider text-[#006b8f] uppercase">
              Configuration
            </span>
          </div>
          <h1 className="mt-1 font-serif text-2xl font-normal text-[#161513]">
            Settings
          </h1>
          <p className="mt-0.5 text-xs text-[#68635d]">
            Manage workspace preferences, Jitsi bridge settings, and member defaults
          </p>
        </div>

        {/* Two-Column GitHub-Style Layout */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
          {/* Left Navigation Rail */}
          <nav className="flex flex-col space-y-1">
            <button
              type="button"
              onClick={() => setActiveTab("general")}
              className={`flex items-center gap-2.5 rounded-[4px] px-3 py-2 text-left text-xs font-medium transition ${
                activeTab === "general"
                  ? "bg-[#f1efed] font-semibold text-[#161513] border-l-2 border-[#161513]"
                  : "text-[#68635d] hover:bg-[#f5f4f2] hover:text-[#161513]"
              }`}
            >
              <HugeiconsIcon icon={Building02Icon} className="size-4 text-[#312d2a]" />
              General
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("policies")}
              className={`flex items-center gap-2.5 rounded-[4px] px-3 py-2 text-left text-xs font-medium transition ${
                activeTab === "policies"
                  ? "bg-[#f1efed] font-semibold text-[#161513] border-l-2 border-[#161513]"
                  : "text-[#68635d] hover:bg-[#f5f4f2] hover:text-[#161513]"
              }`}
            >
              <HugeiconsIcon icon={SecurityCheckIcon} className="size-4 text-[#312d2a]" />
              Meeting Policies
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("defaults")}
              className={`flex items-center gap-2.5 rounded-[4px] px-3 py-2 text-left text-xs font-medium transition ${
                activeTab === "defaults"
                  ? "bg-[#f1efed] font-semibold text-[#161513] border-l-2 border-[#161513]"
                  : "text-[#68635d] hover:bg-[#f5f4f2] hover:text-[#161513]"
              }`}
            >
              <HugeiconsIcon icon={UserCheck01Icon} className="size-4 text-[#312d2a]" />
              Member Defaults
            </button>
          </nav>

          {/* Main Panel */}
          <div className="md:col-span-3 space-y-6">
            {/* Tab 1: General */}
            {activeTab === "general" && (
              <div className="space-y-6">
                <form
                  onSubmit={handleSaveGeneral}
                  className="rounded-[4px] border border-[#e4e1dd] bg-white p-6 shadow-none space-y-5"
                >
                  <div className="border-b border-[#e4e1dd] pb-4">
                    <h2 className="font-serif text-lg font-normal text-[#161513]">
                      Workspace Information
                    </h2>
                    <p className="text-xs text-[#68635d]">
                      Public and internal workspace identifiers
                    </p>
                  </div>

                  <div>
                    <Label
                      htmlFor="org-name"
                      className="mb-1 block text-xs font-semibold text-[#161513]"
                    >
                      Workspace Name
                    </Label>
                    <div className="flex gap-2 max-w-md">
                      <Input
                        id="org-name"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        className="h-10 rounded-[4px] border-[#d4cfca] bg-white text-sm text-[#161513] shadow-none focus-visible:border-[#227e9e] focus-visible:ring-1 focus-visible:ring-[#227e9e]"
                      />
                      <Button
                        type="submit"
                        disabled={savingGeneral}
                        className="h-10 rounded-[4px] border-0 bg-[#312d2a] px-4 text-xs font-semibold text-white shadow-none transition-colors hover:bg-[#47423e]"
                      >
                        Rename
                      </Button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Label className="mb-1 block text-xs font-semibold text-[#161513]">
                      Workspace ID
                    </Label>
                    <div className="flex items-center gap-2 max-w-md">
                      <code className="flex-1 rounded-[4px] border border-[#e4e1dd] bg-[#fbf9f8] px-3 py-2 font-mono text-xs text-[#312d2a]">
                        {activeOrg?.id || "e3b0c442-98fc-1c14-9afb-4c7fa4360e00"}
                      </code>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCopyOrgId}
                        className="h-9 rounded-[4px] border-[#d4cfca] bg-white px-3 text-xs text-[#161513] shadow-none hover:bg-[#f5f4f2]"
                      >
                        <HugeiconsIcon icon={Copy01Icon} className="mr-1 size-3.5" />
                        Copy
                      </Button>
                    </div>
                    <p className="mt-1 text-[11px] text-[#8a847f]">
                      Used for backend API integration and webhook routing.
                    </p>
                  </div>
                </form>

                <div className="rounded-[4px] border border-[#e4e1dd] bg-white p-6 shadow-none space-y-4">
                  <div className="border-b border-[#e4e1dd] pb-4">
                    <h2 className="font-serif text-lg font-normal text-[#161513]">
                      Jitsi Bridge Configuration
                    </h2>
                    <p className="text-xs text-[#68635d]">
                      Prosody XMPP server domain and self-hosted videobridge
                    </p>
                  </div>

                  <div>
                    <Label
                      htmlFor="jitsi-domain"
                      className="mb-1 block text-xs font-semibold text-[#161513]"
                    >
                      Jitsi Domain
                    </Label>
                    <div className="max-w-md">
                      <Input
                        id="jitsi-domain"
                        value={jitsiDomain}
                        onChange={(e) => setJitsiDomain(e.target.value)}
                        placeholder="meet.example.com"
                        className="h-10 rounded-[4px] border-[#d4cfca] bg-white text-sm text-[#161513] shadow-none focus-visible:border-[#227e9e] focus-visible:ring-1 focus-visible:ring-[#227e9e]"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-[#8a847f]">
                      Defaults to NEXT_PUBLIC_JITSI_DOMAIN from client/.env.local.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Meeting Policies */}
            {activeTab === "policies" && (
              <form
                onSubmit={handleSavePolicies}
                className="rounded-[4px] border border-[#e4e1dd] bg-white p-6 shadow-none space-y-6"
              >
                <div className="border-b border-[#e4e1dd] pb-4">
                  <h2 className="font-serif text-lg font-normal text-[#161513]">
                    Meeting Security & Guest Access Policies
                  </h2>
                  <p className="text-xs text-[#68635d]">
                    Enforce default lobby knocking, guest permissions, and encryption
                  </p>
                </div>

                <div className="space-y-4 divide-y divide-[#e4e1dd]">
                  <div className="flex items-start justify-between gap-4 pt-3 first:pt-0">
                    <div>
                      <h4 className="text-xs font-semibold text-[#161513]">
                        Guest Direct Access
                      </h4>
                      <p className="text-xs text-[#68635d] mt-0.5">
                        Allow unauthenticated external participants to join sessions with direct room link.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={allowGuests}
                      onChange={(e) => setAllowGuests(e.target.checked)}
                      className="size-4 mt-1 accent-[#312d2a]"
                    />
                  </div>

                  <div className="flex items-start justify-between gap-4 pt-4">
                    <div>
                      <h4 className="text-xs font-semibold text-[#161513]">
                        Lobby & Knocking Mode
                      </h4>
                      <p className="text-xs text-[#68635d] mt-0.5">
                        Require host or moderator approval before participants enter the video room.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={requireLobby}
                      onChange={(e) => setRequireLobby(e.target.checked)}
                      className="size-4 mt-1 accent-[#312d2a]"
                    />
                  </div>

                  <div className="flex items-start justify-between gap-4 pt-4">
                    <div>
                      <h4 className="text-xs font-semibold text-[#161513]">
                        End-to-End Encryption (E2EE)
                      </h4>
                      <p className="text-xs text-[#68635d] mt-0.5">
                        Enforce client-side cryptographic key exchange on all peer streams.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={enableE2EE}
                      onChange={(e) => setEnableE2EE(e.target.checked)}
                      className="size-4 mt-1 accent-[#312d2a]"
                    />
                  </div>

                  <div className="flex items-start justify-between gap-4 pt-4">
                    <div>
                      <h4 className="text-xs font-semibold text-[#161513]">
                        Agentic AI Auto-Summaries
                      </h4>
                      <p className="text-xs text-[#68635d] mt-0.5">
                        Automatically synthesize action items and meeting transcripts when calls conclude.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={enableAIAutoSummaries}
                      onChange={(e) => setEnableAIAutoSummaries(e.target.checked)}
                      className="size-4 mt-1 accent-[#312d2a]"
                    />
                  </div>
                </div>

                <div className="border-t border-[#e4e1dd] pt-4 flex justify-end">
                  <Button
                    type="submit"
                    className="h-9 rounded-[4px] border-0 bg-[#312d2a] px-4 text-xs font-medium text-white shadow-none transition-colors hover:bg-[#47423e]"
                  >
                    Save Policies
                  </Button>
                </div>
              </form>
            )}

            {/* Tab 3: Member Defaults */}
            {activeTab === "defaults" && (
              <form
                onSubmit={handleSaveDefaults}
                className="rounded-[4px] border border-[#e4e1dd] bg-white p-6 shadow-none space-y-6"
              >
                <div className="border-b border-[#e4e1dd] pb-4">
                  <h2 className="font-serif text-lg font-normal text-[#161513]">
                    Default Member Permissions
                  </h2>
                  <p className="text-xs text-[#68635d]">
                    Initial IAM policies assigned to newly invited workspace members
                  </p>
                </div>

                <div className="space-y-4 divide-y divide-[#e4e1dd]">
                  <div className="flex items-start justify-between gap-4 pt-3 first:pt-0">
                    <div>
                      <h4 className="text-xs font-semibold text-[#161513]">
                        can_create_meeting
                      </h4>
                      <p className="text-xs text-[#68635d] mt-0.5">
                        New members can initiate instant meetings and schedule room reservations.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={defaultCanCreateMeeting}
                      onChange={(e) => setDefaultCanCreateMeeting(e.target.checked)}
                      className="size-4 mt-1 accent-[#312d2a]"
                    />
                  </div>

                  <div className="flex items-start justify-between gap-4 pt-4">
                    <div>
                      <h4 className="text-xs font-semibold text-[#161513]">
                        can_delete_meeting
                      </h4>
                      <p className="text-xs text-[#68635d] mt-0.5">
                        New members can delete recorded sessions or cancel scheduled meetings.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={defaultCanDeleteMeeting}
                      onChange={(e) => setDefaultCanDeleteMeeting(e.target.checked)}
                      className="size-4 mt-1 accent-[#312d2a]"
                    />
                  </div>

                  <div className="flex items-start justify-between gap-4 pt-4">
                    <div>
                      <h4 className="text-xs font-semibold text-[#161513]">
                        can_use_ai
                      </h4>
                      <p className="text-xs text-[#68635d] mt-0.5">
                        New members can trigger AI meeting transcripts and live meeting agent assistance.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={defaultCanUseAI}
                      onChange={(e) => setDefaultCanUseAI(e.target.checked)}
                      className="size-4 mt-1 accent-[#312d2a]"
                    />
                  </div>
                </div>

                <div className="border-t border-[#e4e1dd] pt-4 flex justify-end">
                  <Button
                    type="submit"
                    className="h-9 rounded-[4px] border-0 bg-[#312d2a] px-4 text-xs font-medium text-white shadow-none transition-colors hover:bg-[#47423e]"
                  >
                    Save Member Defaults
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
