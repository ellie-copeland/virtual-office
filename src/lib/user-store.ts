import fs from 'fs';
import path from 'path';
import { PersistentUser, RegisterRequest } from './types';
import { hashPassword } from './auth';

const USERS_FILE_PATH = path.join(process.cwd(), 'data', 'users.json');

// Initialize users file if it doesn't exist
function initializeUsersFile() {
  if (!fs.existsSync(USERS_FILE_PATH)) {
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify([], null, 2));
  }
}

// Read users from JSON file
export function readUsers(): PersistentUser[] {
  try {
    initializeUsersFile();
    const data = fs.readFileSync(USERS_FILE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading users file:', error);
    return [];
  }
}

// Write users to JSON file
function writeUsers(users: PersistentUser[]): void {
  try {
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Error writing users file:', error);
    throw new Error('Failed to save user data');
  }
}

// Generate unique user ID
function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Create new user account
export async function createUser(request: RegisterRequest): Promise<PersistentUser> {
  const users = readUsers();
  
  // Check if email already exists
  if (users.find(user => user.email === request.email)) {
    throw new Error('Email already exists');
  }
  
  // Hash password
  const passwordHash = await hashPassword(request.password);
  
  // Determine role (first user is admin)
  const isFirstUser = users.length === 0;
  
  const newUser: PersistentUser = {
    id: generateUserId(),
    name: request.name.trim(),
    email: request.email.toLowerCase().trim(),
    passwordHash,
    color: request.color,
    title: request.title?.trim(),
    role: isFirstUser ? 'admin' : 'member',
    createdAt: Date.now(),
    settings: {
      defaultMuted: true,
      defaultCamera: false,
      theme: 'dark'
    }
  };
  
  users.push(newUser);
  writeUsers(users);
  
  return newUser;
}

// Find user by email
export function findUserByEmail(email: string): PersistentUser | null {
  const users = readUsers();
  return users.find(user => user.email === email.toLowerCase().trim()) || null;
}

// Find user by ID
export function findUserById(id: string): PersistentUser | null {
  const users = readUsers();
  return users.find(user => user.id === id) || null;
}

// Update user
export function updateUser(id: string, updates: Partial<PersistentUser>): PersistentUser | null {
  const users = readUsers();
  const userIndex = users.findIndex(user => user.id === id);
  
  if (userIndex === -1) {
    return null;
  }
  
  // Merge updates (preserve nested settings)
  const currentUser = users[userIndex];
  users[userIndex] = {
    ...currentUser,
    ...updates,
    id: currentUser.id, // Never allow ID to change
    email: currentUser.email, // Never allow email to change
    passwordHash: updates.passwordHash || currentUser.passwordHash,
    settings: {
      ...currentUser.settings,
      ...(updates.settings || {})
    }
  };
  
  writeUsers(users);
  return users[userIndex];
}

// Update user's desk assignment
export function assignUserToDesk(userId: string, deskId: string | undefined): boolean {
  const users = readUsers();
  const userIndex = users.findIndex(user => user.id === userId);
  
  if (userIndex === -1) {
    return false;
  }
  
  // Clear any existing desk assignment for this desk
  if (deskId) {
    users.forEach(user => {
      if (user.deskId === deskId && user.id !== userId) {
        user.deskId = undefined;
      }
    });
  }
  
  users[userIndex].deskId = deskId;
  writeUsers(users);
  return true;
}

// Get all users with desk assignments
export function getUsersWithDesks(): PersistentUser[] {
  return readUsers().filter(user => user.deskId);
}

// Delete user (admin only)
export function deleteUser(id: string): boolean {
  const users = readUsers();
  const initialLength = users.length;
  const filteredUsers = users.filter(user => user.id !== id);
  
  if (filteredUsers.length === initialLength) {
    return false; // User not found
  }
  
  writeUsers(filteredUsers);
  return true;
}

// Get user count
export function getUserCount(): number {
  return readUsers().length;
}

// Export user without sensitive data
export function sanitizeUser(user: PersistentUser): Omit<PersistentUser, 'passwordHash'> {
  const { passwordHash, ...sanitized } = user;
  return sanitized;
}