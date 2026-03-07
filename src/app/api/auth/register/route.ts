import { NextRequest, NextResponse } from 'next/server';
import { createUser, sanitizeUser } from '../../../../lib/user-store';
import { signToken } from '../../../../lib/auth';
import type { RegisterRequest, AuthResponse } from '../../../../lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: RegisterRequest = await request.json();
    const { name, email, password, color, title } = body;

    // Validate input
    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Name, email, and password are required'
      } as AuthResponse);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({
        success: false,
        error: 'Please enter a valid email address'
      } as AuthResponse);
    }

    // Validate password strength
    if (password.length < 6) {
      return NextResponse.json({
        success: false,
        error: 'Password must be at least 6 characters long'
      } as AuthResponse);
    }

    // Validate color
    const validColors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#FF8C42', '#6C5CE7', '#A8E6CF', '#FF85A2',
      '#2ECC71', '#E74C3C', '#3498DB', '#F39C12', '#9B59B6',
    ];
    if (!validColors.includes(color)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid color selection'
      } as AuthResponse);
    }

    // Create user
    const user = await createUser({
      name: name.trim(),
      email: email.trim(),
      password: password.trim(),
      color,
      title: title?.trim()
    });

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
    console.error('Register error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const statusCode = errorMessage === 'Email already exists' ? 400 : 500;
    
    return NextResponse.json({
      success: false,
      error: errorMessage
    } as AuthResponse, { status: statusCode });
  }
}