import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { db } from '@/lib/db'

interface GeoLocation {
  country: string
  countryCode: string
  flag: string
  connections: number
  city?: string
  latitude?: number
  longitude?: number
}

// Possible GeoIP database locations
const GEOIP_PATHS = [
  '/usr/share/GeoIP/GeoLite2-City.mmdb',
  '/usr/share/GeoIP/GeoIP2-City.mmdb',
  '/var/lib/GeoIP/GeoLite2-City.mmdb',
  '/var/lib/GeoIP/GeoIP2-City.mmdb',
  '/opt/geoip/GeoLite2-City.mmdb',
  '/usr/local/share/GeoIP/GeoLite2-City.mmdb',
  '/usr/share/GeoIP/GeoLite2-Country.mmdb',
  '/var/lib/GeoIP/GeoLite2-Country.mmdb',
]

// GeoIP API - Geographical distribution of VPN connections
export async function GET() {
  try {
    // Find available GeoIP database
    const geoipDbPath = findGeoIPDatabase()
    
    // Get GeoIP data from VPN sessions
    const geoData = await getGeoDataFromSessions(geoipDbPath)
    
    // Get real-time GeoIP lookup for active connections
    const activeGeoData = await getActiveConnectionsGeo(geoipDbPath)
    
    return NextResponse.json({
      countries: geoData,
      activeConnections: activeGeoData,
      totalCountries: geoData.length,
      geoipDatabase: geoipDbPath ? 'installed' : 'not_found',
    })
  } catch (error) {
    console.error('GeoIP error:', error)
    return NextResponse.json({ error: 'Failed to get GeoIP data' }, { status: 500 })
  }
}

function findGeoIPDatabase(): string | null {
  for (const p of GEOIP_PATHS) {
    if (fs.existsSync(p)) {
      return p
    }
  }
  return null
}

async function getGeoDataFromSessions(geoipDbPath: string | null): Promise<GeoLocation[]> {
  try {
    // Get all VPN sessions with source IPs
    const sessions = await db.vpnSession.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        sourceIp: true,
      },
    })
    
    if (sessions.length === 0) {
      // No active sessions, try to get from swanctl
      return await getActiveConnectionsGeo(geoipDbPath)
    }
    
    // Group by country using GeoIP lookup
    const countryMap: { [key: string]: GeoLocation } = {}
    
    for (const session of sessions) {
      const geo = await lookupGeoIP(session.sourceIp, geoipDbPath)
      const key = geo.countryCode || 'UNKNOWN'
      
      if (!countryMap[key]) {
        countryMap[key] = {
          country: geo.country || 'Unknown',
          countryCode: geo.countryCode || 'XX',
          flag: getCountryFlag(geo.countryCode || 'XX'),
          connections: 0,
        }
      }
      countryMap[key].connections++
    }
    
    // Sort by connections and return top 10
    return Object.values(countryMap)
      .sort((a, b) => b.connections - a.connections)
      .slice(0, 10)
  } catch {
    // Return sample data if database fails
    return await getActiveConnectionsGeo(geoipDbPath)
  }
}

async function getActiveConnectionsGeo(geoipDbPath: string | null): Promise<GeoLocation[]> {
  try {
    // Try to get active connections from swanctl
    const output = execSync('swanctl --list-sas 2>/dev/null', { 
      encoding: 'utf-8',
      timeout: 5000 
    })
    
    const connections: GeoLocation[] = []
    const ipRegex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g
    const ips = output.match(ipRegex) || []
    const uniqueIps = [...new Set(ips)]
    
    // Filter out local/private IPs
    const publicIps = uniqueIps.filter(ip => !isPrivateIP(ip))
    
    if (publicIps.length === 0) {
      return []
    }
    
    for (const ip of publicIps.slice(0, 20)) {
      const geo = await lookupGeoIP(ip, geoipDbPath)
      if (geo.countryCode && geo.countryCode !== 'LOCAL' && geo.countryCode !== 'XX') {
        connections.push({
          country: geo.country || 'Unknown',
          countryCode: geo.countryCode || 'XX',
          flag: getCountryFlag(geo.countryCode || 'XX'),
          connections: 1,
          city: geo.city,
          latitude: geo.latitude,
          longitude: geo.longitude,
        })
      }
    }
    
    // Aggregate by country
    const countryMap: { [key: string]: GeoLocation } = {}
    for (const conn of connections) {
      const key = conn.countryCode
      if (!countryMap[key]) {
        countryMap[key] = { ...conn, connections: 0 }
      }
      countryMap[key].connections++
    }
    
    return Object.values(countryMap)
      .sort((a, b) => b.connections - a.connections)
      .slice(0, 10)
  } catch {
    return []
  }
}

function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4) return true
  
  // 10.0.0.0/8
  if (parts[0] === 10) return true
  // 172.16.0.0/12
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
  // 192.168.0.0/16
  if (parts[0] === 192 && parts[1] === 168) return true
  // 127.0.0.0/8 (loopback)
  if (parts[0] === 127) return true
  // 169.254.0.0/16 (link-local)
  if (parts[0] === 169 && parts[1] === 254) return true
  
  return false
}

