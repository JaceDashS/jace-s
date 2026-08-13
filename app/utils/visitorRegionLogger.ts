import oracledb from 'oracledb';
import type { NextRequest } from 'next/server';
import { getConnection } from './db';
import { logDebug } from './logging';

export interface VisitorAddressLog {
  address: string | null;
  addressDisplayed: boolean;
}

interface VisitorLocation {
  city: string;
  region: string;
  postal: string;
  country: string;
}

interface IpWhoIsResponse {
  success?: boolean;
  message?: string;
  city?: string;
  country?: string;
  country_code?: string;
  region?: string;
  region_code?: string;
  postal?: string;
}

const GEO_LOOKUP_TIMEOUT_MS = 2500;

function readFirstHeader(request: NextRequest, names: string[]): string {
  for (const name of names) {
    const value = request.headers.get(name)?.trim();
    if (value) return value;
  }
  return '';
}

function decodeHeaderValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeLocationValue(value: string): string {
  const normalized = decodeHeaderValue(value).trim();
  if (!normalized || /^(unknown|null|undefined|\(unknown\))$/i.test(normalized)) {
    return '';
  }
  return normalized;
}

function isCountryCode(value: string): boolean {
  return /^[A-Za-z]{2}$/.test(value);
}

function getCountryName(value: string): string {
  const normalized = normalizeLocationValue(value);
  if (!isCountryCode(normalized)) return normalized;

  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(normalized.toUpperCase()) || normalized;
  } catch {
    return normalized;
  }
}

function readHeaderLocation(request: NextRequest): VisitorLocation {
  const city = normalizeLocationValue(readFirstHeader(request, [
    'cloudfront-viewer-city',
    'x-vercel-ip-city',
  ]));
  const region = normalizeLocationValue(readFirstHeader(request, [
    'cloudfront-viewer-country-region-name',
    'cloudfront-viewer-country-region',
    'x-vercel-ip-country-region',
  ]));
  const postal = normalizeLocationValue(readFirstHeader(request, [
    'cloudfront-viewer-postal-code',
    'x-vercel-ip-postal-code',
  ]));
  const country = normalizeLocationValue(readFirstHeader(request, [
    'cloudfront-viewer-country-name',
    'cloudfront-viewer-country',
    'x-vercel-ip-country',
    'cf-ipcountry',
  ]));

  return { city, region, postal, country };
}

function getHeaderLocation(request: NextRequest): VisitorLocation | null {
  const location = readHeaderLocation(request);

  if (!location.city && !location.region && !location.postal && !location.country) return null;

  // 국가 코드만 있는 엣지 헤더는 더 정확한 IP 조회를 먼저 시도한다.
  if (!location.city && !location.region && !location.postal && isCountryCode(location.country)) {
    return null;
  }

  return { ...location, country: getCountryName(location.country) };
}

function getHeaderCountryFallback(request: NextRequest): VisitorLocation | null {
  const location = readHeaderLocation(request);

  return location.country || location.postal
    ? { ...location, country: getCountryName(location.country) }
    : null;
}

async function lookupLocation(ip: string): Promise<VisitorLocation> {
  const fields = 'success,message,city,country,country_code,region,region_code,postal';
  const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=${fields}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(GEO_LOOKUP_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`GeoIP lookup returned HTTP ${response.status}`);
  }

  const data = await response.json() as IpWhoIsResponse;
  if (!data.success) {
    throw new Error(data.message || 'GeoIP lookup failed');
  }

  return {
    city: data.city || '',
    region: data.region || data.region_code || '',
    postal: data.postal || '',
    country: getCountryName(data.country || data.country_code || ''),
  };
}

async function resolveLocation(request: NextRequest, ip: string): Promise<VisitorLocation | null> {
  const headerLocation = getHeaderLocation(request);
  if (headerLocation) return headerLocation;

  try {
    return await lookupLocation(ip);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logDebug('Visitor location lookup failed', { clientIp: ip, error: message });
    return getHeaderCountryFallback(request);
  }
}

function formatAddress(location: VisitorLocation): string | null {
  const parts: string[] = [];
  for (const value of [location.city, location.region, location.postal, location.country]) {
    const normalizedValue = value.trim();
    if (!normalizedValue) continue;

    const alreadyIncluded = parts.some((part) => part.toLowerCase() === normalizedValue.toLowerCase());
    if (!alreadyIncluded) parts.push(normalizedValue);
  }

  return parts.length > 0 ? parts.join(', ') : null;
}

async function claimAddressDisplay(clientIp: string): Promise<boolean> {
  let connection: oracledb.Connection | undefined;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `
        MERGE INTO VISITOR_ADDRESS_DISPLAY_STATE target
        USING (SELECT :clientIp AS client_ip FROM dual) source
        ON (target.client_ip = source.client_ip)
        WHEN MATCHED THEN
          UPDATE SET target.last_displayed_at = SYSTIMESTAMP
          WHERE target.last_displayed_at <= ADD_MONTHS(SYSTIMESTAMP, -1)
        WHEN NOT MATCHED THEN
          INSERT (client_ip, last_displayed_at)
          VALUES (source.client_ip, SYSTIMESTAMP)
      `,
      { clientIp },
      { autoCommit: true }
    );

    return (result.rowsAffected ?? 0) > 0;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logDebug('Visitor address display state persistence failed', {
      clientIp,
      error: message,
    });
    return false;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logDebug('Visitor address display state connection close failed', { error: message });
      }
    }
  }
}

export async function getVisitorAddressLog(
  request: NextRequest,
  clientIp: string
): Promise<VisitorAddressLog> {
  const location = await resolveLocation(request, clientIp);
  const address = location ? formatAddress(location) : null;

  if (!address) {
    return { address: null, addressDisplayed: false };
  }

  const addressDisplayed = await claimAddressDisplay(clientIp);
  return {
    address: addressDisplayed ? address : null,
    addressDisplayed,
  };
}
