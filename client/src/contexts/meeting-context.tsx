"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { api, type Meeting } from "@/lib/api";
import { toast } from "sonner";

export interface ActiveMeetingState {
  id?: string;
  title: string;
  roomName: string;
  token: string;
  domain: string;
  isHost: boolean;
  isActive: boolean;
  participantsCount: number;
}

interface MeetingContextType {
  activeMeeting: ActiveMeetingState | null;
  micMuted: boolean;
  cameraMuted: boolean;
  isPiPActive: boolean;
  isExpanded: boolean;
  startInstantMeeting: (title?: string, orgId?: string) => Promise<void>;
  joinMeeting: (
    roomName: string,
    title?: string,
    isHost?: boolean
  ) => Promise<void>;
  endMeeting: () => Promise<void>;
  leaveMeeting: () => void;
  toggleMic: () => void;
  toggleCamera: () => void;
  togglePiP: () => Promise<void>;
  setExpanded: (expanded: boolean) => void;
  setParticipantsCount: (count: number) => void;
  jitsiApiRef: React.MutableRefObject<any>;
}

const MeetingContext = createContext<MeetingContextType | undefined>(undefined);

export function MeetingProvider({ children }: { children: React.ReactNode }) {
  const [activeMeeting, setActiveMeeting] = useState<ActiveMeetingState | null>(
    null
  );
  const [micMuted, setMicMuted] = useState(false);
  const [cameraMuted, setCameraMuted] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const jitsiApiRef = useRef<any>(null);
  const pipWindowRef = useRef<Window | null>(null);

  // Restore active meeting from session storage if available
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("active_meeting");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.roomName && parsed.isActive) {
          setActiveMeeting(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const saveMeetingState = (state: ActiveMeetingState | null) => {
    setActiveMeeting(state);
    try {
      if (state) {
        sessionStorage.setItem("active_meeting", JSON.stringify(state));
      } else {
        sessionStorage.removeItem("active_meeting");
      }
    } catch {
      // ignore
    }
  };

  const startInstantMeeting = useCallback(
    async (title = "Instant Meeting", orgId?: string) => {
      try {
        const res = await api.meetings.createInstant({
          title,
          allow_guests: true,
          org_id: orgId,
        });
        const state: ActiveMeetingState = {
          id: res.meeting.id,
          title: res.meeting.title || title,
          roomName: res.room_name,
          token: res.token,
          domain: res.domain || process.env.NEXT_PUBLIC_JITSI_DOMAIN || "meet.example.com",
          isHost: true,
          isActive: true,
          participantsCount: 1,
        };
        saveMeetingState(state);
        toast.success(`Started instant meeting "${title}"`);
      } catch (err: any) {
        toast.error(err.message || "Failed to start instant meeting");
        throw err;
      }
    },
    []
  );

  const joinMeeting = useCallback(
    async (roomName: string, title?: string, isHost = false) => {
      try {
        const res = await api.meetings.join(roomName);
        const state: ActiveMeetingState = {
          id: res.meeting.id,
          title: res.meeting.title || title || "Meeting",
          roomName: res.room_name,
          token: res.token,
          domain: res.domain || process.env.NEXT_PUBLIC_JITSI_DOMAIN || "meet.example.com",
          isHost: isHost || res.role === "host",
          isActive: true,
          participantsCount: (res.meeting.attendees?.length || 1),
        };
        saveMeetingState(state);
        toast.success(`Joined room ${roomName}`);
      } catch (err: any) {
        toast.error(err.message || "Failed to join meeting");
        throw err;
      }
    },
    []
  );

  const endMeeting = useCallback(async () => {
    if (!activeMeeting) return;
    try {
      await api.meetings.end(activeMeeting.roomName);
      toast.success("Meeting ended");
    } catch (err: any) {
      toast.info(err.message || "Meeting closed");
    } finally {
      if (pipWindowRef.current) {
        pipWindowRef.current.close();
        pipWindowRef.current = null;
      }
      setIsPiPActive(false);
      saveMeetingState(null);
    }
  }, [activeMeeting]);

  const leaveMeeting = useCallback(() => {
    if (jitsiApiRef.current) {
      try {
        jitsiApiRef.current.executeCommand("hangup");
      } catch {
        // ignore
      }
    }
    if (pipWindowRef.current) {
      pipWindowRef.current.close();
      pipWindowRef.current = null;
    }
    setIsPiPActive(false);
    saveMeetingState(null);
    toast.info("Left meeting");
  }, []);

  const toggleMic = useCallback(() => {
    if (jitsiApiRef.current) {
      try {
        jitsiApiRef.current.executeCommand("toggleAudio");
      } catch {
        // ignore
      }
    }
    setMicMuted((prev) => !prev);
  }, []);

  const toggleCamera = useCallback(() => {
    if (jitsiApiRef.current) {
      try {
        jitsiApiRef.current.executeCommand("toggleVideo");
      } catch {
        // ignore
      }
    }
    setCameraMuted((prev) => !prev);
  }, []);

  const togglePiP = useCallback(async () => {
    if (!activeMeeting) return;

    // Check if Document Picture-in-Picture API is supported
    if ("documentPictureInPicture" in window) {
      try {
        if (pipWindowRef.current) {
          pipWindowRef.current.close();
          pipWindowRef.current = null;
          setIsPiPActive(false);
          return;
        }

        const pipWindow = await (window as any).documentPictureInPicture.requestWindow({
          width: 320,
          height: 480,
        });

        pipWindowRef.current = pipWindow;
        setIsPiPActive(true);

        // Copy styles to pip window
        Array.from(document.styleSheets).forEach((styleSheet) => {
          try {
            const cssRules = Array.from(styleSheet.cssRules)
              .map((rule) => rule.cssText)
              .join("");
            const style = pipWindow.document.createElement("style");
            style.textContent = cssRules;
            pipWindow.document.head.appendChild(style);
          } catch {
            const link = pipWindow.document.createElement("link");
            if (styleSheet.href) {
              link.rel = "stylesheet";
              link.type = styleSheet.type;
              link.media = styleSheet.media.toString();
              link.href = styleSheet.href;
              pipWindow.document.head.appendChild(link);
            }
          }
        });

        // Add container to PiP
        const container = pipWindow.document.createElement("div");
        container.id = "pip-root";
        container.style.width = "100%";
        container.style.height = "100%";
        container.style.background = "#211e1c";
        container.style.color = "#ffffff";
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.alignItems = "center";
        container.style.justifyContent = "center";
        container.innerHTML = `
          <div style="font-family: Inter, sans-serif; text-align: center; padding: 16px;">
            <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">${activeMeeting.title}</div>
            <div style="font-size: 12px; color: #aea8a2; margin-bottom: 16px;">Room: ${activeMeeting.roomName}</div>
            <div style="font-size: 12px; color: #22c55e;">Live in Background</div>
          </div>
        `;
        pipWindow.document.body.appendChild(container);

        pipWindow.addEventListener("pagehide", () => {
          pipWindowRef.current = null;
          setIsPiPActive(false);
        });
      } catch (err) {
        console.warn("Document Picture-in-Picture request failed:", err);
      }
    } else {
      toast.info("Document Picture-in-Picture is not supported in this browser.");
    }
  }, [activeMeeting]);

  // Document PiP auto-trigger on tab visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && activeMeeting && !pipWindowRef.current && "documentPictureInPicture" in window) {
        // Can be requested on user interaction; browsers restrict non-user gestures, so we catch silently
        (window as any).documentPictureInPicture
          ?.requestWindow({ width: 320, height: 480 })
          .then((pipWindow: Window) => {
            pipWindowRef.current = pipWindow;
            setIsPiPActive(true);
            pipWindow.addEventListener("pagehide", () => {
              pipWindowRef.current = null;
              setIsPiPActive(false);
            });
          })
          .catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeMeeting]);

  const setParticipantsCount = useCallback((count: number) => {
    setActiveMeeting((prev) => (prev ? { ...prev, participantsCount: count } : null));
  }, []);

  return (
    <MeetingContext.Provider
      value={{
        activeMeeting,
        micMuted,
        cameraMuted,
        isPiPActive,
        isExpanded,
        startInstantMeeting,
        joinMeeting,
        endMeeting,
        leaveMeeting,
        toggleMic,
        toggleCamera,
        togglePiP,
        setExpanded: setIsExpanded,
        setParticipantsCount,
        jitsiApiRef,
      }}
    >
      {children}
    </MeetingContext.Provider>
  );
}

export function useMeeting() {
  const context = useContext(MeetingContext);
  if (!context) {
    throw new Error("useMeeting must be used within a MeetingProvider");
  }
  return context;
}
