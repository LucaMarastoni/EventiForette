import QRCode from 'qrcode';
import { useEffect, useMemo, useState } from 'react';

export default function CouponQr({ coupon, size = 86 }) {
  const [src, setSrc] = useState('');
  const payload = useMemo(
    () =>
      JSON.stringify({
        type: 'eventi-forette-coupon',
        code: coupon.code,
        discountType: coupon.discount_type,
        discountValue: coupon.discount_value,
        status: coupon.status,
        expiresAt: coupon.expires_at
      }),
    [coupon]
  );

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: size,
      color: {
        dark: '#15324a',
        light: '#ffffff'
      }
    })
      .then((dataUrl) => {
        if (active) setSrc(dataUrl);
      })
      .catch(() => {
        if (active) setSrc('');
      });

    return () => {
      active = false;
    };
  }, [payload, size]);

  return (
    <span className="coupon-qr" aria-label={`QR code coupon ${coupon.code}`}>
      {src ? <img src={src} alt="" width={size} height={size} loading="lazy" /> : <span />}
    </span>
  );
}
