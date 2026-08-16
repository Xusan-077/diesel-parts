import type { LucideIcon } from "lucide-react";
import { Icon, type IconSize } from "@/components/ui/icon";
import {
  Award,
  BadgeCheck,
  Banknote,
  Boxes,
  Building2,
  Clock,
  CreditCard,
  FileText,
  Globe,
  Handshake,
  Headset,
  MapPin,
  Package,
  Percent,
  Plane,
  Receipt,
  Search,
  Settings,
  Smartphone,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Truck,
  Users,
  Warehouse,
  Wrench,
} from "lucide-react";

type IconComponent = LucideIcon;

/**
 * Icons for the static content pages. Dictionaries store only the key, so
 * copy and iconography can be edited independently.
 */
const ICONS: Record<string, IconComponent> = {
  // Services
  diagnostics: Stethoscope,
  installation: Wrench,
  warranty: BadgeCheck,
  consultation: Headset,
  delivery: Truck,
  maintenance: Settings,
  selection: Search,
  // Payment
  cash: Banknote,
  card: CreditCard,
  mobile: Smartphone,
  bank: Building2,
  invoice: FileText,
  receipt: Receipt,
  // Delivery
  courier: Package,
  air: Plane,
  pickup: MapPin,
  terms: Clock,
  worldwide: Globe,
  warehouse: Warehouse,
  // Partnership
  handshake: Handshake,
  discount: Percent,
  dealer: Users,
  quality: Award,
  growth: TrendingUp,
  stock: Boxes,
};

const FALLBACK: IconComponent = Sparkles;

export function FeatureIcon({
  icon,
  size,
  className,
}: {
  icon: string;
  size?: IconSize;
  className?: string;
}) {
  return <Icon icon={ICONS[icon] ?? FALLBACK} size={size} className={className} />;
}
