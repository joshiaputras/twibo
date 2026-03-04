import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import type { PlaceholderMeta } from '@/utils/campaignDesign';

type PhotoComposerPreviewProps = {
  templateImage: string;
  userPhoto: string;
  campaignType: 'frame' | 'background';
  width: number;
  height: number;
  previewScale: number;
  photoScale: number;
  photoOffsetX: number;
  photoOffsetY: number;
  placeholderMeta?: PlaceholderMeta | null;
  className?: string;
};

const PhotoComposerPreview = ({
  templateImage,
  userPhoto,
  campaignType,
  width,
  height,
  previewScale,
  photoScale,
  photoOffsetX,
  photoOffsetY,
  placeholderMeta,
  className,
}: PhotoComposerPreviewProps) => {
  const scaledWidth = Math.max(1, Math.round(width * previewScale));
  const scaledHeight = Math.max(1, Math.round(height * previewScale));

  const tx = photoOffsetX * previewScale;
  const ty = photoOffsetY * previewScale;
  const zoom = Math.max(0.02, (photoScale / 100) * previewScale);
  const photoTransform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(${zoom})`;

  const clipStyles = (() => {
    if (campaignType !== 'frame' || !placeholderMeta) return {} as CSSProperties;

    const left = placeholderMeta.left * previewScale;
    const top = placeholderMeta.top * previewScale;
    const boxWidth = placeholderMeta.width * placeholderMeta.scaleX * previewScale;
    const boxHeight = placeholderMeta.height * placeholderMeta.scaleY * previewScale;
    const right = Math.max(0, scaledWidth - (left + boxWidth));
    const bottom = Math.max(0, scaledHeight - (top + boxHeight));
    const radiusX = placeholderMeta.rx * placeholderMeta.scaleX * previewScale;
    const radiusY = placeholderMeta.ry * placeholderMeta.scaleY * previewScale;

    return {
      clipPath: `inset(${Math.max(0, top)}px ${right}px ${bottom}px ${Math.max(0, left)}px round ${Math.max(0, radiusX)}px ${Math.max(0, radiusY)}px)`,
    } as CSSProperties;
  })();

  return (
    <div className={cn('relative overflow-hidden rounded-lg', className)} style={{ width: scaledWidth, height: scaledHeight }}>
      {campaignType === 'background' && (
        <img src={templateImage} alt="Template" draggable={false} className="absolute inset-0 h-full w-full select-none object-contain pointer-events-none" />
      )}

      {campaignType === 'frame' ? (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={clipStyles}>
          {userPhoto && (
            <img
              src={userPhoto}
              alt="Blur fill"
              draggable={false}
              className="absolute inset-0 h-full w-full select-none object-cover scale-110 blur-xl"
              style={{ opacity: 0.88 }}
            />
          )}
          {userPhoto && (
            <img
              src={userPhoto}
              alt="User"
              draggable={false}
              className="absolute left-1/2 top-1/2 max-w-none select-none"
              style={{ transform: photoTransform, transformOrigin: 'center center' }}
            />
          )}
        </div>
      ) : (
        userPhoto && (
          <img
            src={userPhoto}
            alt="User"
            draggable={false}
            className="absolute left-1/2 top-1/2 max-w-none select-none pointer-events-none"
            style={{ transform: photoTransform, transformOrigin: 'center center' }}
          />
        )
      )}

      {campaignType === 'frame' && <img src={templateImage} alt="Template" draggable={false} className="absolute inset-0 h-full w-full select-none object-contain pointer-events-none" />}
    </div>
  );
};

export default PhotoComposerPreview;
