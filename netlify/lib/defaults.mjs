// Sitenin varsayılan içeriği. Yönetim panelinden kaydedilen içerik bunun üzerine yazılır;
// panelde hiç dokunulmamış alanlar buradaki değerlerle gösterilir.

const KVKK = `Bu aydınlatma metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca, {siteName} web sitesini kullanırken paylaştığınız kişisel verilerin nasıl işlendiği hakkında sizi bilgilendirmek amacıyla hazırlanmıştır.

## Veri sorumlusu

{contact}

## İşlenen kişisel veriler

- Üyelik bilgileri: ad soyad, firma adı, e-posta adresi, telefon numarası ve şifreniz (şifreler geri döndürülemez biçimde, şifrelenerek saklanır)
- İlan bilgileri: ilan metni, fotoğraflar, hizmet verilen il/ilçe, fiyat bilgisi, ilanda paylaşılan telefon numarası ve Instagram hesabı
- İletişim ve şikâyet formlarında paylaştığınız bilgiler

## İşleme amaçları

- Üyelik hesabınızı oluşturmak ve yönetmek
- İlanlarınızı yayınlamak, kontrol etmek ve ziyaretçilerin size ulaşmasını sağlamak
- Şikâyet ve iletişim taleplerini yanıtlamak, platform güvenliğini sağlamak
- Yasal yükümlülüklerimizi yerine getirmek

## Toplama yöntemi ve hukuki sebep

Kişisel verileriniz web sitemizdeki formlar aracılığıyla elektronik ortamda toplanır ve KVKK'nın 5. maddesinin 2. fıkrasında yer alan "bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması", "veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi" ve "ilgili kişinin kendisi tarafından alenileştirilmiş olması" hukuki sebeplerine dayanılarak işlenir.

## Aktarım ve yayın

İlanınızda yer alan bilgiler (firma adı, ilan metni, fotoğraflar, telefon numarası, Instagram hesabı) ilanınız yayında olduğu sürece site ziyaretçilerine açık olarak gösterilir. Bunun dışında kişisel verileriniz üçüncü kişilere satılmaz. Web sitemiz, sunucuları yurt dışında bulunan bir barındırma hizmet sağlayıcısında (Netlify) çalıştığından, verileriniz bu hizmet sağlayıcının sunucularında saklanır.

## Saklama süresi

Verileriniz üyeliğiniz ve ilanlarınız devam ettiği sürece ve ilgili mevzuatta öngörülen süreler boyunca saklanır; bu sürelerin sonunda silinir. Hesabınızın silinmesini istediğinizde ilanlarınız ve fotoğraflarınız da silinir.

## Haklarınız

KVKK'nın 11. maddesi uyarınca kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, eksik veya yanlış işlenmişse düzeltilmesini, KVKK'da öngörülen şartlar çerçevesinde silinmesini veya yok edilmesini isteme haklarına sahipsiniz. Bu haklarınızı kullanmak için yukarıdaki iletişim bilgilerinden bize ulaşabilirsiniz.`;

const TERMS = `{siteName}, organizasyon hizmeti veren firmalar ile organizasyon arayan kişileri bir araya getiren bir ilan platformudur. Siteyi kullanan ve üye olan herkes aşağıdaki koşulları kabul etmiş sayılır.

## Platformun rolü

{siteName} ilanlarda sunulan hizmetlerin tarafı değildir. Hizmetin kapsamı, fiyatı, ödemesi ve teslimi ilan veren firma ile hizmet alan kişi arasında doğrudan belirlenir. {siteName}, taraflar arasındaki anlaşmazlıklardan sorumlu tutulamaz.

## Üyelik

- Üyelik ve ilan vermek ücretsizdir.
- Üyelik sırasında verdiğiniz bilgilerin doğru ve güncel olmasından siz sorumlusunuz.
- Hesabınızın şifresini korumak sizin sorumluluğunuzdadır.

## İlan kuralları

- İlanlar yalnızca organizasyon ve etkinlik hizmetleri için verilebilir.
- İlan başlığı, açıklaması, fiyatı ve fotoğrafları gerçeği yansıtmalıdır.
- Başkasına ait fotoğraflar izinsiz kullanılamaz.
- Yanıltıcı, yasa dışı, müstehcen ya da hakaret içeren içerikler yayınlanmaz.
- Aynı hizmet için birden fazla kopya ilan verilemez.

## İlanların kontrolü

Gönderilen ilanlar yayına alınmadan önce kontrol edilir. {siteName}, kurallara uymayan ilanları gerekçe göstererek reddetme, yayından kaldırma ve kuralları tekrar tekrar ihlal eden hesapları askıya alma hakkını saklı tutar.

## Değişiklikler

Bu koşullar gerektiğinde güncellenebilir. Güncel metin her zaman bu sayfada yayınlanır.

## İletişim

{contact}`;

