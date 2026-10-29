"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useMeeting } from "@/contexts/meeting-context";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Mic01Icon,
  MicOff01Icon,
  Video01Icon,
  VideoOffIcon,
  CallEnd01Icon,
  ArrowExpand01Icon,
  ArrowShrink01Icon,
  PictureInPictureIcon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";

// Dynamically import JitsiMeeting to avoid SSR issues
const JitsiMeetingComponent = dynamic(
  () =>
    import("@jitsi/react-sdk").then((mod) => mod.JitsiMeeting),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#211e1c] text-xs text-[#aea8a2]">
        Initializing video stream...
      </div>
    ),
  }
);

export function FloatingMeetingPlayer() {
  const {
    activeMeeting,
    micMuted,
    cameraMuted,
    isExpanded,
    setExpanded,
    toggleMic,
    toggleCamera,
    togglePiP,
    leaveMeeting,
    endMeeting,
    jitsiApiRef,
    setParticipantsCount,
  } = useMeeting();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !activeMeeting || !activeMeeting.isActive) {
    return null;
  }

  const handleApiReady = (externalApi: any) => {
    jitsiApiRef.current = externalApi;

    externalApi.addEventListeners({
      participantJoined: () => {
        try {
          const count = externalApi.getNumberOfParticipants();
          setParticipantsCount(count);
        } catch {
          // ignore
        }
      },
      participantLeft: () => {
        try {
          const count = externalApi.getNumberOfParticipants();
          setParticipantsCount(count);
        } catch {
          // ignore
        }
      },
      videoMuteStatusChanged: (event: { muted: boolean }) => {
        // sync camera state
      },
      audioMuteStatusChanged: (event: { muted: boolean }) => {
        // sync mic state
      },
      readyToClose: () => {
        leaveMeeting();
      },
    });
  };

  const containerClasses = isExpanded
    ? "fixed inset-4 z-50 flex flex-col bg-[#211e1c] border border-[#e4e1dd] rounded-[4px] shadow-none overflow-hidden"
    : "fixed bottom-4 right-4 z-50 flex flex-col w-[320px] h-[480px] bg-[#211e1c] border border-[#e4e1dd] rounded-[4px] shadow-none overflow-hidden";

  return (
    <aside aria-label="Active Meeting Window" className={containerClasses}>
      {/* Header bar */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#312d2a] bg-[#161513] px-3 text-white">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="inline-block size-2 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
          <span className="truncate text-xs font-semibold tracking-tight text-white">
            {activeMeeting.title}
          </span>
          <span className="rounded bg-[#312d2a] px-1 py-0.5 text-[10px] text-[#aea8a2]">
            {activeMeeting.roomName}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={togglePiP}
            title="Picture-in-Picture"
            className="rounded p-1 text-[#aea8a2] transition hover:bg-[#312d2a] hover:text-white"
          >
            <HugeiconsIcon icon={PictureInPictureIcon} className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setExpanded(!isExpanded)}
            title={isExpanded ? "Restore" : "Maximize"}
            className="rounded p-1 text-[#aea8a2] transition hover:bg-[#312d2a] hover:text-white"
          >
            <HugeiconsIcon
              icon={isExpanded ? ArrowShrink01Icon : ArrowExpand01Icon}
              className="size-3.5"
            />
          </button>
          <button
            type="button"
            onClick={leaveMeeting}
            title="Minimize to background"
            className="rounded p-1 text-[#aea8a2] transition hover:bg-[#312d2a] hover:text-white"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Video frame container */}
      <div className="relative flex-1 overflow-hidden bg-black">
        <JitsiMeetingComponent
          domain={activeMeeting.domain}
          roomName={activeMeeting.roomName}
          jwt={activeMeeting.token}
          configOverwrite={{
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            disableModeratorIndicator: false,
            startScreenSharing: false,
            enableEmailInStats: false,
            prejoinPageEnabled: false,
            toolbarButtons: [
              "camera",
              "chat",
              "desktop",
              "fullscreen",
              "microphone",
              "hangup",
              "participants-pane",
              "tileview",
            ],
          }}
          interfaceConfigOverwrite={{
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
          }}
          onApiReady={handleApiReady}
          getIFrameRef={(iframeRef) => {
            if (iframeRef) {
              iframeRef.style.height = "100%";
              iframeRef.style.width = "100%";
              iframeRef.style.border = "none";
            }
          }}
        />
      </div>

      {/* Footer controls */}
      <div className="flex h-12 shrink-0 items-center justify-around border-t border-[#312d2a] bg-[#161513] px-2">
        <button
          type="button"
          onClick={toggleMic}
          className={`flex size-8 items-center justify-center rounded-[4px] border transition ${
            micMuted
              ? "border-red-500/50 bg-red-950/40 text-red-400"
              : "border-[#47423e] bg-[#312d2a] text-white hover:bg-[#47423e]"
          }`}
          title={micMuted ? "Unmute Mic" : "Mute Mic"}
        >
          <HugeiconsIcon
            icon={micMuted ? MicOff01Icon : Mic01Icon}
            className="size-4"
          />
        </button>

        <button
          type="button"
          onClick={toggleCamera}
          className={`flex size-8 items-center justify-center rounded-[4px] border transition ${
            cameraMuted
              ? "border-red-500/50 bg-red-950/40 text-red-400"
              : "border-[#47423e] bg-[#312d2a] text-white hover:bg-[#47423e]"
          }`}
          title={cameraMuted ? "Turn On Camera" : "Turn Off Camera"}
        >
          <HugeiconsIcon
            icon={cameraMuted ? VideoOffIcon : Video01Icon}
            className="size-4"
          />
        </button>

        {activeMeeting.isHost ? (
          <Button
            type="button"
            onClick={endMeeting}
            className="h-7 rounded-[4px] border-0 bg-red-600 px-3 text-xs font-semibold text-white shadow-none transition-colors hover:bg-red-700"
          >
            <HugeiconsIcon icon={CallEnd01Icon} className="mr-1 size-3.5" />
            End Meeting
          </Button>
        ) : (
          <Button
            type="button"
            onClick={leaveMeeting}
            className="h-7 rounded-[4px] border-0 bg-[#312d2a] px-3 text-xs font-semibold text-white shadow-none transition-colors hover:bg-[#47423e]"
          >
            Leave
          </Button>
        )}
      </div>
    </aside>
  );
}
