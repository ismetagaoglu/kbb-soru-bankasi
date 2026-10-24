# KBB Soru Bankası

Markdown (`.md`) dosyalarındaki çoktan seçmeli KBB sorularını yükleyip konuya, kaynağa göre ya da rastgele çözmek için statik bir web sitesi.

- Sunucu, hesap, veritabanı sunucusu ya da ücretli servis kullanmaz.
- Sorular ve çözüm geçmişi tarayıcının **IndexedDB** alanında saklanır.
- Derleme adımı ve `npm install` gerekmez: düz HTML, CSS ve JavaScript.

## Dosyalar

```
index.html        Sayfa iskeleti ve menü
css/style.css     Görünüm (açık/koyu tema, mobil uyum)
js/markdown.js    Güvenli Markdown görüntüleyici (ham HTML'i asla çalıştırmaz)
js/parser.js      .md soru dosyası ayrıştırıcı ve içerik hash'i
js/db.js          IndexedDB katmanı
js/store.js       İçe aktarma, filtreleme, test, yedek işlemleri
js/app.js         Sayfalar: Ana Sayfa, Test Çöz, Soru Bankası, Dosya Yükle, İstatistikler
```

## Bilgisayarda çalıştırma

En kolayı: `index.html` dosyasına çift tıklayın, site tarayıcıda açılır.

Yerel sunucu ile açmak isterseniz (önerilen):

```bash
cd kbb-soru-bankasi
python3 -m http.server 8000
# Tarayıcıda: http://localhost:8000
```

## Ücretsiz yayımlama (GitHub Pages)

1. GitHub'da yeni bir depo açın (ör. `kbb-soru-bankasi`).
2. Bu klasördeki dosyaları depoya yükleyin: `index.html`, `css/`, `js/`, `README.md`, `.gitignore`.
   **Soru dosyalarınızı, yedeklerinizi ve PDF'leri yüklemeyin.** `.gitignore` dosyası `.md` (README hariç), `.json` ve `.pdf` dosyalarının yanlışlıkla eklenmesini engeller.
3. Depoda **Settings → Pages → Build and deployment → Source: Deploy from a branch**, Branch: `main` ve `/ (root)` seçip kaydedin.
4. Bir iki dakika sonra site `https://KULLANICI-ADINIZ.github.io/kbb-soru-bankasi/` adresinde açılır.

Komut satırından:

```bash
cd kbb-soru-bankasi
git init && git add . && git commit -m "KBB Soru Bankası"
git branch -M main
git remote add origin https://github.com/KULLANICI-ADINIZ/kbb-soru-bankasi.git
git push -u origin main
```

Depoda yalnızca sitenin kodu bulunur. Sorularınız her cihazda sayfanın içinden yüklenir ve o tarayıcıda kalır.

Diğer ücretsiz seçenekler: Netlify Drop (klasörü sürükleyip bırakın) veya Cloudflare Pages. Bu seçenekler de aynı dosyalarla, ek ayar yapmadan çalışır.

## Kullanım

1. **Dosya Yükle:** Bir ya da birden fazla `.md` dosyasını sürükleyin veya **Dosya Seç** ile seçin (telefonda da çalışır). Önizlemede “25 soru bulundu · 22 yeni · 2 tekrar · 1 hatalı” gibi bir özet görürsünüz. Hatalı soruların neden atlandığı yazılır. **İçe Aktar** ile kaydedin.
2. **Test Çöz:** Soru havuzunu (tüm sorular, yanlışlarım, favorilerim, hiç çözmediklerim), konu, kaynak, zorluk ve soru tipini seçin. Soru sayısını (10/20/30/50/tümü/özel) belirleyip başlatın. Testin soru sırası sabittir; sayfayı yenileseniz de değişmez.
3. **Soru Bankası:** Arama yapabilir, konu ağacında filtreleyebilir, soruları düzenleyip silebilirsiniz. Konu adının yanındaki kalem simgesiyle konuyu yeniden adlandırabilirsiniz. Var olan bir konunun adını yazarsanız iki konu birleşir.
4. **İstatistikler:** Konu ve kaynak bazında doğru oranlarını gösterir.

Klavye kısayolları (bilgisayarda): A–E veya 1–5 şık seçer, Enter kontrol eder ya da sonraki soruya geçer, ← → sorular arasında gezinir, F favoriye ekler.

## Yedekleme ve cihaz değiştirme

> **Önemli:** Veriler yalnızca o tarayıcıda, o site adresinde saklanır. Tarayıcı verilerini temizlerseniz veya gizli sekme kullanırsanız sorular ve geçmiş silinebilir. Farklı adresler de (ör. `localhost` ile `github.io`) ayrı depolama kullanır.

- **Dosya Yükle → Yedek İndir (.json):** Tüm soruları, kaynakları, konuları, favorileri, çözüm geçmişini ve yarım kalan testleri tek bir dosyaya kaydeder.
- **Yedeği Yükle:** Yedeği diğer cihazda açar. İki seçenek vardır:
  - **Birleştir (önerilen):** Mevcut veriler korunur. Aynı soru, çözüm ve favori tekrar eklenmez.
  - **Tamamen değiştir:** O cihazdaki veriler silinip yerine yedektekiler yüklenir. İsterseniz önce otomatik yedek alınır.
- Ana sayfa, son yedekten sonra değişiklik yaptıysanız sizi uyarır. Yedek dosyasını bulut klasörünüzde (Drive, iCloud vb.) saklamanız önerilir.

## Soru dosyası formatı

```markdown
<!-- QUESTION_START -->

## Soru 1

**Konu:** Rinoloji > Paranazal sinüs anatomisi
**İlişkili Konular:** Frontal reses, Osteomeatal kompleks
**Soru Tipi:** Cerrahi anatomi
**Zorluk:** 3
**Kaynak:** Kitap veya not adı; sayfa

### SORU

Soru kökü (birden fazla paragraf, liste ve tablo olabilir)

A) Seçenek A
B) Seçenek B
C) Seçenek C
D) Seçenek D
E) Seçenek E

### DOĞRU CEVAP

C

### AÇIKLAMA

Açıklama metni

<!-- QUESTION_END -->
```

- `Soru 1` gibi başlıklar yalnızca etikettir. Tekrar kontrolü, **soru kökü + seçenekler + doğru cevap** metninin normalize edilmiş hash'iyle yapılır. Büyük/küçük harf ve boşluk farkları tekrar sayılır, içerikteki farklar sayılmaz.
- Aynı soru başka bir dosyada farklı bir kaynakla gelirse yeni soru eklenmez, mevcut soruya ikinci kaynak eklenir.
- `>` konu hiyerarşisini belirtir. Üst konu seçildiğinde alt konular da dahil olur.
- Kaynak alanı `Kitap; s. 45` ya da `Kitap, s. 45` biçiminde olabilir. Kitap adı kaynak filtresinde kullanılır, sayfa bilgisi soru altında görünür.
- Seçenekler birden fazla satıra yayılabilir. Markdown kalın/italik, liste, tablo ve `<br>` desteklenir. Diğer HTML etiketleri metin olarak gösterilir, çalıştırılmaz.
