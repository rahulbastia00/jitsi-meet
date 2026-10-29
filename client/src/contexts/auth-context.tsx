"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, type Organization, type User } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  organizations: Organization[];
  activeOrg: Organization | null;
  setActiveOrg: (org: Organization) => void;
  refreshUser: () => Promise<void>;
  updateProfile: (firstName: string, lastName: string) => Promise<User>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reloadOrganizations: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrg, setActiveOrgState] = useState<Organization | null>(null);

  const setActiveOrg = useCallback((org: Organization) => {
    setActiveOrgState(org);
    if (typeof window !== "undefined") {
      localStorage.setItem("active_org_id", org.id);
    }
  }, []);

  const reloadOrganizations = useCallback(async () => {
    try {
      const orgs = await api.organizations.list();
      setOrganizations(orgs);
      if (orgs.length > 0) {
        const savedId = typeof window !== "undefined" ? localStorage.getItem("active_org_id") : null;
        const matching = savedId ? orgs.find((o) => o.id === savedId) : null;
        setActiveOrgState(matching || orgs[0]);
      } else {
        // Automatically create initial organization if user has none
        try {
          const newOrg = await api.organizations.create("Acme Engineering");
          setOrganizations([newOrg]);
          setActiveOrgState(newOrg);
          if (typeof window !== "undefined") {
            localStorage.setItem("active_org_id", newOrg.id);
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await api.auth.me();
      setUser(me);
      await reloadOrganizations();
    } catch {
      setUser(null);
      setOrganizations([]);
      setActiveOrgState(null);
    } finally {
      setLoading(false);
    }
  }, [reloadOrganizations]);

  useEffect(() => {
    // Prime CSRF token then check authenticated user
    api.auth
      .csrf()
      .catch(() => {})
      .finally(() => {
        refreshUser();
      });
  }, [refreshUser]);

  const updateProfile = async (firstName: string, lastName: string) => {
    const updated = await api.auth.updateProfile({
      first_name: firstName,
      last_name: lastName,
    });
    setUser(updated);
    return updated;
  };

  const login = async (email: string, password: string) => {
    await api.auth.login(email, password);
    await refreshUser();
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // ignore
    }
    setUser(null);
    setOrganizations([]);
    setActiveOrgState(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("active_org_id");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        organizations,
        activeOrg,
        setActiveOrg,
        refreshUser,
        updateProfile,
        login,
        logout,
        reloadOrganizations,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
