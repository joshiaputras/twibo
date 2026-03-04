
-- Create vouchers table for promo codes
CREATE TABLE public.vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value integer NOT NULL DEFAULT 0,
  max_uses integer DEFAULT NULL,
  used_count integer NOT NULL DEFAULT 0,
  valid_from timestamp with time zone DEFAULT now(),
  valid_until timestamp with time zone DEFAULT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

-- Anyone can read active vouchers (needed for validation on public pages)
CREATE POLICY "Anyone can read active vouchers"
  ON public.vouchers FOR SELECT
  USING (is_active = true);

-- Admins can manage all vouchers
CREATE POLICY "Admins can manage vouchers"
  ON public.vouchers FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add voucher_code column to payments table
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS voucher_code text DEFAULT NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS discount_amount integer NOT NULL DEFAULT 0;

-- Trigger for updated_at on vouchers
CREATE TRIGGER update_vouchers_updated_at
  BEFORE UPDATE ON public.vouchers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
