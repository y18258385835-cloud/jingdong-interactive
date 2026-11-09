import React from 'react';

export interface PresentationStageProps {
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  panX: number;
  panY: number;
  scaleRef: React.RefObject<HTMLDivElement | null>;
  stageRef?: React.RefObject<HTMLDivElement | null>;
  stageKey: string;
  stageStyle: React.CSSProperties;
  /** Kept stationary beneath the animated stage so slide/zoom exits never expose the viewport. */
  backdropStyle?: React.CSSProperties;
  /** Frozen outgoing scene, kept above the live incoming stage during a crossfade. */
  transitionOverlay?: { animation: string; hostRef: React.RefObject<HTMLDivElement | null>; mask?: string } | null;
  children: React.ReactNode;
}

/** Shared authored-canvas shell used by editor preview and the export player. */
export const PresentationStage: React.FC<PresentationStageProps> = ({
  canvasWidth,
  canvasHeight,
  zoom,
  panX,
  panY,
  scaleRef,
  stageRef,
  stageKey,
  stageStyle,
  backdropStyle,
  transitionOverlay,
  children,
}) => (
  <div
    ref={scaleRef}
    style={{
      width: `${canvasWidth}px`,
      height: `${canvasHeight}px`,
      transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
      transformOrigin: 'center center',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      ...backdropStyle,
    }}
    className="relative shrink-0 isolate"
  >
    <div
      key={stageKey}
      ref={stageRef || undefined}
      data-export-stage="true"
      style={{
        width: `${canvasWidth}px`,
        height: `${canvasHeight}px`,
        transformOrigin: 'center center',
        perspective: '1200px',
        perspectiveOrigin: '50% 50%',
        position: 'relative',
        zIndex: 1,
        ...stageStyle,
      }}
      className="relative shrink-0 shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-visible"
    >
      {children}
    </div>
    {transitionOverlay && (
      <>
        <div
          aria-hidden="true"
          className="aether-scene-transition-overlay"
          ref={transitionOverlay.hostRef}
          style={{ animation: transitionOverlay.animation }}
        />
        {['soft-wipe', 'radial-reveal', 'diagonal-curtain', 'wipe-right'].includes(transitionOverlay.mask || '') && (
          <div
            aria-hidden="true"
            className={`aether-scene-transition-seam aether-scene-transition-seam--${transitionOverlay.mask}`}
            style={{ animation: transitionOverlay.animation }}
          />
        )}
      </>
    )}
  </div>
);
