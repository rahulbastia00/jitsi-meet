const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  created_at?: string;
  terms_accepted?: boolean;
}

export interface Organization {
  id: string;
  name: string;
  owner?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  created_at?: string;
}

export interface Team {
  id: string;
  org: string;
  name: string;
  color_tag: string;
  created_at?: string;
}

export interface Member {
  id: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  team: Team | null;
  is_owner: boolean;
  can_create_meeting: boolean;
  can_delete_meeting: boolean;
  can_use_ai: boolean;
  status: "active" | "invited" | "suspended";
  joined_at: string;
}

export interface MeetingAttendee {
  id: string;
  user: User | null;
  guest_name?: string;
  guest_email?: string;
  role: string;
  joined_at: string;
  left_at?: string | null;
  duration_seconds: number;
}

export interface Meeting {
  id: string;
  org: string;
  host: User;
  title: string;
  description?: string;
  meeting_type: "instant" | "scheduled";
  status: "active" | "ended" | "scheduled";
  allow_guests: boolean;
  jitsi_room_name: string;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  actual_started_at?: string | null;
  actual_ended_at?: string | null;
  total_duration_secs: number;
  invited_teams?: Team[];
  attendees?: MeetingAttendee[];
  created_at?: string;
}

export interface KPIs {
  total_meetings_conducted: number;
  total_meeting_minutes: number;
  active_rooms_count: number;
}

export interface CalendarDayMeeting {
  id: string;
  title: string;
  type: string;
  status?: string;
  host_id?: string;
  host_name: string;
  jitsi_room_name?: string;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  actual_started_at?: string | null;
  actual_ended_at?: string | null;
  duration_seconds: number;
  attendees: Array<{ name: string; role: string }>;
}

export interface CalendarDay {
  date: string;
  meeting_count: number;
  total_duration_seconds: number;
  meetings: CalendarDayMeeting[];
}

export interface CalendarResponse {
  year: number;
  month: number;
  days: CalendarDay[];
  meetings?: Meeting[];
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Include Django CSRF token for mutating requests if present in cookies
  const method = (options.method || "GET").toUpperCase();
  if (["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
    const csrftoken = getCookie("csrftoken");
    if (csrftoken) {
      headers.set("X-CSRFToken", csrftoken);
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // Required for HttpOnly auth cookies
  });

  if (!response.ok) {
    let errorDetail = `Request failed with status ${response.status}`;
    try {
      const errJson = await response.json();
      errorDetail =
        errJson.detail ||
        errJson.error ||
        (typeof errJson === "object" ? JSON.stringify(errJson) : String(errJson));
    } catch {
      // ignore
    }
    const err = new Error(errorDetail);
    (err as unknown as { status: number }).status = response.status;
    throw err;
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  auth: {
    csrf: () => request<{ detail: string }>("/api/auth/csrf/"),
    me: () => request<User>("/api/auth/me/"),
    updateProfile: (data: { first_name?: string; last_name?: string }) =>
      request<User>("/api/auth/me/", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    login: (email: string, password: string) =>
      request<{ detail: string; user: User }>("/api/auth/login/", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    logout: () =>
      request<{ detail: string }>("/api/auth/logout/", {
        method: "POST",
      }),
    sendOtp: (email: string) =>
      request<{ detail: string }>("/api/auth/send-otp/", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    verifyOtp: (email: string, otp: string) =>
      request<{ detail: string; verification_ticket: string }>(
        "/api/auth/verify-otp/",
        {
          method: "POST",
          body: JSON.stringify({ email, otp }),
        }
      ),
    register: (payload: {
      email: string;
      password: string;
      password_confirm: string;
      verification_ticket: string;
      terms_accepted: boolean;
      first_name?: string;
      last_name?: string;
    }) =>
      request<{ detail: string }>("/api/auth/register/", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },

  organizations: {
    list: () => request<Organization[]>("/api/organizations/"),
    create: (name: string) =>
      request<Organization>("/api/organizations/", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    get: (orgId: string) =>
      request<Organization>(`/api/organizations/${orgId}/`),
    teams: (orgId: string) =>
      request<Team[]>(`/api/organizations/${orgId}/teams/`),
    createTeam: (orgId: string, data: { name: string; color_tag?: string }) =>
      request<Team>(`/api/organizations/${orgId}/teams/`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    members: (orgId: string) =>
      request<Member[]>(`/api/organizations/${orgId}/members/`),
    inviteMember: (
      orgId: string,
      data: {
        email: string;
        first_name?: string;
        last_name?: string;
        team_id?: string | null;
      }
    ) =>
      request<Member>(`/api/organizations/${orgId}/invite-member/`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updatePermissions: (
      orgId: string,
      memberId: string,
      permissions: {
        can_create_meeting?: boolean;
        can_delete_meeting?: boolean;
        can_use_ai?: boolean;
      }
    ) =>
      request<Member>(
        `/api/organizations/${orgId}/members/${memberId}/permissions/`,
        {
          method: "PATCH",
          body: JSON.stringify(permissions),
        }
      ),
    moveTeam: (orgId: string, memberId: string, team_id: string | null) =>
      request<Member>(
        `/api/organizations/${orgId}/members/${memberId}/move-team/`,
        {
          method: "PATCH",
          body: JSON.stringify({ team_id }),
        }
      ),
    removeMember: (orgId: string, memberId: string) =>
      request<{ message: string }>(
        `/api/organizations/${orgId}/members/${memberId}/`,
        {
          method: "DELETE",
        }
      ),
    inviteTeamInstant: (
      orgId: string,
      teamId: string,
      payload: { title?: string; meeting_id?: string | null } = {}
    ) =>
      request<{
        message: string;
        meeting_id: string;
        room_name: string;
        invited_count: number;
      }>(`/api/organizations/${orgId}/teams/${teamId}/invite-instant/`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },

  meetings: {
    overviewKPIs: (orgId?: string) => {
      const q = orgId ? `?org_id=${encodeURIComponent(orgId)}` : "";
      return request<KPIs>(`/api/meetings/overview-kpis/${q}`);
    },
    createInstant: (payload: {
      title?: string;
      allow_guests?: boolean;
      org_id?: string;
    }) =>
      request<{
        meeting: Meeting;
        room_name: string;
        token: string;
        domain: string;
      }>("/api/meetings/instant/", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    createScheduled: (payload: {
      title: string;
      description?: string;
      scheduled_start: string;
      scheduled_end: string;
      team_ids?: string[];
      allow_guests?: boolean;
      org_id?: string;
    }) =>
      request<{
        meeting: Meeting;
        room_name: string;
        token: string;
        domain: string;
      }>("/api/meetings/scheduled/", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    join: (
      roomName: string,
      payload: { guest_name?: string; guest_email?: string } = {}
    ) =>
      request<{
        meeting: Meeting;
        room_name: string;
        token: string;
        domain: string;
        role: string;
      }>(`/api/meetings/${encodeURIComponent(roomName)}/join/`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    end: (roomName: string) =>
      request<{ message: string; total_duration_secs: number }>(
        `/api/meetings/${encodeURIComponent(roomName)}/end/`,
        {
          method: "POST",
        }
      ),
    calendar: (year: number, month: number, orgId?: string) => {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
      });
      if (orgId) params.set("org_id", orgId);
      return request<CalendarResponse>(`/api/meetings/calendar/?${params.toString()}`);
    },
  },
};
