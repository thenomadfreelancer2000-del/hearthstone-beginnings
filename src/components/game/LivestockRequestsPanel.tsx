import { useGame } from "@/game/store";
import { SPECIES_LABEL } from "@/game/sim/livestock";

// Hand-drawn, ranch-themed glyphs — sized to feel like brand-iron stamps on parchment.
function BrandStamp({ children, label, tone = "primary", onClick }: {
  children: React.ReactNode;
  label: string;
  tone?: "primary" | "ghost" | "danger";
  onClick: () => void;
}) {
  const ring =
    tone === "primary" ? "border-amber text-amber hover:bg-amber/15"
      : tone === "danger" ? "border-danger/60 text-danger hover:bg-danger/15"
        : "border-amber/40 text-dust-light hover:text-amber hover:bg-amber/10";
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`relative w-9 h-9 flex items-center justify-center border ${ring} transition-colors`}
      style={{ borderRadius: 2 }}
    >
      <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
      {/* corner ticks — tiny branding-iron feel */}
      <span className="absolute top-0 left-0 w-1 h-1 border-t border-l border-current opacity-60" />
      <span className="absolute top-0 right-0 w-1 h-1 border-t border-r border-current opacity-60" />
      <span className="absolute bottom-0 left-0 w-1 h-1 border-b border-l border-current opacity-60" />
      <span className="absolute bottom-0 right-0 w-1 h-1 border-b border-r border-current opacity-60" />
    </button>
  );
}

// Sheriff-style star with checkmark inside — "approved by the boss".
const ApproveGlyph = (
  <>
    <path d="M12 3l2 4.2 4.6.5-3.4 3.2.9 4.6L12 13.4 7.9 15.5l.9-4.6L5.4 7.7l4.6-.5L12 3z" />
    <path d="M9.5 11.2l1.8 1.8 3.2-3.6" strokeWidth={1.6} />
  </>
);

// Hourglass — "later".
const PostponeGlyph = (
  <>
    <path d="M7 3h10M7 21h10" />
    <path d="M7 3c0 4 5 5 5 9s-5 5-5 9" />
    <path d="M17 3c0 4-5 5-5 9s5 5 5 9" />
    <path d="M9.5 7.5h5" opacity={0.7} />
  </>
);

// Crossed bones — "rejected".
const RejectGlyph = (
  <>
    <path d="M5 5l14 14M19 5L5 19" />
    <circle cx="5.5" cy="5.5" r="1.4" />
    <circle cx="18.5" cy="5.5" r="1.4" />
    <circle cx="5.5" cy="18.5" r="1.4" />
    <circle cx="18.5" cy="18.5" r="1.4" />
  </>
);

export function LivestockRequestsPanel() {
  const requests = useGame((s) => s.livestockRequests);
  const families = useGame((s) => s.families);
  const survivors = useGame((s) => s.survivors);
  const decide = useGame((s) => s.decideLivestockRequest);

  const pending = requests.filter((r) => r.status === "pending");
  if (pending.length === 0) return null;

  return (
    <div className="absolute top-2 left-2 z-40 w-[300px] max-w-[88vw] space-y-2 pointer-events-auto">
      {pending.slice(0, 3).map((r) => {
        const fam = families.find((f) => f.id === r.familyId);
        const requester = survivors.find((s) => s.id === r.requesterId);
        if (!fam || !requester) return null;
        const verb =
          r.kind === "start-raising" ? "wishes to start raising"
            : r.kind === "build-pen" ? "requests permission to build a"
              : "wishes to expand their";
        const target = r.kind === "build-pen" ? `${SPECIES_LABEL[r.species]} pen` : `${SPECIES_LABEL[r.species].toLowerCase()}`;
        return (
          <div key={r.id} className="parchment-panel corner-brackets p-3 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
            <div className="ranch-label text-[10px] text-amber mb-1">Livestock Request</div>
            <div className="ranch-display text-sm text-parchment leading-tight">
              {requester.name} {requester.surname}
            </div>
            <div className="ranch-handwritten text-[11px] text-dust-light mt-1">
              House of <span className="text-amber">{fam.name}</span> {verb} {target}.
            </div>
            {r.tributeOffer && (
              <div className="ranch-handwritten text-[11px] text-amber italic mt-1">
                "In return, we'll send <span className="text-parchment">{r.tributeOffer.perMonth} {r.tributeOffer.resource}</span> to the ranch each month."
              </div>
            )}
            <div className="flex gap-2 mt-2 justify-end items-center">
              <BrandStamp label="Approve" tone="primary" onClick={() => decide(r.id, "approve")}>
                {ApproveGlyph}
              </BrandStamp>
              <BrandStamp label="Postpone" tone="ghost" onClick={() => decide(r.id, "postpone")}>
                {PostponeGlyph}
              </BrandStamp>
              <BrandStamp label="Reject" tone="danger" onClick={() => decide(r.id, "reject")}>
                {RejectGlyph}
              </BrandStamp>
            </div>
          </div>
        );
      })}
    </div>
  );
}
