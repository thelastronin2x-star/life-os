import { ImageResponse } from "next/og";

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
          background: "#0E1210",
          color: "#8FBF9F",
          fontSize: 15,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        0.0
      </div>
    ),
    { ...size }
  );
}
