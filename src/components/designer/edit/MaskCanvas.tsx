"use client";

import { useRef, useCallback, useImperativeHandle, forwardRef } from "react";

export interface MaskCanvasHandle {
  clear: () => void;
}

interface MaskCanvasProps {
  width: number;
  height: number;
  brushSize: number;
  onMaskGenerated: (maskDataUrl: string) => void;
}

const MaskCanvas = forwardRef<MaskCanvasHandle, MaskCanvasProps>(
  function MaskCanvas({ width, height, brushSize, onMaskGenerated }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const isDrawing = useRef(false);

    /* ── clear canvas ─────────────────────────────────────── */
    const clear = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, []);

    useImperativeHandle(ref, () => ({ clear }), [clear]);

    /* ── drawing helpers ──────────────────────────────────── */
    const getPos = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
          x: ((e.clientX - rect.left) / rect.width) * canvas.width,
          y: ((e.clientY - rect.top) / rect.height) * canvas.height,
        };
      },
      [],
    );

    const paintDot = useCallback(
      (x: number, y: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = "#E91E8C";
        ctx.beginPath();
        ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
      },
      [brushSize],
    );

    /* ── mouse handlers ───────────────────────────────────── */
    const handleMouseDown = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        isDrawing.current = true;
        const { x, y } = getPos(e);
        paintDot(x, y);
      },
      [getPos, paintDot],
    );

    const handleMouseMove = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing.current) return;
        const { x, y } = getPos(e);
        paintDot(x, y);
      },
      [getPos, paintDot],
    );

    const handleMouseUp = useCallback(() => {
      if (!isDrawing.current) return;
      isDrawing.current = false;
      const canvas = canvasRef.current;
      if (!canvas) return;
      onMaskGenerated(canvas.toDataURL("image/png"));
    }, [onMaskGenerated]);

    const handleMouseLeave = useCallback(() => {
      if (!isDrawing.current) return;
      isDrawing.current = false;
      const canvas = canvasRef.current;
      if (!canvas) return;
      onMaskGenerated(canvas.toDataURL("image/png"));
    }, [onMaskGenerated]);

    /* ── render ───────────────────────────────────────────── */
    return (
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          cursor: "crosshair",
          pointerEvents: "all",
        }}
      />
    );
  },
);

export default MaskCanvas;