export const DEFAULT_CONTENT = {
  settings: {
    siteName: "Organizasyon Sepeti",
    tagline: "Organizasyon firmalarını keşfedin, karşılaştırın, doğrudan ulaşın.",
    siteUrl: "https://organizasyonsepeti.net",
    theme: "rose",
    phone: "",
    whatsapp: "",
    whatsappMessage: "Merhaba, Organizasyon Sepeti hakkında bilgi almak istiyorum.",
    email: "",
    address: "",
    workingHours: "",
    instagram: "",
    facebook: "",
    tiktok: "",
    seoTitle: "Organizasyon Sepeti | Doğum Günü, Nişan, Kına ve Düğün Organizasyon Firmaları",
    seoDescription:
      "Türkiye genelinde doğum günü, nişan, kına, düğün, baby shower ve açılış organizasyon firmalarını bulun. İlanları karşılaştırın, firmalara doğrudan ulaşın. Firmalar için ilan vermek ücretsiz.",
    ogImage: "",
  },

  hero: {
    eyebrow: "Türkiye'nin organizasyon ilan sitesi",
    title: "Hayalinizdeki organizasyon",
    highlight: "bir tık uzağınızda",
    subtitle:
      "Doğum günü, nişan, kına, düğün ve daha fazlası için şehrinizdeki organizasyon firmalarını bulun, ilanları karşılaştırın ve doğrudan iletişime geçin.",
    image: "",
  },

  sections: {
    categories: { eyebrow: "Kategoriler", title: "Ne kutluyorsunuz?", text: "" },
    featured: { eyebrow: "Vitrin", title: "Öne çıkan ilanlar", text: "" },
    recent: { eyebrow: "Yeni ilanlar", title: "Son eklenen ilanlar", text: "" },
    cities: { eyebrow: "Şehirler", title: "Şehrinizdeki organizasyon firmaları", text: "" },
    process: { eyebrow: "Nasıl çalışır?", title: "Üç adımda organizasyon firmanızı bulun", text: "" },
    vendor: {
      eyebrow: "Organizasyon firmaları için",
      title: "İlanınızı ücretsiz yayınlayın",
      text: "Hizmetlerinizi organizasyon arayan kişilere ulaştırın. Üye olun, fotoğraflı ilanınızı oluşturun; müşterileriniz size doğrudan ulaşsın.",
    },
    faq: { eyebrow: "Sıkça sorulanlar", title: "Merak ettikleriniz", text: "" },
  },

  vendorPoints: [
    "Üyelik ve ilan vermek tamamen ücretsiz",
    "Fotoğraflı, detaylı ilan sayfası",
    "Müşteriler sizi doğrudan telefon ve WhatsApp'tan arar",
    "İlanlarınızı dilediğiniz zaman güncelleyin",
  ],

  categories: [
    { id: "dogum-gunu", slug: "dogum-gunu", name: "Doğum Günü", icon: "cake" },
    { id: "nisan-soz", slug: "nisan-soz", name: "Nişan & Söz", icon: "ring" },
    { id: "kina-gecesi", slug: "kina-gecesi", name: "Kına Gecesi", icon: "moon" },
    { id: "dugun", slug: "dugun", name: "Düğün", icon: "flower" },
    { id: "baby-shower", slug: "baby-shower", name: "Baby Shower & Cinsiyet Partisi", icon: "baby" },
    { id: "sunnet", slug: "sunnet", name: "Sünnet Organizasyonu", icon: "crown" },
    { id: "evlilik-teklifi", slug: "evlilik-teklifi", name: "Evlilik Teklifi", icon: "heart" },
    { id: "acilis-kurumsal", slug: "acilis-kurumsal", name: "Açılış & Kurumsal", icon: "store" },
    { id: "balon-susleme", slug: "balon-susleme", name: "Balon Süsleme", icon: "balloon" },
    { id: "mekan", slug: "mekan", name: "Mekân & Salon", icon: "building" },
    { id: "fotograf-video", slug: "fotograf-video", name: "Fotoğraf & Video", icon: "camera" },
    { id: "muzik-dj", slug: "muzik-dj", name: "Müzik & DJ", icon: "music" },
    { id: "pasta-ikram", slug: "pasta-ikram", name: "Pasta & İkram", icon: "utensils" },
    { id: "animasyon", slug: "animasyon", name: "Animasyon & Palyaço", icon: "smile" },
    { id: "diger", slug: "diger", name: "Diğer Hizmetler", icon: "sparkles" },
  ],

  steps: [
    { id: "s1", title: "Arayın", text: "Kategori ve şehir seçerek size uygun organizasyon firmalarını listeleyin." },
    { id: "s2", title: "Karşılaştırın", text: "Fotoğraflara, hizmet detaylarına ve fiyatlara göz atın." },
    {
      id: "s3",
      title: "İletişime geçin",
      text: "Beğendiğiniz firmayı arayın ya da WhatsApp'tan yazın; detayları birlikte netleştirin.",
    },
  ],

  faq: [
    {
      id: "f1",
      q: "İlan vermek ücretli mi?",
      a: "Hayır. Üye olmak ve ilan vermek tamamen ücretsizdir.",
    },
    {
      id: "f2",
      q: "İlanım ne zaman yayına girer?",
      a: 'Gönderdiğiniz ilanlar ekibimiz tarafından kontrol edildikten sonra yayına alınır. İlanınızın durumunu hesabınızdaki "İlanlarım" sayfasından takip edebilirsiniz.',
    },
    {
      id: "f3",
      q: "Organizasyon firmasıyla nasıl iletişime geçerim?",
      a: 'İlan sayfasındaki "Telefonu göster" ya da WhatsApp butonunu kullanarak firmaya doğrudan ulaşabilirsiniz.',
    },
    {
      id: "f4",
      q: "Ödemeyi siteye mi yapıyorum?",
      a: "Hayır. Sitemiz firmalarla sizi buluşturan bir ilan platformudur; fiyat, anlaşma ve ödeme doğrudan sizinle firma arasında yapılır.",
    },
    {
      id: "f5",
      q: "Uygunsuz bir ilan gördüm, ne yapmalıyım?",
      a: 'İlan sayfasındaki "İlanı şikâyet et" bağlantısıyla bize bildirebilirsiniz. Bildirimler incelenir, kurallara aykırı ilanlar yayından kaldırılır.',
    },
  ],

  // {siteName}, {phone}, {email}, {address}, {contact} yer tutucuları sayfa çizilirken
  // iletişim bilgileriyle değiştirilir. "## " başlık, "- " madde işaretidir.
  legal: {
    kvkk: KVKK,
    terms: TERMS,
  },
};

// Panelde "yeni ekle" denildiğinde ve sunucu doğrulamasında kullanılan boş kayıt şablonları.
export const ITEM_TEMPLATES = {
  categories: { id: "", slug: "", name: "", icon: "balloon" },
  steps: { id: "", title: "", text: "" },
  faq: { id: "", q: "", a: "" },
};

export const THEMES = {
  rose: "Gül kurusu",
  champagne: "Şampanya",
  lavender: "Lavanta",
  sage: "Adaçayı",
};
