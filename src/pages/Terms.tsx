import Layout from '@/components/Layout';
import { useLanguage } from '@/i18n/LanguageContext';

const Terms = () => {
  const { lang } = useLanguage();
  const isId = lang === 'id';

  return (
    <Layout>
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-gold-gradient mb-8 text-center">
            {isId ? 'Syarat & Ketentuan' : 'Terms of Service'}
          </h1>

          <div className="glass-strong rounded-2xl border-gold-subtle p-6 md:p-10 space-y-6 text-sm text-foreground/80 leading-relaxed">
            <p className="text-xs text-muted-foreground">{isId ? 'Terakhir diperbarui: 5 Maret 2026' : 'Last updated: March 5, 2026'}</p>

            <div className="space-y-4">
              <h2 className="font-display font-semibold text-foreground text-lg">1. {isId ? 'Penerimaan Ketentuan' : 'Acceptance of Terms'}</h2>
              <p>{isId
                ? 'Dengan menggunakan layanan TWIBO.id, Anda setuju untuk terikat oleh syarat dan ketentuan ini. Jika Anda tidak menyetujui syarat ini, mohon untuk tidak menggunakan platform kami.'
                : 'By using TWIBO.id services, you agree to be bound by these terms and conditions. If you do not agree with these terms, please do not use our platform.'}</p>
            </div>

            <div className="space-y-4">
              <h2 className="font-display font-semibold text-foreground text-lg">2. {isId ? 'Penggunaan Layanan' : 'Use of Service'}</h2>
              <p>{isId
                ? 'TWIBO.id menyediakan layanan pembuatan twibbon dan campaign frame secara online. Anda bertanggung jawab atas konten yang Anda buat dan bagikan melalui platform kami. Dilarang menggunakan platform untuk konten ilegal, melanggar hak cipta, pornografi, SARA, atau konten berbahaya lainnya.'
                : 'TWIBO.id provides online twibbon and campaign frame creation services. You are responsible for all content you create and share through our platform. It is prohibited to use the platform for illegal content, copyright infringement, pornography, hate speech, or other harmful content.'}</p>
            </div>

            <div className="space-y-4">
              <h2 className="font-display font-semibold text-foreground text-lg">3. {isId ? 'Akun Pengguna' : 'User Accounts'}</h2>
              <p>{isId
                ? 'Untuk membuat campaign, Anda perlu membuat akun. Anda bertanggung jawab menjaga kerahasiaan kredensial akun Anda. TWIBO.id berhak menangguhkan atau menghapus akun yang melanggar ketentuan.'
                : 'To create campaigns, you need to create an account. You are responsible for maintaining the confidentiality of your account credentials. TWIBO.id reserves the right to suspend or delete accounts that violate these terms.'}</p>
            </div>

            <div className="space-y-4">
              <h2 className="font-display font-semibold text-foreground text-lg">4. {isId ? 'Pembayaran & Langganan' : 'Payment & Subscription'}</h2>
              <p>{isId
                ? 'TWIBO.id menawarkan layanan gratis dan premium. Pembayaran untuk layanan premium bersifat per-campaign dan non-refundable setelah campaign berhasil diupgrade. Harga dapat berubah sewaktu-waktu dengan pemberitahuan sebelumnya.'
                : 'TWIBO.id offers both free and premium services. Payment for premium services is per-campaign and non-refundable after a campaign has been successfully upgraded. Prices may change at any time with prior notice.'}</p>
            </div>

            <div className="space-y-4">
              <h2 className="font-display font-semibold text-foreground text-lg">5. {isId ? 'Hak Kekayaan Intelektual' : 'Intellectual Property'}</h2>
              <p>{isId
                ? 'Semua konten yang Anda buat di TWIBO.id tetap menjadi milik Anda. Namun, Anda memberikan TWIBO.id lisensi terbatas untuk menampilkan dan memproses konten tersebut dalam rangka menyediakan layanan. Merek dagang, logo, dan desain TWIBO.id adalah milik TWIBO.id.'
                : 'All content you create on TWIBO.id remains your property. However, you grant TWIBO.id a limited license to display and process that content in order to provide the service. The TWIBO.id trademark, logo, and design are the property of TWIBO.id.'}</p>
            </div>

            <div className="space-y-4">
              <h2 className="font-display font-semibold text-foreground text-lg">6. {isId ? 'Batasan Tanggung Jawab' : 'Limitation of Liability'}</h2>
              <p>{isId
                ? 'TWIBO.id menyediakan layanan "sebagaimana adanya" tanpa jaminan apapun. Kami tidak bertanggung jawab atas kerugian yang timbul dari penggunaan atau ketidakmampuan menggunakan layanan kami, termasuk kehilangan data atau gangguan layanan.'
                : 'TWIBO.id provides services "as is" without any warranties. We are not liable for any damages arising from the use or inability to use our services, including data loss or service interruptions.'}</p>
            </div>

            <div className="space-y-4">
              <h2 className="font-display font-semibold text-foreground text-lg">7. {isId ? 'Perubahan Ketentuan' : 'Changes to Terms'}</h2>
              <p>{isId
                ? 'TWIBO.id berhak mengubah syarat dan ketentuan ini sewaktu-waktu. Perubahan akan diumumkan melalui platform. Penggunaan berkelanjutan setelah perubahan berarti Anda menerima ketentuan baru.'
                : 'TWIBO.id reserves the right to modify these terms at any time. Changes will be announced through the platform. Continued use after changes means you accept the new terms.'}</p>
            </div>

            <div className="space-y-4">
              <h2 className="font-display font-semibold text-foreground text-lg">8. {isId ? 'Kontak' : 'Contact'}</h2>
              <p>{isId
                ? 'Untuk pertanyaan terkait syarat dan ketentuan, silakan hubungi kami di cs@twibo.id.'
                : 'For questions regarding these terms, please contact us at cs@twibo.id.'}</p>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Terms;
