// Android uygulamasının (Trusted Web Activity) bu siteye ait olduğunu Google'a kanıtlayan dosya.
// Paket adı ve imza parmak izi yönetim panelinden (Marka & SEO > Android uygulaması) girilir.
import { getContent } from "../lib/content.mjs";

export default async () => {
  const { settings } = await getContent();
  const fingerprints = settings.androidSha256.split("\n").filter(Boolean);
  const body =
    settings.androidPackage && fingerprints.length
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: settings.androidPackage,
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ]
      : [];
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
};

export const config = { path: "/.well-known/assetlinks.json", method: ["GET", "HEAD"] };
