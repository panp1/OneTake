"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import DesignerDashboard from "@/components/designer/dashboard/DesignerDashboard";

export default function DesignerPortal() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.role && !["designer", "admin"].includes(data.role)) {
          router.push("/");
        }
      })
      .catch(() => {});
  }, [router]);

  return <DesignerDashboard />;
}
