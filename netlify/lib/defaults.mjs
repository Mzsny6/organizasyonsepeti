// Sitenin varsayılan içeriği. Yönetim panelinden kaydedilen içerik bunun üzerine yazılır;
// panelde hiç dokunulmamış alanlar buradaki değerlerle gösterilir.

export const DEFAULT_CONTENT = {
  settings: {
    siteName: "Organizasyon Sepeti",
    tagline: "Özel günleriniz için şık organizasyonlar",
    siteUrl: "https://organizasyonsepeti.net",
    theme: "rose",
    phone: "",
    whatsapp: "",
    whatsappMessage: "Merhaba, organizasyon için bilgi almak istiyorum.",
    email: "",
    address: "",
    serviceArea: "",
    workingHours: "",
    instagram: "",
    facebook: "",
    tiktok: "",
    seoTitle: "Organizasyon Sepeti | Doğum Günü, Nişan, Kına ve Özel Gün Organizasyonları",
    seoDescription:
      "Doğum günü, nişan, kına gecesi, baby shower, evlilik teklifi ve açılış organizasyonları. Balon süsleme ve kişiye özel konsept tasarımlarla özel günlerinizi birlikte hazırlayalım.",
    ogImage: "",
  },

  hero: {
    eyebrow: "Doğum günü · Nişan · Kına · Baby shower",
    title: "Her kutlamaya",
    highlight: "zarif bir dokunuş",
    subtitle:
      "Balon süslemeden kişiye özel konsept tasarımlara; en özel günleriniz için şık ve özenli organizasyonlar hazırlıyoruz. Siz hayal edin, gerisini biz düşünelim.",
    primaryCta: "Ücretsiz Teklif Al",
    secondaryCta: "Hizmetlerimizi İnceleyin",
    image: "",
    badges: ["Kişiye özel tasarım", "Zamanında kurulum", "Özenli ekip"],
  },

  sections: {
    services: {
      eyebrow: "Hizmetlerimiz",
      title: "Her güzel an için bir organizasyon",
      text: "Küçük bir ev kutlamasından kalabalık davetlere kadar, hayalinizdeki konsepti baştan sona hazırlıyoruz.",
    },
    process: {
      eyebrow: "Nasıl çalışıyoruz?",
      title: "Dört adımda kusursuz bir gün",
      text: "",
    },
    packages: {
      eyebrow: "Paketler",
      title: "İhtiyacınıza uygun paketler",
      text: "Fiyatlar mekâna, tarihe ve konsepte göre değişir. Size özel teklif için bize yazmanız yeterli.",
    },
    gallery: {
      eyebrow: "Galeri",
      title: "Hazırladığımız organizasyonlardan",
      text: "",
    },
    about: {
      eyebrow: "Hakkımızda",
      title: "Küçük detaylar, büyük mutluluklar",
      text: "Organizasyon Sepeti olarak her kutlamanın kendine has bir hikâyesi olduğuna inanıyoruz. Renk seçiminden balonların yerleşimine, masadaki en küçük süse kadar her detayı sizin hikâyenize göre tasarlıyoruz.\n\nAmacımız özel gününüzü stressiz ve unutulmaz kılmak: siz misafirlerinizle anın tadını çıkarırken hazırlığın tüm yükünü biz üstleniyoruz.",
      image: "",
    },
    testimonials: {
      eyebrow: "Yorumlar",
      title: "Mutlu misafirlerimiz ne diyor?",
      text: "",
    },
    faq: {
      eyebrow: "Sıkça sorulanlar",
      title: "Merak ettikleriniz",
      text: "",
    },
    contact: {
      eyebrow: "İletişim",
      title: "Hayalinizdeki organizasyonu konuşalım",
      text: "Formu doldurun, en kısa sürede size dönüş yapalım. Dilerseniz WhatsApp'tan da hemen yazabilirsiniz.",
    },
  },

  services: [
    {
      id: "dogum-gunu",
      title: "Doğum Günü",
      text: "Çocuklardan yetişkinlere; temaya özel balon, masa ve pasta köşesi tasarımlarıyla unutulmaz doğum günleri.",
      icon: "cake",
      image: "",
      price: "",
    },
    {
      id: "nisan-soz",
      title: "Nişan & Söz",
      text: "Zarif çiçek ve balon süslemeleri, isim panoları ve masa düzeniyle en özel gününüze yakışan şıklık.",
      icon: "ring",
      image: "",
      price: "",
    },
    {
      id: "kina-gecesi",
      title: "Kına Gecesi",
      text: "Geleneksel ruhu modern dokunuşlarla buluşturan kına tahtı, tepsi ve dekor hazırlıkları.",
      icon: "moon",
      image: "",
      price: "",
    },
    {
      id: "baby-shower",
      title: "Baby Shower & Cinsiyet Partisi",
      text: "Pastel tonlarda, sürpriz anı için özel balon ve konfeti kurgularıyla tatlı kutlamalar.",
      icon: "baby",
      image: "",
      price: "",
    },
    {
      id: "evlilik-teklifi",
      title: "Evlilik Teklifi",
      text: "Mum, çiçek ve ışık düzenlemeleriyle hayatınızın sorusuna yakışan romantik sürprizler.",
      icon: "heart",
      image: "",
      price: "",
    },
    {
      id: "acilis-kurumsal",
      title: "Açılış & Kurumsal",
      text: "Mağaza açılışları, lansmanlar ve şirket etkinlikleri için marka renklerinize özel balon ve dekor.",
      icon: "store",
      image: "",
      price: "",
    },
  ],

  steps: [
    {
      id: "s1",
      title: "Bize ulaşın",
      text: "Formu doldurun ya da WhatsApp'tan yazın; tarihi, mekânı ve hayalinizdeki konsepti konuşalım.",
    },
    { id: "s2", title: "Konsept & teklif", text: "Size özel tasarım önerimizi ve net fiyat teklifimizi hazırlayalım." },
    { id: "s3", title: "Kurulum", text: "Organizasyon günü ekibimiz mekâna gelip tüm süslemeyi özenle kursun." },
    { id: "s4", title: "Keyfini çıkarın", text: "Siz sadece anın tadını çıkarın, gerisini biz düşünelim." },
  ],

  packages: [
    {
      id: "mini",
      name: "Mini Kutlama",
      price: "",
      note: "Ev içi küçük kutlamalar için",
      features: ["Tema renklerinde balon süsleme", "İsim / yaş panosu", "Temel masa süslemesi", "Kurulum dahil"],
      featured: false,
    },
    {
      id: "klasik",
      name: "Klasik Paket",
      price: "",
      note: "En çok tercih edilen",
      features: [
        "Balon zinciri ve balon takı",
        "Fon panosu & karşılama tabelası",
        "Pasta masası düzenlemesi",
        "Konsepte uygun aksesuarlar",
        "Kurulum dahil",
      ],
      featured: true,
    },
    {
      id: "premium",
      name: "Premium Paket",
      price: "",
      note: "Hayalinizdeki her detay",
      features: [
        "Kişiye özel konsept tasarımı",
        "Çiçek & balon kombin süsleme",
        "Işıklı dekor ve neon yazı",
        "Karşılama alanı ve fotoğraf köşesi",
        "Kurulum dahil",
      ],
      featured: false,
    },
  ],

  stats: [],

  gallery: [],

  testimonials: [],

  faq: [
    {
      id: "f1",
      q: "Ne kadar önceden rezervasyon yapmalıyım?",
      a: "Özellikle hafta sonları yoğun olduğu için tarihinizi netleştirir netleştirmez bize ulaşmanızı öneririz. Müsaitlik durumuna göre kısa süreli talepleri de değerlendiriyoruz.",
    },
    {
      id: "f2",
      q: "Kendi konseptimi getirebilir miyim?",
      a: "Elbette! Beğendiğiniz bir görsel, sevdiğiniz renkler ya da bir tema… Paylaştığınız fikirleri size özel bir tasarıma dönüştürüyoruz.",
    },
    {
      id: "f3",
      q: "Hangi bölgelere hizmet veriyorsunuz?",
      a: "Adresinizi bize iletmeniz yeterli; konumunuza göre kurulum planını ve varsa ulaşım ücretini teklifinizle birlikte paylaşıyoruz.",
    },
    {
      id: "f4",
      q: "Ödeme nasıl yapılıyor?",
      a: "Ödeme ve kapora detaylarını teklifinizle birlikte açıkça paylaşıyoruz; sürpriz bir ek ücretle karşılaşmazsınız.",
    },
    {
      id: "f5",
      q: "Kurulum ne kadar sürer?",
      a: "Organizasyonun büyüklüğüne göre değişir. Ekibimiz etkinlik saatinden önce mekâna gelerek kurulumu tamamlar.",
    },
  ],
};

// Panelde "yeni ekle" denildiğinde ve sunucu doğrulamasında kullanılan boş kayıt şablonları.
export const ITEM_TEMPLATES = {
  services: { id: "", title: "", text: "", icon: "balloon", image: "", price: "" },
  steps: { id: "", title: "", text: "" },
  packages: { id: "", name: "", price: "", note: "", features: [], featured: false },
  stats: { id: "", value: "", label: "" },
  gallery: { id: "", image: "", caption: "", category: "" },
  testimonials: { id: "", name: "", event: "", text: "", rating: 5 },
  faq: { id: "", q: "", a: "" },
};

export const THEMES = {
  rose: "Gül kurusu",
  champagne: "Şampanya",
  lavender: "Lavanta",
  sage: "Adaçayı",
};
