import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { teamProfiles } from "@/content/team-profiles";
import styles from "./team-profiles.module.css";

function initialsFor(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("");
}

function phoneHref(phone: string) {
  return `tel:+1${phone.replace(/\D/g, "")}`;
}

/**
 * The RedDev team grid: portrait (or initials), number, name, role and an
 * expandable profile with biography and contact details. Shared by the
 * About Us page and the Edmonton Multiplex LP 1 page so both always show
 * the same people from src/content/team-profiles.ts.
 */
export function TeamProfiles() {
  return (
    <div className={styles.teamGrid}>
      {teamProfiles.map((profile, index) => (
        <article className={styles.profile} key={profile.name}>
          <div className={styles.profileMedia}>
            {profile.image ? (
              <Image
                src={profile.image}
                alt={`Portrait of ${profile.name}`}
                fill
                sizes="(max-width: 620px) 42vw, (max-width: 980px) 28vw, 20vw"
              />
            ) : (
              <div className={styles.initials} aria-hidden="true">
                {initialsFor(profile.name)}
              </div>
            )}
          </div>
          <div className={styles.profileBody}>
            <p className={styles.profileNumber} aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </p>
            <h3>{profile.name}</h3>
            <p className={styles.role}>{profile.role}</p>
            <details className={styles.profileDetails}>
              <summary>
                <span>Read profile</span>
                <ChevronDown size={18} aria-hidden="true" />
              </summary>
              <div className={styles.profileExpanded}>
                {profile.bio.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {(profile.email || profile.phone) && (
                  <div
                    className={styles.profileContact}
                    aria-label={`Public contact details for ${profile.name}`}
                  >
                    {profile.email && (
                      <a href={`mailto:${profile.email}`}>{profile.email}</a>
                    )}
                    {profile.phone && (
                      <a href={phoneHref(profile.phone)}>{profile.phone}</a>
                    )}
                  </div>
                )}
              </div>
            </details>
          </div>
        </article>
      ))}
    </div>
  );
}

export default TeamProfiles;
