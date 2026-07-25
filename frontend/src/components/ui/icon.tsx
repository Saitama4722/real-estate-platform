import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ArrowUpDown,
  BedDouble,
  Building,
  Building2,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  DoorOpen,
  Heart,
  House,
  Inbox,
  KeyRound,
  LandPlot,
  List,
  Map as MapIcon,
  MapPin,
  Menu,
  MessageCircle,
  Minus,
  Newspaper,
  Phone,
  Plus,
  Ruler,
  Scale,
  Search,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Trees,
  User,
  WashingMachine,
  Wifi,
  X,
} from "lucide-react";

/**
 * Lucide is the ONLY icon vocabulary in this project (load-bearing decision #5).
 * No hand-drawn SVGs, no emoji, no other icon set.
 *
 * Sizes are a closed ladder, straight from the design system:
 *   16 — inline in text and in property-card spec lines
 *   20 — buttons and navigation (default)
 *   24 — large/primary actions
 *   28 — category tiles (inside a 48px --color-brand-tint plate)
 *
 * Import icons FROM THIS MODULE rather than from "lucide-react" directly: it
 * keeps the vocabulary greppable in one place and stops the size/stroke ladder
 * from drifting per call site.
 */
export type IconSize = 16 | 20 | 24 | 28;

export interface IconProps {
  /** A Lucide component, e.g. `Icons.Heart`. */
  icon: LucideIcon;
  size?: IconSize;
  className?: string;
  /**
   * Icons are decorative by default (`aria-hidden`). Pass a label ONLY when the
   * icon is the sole content of an interactive control and nothing else names it.
   */
  label?: string;
}

export function Icon({ icon: Glyph, size = 20, className, label }: IconProps) {
  return (
    <Glyph
      size={size}
      strokeWidth={2}
      className={className}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}

/**
 * The design system's icon dictionary. Grouped as documented in readme.md
 * §ICONOGRAPHY so the intended meaning of each glyph stays attached to it.
 */
export const Icons = {
  // Actions / chrome
  Search,
  Filters: SlidersHorizontal,
  Map: MapIcon,
  List,
  Heart,
  Compare: Scale,
  Share: Share2,
  Phone,
  Menu,
  Close: X,
  User,
  Alert: CircleAlert,
  Message: MessageCircle,
  Check,
  Plus,
  Minus,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ArrowRight,
  Inbox,
  Article: Newspaper,

  // Property categories
  Apartment: Building2,
  House,
  Land: LandPlot,
  Commercial: Store,

  // Card spec line
  Rooms: BedDouble,
  Area: Ruler,
  Floor: Building,
  Address: MapPin,

  // Property-detail amenities
  Wifi,
  Parking: Car,
  Trees,
  Elevator: ArrowUpDown,
  Security: ShieldCheck,
  Laundry: WashingMachine,

  // Hero backdrop field
  Key: KeyRound,
  Door: DoorOpen,
} as const;

export type IconName = keyof typeof Icons;
