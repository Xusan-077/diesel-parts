import type { LucideIcon } from "lucide-react";
import {
  Armchair,
  BatteryCharging,
  Bolt,
  Cable,
  Circle,
  CircleDot,
  CircleGauge,
  Cog,
  Container,
  Cylinder,
  Disc,
  Disc3,
  DoorOpen,
  Droplet,
  Droplets,
  Fan,
  Filter,
  Footprints,
  Frame,
  Fuel,
  Funnel,
  Gauge,
  GitBranch,
  Layers,
  Lightbulb,
  Link2,
  PanelTop,
  Plug,
  Radio,
  RotateCw,
  Settings2,
  Shell,
  Sliders,
  Snowflake,
  Square,
  Thermometer,
  Timer,
  Waves,
  Wind,
  Wrench,
  Zap,
} from "lucide-react";
import type { CatalogIconKey } from "@/lib/data/catalog-menu";
import { Icon, type IconSize } from "@/components/ui/icon";

type IconComponent = LucideIcon;

/**
 * Placeholder icon set. Swap individual entries for bespoke SVGs without
 * touching the catalog data, which only stores the key.
 */
const ICONS: Record<CatalogIconKey, IconComponent> = {
  antifreeze: Snowflake,
  engine: Cog,
  gasket: Layers,
  bushing: CircleDot,
  injector: Fuel,
  timing: Timer,
  crank: RotateCw,
  pump: Gauge,
  piston: Disc3,
  turbo: Fan,
  undercarriage: Footprints,
  track: Link2,
  wheel: Disc,
  suspension: Waves,
  bearing: Circle,
  "brake-pad": Square,
  "brake-disc": Disc,
  fluid: Droplet,
  hose: Cable,
  sensor: Radio,
  cylinder: Cylinder,
  valve: Bolt,
  seal: Shell,
  glass: PanelTop,
  seat: Armchair,
  door: DoorOpen,
  mirror: Frame,
  climate: Thermometer,
  "oil-filter": Filter,
  "fuel-filter": Funnel,
  "air-filter": Wind,
  "cabin-filter": Sliders,
  adblue: Container,
  oil: Droplets,
  battery: BatteryCharging,
  starter: Zap,
  alternator: Plug,
  light: Lightbulb,
  wiring: Cable,
  gearbox: Settings2,
  clutch: CircleGauge,
  driveshaft: GitBranch,
  reducer: Wrench,
};

export function CatalogIcon({
  icon,
  size,
  className,
}: {
  icon: CatalogIconKey;
  size?: IconSize;
  className?: string;
}) {
  return <Icon icon={ICONS[icon]} size={size} className={className} />;
}
