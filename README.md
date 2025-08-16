# DÜLDÜL FAB - Zeytinyağı Fabrikası Yönetim Uygulaması

## Kurulum ve Çalıştırma

1. **Bağımlılıkları yükleyin:**
   ```
   npm install
   ```

2. **Gerekli ek paketler:**
   - Tailwind CSS (otomatik kurulur)
   - lucide-react (ikonlar için)
   ```
   npm install lucide-react
   ```

3. **Projeyi başlatın:**
   ```
   npm start
   ```

4. **Tarayıcıda açın:**
   - [http://localhost:3000](http://localhost:3000)

## Notlar
- Tüm stiller Tailwind CSS ile yazılmıştır.
- Font olarak Google Fonts üzerinden Inter kullanılmıştır.
- İkonlar için [lucide-react](https://lucide.dev/icons/) kütüphanesi gereklidir.
- Tüm veriler localStorage'da saklanır, harici bir backend gerekmez.

## Klasör Yapısı
```
public/
  index.html
src/
  App.js
  App.css
  index.js
  index.css
  ... (diğer componentler)
tailwind.config.js
postcss.config.js
package.json
``` 