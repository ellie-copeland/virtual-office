import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '../../../../lib/auth';
import { updateUser, sanitizeUser } from '../../../../lib/user-store';

interface UpdateProfileRequest {
  name?: string;
  title?: string;
  color?: string;
  avatar?: string;
  settings?: {
    defaultMuted?: boolean;
    defaultCamera?: boolean;
    theme?: 'light' | 'dark';
  };
}

export async function PUT(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({
        success: false,
        error: 'Invalid or expired token'
      }, { status: 401 });
    }

    const body: UpdateProfileRequest = await request.json();
    const { name, title, color, avatar, settings } = body;

    // Validate input
    if (name && !name.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Name cannot be empty'
      });
    }

    if (color) {
      const validColors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#FF8C42', '#6C5CE7', '#A8E6CF', '#FF85A2',
        '#2ECC71', '#E74C3C', '#3498DB', '#F39C12', '#9B59B6',
      ];
      if (!validColors.includes(color)) {
        return NextResponse.json({
          success: false,
          error: 'Invalid color selection'
        });
      }
    }

    // Prepare updates
    const updates: Partial<any> = {};
    if (name !== undefined) updates.name = name.trim();
    if (title !== undefined) updates.title = title.trim() || undefined;
    if (color !== undefined) updates.color = color;
    if (avatar !== undefined) updates.avatar = avatar;
    if (settings !== undefined) updates.settings = settings;

    // Update user
    const updatedUser = updateUser(decoded.userId, updates);
    if (!updatedUser) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: sanitizeUser(updatedUser)
    });

  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}