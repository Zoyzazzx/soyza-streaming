import type { NextConfig } from "next";
import os from "os";

// Automatically discover all active local IPv4 addresses (LAN, Wi-Fi, Ethernet, Hotspot)
// so any PC/phone on ANY network can access the dev server without manual IP configuration.
function getLocalDevOrigins(): string[] {
  const origins = new Set<string>([
    "localhost",
    "127.0.0.1",
  ]);

  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name];
      if (!iface) continue;
      for (const info of iface) {
        if (info.family === "IPv4" || (info as any).family === 4) {
          origins.add(info.address);
        }
      }
    }
  } catch {
    // fallback if OS inspection fails
  }

  return Array.from(origins);
}

const nextConfig: NextConfig = {
  allowedDevOrigins: getLocalDevOrigins(),
};

export default nextConfig;
