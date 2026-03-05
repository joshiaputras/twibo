import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Crown, Ticket, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/i18n/LanguageContext';

type PaymentTab = 'local' | 'international';

interface PaymentConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (voucherCode?: string) => void;
  onPayPalSuccess?: () => void;
  basePrice: number;
  originalPrice: number;
  campaignName: string;
  campaignId?: string;
  paying: boolean;
  paypalEnabled?: boolean;
  paypalClientId?: string;
  paypalMode?: string;
  paypalPriceUsd?: number;
  paypalOriginalPriceUsd?: number;
}

const PaymentConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  onPayPalSuccess,
  basePrice,
  originalPrice,
  campaignName,
  campaignId,
  paying,
  paypalEnabled = false,
  paypalClientId = '',
  paypalMode = 'sandbox',
  paypalPriceUsd = 3,
  paypalOriginalPriceUsd,
}: PaymentConfirmDialogProps) => {
  const { t } = useLanguage();
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherValidating, setVoucherValidating] = useState(false);
  const [voucherError, setVoucherError] = useState('');
  const [voucherDiscount, setVoucherDiscount] = useState<{
    type: string;
    value: number;
    code: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<PaymentTab>('local');
  const [paypalReady, setPaypalReady] = useState(false);
  const [paypalProcessing, setPaypalProcessing] = useState(false);
  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const paypalButtonsRendered = useRef(false);

  const discountAmount = voucherDiscount
    ? voucherDiscount.type === 'percentage'
      ? Math.round(basePrice * voucherDiscount.value / 100)
      : voucherDiscount.value
    : 0;
  const finalPrice = Math.max(0, basePrice - discountAmount);

  // Load PayPal SDK when International tab is selected
  useEffect(() => {
    if (!open || activeTab !== 'international' || !paypalEnabled || !paypalClientId) return;

    paypalButtonsRendered.current = false;
    setPaypalReady(false);

    const existingScript = document.querySelector('script[src*="paypal.com/sdk"]');
    if (existingScript) existingScript.remove();

    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${paypalClientId}&currency=USD`;
    script.onload = () => setPaypalReady(true);
    script.onerror = () => toast.error(t.payment?.paypalLoadFailed ?? 'Failed to load PayPal');
    document.head.appendChild(script);

    return () => {
      paypalButtonsRendered.current = false;
    };
  }, [open, activeTab, paypalEnabled, paypalClientId]);

  // Render PayPal buttons
  useEffect(() => {
    if (!paypalReady || !paypalContainerRef.current || paypalButtonsRendered.current) return;
    if (!(window as any).paypal) return;

    paypalButtonsRendered.current = true;
    paypalContainerRef.current.innerHTML = '';

    (window as any).paypal.Buttons({
      style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' },
      createOrder: (_data: any, actions: any) => {
        return actions.order.create({
          purchase_units: [{
            description: `Premium: ${campaignName.substring(0, 40)}`,
            amount: { currency_code: 'USD', value: paypalPriceUsd.toFixed(2) },
          }],
        });
      },
      onApprove: async (_data: any, actions: any) => {
        setPaypalProcessing(true);
        try {
          const details = await actions.order.capture();
          
          const { data: { session } } = await supabase.auth.getSession();
          if (session && campaignId) {
            const orderId = `PAYPAL-${details.id}`;
            await supabase.from('payments' as any).insert({
              user_id: session.user.id,
              campaign_id: campaignId,
              amount: Math.round(paypalPriceUsd * 100),
              midtrans_order_id: orderId,
              midtrans_transaction_id: details.id,
              status: 'paid',
              payment_method: 'paypal',
              paid_at: new Date().toISOString(),
            });

            await supabase.from('campaigns' as any).update({ tier: 'premium' }).eq('id', campaignId);

            // Cleanup other pending/failed payments for this campaign
            await supabase.from('payments' as any)
              .delete()
              .eq('campaign_id', campaignId)
              .neq('midtrans_order_id', orderId)
              .in('status', ['pending', 'failed']);

            // Trigger invoice email (fire-and-forget)
            supabase.functions.invoke('send-invoice-email', {
              body: { order_id: orderId, app_url: window.location.origin },
            }).catch(err => console.error('Invoice email trigger failed:', err));
          }

          toast.success(t.payment?.paypalSuccess ?? 'Payment successful! Campaign upgraded to Premium.');
          onClose();
          onPayPalSuccess?.();
        } catch (err: any) {
          toast.error(err.message || 'PayPal payment failed');
        } finally {
          setPaypalProcessing(false);
        }
      },
      onError: (err: any) => {
        console.error('PayPal error:', err);
        toast.error(t.payment?.paypalFailed ?? 'PayPal payment failed');
      },
    }).render(paypalContainerRef.current);
  }, [paypalReady, campaignId, campaignName, paypalPriceUsd, onClose, onPayPalSuccess, t]);

  const handleValidateVoucher = async () => {
    if (!voucherCode.trim()) return;
    setVoucherValidating(true);
    setVoucherError('');
    try {
      const { data, error } = await supabase
        .from('vouchers' as any)
        .select('*')
        .eq('code', voucherCode.trim().toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) {
        setVoucherError(t.payment?.voucherInvalid ?? 'Kode voucher tidak valid');
        setVoucherDiscount(null);
        return;
      }

      const v = data as any;
      if (v.max_uses && v.used_count >= v.max_uses) {
        setVoucherError(t.payment?.voucherExhausted ?? 'Voucher sudah habis digunakan');
        setVoucherDiscount(null);
        return;
      }
      if (v.valid_until && new Date(v.valid_until) < new Date()) {
        setVoucherError(t.payment?.voucherExpired ?? 'Voucher sudah kadaluarsa');
        setVoucherDiscount(null);
        return;
      }
      if (v.valid_from && new Date(v.valid_from) > new Date()) {
        setVoucherError(t.payment?.voucherNotActive ?? 'Voucher belum berlaku');
        setVoucherDiscount(null);
        return;
      }

      setVoucherDiscount({ type: v.discount_type, value: v.discount_value, code: v.code });
      toast.success(`Voucher "${v.code}" ${t.payment?.voucherApplied ?? 'berhasil diterapkan!'}`);
    } catch {
      setVoucherError(t.payment?.voucherValidateFailed ?? 'Gagal memvalidasi voucher');
    } finally {
      setVoucherValidating(false);
    }
  };

  const handleConfirm = () => {
    onClose();
    setTimeout(() => {
      onConfirm(voucherDiscount?.code);
    }, 300);
  };

  const premiumFeatures = [
    t.pricing?.premiumFeatures?.f2 ?? 'No watermark',
    t.pricing?.premiumFeatures?.f3 ?? 'No ads',
    t.pricing?.premiumFeatures?.f4 ?? 'Full statistics',
    t.pricing?.premiumFeatures?.f5 ?? 'Priority support',
    t.pricing?.premiumFeatures?.f6 ?? 'Upload custom banner',
  ];

  const showInternational = paypalEnabled && paypalClientId;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="glass-strong border-gold-subtle max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-gold-gradient flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            {t.campaign?.upgradeToPremium ?? 'Upgrade ke Premium'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2">
            <p className="text-sm text-muted-foreground">Campaign</p>
            <p className="text-foreground font-semibold">{campaignName}</p>
          </div>

          {/* Payment method tabs */}
          {showInternational && (
            <div className="flex rounded-xl border border-border overflow-hidden">
              <button
                onClick={() => setActiveTab('local')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-all ${
                  activeTab === 'local'
                    ? 'bg-primary/10 text-foreground border-b-2 border-primary'
                    : 'bg-secondary/20 text-muted-foreground hover:bg-secondary/40'
                }`}
              >
                <svg viewBox="0 0 3 2" className="w-5 h-3" aria-label="Indonesia"><rect width="3" height="1" fill="#FF0000" /><rect y="1" width="3" height="1" fill="#FFFFFF" /></svg>
                <span className="text-xs sm:text-sm">{t.payment?.localPayment ?? 'Pembayaran Lokal'}</span>
              </button>
              <button
                onClick={() => setActiveTab('international')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-all ${
                  activeTab === 'international'
                    ? 'bg-primary/10 text-foreground border-b-2 border-primary'
                    : 'bg-secondary/20 text-muted-foreground hover:bg-secondary/40'
                }`}
              >
                <span className="text-base">🌍</span>
                <span className="text-xs sm:text-sm">{t.payment?.internationalPayment ?? 'International'}</span>
              </button>
            </div>
          )}

          {/* === LOCAL (Midtrans) Tab === */}
          {activeTab === 'local' && (
            <>
              {/* Price breakdown */}
              <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-muted-foreground">🏦 QRIS / Bank Transfer</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t.payment?.premiumPrice ?? 'Harga Premium'}</span>
                  <span className="text-muted-foreground line-through">Rp {originalPrice.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t.payment?.promoPrice ?? 'Harga Promo'}</span>
                  <span className="text-foreground font-semibold">Rp {basePrice.toLocaleString('id-ID')}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-400">{t.payment?.voucherDiscount ?? 'Diskon Voucher'}</span>
                    <span className="text-green-400 font-semibold">-Rp {discountAmount.toLocaleString('id-ID')}</span>
                  </div>
                )}
                <hr className="border-border/30" />
                <div className="flex justify-between">
                  <span className="text-foreground font-semibold">{t.payment?.totalPay ?? 'Total Bayar'}</span>
                  <span className="text-gold-gradient font-display font-bold text-xl">Rp {finalPrice.toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* Voucher input */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t.payment?.havePromo ?? 'Punya kode promo?'}</p>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Ticket className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={t.payment?.enterVoucher ?? 'Masukkan kode voucher'}
                      value={voucherCode}
                      onChange={e => { setVoucherCode(e.target.value.toUpperCase()); setVoucherError(''); }}
                      className="pl-9 bg-secondary/50 border-border text-sm uppercase"
                      disabled={!!voucherDiscount}
                    />
                  </div>
                  {voucherDiscount ? (
                    <Button size="sm" variant="outline" className="text-xs shrink-0 text-green-400 border-green-400/30" disabled>
                      <Check className="w-3 h-3 mr-1" /> Applied
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs shrink-0"
                      onClick={handleValidateVoucher}
                      disabled={voucherValidating || !voucherCode.trim()}
                    >
                      {voucherValidating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Apply'}
                    </Button>
                  )}
                </div>
                {voucherError && (
                  <p className="text-xs text-destructive">{voucherError}</p>
                )}
                {voucherDiscount && (
                  <button
                    className="text-xs text-muted-foreground underline"
                    onClick={() => { setVoucherDiscount(null); setVoucherCode(''); setVoucherError(''); }}
                  >
                    {t.payment?.removeVoucher ?? 'Hapus voucher'}
                  </button>
                )}
              </div>

              {/* Features */}
              <PremiumFeatures features={premiumFeatures} label={t.payment?.whatYouGet ?? 'Yang kamu dapatkan:'} />

              {/* Pay button */}
              <Button
                className="w-full gold-glow-strong font-display font-semibold text-lg py-5"
                onClick={handleConfirm}
                disabled={paying}
              >
                {paying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Crown className="w-4 h-4 mr-2" />}
                {paying ? (t.payment?.processing ?? 'Memproses...') : `${t.payment?.pay ?? 'Bayar'} Rp ${finalPrice.toLocaleString('id-ID')}`}
              </Button>
            </>
          )}

          {/* === INTERNATIONAL (PayPal) Tab === */}
          {activeTab === 'international' && (
            <>
              {/* Price */}
              <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-muted-foreground">💳 PayPal / Credit Card</span>
                </div>
                {paypalOriginalPriceUsd && paypalOriginalPriceUsd > paypalPriceUsd && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t.payment?.premiumPrice ?? 'Harga Premium'}</span>
                    <span className="text-muted-foreground line-through">${paypalOriginalPriceUsd.toFixed(2)} USD</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t.payment?.promoPrice ?? 'Harga Promo'}</span>
                  <span className="text-foreground font-semibold">${paypalPriceUsd.toFixed(2)} USD</span>
                </div>
                <hr className="border-border/30" />
                <div className="flex justify-between">
                  <span className="text-foreground font-semibold">{t.payment?.totalPay ?? 'Total Bayar'}</span>
                  <span className="text-gold-gradient font-display font-bold text-xl">${paypalPriceUsd.toFixed(2)} USD</span>
                </div>
              </div>

              {/* Features */}
              <PremiumFeatures features={premiumFeatures} label={t.payment?.whatYouGet ?? 'Yang kamu dapatkan:'} />

              {/* PayPal buttons */}
              <div className="space-y-3">
                {paypalProcessing && (
                  <div className="flex items-center justify-center gap-2 py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm text-foreground">{t.payment?.processing ?? 'Memproses...'}</span>
                  </div>
                )}
                <div ref={paypalContainerRef} className={paypalProcessing ? 'opacity-50 pointer-events-none' : ''} />
                {!paypalReady && !paypalProcessing && (
                  <div className="flex items-center justify-center gap-2 py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{t.payment?.loadingPaypal ?? 'Loading PayPal...'}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const PremiumFeatures = ({ features, label }: { features: string[]; label: string }) => (
  <div className="rounded-xl border border-border bg-secondary/20 p-4">
    <p className="text-xs text-muted-foreground mb-2">{label}</p>
    <ul className="space-y-1.5">
      {features.map((f, i) => (
        <li key={i} className="flex items-center gap-2 text-xs text-foreground">
          <Check className="w-3 h-3 text-primary shrink-0" /> {f}
        </li>
      ))}
    </ul>
  </div>
);

export default PaymentConfirmDialog;
