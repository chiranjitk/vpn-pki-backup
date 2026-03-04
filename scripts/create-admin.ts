/**
 * Create Admin User Script
 * Usage: npm run create-admin -- --username <username> --email <email> --password <password> --role <role>
 * 
 * Roles: SUPER_ADMIN, ADMIN, OPERATOR, VIEWER
 * Default role: ADMIN
 */

import { PrismaClient, AdminRole, AdminStatus } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function createAdmin() {
  const args = process.argv.slice(2)
  
  let username = ''
  let email = ''
  let password = ''
  let role: AdminRole = AdminRole.ADMIN
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--username':
      case '-u':
        username = args[++i]
        break
      case '--email':
      case '-e':
        email = args[++i]
        break
      case '--password':
      case '-p':
        password = args[++i]
        break
      case '--role':
      case '-r':
        const roleValue = args[++i].toUpperCase()
        if (Object.values(AdminRole).includes(roleValue as AdminRole)) {
          role = roleValue as AdminRole
        } else {
          console.error(`Invalid role: ${args[i]}. Valid roles: ${Object.values(AdminRole).join(', ')}`)
          process.exit(1)
        }
        break
      case '--help':
      case '-h':
        console.log(`
Usage: npm run create-admin -- [options]

Options:
  --username, -u   Admin username (required)
  --email, -e      Admin email (required)
  --password, -p   Admin password (required)
  --role, -r       Admin role (default: ADMIN)
                   Valid roles: SUPER_ADMIN, ADMIN, OPERATOR, VIEWER
  --help, -h       Show this help message

Examples:
  npm run create-admin -- -u admin -e admin@example.com -p SecurePass123 -r SUPER_ADMIN
  npm run create-admin -- --username admin --email admin@example.com --password Pass123
`)
        process.exit(0)
    }
  }
  
  // Check required fields
  if (!username) {
    console.error('Error: Username is required')
    console.log('Usage: npm run create-admin -- -u <username> -e <email> -p <password>')
    process.exit(1)
  }
  
  if (!email) {
    console.error('Error: Email is required')
    console.log('Usage: npm run create-admin -- -u <username> -e <email> -p <password>')
    process.exit(1)
  }
  
  if (!password) {
    console.error('Error: Password is required')
    console.log('Usage: npm run create-admin -- -u <username> -e <email> -p <password>')
    process.exit(1)
  }
  
  try {
    // Check if user already exists
    const existingUser = await prisma.adminUser.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    })
    
    if (existingUser) {
      if (existingUser.username === username) {
        console.error(`Error: Username "${username}" already exists`)
      } else {
        console.error(`Error: Email "${email}" already exists`)
      }
      process.exit(1)
    }
    
    // Create admin user with hashed password
    const hashedPassword = await hash(password, 12)
    
    const admin = await prisma.adminUser.create({
      data: {
        username,
        email,
        passwordHash: hashedPassword,
        role,
        status: AdminStatus.ACTIVE,
      }
    })
    
    console.log('\n✅ Admin user created successfully!')
    console.log('─'.repeat(40))
    console.log(`  ID:       ${admin.id}`)
    console.log(`  Username: ${admin.username}`)
    console.log(`  Email:    ${admin.email}`)
    console.log(`  Role:     ${admin.role}`)
    console.log(`  Status:   ${admin.status}`)
    console.log('─'.repeat(40))
    console.log('\nYou can now login to the VPN PKI Management Platform.')
    
  } catch (error) {
    console.error('Error creating admin user:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

createAdmin()
