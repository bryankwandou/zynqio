import { redis } from './redis';
import bcrypt from 'bcryptjs';

export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash?: string;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const userId = await redis.get<string>(`user:email:${email.toLowerCase()}`);
  if (!userId) return null;
  
  const user = await redis.get<User>(`user:${userId}`);
  return user || null;
}

export async function createUser(email: string, username: string, passwordPlain: string): Promise<User> {
  const existing = await getUserByEmail(email);
  if (existing) {
    throw new Error('User already exists');
  }

  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(passwordPlain, 10);
  
  const user: User = {
    id,
    email: email.toLowerCase(),
    username,
    passwordHash
  };

  await redis.set(`user:email:${email.toLowerCase()}`, id);
  await redis.set(`user:${id}`, user);
  
  return user;
}

export async function verifyUser(email: string, passwordPlain: string): Promise<User | null> {
  const user = await getUserByEmail(email);
  if (!user || !user.passwordHash) return null;
  
  const isValid = await bcrypt.compare(passwordPlain, user.passwordHash);
  if (!isValid) return null;
  
  return user;
}
