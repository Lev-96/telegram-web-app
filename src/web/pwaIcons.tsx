/**
 * Line icons for the installable app's cards, banner and steps (Lucide shapes,
 * in the current text colour, decorative: the text next to them says it all).
 */
const Svg = ({ size = 18, children }: { size?: number; children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {children}
  </svg>
);

/** A phone ("smartphone"). */
export const PhoneIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <rect x="5" y="2" width="14" height="20" rx="2" />
    <path d="M12 18h.01" />
  </Svg>
);

/** Safari's Share button: a square with an arrow up out of it ("share"). */
export const ShareIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <path d="M16 6l-4-4-4 4" />
    <path d="M12 2v13" />
  </Svg>
);

/** «Add to Home Screen» in the Share menu: a plus in a square ("square-plus"). */
export const AddToHomeIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M8 12h8" />
    <path d="M12 8v8" />
  </Svg>
);
