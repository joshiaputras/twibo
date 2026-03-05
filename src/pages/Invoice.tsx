import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const Invoice = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [data, setData] = useState<any>(null);
  const [campaign, setCampaign] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!orderId) return;

      const [{ data: payment }, { data: logoSetting }] = await Promise.all([
        supabase.from('payments' as any).select('*').eq('midtrans_order_id', orderId).single(),
        supabase.from('site_settings').select('value').eq('key', 'logo_url').maybeSingle(),
      ]);

      if (logoSetting) setLogoUrl((logoSetting as any).value || '');

      if (!payment) {
        setLoading(false);
        return;
      }

      setData(payment);

      const [{ data: camp }, { data: prof }] = await Promise.all([
        supabase.from('campaigns' as any).select('name, slug').eq('id', (payment as any).campaign_id).single(),
        supabase.from('profiles' as any).select('name, email, phone').eq('id', (payment as any).user_id).single(),
      ]);

      setCampaign(camp);
      setProfile(prof);
      setLoading(false);
    };
    load();
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-gray-500">
        Loading invoice...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-gray-500">
        Invoice not found
      </div>
    );
  }

  const tx = data as any;
  const isPaid = tx.status === 'paid';
  const isPaypal = tx.payment_method === 'paypal';

  return (
    <div className="min-h-screen bg-gray-50 p-4 print:p-0 print:bg-white">
      <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-lg shadow-sm print:shadow-none print:border-none">
        {/* Header */}
        <div className="p-8 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                {logoUrl && (
                  <img src={logoUrl} alt="TWIBO.id" className="h-9 w-9 rounded-lg object-cover" />
                )}
                <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: '#fcb503', fontFamily: "'Space Grotesk', 'Segoe UI', sans-serif" }}>TWIBO.id</h1>
              </div>
              <p className="text-sm text-gray-500 mt-1">www.twibo.id</p>
              <p className="text-xs text-gray-400 mt-0.5">cs@twibo.id</p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-semibold text-gray-700 mb-2">INVOICE</h2>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                isPaid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {isPaid ? 'PAID' : tx.status?.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-gray-500 font-medium mb-1">Order ID</p>
              <p className="text-gray-900 font-mono text-xs">{tx.midtrans_order_id}</p>
            </div>
            <div>
              <p className="text-gray-500 font-medium mb-1">Date</p>
              <p className="text-gray-900">
                {new Date(tx.created_at).toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
            {tx.paid_at && (
              <div>
                <p className="text-gray-500 font-medium mb-1">Payment Date</p>
                <p className="text-gray-900">
                  {new Date(tx.paid_at).toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            )}
            {tx.payment_method && (
              <div>
                <p className="text-gray-500 font-medium mb-1">Payment Method</p>
                <p className="text-gray-900 capitalize">{tx.payment_method}</p>
              </div>
            )}
          </div>

          {/* Customer */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-gray-500 font-medium mb-2 text-sm">Bill To</p>
            <p className="text-gray-900 font-semibold">{profile?.name || '-'}</p>
            <p className="text-gray-600 text-sm">{profile?.email || '-'}</p>
            {profile?.phone && <p className="text-gray-600 text-sm">{profile.phone}</p>}
          </div>

          {/* Items */}
          <div className="border-t border-gray-100 pt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500">
                  <th className="text-left py-2 font-medium">Description</th>
                  <th className="text-right py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-50">
                  <td className="py-3">
                    <p className="text-gray-900 font-medium">Premium Upgrade</p>
                    <p className="text-gray-500 text-xs">Campaign: {campaign?.name || '-'}</p>
                  </td>
                  <td className="py-3 text-right text-gray-900 font-semibold">
                    {isPaypal
                      ? `$${((tx.amount + (tx.discount_amount || 0)) / 100).toFixed(2)} USD`
                      : `Rp ${((tx.amount || 0) + (tx.discount_amount || 0)).toLocaleString('id-ID')}`}
                  </td>
                </tr>
                {tx.discount_amount > 0 && (
                  <tr className="border-t border-gray-50">
                    <td className="py-2">
                      <p className="text-green-600 font-medium">Voucher Discount</p>
                      {tx.voucher_code && <p className="text-gray-500 text-xs">Code: {tx.voucher_code}</p>}
                    </td>
                    <td className="py-2 text-right text-green-600 font-semibold">
                      {isPaypal
                        ? `-$${(tx.discount_amount / 100).toFixed(2)} USD`
                        : `-Rp ${(tx.discount_amount || 0).toLocaleString('id-ID')}`}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200">
                  <td className="py-3 font-bold text-gray-900">Total</td>
                  <td className="py-3 text-right font-bold text-gray-900 text-lg" style={{ color: '#000000' }}>
                    {isPaypal
                      ? `$${(tx.amount / 100).toFixed(2)} USD`
                      : `Rp ${(tx.amount || 0).toLocaleString('id-ID')}`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {tx.midtrans_transaction_id && (
            <div className="text-xs text-gray-400 border-t border-gray-100 pt-4">
              Transaction ID: {tx.midtrans_transaction_id}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 text-center text-xs text-gray-400">
          <p>TWIBO.id — www.twibo.id — cs@twibo.id</p>
          <p className="mt-1">Thank you for your purchase!</p>
        </div>

        {/* Print button - hidden on print */}
        <div className="p-6 border-t border-gray-100 text-center print:hidden">
          <button
            onClick={() => window.print()}
            className="px-6 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            🖨️ Print / Save PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default Invoice;
