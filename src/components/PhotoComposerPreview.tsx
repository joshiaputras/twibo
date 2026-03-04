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
  bgOverlayImage?: string;
  bgUnderImage?: string;
  showWatermark?: boolean;
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
  bgOverlayImage,
  bgUnderImage,
  showWatermark = false,
  className,
}: PhotoComposerPreviewProps) => {
  const scaledWidth = Math.max(1, Math.round(width * previewScale));
  const scaledHeight = Math.max(1, Math.round(height * previewScale));

  const tx = photoOffsetX * previewScale;
  const ty = photoOffsetY * previewScale;
  const zoom = Math.max(0.02, (photoScale / 100) * previewScale);
  const photoTransform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(${zoom})`;

  return (
    <div className={cn('relative rounded-lg', campaignType === 'frame' && 'bg-black', className)} style={{ width: scaledWidth, height: scaledHeight, overflow: 'hidden' }}>
      {campaignType === 'background' && (
        <img src={bgUnderImage || templateImage} alt="Template Under" draggable={false} className="absolute inset-0 h-full w-full select-none object-contain pointer-events-none" />
      )}

      {campaignType === 'frame' ? (
        <>
          {/* Photo layer fills entire container – template on top masks everything outside the hole */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden bg-black">
            {userPhoto && (
              <img
                src={userPhoto}
                alt="Blur fill"
                draggable={false}
                className="absolute inset-0 h-full w-full select-none object-cover blur-xl"
                style={{ opacity: 0.92, transform: 'scale(1.5)' }}
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
        </>
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

      {/* Background overlay: layers above the image placeholder */}
      {campaignType === 'background' && bgOverlayImage && (
        <img src={bgOverlayImage} alt="Template Overlay" draggable={false} className="absolute inset-0 h-full w-full select-none object-contain pointer-events-none" />
      )}

      {campaignType === 'frame' && <img src={templateImage} alt="Template" draggable={false} className="absolute inset-0 h-full w-full select-none object-contain pointer-events-none" />}

      {showWatermark && (
        <>
          {/* PREVIEW diagonal text */}
          <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center overflow-hidden">
            <span
              className="font-black select-none"
              style={{
                fontSize: `${Math.max(16, Math.round(scaledWidth * 0.12))}px`,
                color: 'rgba(255,255,255,0.3)',
                transform: 'rotate(-20deg)',
                textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                fontFamily: '"Inter", "Segoe UI", sans-serif',
                letterSpacing: '0.05em',
              }}
            >
              PREVIEW
            </span>
          </div>
          {/* Watermark badge */}
          <div className="absolute bottom-2 right-2 z-20 pointer-events-none" style={{ margin: `${Math.max(4, Math.round(scaledWidth * 0.03))}px` }}>
            <div className="bg-white/95 rounded-full shadow-sm flex items-center justify-center" style={{ padding: `${Math.max(3, Math.round(scaledWidth * 0.006))}px ${Math.max(8, Math.round(scaledWidth * 0.018))}px` }}>
              <span className="font-bold tracking-wide leading-none" style={{ fontSize: `${Math.max(7, Math.round(scaledWidth * 0.022))}px`, color: 'hsl(46 95% 48%)', fontFamily: '"Space Grotesk", "Segoe UI", sans-serif' }}>Made with TWIBO.id</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PhotoComposerPreview;
