import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import fs from 'fs'
import { db } from '@/lib/db'

interface GeoLocation {
  country: string
  countryCode: string
  flag: string
  connections: number
  city?: string
}

// GeoIP API - Geographical distribution of VPN connections
export async function GET() {
  try {
    // Get GeoIP data from VPN sessions
    const geoData = await getGeoDataFromSessions()
    
    // Get real-time GeoIP lookup for active connections
    const activeGeoData = await getActiveConnectionsGeo()
    
    // Merge and deduplicate
    const merged = mergeGeoData(geoData, activeGeoData)
    
    return NextResponse.json({
      countries: merged,
      totalCountries: merged.length,
      geoipDatabase: checkGeoIPDatabase(),
    })
  } catch (error) {
    console.error('GeoIP error:', error)
    return NextResponse.json({ error: 'Failed to get GeoIP data' }, { status: 500 })
  }
}

function checkGeoIPDatabase(): string {
  const paths = [
    '/usr/share/GeoIP/GeoLite2-City.mmdb',
    '/usr/share/GeoIP/GeoIP2-City.mmdb',
    '/var/lib/GeoIP/GeoLite2-City.mmdb',
  ]
  
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        return 'installed'
      }
    } catch {
      // Ignore
    }
  }
  return 'not_found'
}

async function getGeoDataFromSessions(): Promise<GeoLocation[]> {
  try {
    // Get all VPN sessions with source IPs (active and recent)
    const sessions = await db.vpnSession.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        clientPublicIp: true,
        username: true,
      },
    })
    
    if (sessions.length === 0) {
      return []
    }
    
    // Group by country using GeoIP lookup
    const countryMap: { [key: string]: GeoLocation } = {}
    
    for (const session of sessions) {
      if (!session.clientPublicIp) continue
      
      const geo = lookupGeoIP(session.clientPublicIp)
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
    return []
  }
}

async function getActiveConnectionsGeo(): Promise<GeoLocation[]> {
  const connections: GeoLocation[] = []
  
  try {
    // Try to get active connections from swanctl
    const output = execSync('swanctl --list-sas 2>/dev/null', { 
      encoding: 'utf-8',
      timeout: 5000,
    })
    
    if (!output.trim()) {
      return []
    }
    
    // Extract remote IPs from swanctl output (the client public IPs)
    // Format: remote 'CN=user' @ 192.168.5.10[4500] [10.70.0.1]
    // We want the IP after @ (the client's public IP)
    const remoteMatch = output.matchAll(/remote\s+['"][^'"]+['"]\s*@\s*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g)
    const ips: string[] = []
    for (const match of remoteMatch) {
      if (match[1]) ips.push(match[1])
    }
    
    const uniqueIps = [...new Set(ips)]
    let localCount = 0
    
    for (const ip of uniqueIps.slice(0, 20)) {
      if (isPrivateIP(ip)) {
        localCount++
      } else {
        const geo = lookupGeoIP(ip)
        if (geo.countryCode && geo.countryCode !== 'LOCAL' && geo.countryCode !== 'XX') {
          connections.push({
            country: geo.country || 'Unknown',
            countryCode: geo.countryCode || 'XX',
            flag: getCountryFlag(geo.countryCode || 'XX'),
            connections: 1,
            city: geo.city,
          })
        }
      }
    }
    
    // Add local network entry if there are private IP connections
    if (localCount > 0) {
      connections.push({
        country: 'Local Network',
        countryCode: 'LOCAL',
        flag: '🏠',
        connections: localCount,
      })
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

function mergeGeoData(sessions: GeoLocation[], active: GeoLocation[]): GeoLocation[] {
  const merged: { [key: string]: GeoLocation } = {}
  
  for (const item of [...sessions, ...active]) {
    const key = item.countryCode
    if (!merged[key]) {
      merged[key] = { ...item }
    } else {
      merged[key].connections += item.connections
    }
  }
  
  return Object.values(merged)
    .sort((a, b) => b.connections - a.connections)
    .slice(0, 10)
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

function lookupGeoIP(ip: string): {
  country?: string
  countryCode?: string
  city?: string
} {
  // Skip private IPs
  if (isPrivateIP(ip)) {
    return {
      country: 'Private Network',
      countryCode: 'LOCAL',
    }
  }
  
  // Try mmdblookup with GeoIP database
  const dbPaths = [
    '/usr/share/GeoIP/GeoLite2-City.mmdb',
    '/usr/share/GeoIP/GeoLite2-Country.mmdb',
    '/var/lib/GeoIP/GeoLite2-City.mmdb',
  ]
  
  for (const dbPath of dbPaths) {
    try {
      const output = execSync(
        `mmdblookup --file "${dbPath}" --ip ${ip} registered_country iso_code 2>/dev/null`,
        { encoding: 'utf-8', timeout: 3000 }
      )
      
      const codeMatch = output.match(/"([^"]+)"/)
      if (codeMatch && codeMatch[1] !== 'XX') {
        const countryCode = codeMatch[1]
        return {
          countryCode,
          country: getCountryName(countryCode),
        }
      }
    } catch {
      // Continue to next path
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
  
  // Fallback: return empty (will be filtered out)
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
    UA: 'Ukraine', RO: 'Romania', GR: 'Greece', HU: 'Hungary',
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
