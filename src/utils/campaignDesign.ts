export type CampaignPreviewMeta = {
  photoDataUrl?: string;
  photoScale?: number;
  photoOffsetX?: number;
  photoOffsetY?: number;
  previewImageDataUrl?: string;
};

const PREVIEW_KEY = '__twiboPreview';

function parseDesignJson(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? (raw as Record<string, any>) : {};
}

export function extractPreviewMeta(raw: unknown): CampaignPreviewMeta {
  const parsed = parseDesignJson(raw);
  const preview = parsed?.[PREVIEW_KEY] ?? {};

  return {
    photoDataUrl: typeof preview.photoDataUrl === 'string' ? preview.photoDataUrl : '',
    photoScale: typeof preview.photoScale === 'number' ? preview.photoScale : 100,
    photoOffsetX: typeof preview.photoOffsetX === 'number' ? preview.photoOffsetX : 0,
    photoOffsetY: typeof preview.photoOffsetY === 'number' ? preview.photoOffsetY : 0,
    previewImageDataUrl: typeof preview.previewImageDataUrl === 'string' ? preview.previewImageDataUrl : '',
  };
}

export function extractCanvasDesign(raw: unknown): Record<string, any> {
  const parsed = parseDesignJson(raw);
  if (!(PREVIEW_KEY in parsed)) return parsed;

  const { [PREVIEW_KEY]: _preview, ...canvasOnly } = parsed;
  return canvasOnly;
}

export function mergeDesignWithPreview(rawCanvasDesign: unknown, previewMeta: CampaignPreviewMeta): Record<string, any> {
  const canvasDesign = parseDesignJson(rawCanvasDesign);
  return {
    ...canvasDesign,
    [PREVIEW_KEY]: {
      photoDataUrl: previewMeta.photoDataUrl ?? '',
      photoScale: typeof previewMeta.photoScale === 'number' ? previewMeta.photoScale : 100,
      photoOffsetX: typeof previewMeta.photoOffsetX === 'number' ? previewMeta.photoOffsetX : 0,
      photoOffsetY: typeof previewMeta.photoOffsetY === 'number' ? previewMeta.photoOffsetY : 0,
      previewImageDataUrl: previewMeta.previewImageDataUrl ?? '',
    },
  };
}
