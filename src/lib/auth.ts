import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { AuthTokenPayload } from './types';

// Get JWT secret from environment or generate one
function getJwtSecret(): string {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  // For development, generate a random secret if not provided
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(process.cwd(), 'data', '.env');
  
  try {
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/JWT_SECRET=(.+)/);
      if (match) {
        return match[1];
      }
    }
    
    // Generate new secret
    const secret = require('crypto').randomBytes(64).toString('hex');
    const envContent = `JWT_SECRET=${secret}\n`;
    fs.writeFileSync(envPath, envContent);
    console.log('🔐 Generated new JWT secret in data/.env');
    return secret;
  } catch (error) {
    console.warn('⚠️ Could not manage JWT secret file, using fallback');
    return 'fallback-secret-for-development-only';
  }
}

const JWT_SECRET = getJwtSecret();
const BCRYPT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
  } catch (error) {
    return null;
  }
}

export function extractTokenFromSocket(socket: any): string | null {
  // Try to get token from handshake auth
  const token = socket.handshake.auth?.token;
  if (token && typeof token === 'string') {
    return token;
  }
  
  // Try to get from query params
  const queryToken = socket.handshake.query?.token;
  if (queryToken && typeof queryToken === 'string') {
    return queryToken;
  }
  
  return null;
}