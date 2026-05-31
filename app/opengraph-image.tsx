import { ImageResponse } from "next/og";

/**
 * Dynamic OG image for landing-page social shares.
 *
 * Next renders this on the edge whenever a crawler (LinkedIn, WhatsApp,
 * X, Discord) fetches /opengraph-image so it always has a 1200×630 PNG
 * preview. We draw a hero-style mock slide so people see what the
 * product actually looks like, not a logo on a black square.
 */

export const runtime = "edge";
export const alt = "EZdeck — Free AI PPT Maker. Make PowerPoint presentations from text.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#000000",
          color: "#FFFFFF",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: 64,
        }}
      >
        {/* Brand chip */}
        <div
          style={{
            position: "absolute",
            top: 56,
            left: 64,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 22,
            color: "#FFFFFF",
            fontWeight: 700,
            letterSpacing: -0.3,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 10,
              background: "#FFFFFF",
              color: "#000000",
              fontSize: 18,
              fontWeight: 800,
            }}
          >
            EZ
          </div>
          <span>
            EZ<span style={{ opacity: 0.85 }}>deck</span>
          </span>
        </div>

        {/* Left: copy */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: "55%",
            paddingRight: 40,
          }}
        >
          <div
            style={{
              fontSize: 18,
              letterSpacing: "0.32em",
              color: "rgba(255,255,255,0.6)",
              fontWeight: 700,
              marginBottom: 24,
            }}
          >
            FREE AI PPT MAKER
          </div>
          <div
            style={{
              fontSize: 82,
              fontWeight: 800,
              lineHeight: 0.98,
              letterSpacing: "-0.03em",
            }}
          >
            PowerPoint from a single prompt.
          </div>
          <div
            style={{
              marginTop: 26,
              fontSize: 24,
              color: "rgba(255,255,255,0.7)",
              lineHeight: 1.4,
            }}
          >
            Type a topic. Get an editable presentation in seconds. Real PPTX & PDF export, free to try.
          </div>
        </div>

        {/* Right: mock slide */}
        <div
          style={{
            position: "absolute",
            right: 64,
            top: 130,
            width: 460,
            height: 360,
            borderRadius: 4,
            background: "#FFFFFF",
            boxShadow: "0 30px 80px -20px rgba(0,0,0,0.6)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: 36,
            color: "#0A0A0A",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 8,
              background: "#000000",
            }}
          />
          <div
            style={{
              fontSize: 14,
              letterSpacing: "0.32em",
              color: "#555555",
              fontWeight: 700,
              marginBottom: 14,
            }}
          >
            Q1 INVESTOR UPDATE
          </div>
          <div
            style={{
              fontSize: 44,
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: "-0.02em",
            }}
          >
            From idea to deck in under a minute.
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 18,
              color: "#555555",
            }}
          >
            Real PPTX, edit anything inline, free to try.
          </div>
        </div>

        {/* Bottom row */}
        <div
          style={{
            position: "absolute",
            left: 64,
            bottom: 56,
            display: "flex",
            alignItems: "center",
            gap: 24,
            fontSize: 18,
            color: "rgba(255,255,255,0.55)",
          }}
        >
          <span>Free to try</span>
          <span>·</span>
          <span>Real PPTX & PDF export</span>
          <span>·</span>
          <span>ezdeck.app</span>
        </div>
      </div>
    ),
    size,
  );
}
