const cdn = "https://ddragon.leagueoflegends.com/cdn/";
const patch = /^\d+\.\d+\.\d+$/;

export const RIOT_ATTRIBUTION =
  "© Riot Games. Riot Games does not endorse or sponsor this product.";

export type ChampionAssetUrls = {
  primary: string | null;
  fallback: string | null;
};

const championPath = (champion: string) => {
  const value = champion.trim();
  return value && !/[\u0000-\u001f]/.test(value) ? encodeURIComponent(value) : null;
};

const assetUrl = (version: string, champion: string) => {
  const path = championPath(champion);
  return path ? `${cdn}${version}/img/champion/${path}.png` : null;
};

export function championAssetUrls(version: string, champion: string): ChampionAssetUrls {
  return {
    primary: patch.test(version) ? assetUrl(version, champion) : null,
    fallback: assetUrl("latest", champion),
  };
}

export function nextChampionAssetUrl(urls: ChampionAssetUrls, current: string) {
  return current === urls.primary ? urls.fallback : null;
}
