import Link from "next/link";
import { PageHero, PageNote } from "@/components/marketing/PageShell";
import { DashboardLoginLink } from "@/components/marketing/DashboardLoginLink";
import { getDashboardLoginUrl } from "@/lib/dashboard";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Dashboard Login",
  description:
    "Access the existing LiveWell dashboard separately from the RedDev public website.",
  path: "/dashboard-login/",
});

export default function DashboardLoginPage() {
  const dashboardUrl = getDashboardLoginUrl(
    process.env.NEXT_PUBLIC_DASHBOARD_LOGIN_URL,
    { allowLocalHTTP: process.env.NODE_ENV === "development" },
  );
  return (
    <>
      <PageHero
        eyebrow="EXISTING ACCOUNT ACCESS"
        title="Dashboard Login"
        description="Your operating dashboard remains separate from the RedDev public website. Sign in there using your existing account."
      />
      <section className="page-section">
        <div className="container" style={{ maxWidth: "52rem" }}>
          <h2>Your dashboard. Your existing account.</h2>
          <p>
            This website does not collect passwords, create dashboard accounts
            or replace the dashboard’s authentication system.
          </p>
          {dashboardUrl ? (
            <>
              <DashboardLoginLink className="button button-gold" />
              <p>
                The dashboard opens in a new tab. Use its normal sign-in
                process.
              </p>
            </>
          ) : (
            <PageNote title="Sign-in address awaiting configuration">
              <p>
                The LiveWell login route is available in the dashboard source,
                but its live address has not yet been confirmed for this
                release. No guessed or unrelated dashboard address is used.
              </p>
              <p>
                If you already use the dashboard, continue using your existing
                sign-in address. For help with access,{" "}
                <Link href="/contact/">contact the RedDev team</Link>.
              </p>
            </PageNote>
          )}
        </div>
      </section>
    </>
  );
}
