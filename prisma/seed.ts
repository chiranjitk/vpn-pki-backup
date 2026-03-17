import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create default admin user
  const existingAdmin = await prisma.adminUser.findUnique({
    where: { username: 'admin' }
  })

  if (!existingAdmin) {
    const hashedPassword = await hash('admin123', 10)
    
    await prisma.adminUser.create({
      data: {
        username: 'admin',
        email: 'admin@localhost',
        passwordHash: hashedPassword,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      }
    })
    
    console.log('Created default admin user: admin / admin123')
  } else {
    console.log('Admin user already exists')
  }

  // Create default PKI configuration
  const existingPki = await prisma.pkiConfiguration.findFirst()
  if (!existingPki) {
    await prisma.pkiConfiguration.create({
      data: {
        mode: 'MANAGED',
        minKeySize: 4096,
        defaultClientValidityDays: 365,
        defaultServerValidityDays: 730,
        crlValidityDays: 7,
        swanctlConfigPath: '/etc/swanctl',
        autoReloadStrongswan: true,
      }
    })
    console.log('Created default PKI configuration')
  }

  // Create default VPN configuration
  const existingVpn = await prisma.vpnConfiguration.findFirst()
  if (!existingVpn) {
    await prisma.vpnConfiguration.create({
      data: {
        connectionName: 'ikev2-cert',
        ikeVersion: 2,
        ikeProposals: 'aes256-sha256-modp1024',
        espProposals: 'aes256-sha1,aes256-sha256',
        localAuth: 'pubkey',
        localCert: 'vpn-server.pem',
        remoteAuth: 'pubkey',
        poolName: 'vpn-pool',
        poolAddressRange: '10.70.0.0/24',
        dnsServers: '8.8.8.8',
        localTrafficSelector: '0.0.0.0/0',
        remoteTrafficSelector: 'dynamic',
        mobike: true,
        fragmentation: true,
        dpdAction: 'restart',
        startAction: 'none',
      }
    })
    console.log('Created default VPN configuration')
  }

  console.log('Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
