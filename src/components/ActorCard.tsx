import { UserCircle } from "lucide-react";
import type { ActorProfile } from "@/lib/types";

interface ActorCardProps {
  actor: ActorProfile;
}

function parseFaceLock(faceLock: unknown): string {
  if (!faceLock || typeof faceLock !== "object") return String(faceLock || "");

  const fl = faceLock as Record<string, unknown>;

  // If there's a description field, use it
  if (fl.description) return String(fl.description);

  // If there's a prompt_seed on the actor, that's the best description
  // Otherwise, build a human-readable description from the fields
  const parts: string[] = [];

  if (fl.age_range) parts.push(`Age ${fl.age_range}`);
  if (fl.skin_tone_hex) parts.push(`skin tone ${fl.skin_tone_hex}`);
  if (fl.eye_color) parts.push(`${fl.eye_color} eyes`);
  if (fl.hair) parts.push(`${fl.hair}`);
  if (fl.jawline) parts.push(`${fl.jawline} jawline`);
  if (fl.nose_shape) parts.push(`${fl.nose_shape} nose`);
  if (fl.distinguishing_marks) parts.push(`${fl.distinguishing_marks}`);

  return parts.length > 0 ? parts.join(" · ") : "No description available";
}

function parseOutfits(outfitData: unknown): [string, string][] {
  if (!outfitData || typeof outfitData !== "object") return [];

  const data = outfitData as Record<string, unknown>;

  // Handle dynamic scenes format (new)
  // scenes: { "morning_desk": { name, setting, outfit, pose_and_action, emotion } }
  const entries: [string, string][] = [];

  for (const [key, val] of Object.entries(data)) {
    if (typeof val === "string") {
      // Legacy outfit_variations format
      entries.push([key, val]);
    } else if (typeof val === "object" && val !== null) {
      // Dynamic scenes format
      const scene = val as Record<string, unknown>;
      const name = scene.name ? String(scene.name) : key.replace(/_/g, " ");
      const desc = scene.outfit
        ? String(scene.outfit)
        : scene.setting
          ? String(scene.setting)
          : JSON.stringify(val);
      entries.push([name, desc]);
    }
  }

  return entries;
}

export default function ActorCard({ actor }: ActorCardProps) {
  const faceDesc = actor.prompt_seed
    ? String(actor.prompt_seed)
    : parseFaceLock(actor.face_lock);

  const outfits = parseOutfits(actor.outfit_variations);

  return (
    <div className="border border-[var(--border)] rounded-[var(--radius-md)] p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[var(--muted)] flex items-center justify-center shrink-0">
          <UserCircle size={20} className="text-[var(--muted-foreground)]" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-[var(--foreground)]">{actor.name}</h4>
          {actor.signature_accessory && (
            <p className="text-xs text-[var(--muted-foreground)]">
              Signature: {actor.signature_accessory}
            </p>
          )}
        </div>
      </div>

      <p className="text-xs text-[var(--foreground)] leading-relaxed line-clamp-3">
        {faceDesc}
      </p>

      {outfits.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">
            Scenes
          </p>
          <div className="space-y-1">
            {outfits.map(([key, val]) => (
              <div key={key} className="flex items-start gap-2 text-xs">
                <span className="font-medium text-[var(--foreground)] capitalize whitespace-nowrap">
                  {key.replace(/_/g, " ")}:
                </span>
                <span className="text-[var(--muted-foreground)] line-clamp-1">{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(actor.backdrops) && actor.backdrops.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {actor.backdrops.slice(0, 3).map((b: string) => (
            <span key={b} className="tag-pill line-clamp-1 text-[10px]">
              {typeof b === "string" ? (b.length > 40 ? b.slice(0, 40) + "..." : b) : ""}
            </span>
          ))}
          {actor.backdrops.length > 3 && (
            <span className="tag-pill text-[10px]">+{actor.backdrops.length - 3}</span>
          )}
        </div>
      )}
    </div>
  );
}
