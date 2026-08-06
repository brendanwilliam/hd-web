ALTER TABLE "Profile" ADD COLUMN "slug" TEXT;

WITH ranked_profiles AS (
  SELECT "id", lower(replace("riotId", '#', '-')) AS base_slug,
         row_number() OVER (PARTITION BY lower(replace("riotId", '#', '-')) ORDER BY "createdAt", "id") AS position
  FROM "Profile"
)
UPDATE "Profile" AS profile
SET "slug" = CASE
  WHEN ranked_profiles.position = 1 THEN ranked_profiles.base_slug
  ELSE ranked_profiles.base_slug || '-' || substr(md5(profile."riotIdNormalized"), 1, 8)
END
FROM ranked_profiles
WHERE profile."id" = ranked_profiles."id";

ALTER TABLE "Profile" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Profile_slug_key" ON "Profile"("slug");
