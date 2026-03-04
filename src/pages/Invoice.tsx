import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const Invoice = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [data, setData] = useState<any>(null);
  const [campaign, setCampaign] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!orderId) return;

      const { data: payment } = await supabase
        .from('payments' as any)
        .select('*')
        .eq('midtrans_order_id', orderId)
        .single();

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

  return (
    <div className="min-h-screen bg-white p-4 print:p-0">
      <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-lg shadow-sm print:shadow-none print:border-none">
        {/* Header */}
        <div className="p-8 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">INVOICE</h1>
              <p className="text-sm text-gray-500 mt-1">Twibbo Creator Hub</p>
            </div>
            <div className="text-right">
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
              <p className="text-gray-500 font-medium mb-1">Tanggal</p>
              <p className="text-gray-900">
                {new Date(tx.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
            {tx.paid_at && (
              <div>
                <p className="text-gray-500 font-medium mb-1">Tanggal Bayar</p>
                <p className="text-gray-900">
                  {new Date(tx.paid_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            )}
            {tx.payment_method && (
              <div>
                <p className="text-gray-500 font-medium mb-1">Metode Pembayaran</p>
                <p className="text-gray-900 capitalize">{tx.payment_method}</p>
              </div>
            )}
          </div>

          {/* Customer */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-gray-500 font-medium mb-2 text-sm">Pelanggan</p>
            <p className="text-gray-900 font-semibold">{profile?.name || '-'}</p>
            <p className="text-gray-600 text-sm">{profile?.email || '-'}</p>
            {profile?.phone && <p className="text-gray-600 text-sm">{profile.phone}</p>}
          </div>

          {/* Items */}
          <div className="border-t border-gray-100 pt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500">
                  <th className="text-left py-2 font-medium">Item</th>
                  <th className="text-right py-2 font-medium">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-50">
                  <td className="py-3">
                    <p className="text-gray-900 font-medium">Upgrade Premium</p>
                    <p className="text-gray-500 text-xs">Campaign: {campaign?.name || '-'}</p>
                  </td>
                  <td className="py-3 text-right text-gray-900 font-semibold">
                    Rp {(tx.amount || 0).toLocaleString('id-ID')}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200">
                  <td className="py-3 font-bold text-gray-900">Total</td>
                  <td className="py-3 text-right font-bold text-gray-900 text-lg">
                    Rp {(tx.amount || 0).toLocaleString('id-ID')}
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

        {/* Footer - hidden on print */}
        <div className="p-8 border-t border-gray-200 text-center print:hidden">
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
