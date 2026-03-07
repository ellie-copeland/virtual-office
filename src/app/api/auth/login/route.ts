import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail, sanitizeUser } from '../../../../lib/user-store';
import { verifyPassword, signToken } from '../../../../lib/auth';
import type { LoginRequest, AuthResponse } from '../../../../lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: 'Email and password are required'
      } as AuthResponse);
    }

    // Find user
    const user = findUserByEmail(email);
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Invalid email or password'
      } as AuthResponse);
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json({
        success: false,
        error: 'Invalid email or password'
      } as AuthResponse);
    }

    // Generate token
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    return NextResponse.json({
      success: true,
      token,
      user: sanitizeUser(user)
    } as AuthResponse);

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    } as AuthResponse, { status: 500 });
  }
}