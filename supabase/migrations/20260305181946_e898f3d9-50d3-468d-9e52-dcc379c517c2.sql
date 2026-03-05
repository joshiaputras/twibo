CREATE POLICY "Anyone can read paid payments by order id"
ON public.payments
FOR SELECT
USING (status = 'paid' AND midtrans_order_id IS NOT NULL);