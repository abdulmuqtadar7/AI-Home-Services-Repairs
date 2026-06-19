// Shared service catalog. Safe to import in both server and client components
// (no server-only imports). Keys match the Prisma ServiceNiche enum.

export type ServiceNiche =
  | "PLUMBING"
  | "HVAC"
  | "ELECTRICAL"
  | "ROOFING"
  | "PEST_CONTROL"
  | "CLEANING"
  | "APPLIANCE_REPAIR"
  | "HANDYMAN"
  | "GENERAL_REPAIR"
  | "OTHER";

export type CatalogService = {
  name: string;
  basePrice: number | null;
  durationMin: number;
};

export const NICHE_LABELS: Record<ServiceNiche, string> = {
  PLUMBING: "Plumbing",
  HVAC: "HVAC",
  ELECTRICAL: "Electrical",
  ROOFING: "Roofing",
  PEST_CONTROL: "Pest control",
  CLEANING: "Cleaning",
  APPLIANCE_REPAIR: "Appliance repair",
  HANDYMAN: "Handyman",
  GENERAL_REPAIR: "General repair",
  OTHER: "Other",
};

// Categories shown as selectable business types (excludes OTHER, which is a
// catch-all used only for custom services).
export const NICHE_ORDER: ServiceNiche[] = [
  "PLUMBING",
  "HVAC",
  "ELECTRICAL",
  "ROOFING",
  "PEST_CONTROL",
  "CLEANING",
  "APPLIANCE_REPAIR",
  "HANDYMAN",
  "GENERAL_REPAIR",
];

export const SERVICE_CATALOG: Record<ServiceNiche, CatalogService[]> = {
  PLUMBING: [
    { name: "Drain cleaning", basePrice: 149, durationMin: 60 },
    { name: "Leak repair", basePrice: 150, durationMin: 60 },
    { name: "Water heater repair", basePrice: 175, durationMin: 90 },
    { name: "Water heater installation", basePrice: 950, durationMin: 180 },
    { name: "Toilet repair / install", basePrice: 160, durationMin: 60 },
    { name: "Faucet & fixture install", basePrice: 140, durationMin: 60 },
    { name: "Sewer line service", basePrice: 300, durationMin: 120 },
    { name: "Repiping", basePrice: 1200, durationMin: 480 },
    { name: "Emergency call-out", basePrice: 250, durationMin: 60 },
  ],
  HVAC: [
    { name: "AC repair", basePrice: 199, durationMin: 90 },
    { name: "AC installation", basePrice: 3500, durationMin: 480 },
    { name: "Furnace repair", basePrice: 189, durationMin: 90 },
    { name: "Furnace installation", basePrice: 3000, durationMin: 480 },
    { name: "Maintenance / tune-up", basePrice: 99, durationMin: 60 },
    { name: "Thermostat installation", basePrice: 150, durationMin: 60 },
    { name: "Duct cleaning", basePrice: 350, durationMin: 180 },
    { name: "Emergency call-out", basePrice: 250, durationMin: 60 },
  ],
  ELECTRICAL: [
    { name: "Panel upgrade", basePrice: 1800, durationMin: 480 },
    { name: "Outlet / switch install", basePrice: 120, durationMin: 45 },
    { name: "Lighting installation", basePrice: 150, durationMin: 60 },
    { name: "Wiring / rewiring", basePrice: 800, durationMin: 240 },
    { name: "EV charger installation", basePrice: 650, durationMin: 180 },
    { name: "Ceiling fan installation", basePrice: 160, durationMin: 90 },
    { name: "Troubleshooting / diagnostic", basePrice: 120, durationMin: 60 },
    { name: "Emergency call-out", basePrice: 250, durationMin: 60 },
  ],
  ROOFING: [
    { name: "Roof inspection", basePrice: 99, durationMin: 60 },
    { name: "Roof repair", basePrice: 450, durationMin: 180 },
    { name: "Roof replacement", basePrice: 8000, durationMin: 1440 },
    { name: "Leak repair", basePrice: 350, durationMin: 120 },
    { name: "Gutter installation", basePrice: 900, durationMin: 240 },
    { name: "Gutter cleaning", basePrice: 150, durationMin: 90 },
    { name: "Emergency tarp / patch", basePrice: 300, durationMin: 90 },
  ],
  PEST_CONTROL: [
    { name: "General pest treatment", basePrice: 120, durationMin: 60 },
    { name: "Termite treatment", basePrice: 600, durationMin: 180 },
    { name: "Rodent control", basePrice: 250, durationMin: 90 },
    { name: "Bed bug treatment", basePrice: 500, durationMin: 180 },
    { name: "Mosquito control", basePrice: 100, durationMin: 60 },
    { name: "Inspection", basePrice: 75, durationMin: 45 },
    { name: "Recurring plan", basePrice: 45, durationMin: 45 },
  ],
  CLEANING: [
    { name: "Standard cleaning", basePrice: 120, durationMin: 120 },
    { name: "Deep cleaning", basePrice: 250, durationMin: 240 },
    { name: "Move-in / move-out", basePrice: 300, durationMin: 300 },
    { name: "Recurring cleaning", basePrice: 100, durationMin: 120 },
    { name: "Carpet cleaning", basePrice: 150, durationMin: 120 },
    { name: "Window cleaning", basePrice: 120, durationMin: 90 },
  ],
  APPLIANCE_REPAIR: [
    { name: "Refrigerator repair", basePrice: 150, durationMin: 90 },
    { name: "Washer / dryer repair", basePrice: 140, durationMin: 90 },
    { name: "Dishwasher repair", basePrice: 130, durationMin: 90 },
    { name: "Oven / stove repair", basePrice: 140, durationMin: 90 },
    { name: "Microwave repair", basePrice: 110, durationMin: 60 },
    { name: "Diagnostic", basePrice: 80, durationMin: 45 },
  ],
  HANDYMAN: [
    { name: "Furniture assembly", basePrice: 90, durationMin: 90 },
    { name: "Drywall repair", basePrice: 150, durationMin: 120 },
    { name: "Painting (per room)", basePrice: 250, durationMin: 240 },
    { name: "TV / shelf mounting", basePrice: 100, durationMin: 60 },
    { name: "Door repair / install", basePrice: 140, durationMin: 90 },
    { name: "General repairs", basePrice: 100, durationMin: 60 },
  ],
  GENERAL_REPAIR: [
    { name: "General diagnostic", basePrice: 80, durationMin: 45 },
    { name: "Minor repair", basePrice: 100, durationMin: 60 },
    { name: "Maintenance visit", basePrice: 120, durationMin: 90 },
  ],
  OTHER: [],
};

export function nicheLabel(n: string): string {
  return (NICHE_LABELS as Record<string, string>)[n] ?? n;
}
