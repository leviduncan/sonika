import { ImageResponse } from "next/og";

export const alt = "Sonika — White-label Voice AI for agencies";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0A0A0A";
const FG = "#FFFFFF";
const MUTED = "#A1A1AA";
const ACCENT = "#22C55E";

const BARS = [
  0.4, 0.7, 0.9, 0.55, 1, 0.75, 0.45, 0.85, 0.6, 0.95, 0.5, 0.8, 0.35, 0.7, 0.9,
];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: BG,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "63px 120px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 110,
            fontWeight: 500,
            color: FG,
            letterSpacing: "-0.04em",
            lineHeight: 0.95,
            display: "flex",
          }}
        >
          sonika
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 48,
            marginTop: 24,
          }}
        >
          {BARS.map((h, i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: `${Math.round(h * 100)}%`,
                background: ACCENT,
                borderRadius: 9999,
                opacity: 0.5 + h * 0.5,
              }}
            />
          ))}
        </div>

        <div
          style={{
            marginTop: 44,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            fontSize: 56,
            fontWeight: 500,
            color: FG,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
          }}
        >
          <div style={{ display: "flex" }}>Launch AI voice agents for every</div>
          <div style={{ display: "flex" }}>
            client in
            <span style={{ color: ACCENT, marginLeft: 14 }}>under 10 minutes.</span>
          </div>
        </div>

        <div
          style={{
            marginTop: 28,
            fontSize: 30,
            color: MUTED,
            letterSpacing: "-0.01em",
            display: "flex",
          }}
        >
          White-label Voice AI built specifically for agencies.
        </div>
      </div>
    ),
    { ...size },
  );
}
