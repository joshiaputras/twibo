import Layout from '@/components/Layout';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Upload, Download, Share2, Copy, MessageCircle } from 'lucide-react';
import { useState } from 'react';

const CampaignPublic = () => {
  const { slug } = useParams();
  const [uploaded, setUploaded] = useState(false);

  return (
    <Layout>
      <section className="py-24 md:py-32">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="glass-strong rounded-2xl p-8 border-gold-subtle gold-glow text-center">
            <h1 className="font-display text-2xl font-bold text-gold-gradient mb-2">Campaign: {slug}</h1>
            <p className="text-muted-foreground text-sm mb-6">Upload your photo to create your twibbon</p>

            {/* Example result preview */}
            <div className="aspect-square max-w-sm mx-auto rounded-xl bg-secondary/30 border border-border mb-6 flex items-center justify-center">
              <p className="text-muted-foreground text-sm">Example result preview</p>
            </div>

            {!uploaded ? (
              <div className="space-y-4">
                <label className="block cursor-pointer">
                  <div className="border-2 border-dashed border-border rounded-xl p-8 hover:border-primary/50 transition-colors">
                    <Upload className="w-10 h-10 text-primary/50 mx-auto mb-2" />
                    <p className="text-foreground font-medium">Upload your photo</p>
                    <p className="text-xs text-muted-foreground mt-1">Click or drag to upload</p>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={() => setUploaded(true)} />
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="aspect-square max-w-sm mx-auto rounded-xl bg-secondary/30 border border-primary/30 flex items-center justify-center">
                  <p className="text-foreground text-sm">Your twibbon result</p>
                </div>
                <Button className="gold-glow font-semibold gap-2 w-full max-w-sm mx-auto">
                  <Download className="w-4 h-4" />Download Result
                </Button>

                {/* Caption & share */}
                <div className="glass rounded-xl p-4 border-gold-subtle max-w-sm mx-auto text-left">
                  <p className="text-sm text-foreground mb-2">Caption text here #hashtag</p>
                  <Button variant="outline" size="sm" className="border-border gap-1 text-xs"><Copy className="w-3 h-3" />Copy Caption</Button>
                </div>

                <div className="flex gap-2 justify-center">
                  <Button variant="outline" size="icon" className="border-border" title="WhatsApp"><MessageCircle className="w-4 h-4" /></Button>
                  <Button variant="outline" size="icon" className="border-border" title="Share"><Share2 className="w-4 h-4" /></Button>
                  <Button variant="outline" size="icon" className="border-border" title="Copy Link"><Copy className="w-4 h-4" /></Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default CampaignPublic;