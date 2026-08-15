import { describe, expect, it } from "vitest";
import fixture from "@/tests/fixtures/data-dragon/assets.json";
import {
  championAssetUrls,
  nextChampionAssetUrl,
  RIOT_ATTRIBUTION,
} from "@/features/reports/domain/data-dragon";

describe("Data Dragon champion asset contracts", () => {
  it("uses the exact match patch before falling back to latest", () => {
    const urls = championAssetUrls(fixture.exactPatch, fixture.champions.apostrophe);
    expect(urls).toEqual({
      primary:
        "https://ddragon.leagueoflegends.com/cdn/14.12.1/img/champion/Cho'Gath.png",
      fallback:
        "https://ddragon.leagueoflegends.com/cdn/latest/img/champion/Cho'Gath.png",
    });
    expect(nextChampionAssetUrl(urls, urls.primary!)).toBe(urls.fallback);
    expect(nextChampionAssetUrl(urls, urls.fallback!)).toBeNull();
  });

  it("uses safe latest assets for malformed patches and encoded champion names", () => {
    expect(
      championAssetUrls(fixture.malformedPatch, fixture.champions.punctuation),
    ).toEqual({
      primary: null,
      fallback:
        "https://ddragon.leagueoflegends.com/cdn/latest/img/champion/" +
        "Nunu%20%26%20Willump.png",
    });
    expect(championAssetUrls(fixture.exactPatch, fixture.champions.whitespace)).toEqual({
      primary: "https://ddragon.leagueoflegends.com/cdn/14.12.1/img/champion/Ahri.png",
      fallback: "https://ddragon.leagueoflegends.com/cdn/latest/img/champion/Ahri.png",
    });
    expect(championAssetUrls(fixture.exactPatch, fixture.champions.missing)).toEqual({
      primary: null,
      fallback: null,
    });
  });

  it("keeps Riot attribution alongside asset rendering", () => {
    expect(RIOT_ATTRIBUTION).toBe(
      "© Riot Games. Riot Games does not endorse or sponsor this product.",
    );
  });
});
