import Link from "next/link";
import { LogIn } from "lucide-react";
import { getDashboardLoginUrl } from "@/lib/dashboard";

export function DashboardLoginLink({
  className,
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  const dashboardUrl = getDashboardLoginUrl(
    process.env.NEXT_PUBLIC_DASHBOARD_LOGIN_URL,
    { allowLocalHTTP: process.env.NODE_ENV === "development" },
  );
  return (
    <Link
      href={dashboardUrl ?? "/dashboard-login/"}
      className={className}
      onClick={onClick}
      target={dashboardUrl ? "_blank" : undefined}
      rel={dashboardUrl ? "noopener noreferrer" : undefined}
      title="Dashboard Login"
      aria-label={
        dashboardUrl
          ? "Dashboard Login (opens in a new tab)"
          : "Dashboard Login"
      }
    >
      <LogIn size={17} aria-hidden="true" />
      <span>Dashboard Login</span>
    </Link>
  );
}
