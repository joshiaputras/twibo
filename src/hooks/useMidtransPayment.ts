import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PaymentResult {
  success: boolean;
  orderId?: string;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const useMidtransPayment = () => {
  const [paying, setPaying] = useState(false);

  const pay = useCallback(async (campaignId: string): Promise<PaymentResult> => {
    setPaying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Silakan login terlebih dahulu');
        return { success: false };
      }

      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { campaign_id: campaignId },
      });

      if (error || !data?.snap_token) {
        toast.error(data?.error || error?.message || 'Gagal membuat pembayaran');
        return { success: false };
      }

      const { snap_token, snap_url, client_key, order_id } = data;

      // Load Midtrans Snap script
      await new Promise<void>((resolve, reject) => {
        const existingScript = document.querySelector('script[src*="snap"]') as HTMLScriptElement | null;
        if (existingScript && (window as any).snap) {
          resolve();
          return;
        }
        if (existingScript) existingScript.remove();

        const script = document.createElement('script');
        script.src = snap_url;
        script.setAttribute('data-client-key', client_key);
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Midtrans'));
        document.head.appendChild(script);
      });

      // Open Snap popup
      return new Promise<PaymentResult>((resolve) => {
        (window as any).snap.pay(snap_token, {
          onSuccess: async () => {
            toast.success('Pembayaran berhasil! Campaign di-upgrade ke Premium.');
            // Poll briefly to let webhook process, then force-upgrade client-side
            for (let i = 0; i < 5; i++) {
              await sleep(2000);
              const { data: pData } = await supabase
                .from('payments' as any)
                .select('status')
                .eq('midtrans_order_id', order_id)
                .single();
              if ((pData as any)?.status === 'paid') break;
            }
            resolve({ success: true, orderId: order_id });
          },
          onPending: () => {
            toast.info('Pembayaran pending. Akan otomatis di-upgrade setelah pembayaran dikonfirmasi.');
            resolve({ success: false, orderId: order_id });
          },
          onError: () => {
            toast.error('Pembayaran gagal.');
            resolve({ success: false, orderId: order_id });
          },
          onClose: () => {
            resolve({ success: false, orderId: order_id });
          },
        });
      });
    } catch (err: any) {
      toast.error(err.message || 'Payment error');
      return { success: false };
    } finally {
      setPaying(false);
    }
  }, []);

  return { pay, paying };
};
