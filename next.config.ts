import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin debe cargarse como paquete externo de Node, no empaquetado por
  // Next.js. Si se empaqueta, sus dependencias internas (jose / jwks-rsa) fallan
  // en el runtime de Vercel con: ERR_REQUIRE_ESM — require() of ES Module.
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
