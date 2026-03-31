"use client";

import { SignIn } from "@clerk/nextjs";
import dynamic from "next/dynamic";

const DarkVeil = dynamic(() => import("@/components/DarkVeil"), {
  ssr: false,
});

export default function SignInPage() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#09090b",
      }}
    >
      {/* Full-screen WebGL aurora — OneForma purple */}
      <div style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <DarkVeil
          hueShift={270}
          noiseIntensity={0.015}
          speed={0.25}
          warpAmount={0.25}
          resolutionScale={0.6}
        />
      </div>

      {/* Subtle dark overlay for depth */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.55) 100%)",
          zIndex: 1,
        }}
      />

      {/* Centered content */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          gap: "24px",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center" }}>
          <h1
            style={{
              fontSize: "36px",
              fontWeight: 700,
              color: "white",
              letterSpacing: "-0.5px",
              fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif",
              margin: 0,
            }}
          >
            OneForma
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "rgba(255,255,255,0.5)",
              marginTop: "6px",
              fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            Creative OS — Recruitment Marketing Intelligence
          </p>
        </div>

        {/* Clerk Sign-In — integrated with frosted glass */}
        <SignIn
          appearance={{
            layout: {
              socialButtonsPlacement: "top",
              socialButtonsVariant: "blockButton",
            },
            elements: {
              rootBox: "w-full max-w-[420px]",
              cardBox: "shadow-none border-none",
              card: "bg-white/[0.08] backdrop-blur-2xl border border-white/[0.12] rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.3)]",
              headerTitle: "text-white text-lg font-semibold",
              headerSubtitle: "text-white/50 text-sm",
              socialButtonsBlockButton:
                "bg-white/10 border border-white/15 text-white hover:bg-white/20 rounded-xl transition-all",
              socialButtonsBlockButtonText: "text-white/90 font-medium text-sm",
              socialButtonsProviderIcon: "brightness-0 invert opacity-80",
              dividerLine: "bg-white/10",
              dividerText: "text-white/30 text-xs",
              formFieldLabel: "text-white/70 text-sm font-medium",
              formFieldInput:
                "bg-white/[0.06] border-white/[0.12] text-white placeholder:text-white/30 rounded-xl focus:border-purple-400/50 focus:ring-purple-400/20 transition-all",
              formButtonPrimary:
                "bg-gradient-to-r from-[#6B21A8] to-[#E91E8C] hover:from-[#7C3AED] hover:to-[#F472B6] text-white rounded-xl font-semibold shadow-lg shadow-purple-500/20 transition-all",
              footerAction: "text-white/40",
              footerActionLink: "text-purple-300 hover:text-purple-200 font-medium",
              formFieldAction: "text-purple-300 hover:text-purple-200",
              identityPreviewEditButton: "text-purple-300 hover:text-purple-200",
              alertText: "text-white/70",
              footer: "bg-transparent",
              footerPagesLink: "text-white/30 hover:text-white/50",
            },
            variables: {
              colorBackground: "transparent",
              colorText: "white",
              colorTextSecondary: "rgba(255,255,255,0.5)",
              colorInputBackground: "rgba(255,255,255,0.06)",
              colorInputText: "white",
              borderRadius: "12px",
            },
          }}
        />

        {/* Footer */}
        <p
          style={{
            fontSize: "11px",
            color: "rgba(255,255,255,0.2)",
            fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          Powered by Centific
        </p>
      </div>
    </div>
  );
}
