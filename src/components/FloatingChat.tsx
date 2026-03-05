import { MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const FloatingChat = () => {
  const [chatUrl, setChatUrl] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'chat_url')
        .maybeSingle();
      if (data?.value) setChatUrl(data.value);
    };
    load();
  }, []);

  if (!chatUrl) return null;

  return (
    <a
      href={chatUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-110 transition-transform gold-glow"
      aria-label="Chat Support"
    >
      <MessageCircle className="w-6 h-6" />
    </a>
  );
};

export default FloatingChat;
