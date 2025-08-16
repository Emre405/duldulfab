# Firebase Hosting ile Yayınlama (Deploy)

## 1. Firebase CLI Kurulumu
```
npm install -g firebase-tools
```

## 2. Firebase'e Giriş Yap
```
firebase login
```

## 3. Proje Ayarları
- `.firebaserc` ve `firebase.json` dosyaları hazır.
- Proje ID: duldulzey

## 4. React Build Al
```
npm run build
```

## 5. Deploy Et
```
firebase deploy
```

## 6. Sonuç
- Siteniz şu adreste yayınlanacak: https://duldulzey.firebaseapp.com veya https://duldulzey.web.app

## Notlar
- `public/404.html` dosyası özel hata sayfası olarak gösterilecek.
- `public/firebase-messaging-sw.js` dosyası push notification için hazır (geliştirilebilir).
- Tüm ayarlar ve dosyalar Firebase Hosting için uygundur. 