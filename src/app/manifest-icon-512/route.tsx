import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0E1210",
          color: "#8FBF9F",
          fontSize: 180,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        0.0
      </div>
    ),
    { width: 512, height: 512 }
  );
}
