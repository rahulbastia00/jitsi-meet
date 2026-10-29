"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { ProfileSettingsModal } from "@/components/modals/profile-settings-modal";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  GridViewIcon,
  UserGroupIcon,
  Calendar03Icon,
  Settings05Icon,
  ArrowDown01Icon,
  UnfoldMoreIcon,
  Building02Icon,
  PlusSignIcon,
  UserCheck01Icon,
  Video01Icon,
} from "@hugeicons/core-free-icons";

export function AppSidebar() {
  const pathname = usePathname();
  const { user, organizations, activeOrg, setActiveOrg } = useAuth();
  const [profileModalOpen, setProfileModalOpen] = React.useState(false);
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const { isMobile } = useSidebar();

  const isMeetingsActive = pathname.startsWith("/meetings");
  const isSettingsActive = pathname.startsWith("/settings");

  const displayName =
    user?.first_name || user?.last_name
      ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
      : user?.email?.split("@")[0] || "User";

  const userInitials = displayName
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <Sidebar collapsible="icon" className="border-r border-[#e4e1dd] bg-[#fbf9f8]">
        {/* Workspace Header */}
        <SidebarHeader className="border-b border-[#e4e1dd] p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuButton
                      size="lg"
                      className="rounded-[4px] border border-transparent hover:bg-[#f1efed] data-open:bg-[#f1efed]"
                    />
                  }
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-[4px] bg-[#312d2a] text-white">
                    <HugeiconsIcon icon={Building02Icon} className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-xs leading-tight">
                    <span className="truncate font-semibold text-[#161513]">
                      {activeOrg?.name || "Enterprise Workspace"}
                    </span>
                    <span className="truncate text-[11px] text-[#68635d]">
                      AI Meeting Platform
                    </span>
                  </div>
                  <HugeiconsIcon
                    icon={UnfoldMoreIcon}
                    className="ml-auto size-4 text-[#68635d]"
                  />
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  className="w-56 rounded-[4px] border border-[#e4e1dd] bg-white p-1 text-xs shadow-none"
                  align="start"
                  side={isMobile ? "bottom" : "right"}
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-semibold text-[#68635d]">
                    Workspaces
                  </DropdownMenuLabel>
                  {organizations.map((org) => (
                    <DropdownMenuItem
                      key={org.id}
                      onClick={() => setActiveOrg(org)}
                      className={`cursor-pointer rounded-[4px] px-2 py-1.5 text-xs ${
                        org.id === activeOrg?.id
                          ? "bg-[#f1efed] font-semibold text-[#161513]"
                          : "text-[#312d2a] hover:bg-[#f5f4f2]"
                      }`}
                    >
                      <HugeiconsIcon icon={Building02Icon} className="mr-2 size-3.5" />
                      <span className="truncate">{org.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        {/* Navigation Content */}
        <SidebarContent className="px-2 py-3">
          <SidebarMenu>
            {/* Meetings Collapsible Group (Default Open) */}
            <Collapsible defaultOpen className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger
                  render={
                    <SidebarMenuButton
                      tooltip="Meetings"
                      className={`w-full rounded-[4px] text-xs font-semibold ${
                        isMeetingsActive
                          ? "text-[#161513]"
                          : "text-[#68635d] hover:text-[#161513]"
                      }`}
                    />
                  }
                >
                  <HugeiconsIcon icon={Video01Icon} className="size-4 text-[#312d2a]" />
                  <span>Meetings</span>
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    className="ml-auto size-3.5 text-[#8a847f] transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180"
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub className="my-1 ml-4 border-l border-[#e4e1dd] pl-2 space-y-1">
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        render={<Link href="/meetings" />}
                        isActive={pathname === "/meetings"}
                        className={`rounded-[4px] text-xs ${
                          pathname === "/meetings"
                            ? "bg-[#f1efed] font-semibold text-[#161513]"
                            : "text-[#68635d] hover:bg-[#f5f4f2] hover:text-[#161513]"
                        }`}
                      >
                        <HugeiconsIcon icon={GridViewIcon} className="size-3.5 mr-1" />
                        <span>Overview</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>

                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        render={<Link href="/meetings/teams" />}
                        isActive={pathname === "/meetings/teams"}
                        className={`rounded-[4px] text-xs ${
                          pathname === "/meetings/teams"
                            ? "bg-[#f1efed] font-semibold text-[#161513]"
                            : "text-[#68635d] hover:bg-[#f5f4f2] hover:text-[#161513]"
                        }`}
                      >
                        <HugeiconsIcon icon={UserGroupIcon} className="size-3.5 mr-1" />
                        <span>Team Management</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>

                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        render={<Link href="/meetings/calendar" />}
                        isActive={pathname === "/meetings/calendar"}
                        className={`rounded-[4px] text-xs ${
                          pathname === "/meetings/calendar"
                            ? "bg-[#f1efed] font-semibold text-[#161513]"
                            : "text-[#68635d] hover:bg-[#f5f4f2] hover:text-[#161513]"
                        }`}
                      >
                        <HugeiconsIcon icon={Calendar03Icon} className="size-3.5 mr-1" />
                        <span>Calendar</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>

            {/* Settings Link */}
            <SidebarMenuItem className="mt-1">
              <SidebarMenuButton
                render={<Link href="/settings" />}
                tooltip="Settings"
                isActive={isSettingsActive}
                className={`rounded-[4px] text-xs ${
                  isSettingsActive
                    ? "bg-[#f1efed] font-semibold text-[#161513]"
                    : "text-[#68635d] hover:bg-[#f5f4f2] hover:text-[#161513]"
                }`}
              >
                <HugeiconsIcon icon={Settings05Icon} className="size-4 text-[#312d2a]" />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>

        {/* User Footer (Section 2.3: Popover containing ONLY "Profile Settings") */}
        <SidebarFooter className="border-t border-[#e4e1dd] p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger
                  render={
                    <SidebarMenuButton
                      size="lg"
                      className="rounded-[4px] border border-transparent hover:bg-[#f1efed]"
                    />
                  }
                >
                  <Avatar className="size-7 rounded-[4px] border border-[#e4e1dd]">
                    <AvatarFallback className="bg-[#312d2a] text-xs font-semibold text-white">
                      {userInitials || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-xs leading-tight">
                    <span className="truncate font-medium text-[#161513]">
                      {displayName}
                    </span>
                    <span className="truncate text-[11px] text-[#68635d]">
                      {user?.email || "user@example.com"}
                    </span>
                  </div>
                  <HugeiconsIcon
                    icon={UnfoldMoreIcon}
                    className="ml-auto size-4 text-[#68635d]"
                  />
                </PopoverTrigger>

                <PopoverContent
                  align="end"
                  side={isMobile ? "bottom" : "right"}
                  sideOffset={6}
                  className="w-48 rounded-[4px] border border-[#e4e1dd] bg-white p-1 text-xs shadow-none"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setPopoverOpen(false);
                      setProfileModalOpen(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-[4px] px-3 py-2 text-left text-xs font-medium text-[#161513] transition hover:bg-[#f5f4f2]"
                  >
                    <HugeiconsIcon icon={UserCheck01Icon} className="size-4 text-[#312d2a]" />
                    Profile Settings
                  </button>
                </PopoverContent>
              </Popover>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      {/* Profile Settings Modal */}
      <ProfileSettingsModal
        open={profileModalOpen}
        onOpenChange={setProfileModalOpen}
      />
    </>
  );
}
