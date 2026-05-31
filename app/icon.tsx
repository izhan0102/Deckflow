import { ImageResponse } from "next/og";

/**
 * Dynamic favicon. Renders an EZ-mark tile that matches the brand logo
 * — minimal monochrome, black tile with white "EZ". Picked up
 * automatically by Next.js as the site icon.
 */

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
          color: "#FFFFFF",
          fontSize: 16,
          fontWeight: 800,
          fontFamily: "system-ui, -apple-system, sans-serif",
          letterSpacing: -0.5,
          borderRadius: 7,
        }}
      >
        EZ
      </div>
    ),
    size,
  );
}
