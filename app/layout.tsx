import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Allo Inventory",
  description: "Multi-warehouse inventory & order fulfillment platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header style={{
          borderBottom: "1px solid var(--card-border)",
          backgroundColor: "var(--card)",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "56px",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}>
          <a href="/" style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "28px",
                height: "28px",
                backgroundColor: "var(--accent)",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 3h12v2H2V3zm0 4h12v2H2V7zm0 4h8v2H2v-2z" fill="white"/>
                </svg>
              </div>
              <span style={{ fontWeight: "700", fontSize: "16px", letterSpacing: "-0.3px" }}>
                allo
              </span>
              <span style={{ color: "var(--muted)", fontSize: "13px", marginLeft: "2px" }}>
                inventory
              </span>
            </div>
          </a>
          <span style={{ fontSize: "12px", color: "var(--muted)", fontFamily: "monospace" }}>
            take-home exercise
          </span>
        </header>
        <main style={{ maxWidth: "1100px", margin: "0 auto", padding: "32px 24px" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
