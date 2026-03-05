import Layout from '@/components/Layout';
import { useLanguage } from '@/i18n/LanguageContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Tag } from 'lucide-react';
import AnchorAd from '@/components/AnchorAd';

const Blog = () => {
  const { t } = useLanguage();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // Fetch published posts AND scheduled posts whose published_at <= now
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('blog_posts' as any)
        .select('*')
        .or(`status.eq.published,and(status.eq.scheduled,published_at.lte.${now})`)
        .order('published_at', { ascending: false });
      setPosts((data as any[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <Layout>
      <section className="py-24 md:py-32">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="font-display text-3xl md:text-5xl font-bold text-gold-gradient mb-3">
              {t.blog?.title ?? 'Blog'}
            </h1>
            <p className="text-muted-foreground">
              {t.blog?.subtitle ?? 'Tips, tutorial, dan update terbaru dari TWIBO.id'}
            </p>
          </div>

          {loading ? (
            <div className="space-y-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="glass rounded-2xl border-gold-subtle p-6">
                  <Skeleton className="h-6 w-3/4 mb-3" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">
              {t.blog?.noPosts ?? 'Belum ada artikel.'}
            </div>
          ) : (
            <div className="space-y-6">
              {posts.map((post: any) => (
                <Link key={post.id} to={`/blog/${post.slug}`}>
                  <article className="glass rounded-2xl border-gold-subtle p-6 hover:gold-glow transition-shadow group">
                    {post.cover_image_url && (
                      <img
                        src={post.cover_image_url}
                        alt={post.title}
                        className="w-full h-48 object-cover rounded-xl mb-4"
                        loading="lazy"
                      />
                    )}
                    <h2 className="font-display text-xl font-bold text-foreground group-hover:text-primary transition-colors mb-2">
                      {post.title}
                    </h2>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(post.published_at || post.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                      {post.tags?.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {post.tags.slice(0, 3).join(', ')}
                        </span>
                      )}
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
      <AnchorAd />
    </Layout>
  );
};

export default Blog;
