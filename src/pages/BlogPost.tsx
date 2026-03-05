import Layout from '@/components/Layout';
import SEOHead from '@/components/SEOHead';
import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Tag, ArrowLeft, BookOpen, Share2, Link2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import AdSenseBanner from '@/components/AdSenseBanner';
import AnchorAd from '@/components/AnchorAd';

const BlogPost = () => {
  const { slug } = useParams();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [relatedPosts, setRelatedPosts] = useState<any[]>([]);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('blog_posts' as any)
        .select('*')
        .eq('slug', slug)
        .or(`status.eq.published,and(status.eq.scheduled,published_at.lte.${now})`)
        .maybeSingle();
      setPost(data);
      setLoading(false);

      // Fetch related posts (same tags, exclude current)
      if (data) {
        const { data: allPosts } = await supabase
          .from('blog_posts' as any)
          .select('id, title, slug, excerpt, cover_image_url, published_at, created_at, tags')
          .or(`status.eq.published,and(status.eq.scheduled,published_at.lte.${now})`)
          .neq('id', (data as any).id)
          .order('published_at', { ascending: false })
          .limit(20);

        const currentTags = new Set(((data as any).tags || []).map((t: string) => t.toLowerCase()));
        let related = ((allPosts as any[]) ?? []);

        if (currentTags.size > 0) {
          // Sort by tag overlap
          related = related
            .map(p => ({
              ...p,
              overlap: (p.tags || []).filter((t: string) => currentTags.has(t.toLowerCase())).length,
            }))
            .sort((a, b) => b.overlap - a.overlap);
        }

        setRelatedPosts(related.slice(0, 3));
      }
    };
    load();
  }, [slug]);

  if (loading) {
    return (
      <Layout>
        <section className="py-24 md:py-32">
          <div className="container mx-auto px-4 max-w-3xl space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-64 w-full" />
          </div>
        </section>
      </Layout>
    );
  }

  if (!post) {
    return (
      <Layout>
        <section className="py-24 md:py-32 text-center">
          <div className="container mx-auto px-4">
            <h1 className="font-display text-2xl font-bold text-foreground mb-2">Artikel tidak ditemukan</h1>
            <Link to="/blog"><Button variant="outline">Kembali ke Blog</Button></Link>
          </div>
        </section>
      </Layout>
    );
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.meta_title || post.title,
    description: post.meta_description || post.excerpt,
    image: post.cover_image_url,
    datePublished: post.published_at || post.created_at,
    dateModified: post.updated_at,
  };

  return (
    <Layout>
      <SEOHead
        title={`${post.meta_title || post.title} — TWIBO.id Blog`}
        description={post.meta_description || post.excerpt}
        canonical={`https://twibo.id/blog/${post.slug}`}
        ogImage={post.cover_image_url}
        ogType="article"
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-3xl">
          <Link to="/blog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="w-4 h-4" /> Kembali ke Blog
          </Link>

          {post.cover_image_url && (
            <img
              src={post.cover_image_url}
              alt={post.title}
              className="w-full h-auto max-h-[400px] object-cover rounded-2xl mb-6"
              loading="lazy"
            />
          )}

          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            {post.title}
          </h1>

          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(post.published_at || post.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
            {post.tags?.length > 0 && (
              <span className="flex items-center gap-1">
                <Tag className="w-4 h-4" />
                {post.tags.join(', ')}
              </span>
            )}
          </div>

          {/* Share buttons */}
          <div className="flex items-center gap-2 mb-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const url = `${window.location.origin}/blog/${slug}`;
                navigator.clipboard.writeText(url);
                toast.success('Link disalin!');
              }}
            >
              <Link2 className="w-4 h-4 mr-1" /> Salin Link
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const url = `${window.location.origin}/blog/${slug}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(`${post.title}\n\n${url}`)}`, '_blank');
              }}
            >
              <Share2 className="w-4 h-4 mr-1" /> Share
            </Button>
          </div>

          {/* AdSense - Top of article */}
          <div className="mb-8">
            <AdSenseBanner />
          </div>

          <div
            className="prose max-w-none text-foreground/90 
              [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:text-foreground
              [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:text-foreground
              [&_p]:mb-4 [&_p]:leading-relaxed [&_p]:text-foreground/80
              [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4
              [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4
              [&_li]:mb-1 [&_li]:text-foreground/80
              [&_a]:text-primary [&_a]:underline
              [&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground
              [&_img]:rounded-xl [&_img]:my-4
              [&_pre]:bg-secondary/50 [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:overflow-x-auto
              [&_code]:text-primary [&_code]:text-sm"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* AdSense - Bottom of article */}
          <div className="mt-8">
            <AdSenseBanner />
          </div>

          {/* Related Articles */}
          {relatedPosts.length > 0 && (
            <div className="mt-16 pt-8 border-t border-border">
              <h2 className="font-display text-xl font-bold text-foreground mb-6">Artikel Terkait</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {relatedPosts.map((rp: any) => (
                  <Link key={rp.id} to={`/blog/${rp.slug}`} className="group">
                    <article className="glass rounded-xl border-gold-subtle overflow-hidden hover:gold-glow transition-shadow h-full flex flex-col">
                      {rp.cover_image_url ? (
                        <img src={rp.cover_image_url} alt={rp.title} className="w-full h-32 object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                      ) : (
                        <div className="w-full h-32 bg-secondary/30 flex items-center justify-center">
                          <BookOpen className="w-8 h-8 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="p-3 flex-1 flex flex-col">
                        <h3 className="font-display font-semibold text-sm text-foreground group-hover:text-primary transition-colors mb-1 line-clamp-2">{rp.title}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{rp.excerpt}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                          <Calendar className="w-3 h-3" />
                          {new Date(rp.published_at || rp.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </article>
      <AnchorAd />
    </Layout>
  );
};

export default BlogPost;
