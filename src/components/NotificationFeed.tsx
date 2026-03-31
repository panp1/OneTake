"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";

interface Notification {
  id: string;
  request_id: string | null;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function NotificationFeed() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications((data.notifications ?? []).slice(0, 20));
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // silently ignore network errors
    }
  }, []);

  // Initial fetch + 30-second polling
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  async function markAllRead() {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // silently ignore
    }
  }

  function handleOpen() {
    setOpen((v) => !v);
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell trigger */}
      <button
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-[#F5F5F5] transition-colors cursor-pointer"
        style={{ color: "#1A1A1A" }}
      >
        <Bell size={20} strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span
            className="absolute top-0.5 right-0.5 flex items-center justify-center rounded-full text-white font-semibold"
            style={{
              minWidth: 16,
              height: 16,
              fontSize: 10,
              paddingInline: 3,
              background: "#E53E3E",
              lineHeight: 1,
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 z-50 bg-white rounded-[12px] border border-[#E5E5E5] overflow-hidden"
          style={{
            top: "calc(100% + 8px)",
            width: 340,
            boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5]"
            style={{ background: "#FAFAFA" }}
          >
            <span className="text-sm font-semibold text-[#1A1A1A]">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-medium cursor-pointer hover:underline"
                style={{ color: "#6147E8" }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: 380 }}>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <Bell size={28} strokeWidth={1.5} style={{ color: "#D1D5DB", marginBottom: 8 }} />
                <p className="text-sm text-[#737373]">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => {
                const href = n.request_id ? `/intake/${n.request_id}` : "#";
                return (
                  <Link
                    key={n.id}
                    href={href}
                    onClick={() => setOpen(false)}
                    className="flex flex-col gap-0.5 px-4 py-3 border-b border-[#F0F0F0] last:border-b-0 hover:bg-[#F5F5F5] transition-colors cursor-pointer"
                    style={
                      !n.read
                        ? {
                            background:
                              "linear-gradient(135deg, rgba(6,147,227,0.06), rgba(155,81,224,0.06))",
                          }
                        : undefined
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className="text-sm font-medium leading-snug"
                        style={{ color: "#1A1A1A" }}
                      >
                        {n.title}
                      </span>
                      {!n.read && (
                        <span
                          className="mt-1 shrink-0 rounded-full"
                          style={{ width: 7, height: 7, background: "#6147E8" }}
                        />
                      )}
                    </div>
                    {n.body && (
                      <p
                        className="text-xs leading-relaxed line-clamp-2"
                        style={{ color: "#737373" }}
                      >
                        {n.body}
                      </p>
                    )}
                    <span className="text-[11px]" style={{ color: "#A0A0A0" }}>
                      {timeAgo(n.created_at)}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
