import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Crown, Ticket, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PaymentConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (voucherCode?: string) => void;
  basePrice: number;
  originalPrice: number;
  campaignName: string;
  paying: boolean;
}

const PaymentConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  basePrice,
  originalPrice,
  campaignName,
  paying,
}: PaymentConfirmDialogProps) => {
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherValidating, setVoucherValidating] = useState(false);
  const [voucherDiscount, setVoucherDiscount] = useState<{
    type: string;
    value: number;
    code: string;
  } | null>(null);

  const discountAmount = voucherDiscount
    ? voucherDiscount.type === 'percentage'
      ? Math.round(basePrice * voucherDiscount.value / 100)
      : voucherDiscount.value
    : 0;
  const finalPrice = Math.max(0, basePrice - discountAmount);

  const handleValidateVoucher = async () => {
    if (!voucherCode.trim()) return;
    setVoucherValidating(true);
    try {
      const { data, error } = await supabase
        .from('vouchers' as any)
        .select('*')
        .eq('code', voucherCode.trim().toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) {
        toast.error('Kode voucher tidak valid');
        setVoucherDiscount(null);
        return;
      }

      const v = data as any;
      if (v.max_uses && v.used_count >= v.max_uses) {
        toast.error('Voucher sudah habis digunakan');
        setVoucherDiscount(null);
        return;
      }
      if (v.valid_until && new Date(v.valid_until) < new Date()) {
        toast.error('Voucher sudah kadaluarsa');
        setVoucherDiscount(null);
        return;
      }
      if (v.valid_from && new Date(v.valid_from) > new Date()) {
        toast.error('Voucher belum berlaku');
        setVoucherDiscount(null);
        return;
      }

      setVoucherDiscount({ type: v.discount_type, value: v.discount_value, code: v.code });
      toast.success(`Voucher "${v.code}" berhasil diterapkan!`);
    } catch {
      toast.error('Gagal memvalidasi voucher');
    } finally {
      setVoucherValidating(false);
    }
  };

  const handleConfirm = () => {
    onConfirm(voucherDiscount?.code);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="glass-strong border-gold-subtle max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-gold-gradient flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            Upgrade ke Premium
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2">
            <p className="text-sm text-muted-foreground">Campaign</p>
            <p className="text-foreground font-semibold">{campaignName}</p>
          </div>

          {/* Price breakdown */}
          <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Harga Premium</span>
              <span className="text-muted-foreground line-through">Rp {originalPrice.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Harga Promo</span>
              <span className="text-foreground font-semibold">Rp {basePrice.toLocaleString('id-ID')}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-green-400">Diskon Voucher</span>
                <span className="text-green-400 font-semibold">-Rp {discountAmount.toLocaleString('id-ID')}</span>
              </div>
            )}
            <hr className="border-border/30" />
            <div className="flex justify-between">
              <span className="text-foreground font-semibold">Total Bayar</span>
              <span className="text-gold-gradient font-display font-bold text-xl">Rp {finalPrice.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* Voucher input */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Punya kode promo?</p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Ticket className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Masukkan kode voucher"
                  value={voucherCode}
                  onChange={e => setVoucherCode(e.target.value.toUpperCase())}
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
            {voucherDiscount && (
              <button
                className="text-xs text-muted-foreground underline"
                onClick={() => { setVoucherDiscount(null); setVoucherCode(''); }}
              >
                Hapus voucher
              </button>
            )}
          </div>

          {/* Features included */}
          <div className="rounded-xl border border-border bg-secondary/20 p-4">
            <p className="text-xs text-muted-foreground mb-2">Yang kamu dapatkan:</p>
            <ul className="space-y-1.5">
              {['Tanpa watermark', 'Tanpa iklan', 'Statistik lengkap', 'Prioritas support'].map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-foreground">
                  <Check className="w-3 h-3 text-primary shrink-0" /> {f}
                </li>
              ))}
            </ul>
          </div>

          <Button
            className="w-full gold-glow-strong font-display font-semibold text-lg py-5"
            onClick={handleConfirm}
            disabled={paying}
          >
            {paying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Crown className="w-4 h-4 mr-2" />}
            {paying ? 'Memproses...' : `Bayar Rp ${finalPrice.toLocaleString('id-ID')}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentConfirmDialog;
