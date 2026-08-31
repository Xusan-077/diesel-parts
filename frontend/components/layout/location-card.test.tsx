// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import uz from "@/dictionaries/uz.json";
import { LocationCard } from "./location-card";

const point = { lat: 41.186136, lon: 69.196655 };

function renderCard() {
  return render(
    <LocationCard address={uz.footer.address} point={point} footer={uz.footer} />
  );
}

afterEach(cleanup);

function linkTo(host: string): HTMLAnchorElement {
  const link = screen
    .getAllByRole("link")
    .find((element): element is HTMLAnchorElement =>
      element.getAttribute("href")?.includes(host) ?? false
    );
  if (!link) throw new Error(`no link to ${host}`);
  return link;
}

describe("LocationCard", () => {
  it("shows the street address and its coordinates", () => {
    renderCard();
    expect(screen.getByText(uz.footer.address)).toBeTruthy();
    expect(screen.getByText("41.186136, 69.196655")).toBeTruthy();
    expect(screen.getByText(`${uz.footer.coordinatesLabel}:`)).toBeTruthy();
  });

  it("hands Yandex the point as a centre and a marker", () => {
    renderCard();
    const url = new URL(linkTo("yandex").href);
    expect(url.searchParams.get("ll")).toBe("69.196655,41.186136");
    expect(url.searchParams.get("pt")).toBe("69.196655,41.186136");
    expect(url.searchParams.get("z")).toBe("15");
  });

  it("hands Google the same point, latitude first", () => {
    renderCard();
    const url = new URL(linkTo("google").href);
    expect(url.searchParams.get("query")).toBe("41.186136,69.196655");
  });

  /*
   * Both map services are separate applications, and losing the shop's page to
   * a map is a dead end for someone who was still reading the footer.
   */
  it("opens both map services in a new tab", () => {
    renderCard();
    for (const host of ["yandex", "google"]) {
      const link = linkTo(host);
      expect(link.target).toBe("_blank");
      expect(link.rel).toContain("noreferrer");
    }
  });

  it("labels each destination in the caller's locale", () => {
    renderCard();
    expect(linkTo("yandex").textContent).toContain(uz.footer.yandexCta);
    expect(linkTo("google").textContent).toContain(uz.footer.googleCta);
  });
});
