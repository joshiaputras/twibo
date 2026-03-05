import Layout from '@/components/Layout';
import { useLanguage } from '@/i18n/LanguageContext';

const Privacy = () => {
  const { lang } = useLanguage();
  const isId = lang === 'id';

  return (
    <Layout>
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-gold-gradient mb-8 text-center">
            {isId ? 'Kebijakan Privasi' : 'Privacy Policy'}
          </h1>

          <div className="glass-strong rounded-2xl border-gold-subtle p-6 md:p-10 space-y-6 text-sm text-foreground/80 leading-relaxed">
            <p className="text-xs text-muted-foreground">{isId ? 'Terakhir diperbarui: 5 Maret 2026' : 'Last updated: March 5, 2026'}</p>

            <div className="space-y-4">
              <h2 className="font-display font-semibold text-foreground text-lg">1. {isId ? 'Informasi yang Kami Kumpulkan' : 'Information We Collect'}</h2>
              <p>{isId
                ? 'Kami mengumpulkan informasi yang Anda berikan saat mendaftar (nama, email, nomor telepon), serta data penggunaan platform seperti campaign yang dibuat dan statistik akses. Foto yang diunggah oleh supporter hanya diproses secara lokal di browser dan tidak disimpan di server kami.'
                : 'We collect information you provide during registration (name, email, phone number), as well as platform usage data such as campaigns created and access statistics. Photos uploaded by supporters are processed locally in the browser and are not stored on our servers.'}</p>
            </div>

            <div className="space-y-4">
              <h2 className="font-display font-semibold text-foreground text-lg">2. {isId ? 'Bagaimana Kami Menggunakan Informasi' : 'How We Use Information'}</h2>
              <p>{isId
                ? 'Informasi yang kami kumpulkan digunakan untuk: menyediakan dan meningkatkan layanan, mengirim notifikasi terkait akun, memproses pembayaran, dan menjaga keamanan platform. Kami tidak menjual data pribadi Anda kepada pihak ketiga.'
                : 'Information we collect is used to: provide and improve services, send account-related notifications, process payments, and maintain platform security. We do not sell your personal data to third parties.'}</p>
            </div>

            <div className="space-y-4">
              <h2 className="font-display font-semibold text-foreground text-lg">3. {isId ? 'Keamanan Data' : 'Data Security'}</h2>
              <p>{isId
                ? 'Kami menerapkan langkah-langkah keamanan teknis dan organisasional yang wajar untuk melindungi informasi pribadi Anda dari akses, penggunaan, atau pengungkapan yang tidak sah. Data disimpan di server yang aman dengan enkripsi yang sesuai standar industri.'
                : 'We implement reasonable technical and organizational security measures to protect your personal information from unauthorized access, use, or disclosure. Data is stored on secure servers with industry-standard encryption.'}</p>
            </div>

            <div className="space-y-4">
              <h2 className="font-display font-semibold text-foreground text-lg">4. {isId ? 'Cookie & Teknologi Pelacakan' : 'Cookies & Tracking'}</h2>
              <p>{isId
                ? 'TWIBO.id menggunakan cookie untuk menjaga sesi login dan preferensi pengguna (seperti bahasa dan tema). Kami juga dapat menggunakan Google AdSense yang menempatkan cookie pihak ketiga untuk menampilkan iklan yang relevan.'
                : 'TWIBO.id uses cookies to maintain login sessions and user preferences (such as language and theme). We may also use Google AdSense which places third-party cookies to display relevant ads.'}</p>
            </div>

            <div className="space-y-4">
              <h2 className="font-display font-semibold text-foreground text-lg">5. {isId ? 'Hak Pengguna' : 'User Rights'}</h2>
              <p>{isId
                ? 'Anda berhak untuk: mengakses data pribadi Anda, meminta koreksi data yang tidak akurat, meminta penghapusan akun dan data terkait, serta menarik persetujuan penggunaan data. Untuk menjalankan hak-hak ini, hubungi kami di cs@twibo.id.'
                : 'You have the right to: access your personal data, request correction of inaccurate data, request deletion of your account and related data, and withdraw consent for data usage. To exercise these rights, contact us at cs@twibo.id.'}</p>
            </div>

            <div className="space-y-4">
              <h2 className="font-display font-semibold text-foreground text-lg">6. {isId ? 'Penyimpanan Data' : 'Data Retention'}</h2>
              <p>{isId
                ? 'Kami menyimpan data pribadi selama akun Anda aktif atau selama diperlukan untuk menyediakan layanan. Setelah akun dihapus, data akan dihapus dalam waktu 30 hari, kecuali diwajibkan oleh hukum untuk menyimpannya lebih lama.'
                : 'We retain personal data as long as your account is active or as needed to provide services. After account deletion, data will be removed within 30 days, unless legally required to retain it longer.'}</p>
            </div>

            <div className="space-y-4">
              <h2 className="font-display font-semibold text-foreground text-lg">7. {isId ? 'Perubahan Kebijakan' : 'Policy Changes'}</h2>
              <p>{isId
                ? 'Kami dapat memperbarui kebijakan privasi ini dari waktu ke waktu. Perubahan signifikan akan diumumkan melalui platform atau email. Penggunaan berkelanjutan setelah perubahan berarti Anda menerima kebijakan yang diperbarui.'
                : 'We may update this privacy policy from time to time. Significant changes will be announced through the platform or email. Continued use after changes means you accept the updated policy.'}</p>
            </div>

            <div className="space-y-4">
              <h2 className="font-display font-semibold text-foreground text-lg">8. {isId ? 'Kontak' : 'Contact'}</h2>
              <p>{isId
                ? 'Untuk pertanyaan terkait kebijakan privasi, silakan hubungi kami di cs@twibo.id.'
                : 'For questions regarding this privacy policy, please contact us at cs@twibo.id.'}</p>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Privacy;
