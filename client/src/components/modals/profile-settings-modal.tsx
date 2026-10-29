"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";

interface ProfileSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileSettingsModal({
  open,
  onOpenChange,
}: ProfileSettingsModalProps) {
  const { user, updateProfile } = useAuth();
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || "");
      setLastName(user.last_name || "");
    }
  }, [user]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile(firstName, lastName);
      toast.success("Profile updated successfully");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-[4px] border border-[#e4e1dd] bg-white p-6 shadow-none">
        <div className="flex items-center justify-between border-b border-[#e4e1dd] pb-4">
          <div>
            <h3 className="font-serif text-xl font-normal text-[#161513]">
              Profile Settings
            </h3>
            <p className="mt-1 text-xs text-[#68635d]">
              Update your personal identity details
            </p>
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
            <Label className="mb-1 block text-xs font-semibold text-[#161513]">
              Email Address
            </Label>
            <Input
              value={user?.email || ""}
              disabled
              className="h-10 rounded-[4px] border-[#e4e1dd] bg-[#fbf9f8] text-sm text-[#8a847f] shadow-none"
            />
            <p className="mt-1 text-[11px] text-[#8a847f]">
              Primary email address cannot be changed.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label
                htmlFor="profile-first-name"
                className="mb-1 block text-xs font-semibold text-[#161513]"
              >
                First Name
              </Label>
              <Input
                id="profile-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                className="h-10 rounded-[4px] border-[#d4cfca] bg-white text-sm text-[#161513] shadow-none focus-visible:border-[#227e9e] focus-visible:ring-1 focus-visible:ring-[#227e9e]"
              />
            </div>
            <div>
              <Label
                htmlFor="profile-last-name"
                className="mb-1 block text-xs font-semibold text-[#161513]"
              >
                Last Name
              </Label>
              <Input
                id="profile-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                className="h-10 rounded-[4px] border-[#d4cfca] bg-white text-sm text-[#161513] shadow-none focus-visible:border-[#227e9e] focus-visible:ring-1 focus-visible:ring-[#227e9e]"
              />
            </div>
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
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
