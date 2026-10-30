import { cloudAuth, cloudRepository, isFirebaseConfigured } from '../firebase/client';
import { localAuth, localRepository } from './local';

export const usingCloud = isFirebaseConfigured();
export const authService = usingCloud ? cloudAuth : localAuth;
export const repository = usingCloud ? cloudRepository : localRepository;
