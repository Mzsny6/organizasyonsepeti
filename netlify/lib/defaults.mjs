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
    eyebrow: "Türkiye'nin organizasyon pazarı",
    title: "Etkinliğiniz için",
    highlight: "doğru organizatör burada",
    subtitle:
      "Düğün salonundan palyaçoya, catering'den ses-ışığa; etkinliğiniz için ihtiyacınız olan organizatörleri bulun, ilanları karşılaştırın ve komisyonsuz, doğrudan iletişime geçin.",
    image: "",
  },

  sections: {
    events: { eyebrow: "Etkinlikler", title: "Ne kutluyorsunuz?", text: "" },
    categories: { eyebrow: "Hizmetler", title: "Aradığınız organizatörü seçin", text: "" },
    featured: { eyebrow: "Vitrin", title: "Öne çıkan organizatörler", text: "" },
    recent: { eyebrow: "Yeni ilanlar", title: "Son eklenen ilanlar", text: "" },
    cities: { eyebrow: "Şehirler", title: "Şehrinizdeki organizatörler", text: "" },
    process: { eyebrow: "Nasıl çalışır?", title: "Üç adımda organizatörünüzü bulun", text: "" },
    vendor: {
      eyebrow: "Organizatörler için",
      title: "İşinizi büyütün, komisyon ödemeyin",
      text: "İlanınızı yayınlayın, müşterileriniz sizi doğrudan arasın. Randevularınızı takviminizden yönetin, vitrin ve üst sıra dopingleriyle öne çıkın.",
    },
    faq: { eyebrow: "Sıkça sorulanlar", title: "Merak ettikleriniz", text: "" },
  },

  vendorPoints: [
    "Komisyon yok: müşterilerinizle doğrudan anlaşın",
    "Hizmet türünüze göre uygun fiyatlı ilan paketleri",
    "Vitrin ve kategori üst sıra dopingleriyle öne çıkın",
    "Randevu takvimi ve çifte rezervasyon uyarısı",
  ],

  // Organizatör (hizmet veren) türleri. tier: ilan paketi fiyat kademesi (1 üst, 2 orta, 3 mikro).
  categories: [
    { id: "dugun-salonu", slug: "dugun-salonu", name: "Düğün Salonu", icon: "building", tier: 1 },
    { id: "davet-evi", slug: "davet-evi", name: "Davet Evi", icon: "home", tier: 1 },
    { id: "kina-konagi", slug: "kina-konagi", name: "Kına Konağı", icon: "moon", tier: 1 },
    { id: "tekne-yat", slug: "tekne-yat", name: "Tekne & Yat", icon: "boat", tier: 1 },
    { id: "ses-isik", slug: "ses-isik", name: "Ses & Işık Sistemleri", icon: "speaker", tier: 1 },
    { id: "catering", slug: "catering", name: "Catering & İkram", icon: "utensils", tier: 2 },
    { id: "fotografci", slug: "fotografci", name: "Etkinlik Fotoğrafçısı", icon: "camera", tier: 2 },
    { id: "bando", slug: "bando", name: "Bando", icon: "drum", tier: 2 },
    { id: "dekorasyon", slug: "dekorasyon", name: "Dekorasyon & Balon Süsleme", icon: "balloon", tier: 2 },
    { id: "muzik-grubu", slug: "muzik-grubu", name: "Müzik Grubu & DJ", icon: "music", tier: 2 },
    { id: "palyaco", slug: "palyaco", name: "Palyaço", icon: "smile", tier: 3 },
    { id: "yuz-boyama", slug: "yuz-boyama", name: "Yüz Boyama", icon: "brush", tier: 3 },
    { id: "illuzyonist", slug: "illuzyonist", name: "İllüzyonist", icon: "wand", tier: 3 },
    { id: "pamuk-sekerci", slug: "pamuk-sekerci", name: "Pamuk Şekerci", icon: "candy", tier: 3 },
    { id: "kostumlu-karakter", slug: "kostumlu-karakter", name: "Kostümlü Karakter", icon: "mask", tier: 3 },
  ],

  // Etkinlik türleri: ilanlarda "hangi etkinlikler için" etiketi ve aramada filtre olarak kullanılır.
  events: [
    { id: "dugun", slug: "dugun", name: "Düğün", icon: "flower" },
    { id: "nisan-soz", slug: "nisan-soz", name: "Nişan & Söz", icon: "ring" },
    { id: "kina", slug: "kina", name: "Kına Gecesi", icon: "moon" },
    { id: "dogum-gunu", slug: "dogum-gunu", name: "Doğum Günü", icon: "cake" },
    { id: "sunnet", slug: "sunnet", name: "Sünnet", icon: "crown" },
    { id: "baby-shower", slug: "baby-shower", name: "Baby Shower", icon: "baby" },
    { id: "evlilik-teklifi", slug: "evlilik-teklifi", name: "Evlilik Teklifi", icon: "heart" },
    { id: "kurumsal", slug: "kurumsal", name: "Açılış & Kurumsal", icon: "store" },
  ],

  steps: [
    { id: "s1", title: "Arayın", text: "Hizmet türü, etkinlik, şehir ve bütçenize göre organizatörleri listeleyin." },
    {
      id: "s2",
      title: "Karşılaştırın",
      text: "Fotoğraflara, hizmet detaylarına, fiyatlara ve müsait günlere göz atın.",
    },
    {
      id: "s3",
      title: "Doğrudan anlaşın",
      text: "Telefonunuzu doğrulayın, organizatörü arayın ya da WhatsApp'tan yazın. Komisyon yok.",
    },
  ],

  faq: [
    {
      id: "f1",
      q: "Komisyon alıyor musunuz?",
      a: "Hayır. Organizasyon Sepeti hiçbir işten komisyon almaz; anlaşma ve ödeme doğrudan sizinle organizatör arasında yapılır.",
    },
    {
      id: "f2",
      q: "Organizatörün telefon numarasını neden hemen göremiyorum?",
      a: "Sahte aramaları ve botları engellemek için iletişim bilgileri, telefon numaranızı SMS koduyla doğruladıktan sonra görünür. Doğrulama birkaç saniye sürer.",
    },
    {
      id: "f3",
      q: "İlan vermek ücretli mi?",
      a: "İlanlar, hizmet türünüze göre belirlenen aylık, 3 aylık veya yıllık paketlerle yayınlanır. Lansman dönemine özel promosyon kodlarıyla paketinizi ücretsiz başlatabilirsiniz.",
    },
    {
      id: "f4",
      q: "İlanım ne zaman yayına girer?",
      a: 'Gönderdiğiniz ilanlar ekibimiz tarafından kontrol edildikten sonra yayına alınır. İlanınızın durumunu hesabınızdaki "İlanlarım" sayfasından takip edebilirsiniz.',
    },
    {
      id: "f5",
      q: "Uygunsuz bir ilan gördüm, ne yapmalıyım?",
      a: 'İlan sayfasındaki "İlanı şikâyet et" bağlantısıyla bize bildirebilirsiniz. Bildirimler incelenir, kurallara aykırı ilanlar yayından kaldırılır.',
    },
  ],

  // PRD fiyatlandırması (TL). Panelden değiştirilebilir.
  pricing: {
    freeMode: false, // açıkken tüm paketler ücretsizdir (ödeme adımı atlanır)
    tiers: {
      t1: { name: "Üst segment", monthly: 1250, quarterly: 3000, yearly: 12500 },
      t2: { name: "Orta segment", monthly: 550, quarterly: 1320, yearly: 5500 },
      t3: { name: "Mikro segment", monthly: 250, quarterly: 600, yearly: 2500 },
    },
    dopings: {
      showcase: { price: 400, days: 7 },
      categoryTop: { price: 250, days: 7 },
      highlight: { price: 150, days: 30 },
    },
    bank: { bankName: "", holder: "", iban: "", note: "Açıklamaya sipariş numaranızı yazmayı unutmayın." },
  },

  security: {
    // SMS sağlayıcısı tanımlıyken ziyaretçiler iletişim bilgilerini görmek için telefonunu doğrular.
    contactGate: true,
    blacklistThreshold: 2,
  },

  // {siteName}, {phone}, {email}, {address}, {contact} yer tutucuları sayfa çizilirken
  // iletişim bilgileriyle değiştirilir. "## " başlık, "- " madde işaretidir.
  legal: {
    kvkk: KVKK,
    terms: TERMS,
  },
};

// Panelde "yeni ekle" denildiğinde ve sunucu doğrulamasında kullanılan boş kayıt şablonları.
export const ITEM_TEMPLATES = {
  categories: { id: "", slug: "", name: "", icon: "sparkles", tier: 3 },
  events: { id: "", slug: "", name: "", icon: "party" },
  steps: { id: "", title: "", text: "" },
  faq: { id: "", q: "", a: "" },
};
