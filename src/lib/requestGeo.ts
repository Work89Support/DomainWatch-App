export type RequestGeo = {
  country: string | null;
  region: string | null;
  city: string | null;
};

function cleanHeader(value: string | null, maxLength: number, decode = false) {
  if (!value) return null;
  let result = value;
  if (decode) {
    try { result = decodeURIComponent(value); } catch { /* เก็บค่าที่อ่านได้เดิม */ }
  }
  result = result.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return result ? result.slice(0, maxLength) : null;
}

/**
 * อ่านตำแหน่งโดยประมาณของ Public IP ที่เข้า Vercel
 * ไม่อ่าน/คืนค่า IP, latitude, longitude หรือ GPS ของอุปกรณ์
 */
export function getRequestGeo(headers: Headers): RequestGeo {
  return {
    country: cleanHeader(headers.get("x-vercel-ip-country"), 8)?.toUpperCase() || null,
    region: cleanHeader(headers.get("x-vercel-ip-country-region"), 120),
    city: cleanHeader(headers.get("x-vercel-ip-city"), 160, true),
  };
}

export function hasRequestGeo(geo: RequestGeo) {
  return Boolean(geo.country || geo.region || geo.city);
}
