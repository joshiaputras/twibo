import Layout from '@/components/Layout';
import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Tag, ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

const BlogPost = () => {
  const { slug } = useParams();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      const { data } = await supabase
        .from('blog_posts' as any)
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle();
      setPost(data);
      setLoading(false);
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

  // JSON-LD for SEO
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {post.meta_title && (
        <title>{post.meta_title}</title>
      )}
      <article className="py-24 md:py-32">
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

          <div
            className="prose prose-invert max-w-none text-foreground/90 
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
        </div>
      </article>
    </Layout>
  );
};

export default BlogPost;
