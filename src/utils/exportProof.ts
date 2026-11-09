export interface ExportProof {
  version: 1;
  exportId: string;
  licenseRef: string;
  issuedAt: number;
  format: string;
  signature: string;
}

export function serializeExportProof(proof: ExportProof): string {
  return JSON.stringify(proof);
}

/** A subtle visual marker lets exported raster files be traced to a signed export receipt. */
export function applyCanvasExportProof(context: CanvasRenderingContext2D, width: number, height: number, proof: ExportProof): void {
  const label = `AETHER ${proof.exportId.slice(-8)} ${proof.licenseRef.slice(-6)}`;
  const fontSize = Math.max(7, Math.round(Math.min(width, height) * 0.009));
  context.save();
  context.globalAlpha = 0.12;
  context.fillStyle = '#ffffff';
  context.font = `${fontSize}px Arial`;
  context.textAlign = 'right';
  context.textBaseline = 'bottom';
  context.fillText(label, width - Math.max(8, fontSize), height - Math.max(7, fontSize));
  context.restore();
}
