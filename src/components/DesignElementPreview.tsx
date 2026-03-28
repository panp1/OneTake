'use client';

interface DesignElementPreviewProps {
  template?: string;
  headline?: string;
  subheadline?: string;
  ctaText?: string;
  platform?: string;
  dimensions?: string;
}

export default function DesignElementPreview({
  template,
  headline,
  subheadline,
  ctaText,
  platform,
}: DesignElementPreviewProps) {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center p-4 text-center"
      style={{
        background: '#32373C',
        minHeight: '200px',
      }}
    >
      {/* Platform label */}
      {platform && (
        <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-3">
          {platform}
        </span>
      )}

      {/* Template name */}
      {template && (
        <p className="text-[10px] uppercase tracking-wider text-white/30 font-medium mb-2">
          {template}
        </p>
      )}

      {/* Headline */}
      {headline && (
        <h4
          className="text-base font-bold text-white leading-tight mb-2"
          style={{ maxWidth: '90%' }}
        >
          {headline}
        </h4>
      )}

      {/* Subheadline */}
      {subheadline && (
        <p className="text-xs text-white/60 mb-3" style={{ maxWidth: '85%' }}>
          {subheadline}
        </p>
      )}

      {/* CTA button */}
      {ctaText && (
        <span
          className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold"
          style={{
            background: 'linear-gradient(135deg, rgb(6, 147, 227), rgb(155, 81, 224))',
            color: '#ffffff',
          }}
        >
          {ctaText}
        </span>
      )}

      {/* Logo placement indicator */}
      <div className="mt-4 w-8 h-8 rounded-full border border-white/20 flex items-center justify-center">
        <span className="text-[8px] text-white/30 font-bold">LOGO</span>
      </div>
    </div>
  );
}
