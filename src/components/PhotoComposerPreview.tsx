import { cn } from '@/lib/utils';

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
  className,
}: PhotoComposerPreviewProps) => {
  const scaledWidth = Math.max(1, Math.round(width * previewScale));
  const scaledHeight = Math.max(1, Math.round(height * previewScale));

  const tx = photoOffsetX * previewScale;
  const ty = photoOffsetY * previewScale;
  const zoom = Math.max(0.05, photoScale / 100);
  const photoTransform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(${zoom})`;

  return (
    <div className={cn('relative overflow-hidden rounded-lg', className)} style={{ width: scaledWidth, height: scaledHeight }}>
      {campaignType === 'background' && (
        <img src={templateImage} alt="Template" draggable={false} className="absolute inset-0 h-full w-full select-none object-contain pointer-events-none" />
      )}

      {campaignType === 'frame' && userPhoto && (
        <img
          src={userPhoto}
          alt="Blur fill"
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-cover scale-110 blur-xl pointer-events-none"
          style={{ opacity: 0.88 }}
        />
      )}

      {userPhoto && (
        <img
          src={userPhoto}
          alt="User"
          draggable={false}
          className="absolute left-1/2 top-1/2 max-w-none select-none pointer-events-none"
          style={{ transform: photoTransform, transformOrigin: 'center center' }}
        />
      )}

      {campaignType === 'frame' && (
        <img src={templateImage} alt="Template" draggable={false} className="absolute inset-0 h-full w-full select-none object-contain pointer-events-none" />
      )}
    </div>
  );
};

export default PhotoComposerPreview;