async function lookupGeoIP(ip: string, dbPath: string | null): Promise<{
  country?: string
  countryCode?: string
  city?: string
  latitude?: number
  longitude?: number
}> {
  // Skip private IPs
  if (isPrivateIP(ip)) {
    return {
      country: 'Private Network',
      countryCode: 'LOCAL',
    }
  }
  
  // Try mmdblookup with the found database
  if (dbPath) {
    try {
      const countryOutput = execSync(
        `mmdblookup --file "${dbPath}" --ip ${ip} registered_country iso_code 2>/dev/null || mmdblookup --file "${dbPath}" --ip ${ip} country iso_code 2>/dev/null`,
        { encoding: 'utf-8', timeout: 3000 }
      )
      
      const codeMatch = countryOutput.match(/"([^"]+)"/)
      const countryCode = codeMatch ? codeMatch[1] : undefined
      
      if (countryCode && countryCode !== 'XX') {
        // Get country name
        let country: string | undefined
        try {
          const nameOutput = execSync(
            `mmdblookup --file "${dbPath}" --ip ${ip} registered_country names en 2>/dev/null || mmdblookup --file "${dbPath}" --ip ${ip} country names en 2>/dev/null`,
            { encoding: 'utf-8', timeout: 3000 }
          )
          const nameMatch = nameOutput.match(/"([^"]+)"/)
          country = nameMatch ? nameMatch[1] : getCountryName(countryCode)
        } catch {
          country = getCountryName(countryCode)
        }
        
        return { country, countryCode }
      }
    } catch {
      // mmdblookup failed, try alternative
    }
  }
  
  // Try geoiplookup command (legacy GeoIP)
  try {
    const output = execSync(`geoiplookup ${ip} 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 3000,
    })
    
    // Parse: GeoIP Country Edition: US, United States
    const match = output.match(/([A-Z]{2}),\s*([^\n]+)/)
    if (match) {
      return {
        countryCode: match[1],
        country: match[2].trim(),
      }
    }
  } catch {
    // geoiplookup not available
  }
  
  // Use online API as last resort
  return await lookupGeoIPOnline(ip)
}

async function lookupGeoIPOnline(ip: string): Promise<{
  country?: string
  countryCode?: string
  city?: string
  latitude?: number
  longitude?: number
}> {
  try {
    // Use free GeoIP API with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)
    
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=country,countryCode,city,lat,lon`, {
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)
    
    if (response.ok) {
      const data = await response.json()
      return {
        country: data.country,
        countryCode: data.countryCode,
        city: data.city,
        latitude: data.lat,
        longitude: data.lon,
      }
    }
  } catch {
    // Ignore errors
  }
  
  return {}
}

function getCountryName(code: string): string {
  const countries: { [key: string]: string } = {
    US: 'United States', GB: 'United Kingdom', DE: 'Germany', FR: 'France', JP: 'Japan',
    CN: 'China', RU: 'Russia', BR: 'Brazil', IN: 'India', AU: 'Australia',
    CA: 'Canada', KR: 'South Korea', IT: 'Italy', ES: 'Spain', MX: 'Mexico',
    NL: 'Netherlands', SG: 'Singapore', HK: 'Hong Kong', TW: 'Taiwan', PL: 'Poland',
    TR: 'Turkey', SA: 'Saudi Arabia', AE: 'UAE', ZA: 'South Africa', EG: 'Egypt',
    NG: 'Nigeria', ID: 'Indonesia', TH: 'Thailand', VN: 'Vietnam', MY: 'Malaysia',
    PH: 'Philippines', PK: 'Pakistan', BD: 'Bangladesh', IR: 'Iran', IL: 'Israel',
    SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland', CH: 'Switzerland',
    AT: 'Austria', BE: 'Belgium', IE: 'Ireland', PT: 'Portugal', CZ: 'Czech Republic',
    UA: 'Ukraine', RO: 'Romania', GR: 'Greece', HU: 'Hungary', IL: 'Israel',
  }
  return countries[code] || code
}

function getCountryFlag(countryCode: string): string {
  const flags: { [key: string]: string } = {
    US: '🇺🇸', GB: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷', JP: '🇯🇵',
    CN: '🇨🇳', RU: '🇷🇺', BR: '🇧🇷', IN: '🇮🇳', AU: '🇦🇺',
    CA: '🇨🇦', KR: '🇰🇷', IT: '🇮🇹', ES: '🇪🇸', MX: '🇲🇽',
    NL: '🇳🇱', SG: '🇸🇬', HK: '🇭🇰', TW: '🇹🇼', PL: '🇵🇱',
    TR: '🇹🇷', SA: '🇸🇦', AE: '🇦🇪', ZA: '🇿🇦', EG: '🇪🇬',
    NG: '🇳🇬', ID: '🇮🇩', TH: '🇹🇭', VN: '🇻🇳', MY: '🇲🇾',
    PH: '🇵🇭', PK: '🇵🇰', BD: '🇧🇩', IR: '🇮🇷', IL: '🇮🇱',
    SE: '🇸🇪', NO: '🇳🇴', DK: '🇩🇰', FI: '🇫🇮', CH: '🇨🇭',
    AT: '🇦🇹', BE: '🇧🇪', IE: '🇮🇪', PT: '🇵🇹', CZ: '🇨🇿',
    UA: '🇺🇦', RO: '🇷🇴', GR: '🇬🇷', HU: '🇭🇺', LOCAL: '🏠', XX: '🌐',
  }
  return flags[countryCode] || '🌐'
}
