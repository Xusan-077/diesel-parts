/**
 * Builds a placeholder photo for a seeded product.
 *
 * Real product photography needs a camera, not a script, so the seed cannot
 * ship any — and downloading stock photos from the internet would make the
 * seed depend on the network and on links that outlive this repo. An SVG
 * generated from the product's own name, SKU and brand is a real, valid image
 * file either way: reproducible offline, and distinct per product rather than
 * one shared placeholder every row would point at.
 *
 * Pure and network-free so it can be tested directly, same as the rest of
 * `seed-data`.
 */

const BRAND_COLORS: Record<string, string> = {
  cat: "#f2b229",
  komatsu: "#f9c000",
  volvo: "#1560bd",
  hitachi: "#e2231a",
  jcb: "#f7d117",
  hyundai: "#0f2984",
  doosan: "#003876",
};

const DEFAULT_COLOR = "#4b5563";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Wraps `text` onto lines of at most `maxChars`, breaking on spaces. */
function wrap(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? current + " " + word : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

export interface SeedImageInput {
  name: string;
  sku: string;
  brandName: string;
  brandId: string;
}

export function buildProductImageSvg({ name, sku, brandName, brandId }: SeedImageInput): string {
  const accent = BRAND_COLORS[brandId] ?? DEFAULT_COLOR;
  const nameLines = wrap(name, 22).slice(0, 3);
  const lineHeight = 30;
  const startY = 220 - ((nameLines.length - 1) * lineHeight) / 2;

  const nameSpans = nameLines
    .map(
      (line, index) =>
        `<tspan x="200" y="${startY + index * lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" role="img" aria-label="${escapeXml(name)}">
  <rect width="400" height="400" fill="#111827" />
  <rect width="400" height="6" fill="${accent}" />
  <circle cx="200" cy="150" r="54" fill="none" stroke="${accent}" stroke-width="6" />
  <circle cx="200" cy="150" r="18" fill="${accent}" />
  <g stroke="${accent}" stroke-width="6">
    <line x1="200" y1="80" x2="200" y2="96" />
    <line x1="200" y1="204" x2="200" y2="220" />
    <line x1="130" y1="150" x2="146" y2="150" />
    <line x1="254" y1="150" x2="270" y2="150" />
    <line x1="148" y1="98" x2="157" y2="112" />
    <line x1="243" y1="188" x2="252" y2="202" />
    <line x1="252" y1="98" x2="243" y2="112" />
    <line x1="157" y1="188" x2="148" y2="202" />
  </g>
  <text font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#f9fafb" text-anchor="middle">${nameSpans}</text>
  <text x="200" y="280" font-family="Arial, sans-serif" font-size="15" fill="${accent}" text-anchor="middle" letter-spacing="1">${escapeXml(sku)}</text>
  <text x="200" y="370" font-family="Arial, sans-serif" font-size="13" fill="#9ca3af" text-anchor="middle" letter-spacing="2">${escapeXml(brandName.toUpperCase())}</text>
</svg>
`;
}
