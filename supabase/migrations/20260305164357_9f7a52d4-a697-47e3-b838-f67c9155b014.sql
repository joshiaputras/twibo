CREATE POLICY "Users can delete own pending payments"
ON public.payments
FOR DELETE
TO authenticated
USING (auth.uid() = user_id AND status IN ('pending', 'failed'));