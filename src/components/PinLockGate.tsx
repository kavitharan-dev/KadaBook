import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { AppLogo } from './AppLogo';
import { Screen } from './ui';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { fonts } from '../theme/fonts';

const PIN_LENGTH = 4;
const MAX_FAILS = 5;
/** Ask for the PIN again after the app was in the background this long. 0 = every time. */
const LOCK_AFTER_MS = 30_000;

type Mode = 'loading' | 'set' | 'confirm' | 'enter' | 'unlocked';
type Intent = 'none' | 'enable' | 'disable' | 'change';

const safe = (uid: string) => uid.replace(/[^A-Za-z0-9._-]/g, '_');
const pinKey = (uid: string) => `kb_pin_${uid}`;
const failKey = (uid: string) => `kb_pin_fails_${uid}`;
/** '0' = the user turned the PIN lock off. Missing = on (default). */
const enabledKey = (uid: string) => `kb_pin_enabled_${uid}`;
/** Set on a normal sign out: the next email login on this device skips the PIN once. */
const skipKey = (uid: string) => `kb_pin_skip_${uid}`;

async function hashPin(uid: string, pin: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${uid}:${pin}`);
}

/** Call on sign out so the next email login sets a fresh PIN. */
export async function clearSavedPin(rawUid?: string | null) {
  if (!rawUid) return;
  const uid = safe(rawUid);
  try {
    await SecureStore.deleteItemAsync(pinKey(uid));
    await SecureStore.deleteItemAsync(failKey(uid));
  } catch {
    // nothing saved
  }
}

type PinLockApi = {
  /** Start the "set a new PIN" flow. */
  changePin: () => void;
  /** Is the PIN lock switched on for this account? */
  pinEnabled: boolean;
  /** Switch the lock on: asks the user to create a PIN. */
  enablePin: () => void;
  /** Switch the lock off: asks for the current PIN first. */
  disablePin: () => void;
};

/**
 * Call on a normal sign out. The PIN is kept, but signing in again with email and
 * password goes straight into the app. The PIN is asked again the next time the app
 * is opened with that session or comes back from the background.
 */
export async function markSignedOut(rawUid?: string | null) {
  if (!rawUid) return;
  try {
    await SecureStore.setItemAsync(skipKey(safe(rawUid)), '1');
  } catch {
    // worst case the PIN is asked once after the next login
  }
}

const PinLockContext = createContext<PinLockApi>({
  changePin: () => {},
  pinEnabled: true,
  enablePin: () => {},
  disablePin: () => {},
});

/** Lets a screen (More) change the PIN or turn the lock on and off. */
export function usePinLock() {
  return useContext(PinLockContext);
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];

export function PinLockGate({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { colors } = useTheme();
  const rawUid = user?.uid ?? null;
  const uid = rawUid ? safe(rawUid) : null;

  const [mode, setMode] = useState<Mode>('loading');
  const [digits, setDigits] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [changing, setChanging] = useState(false);
  const [everUnlocked, setEverUnlocked] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(true);
  const [intent, setIntent] = useState<Intent>('none');
  const pinEnabledRef = useRef(true);
  const leftAt = useRef<number | null>(null);

  useEffect(() => {
    pinEnabledRef.current = pinEnabled;
  }, [pinEnabled]);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    setMode('loading');
    setDigits('');
    setError(null);
    setChanging(false);
    setIntent('none');
    setEverUnlocked(false);
    Promise.all([
      SecureStore.getItemAsync(enabledKey(uid)),
      SecureStore.getItemAsync(pinKey(uid)),
      SecureStore.getItemAsync(skipKey(uid)),
    ])
      .then(([flag, saved, skip]) => {
        if (!alive) return;
        const on = flag !== '0';
        setPinEnabled(on);
        if (skip === '1') {
          // Just signed in with email and password: no PIN screen this time.
          SecureStore.deleteItemAsync(skipKey(uid)).catch(() => {});
          setMode(!on || saved ? 'unlocked' : 'set');
          return;
        }
        // Lock switched off in Settings: go straight into the app.
        setMode(!on ? 'unlocked' : saved ? 'enter' : 'set');
      })
      .catch(() => {
        if (!alive) return;
        setPinEnabled(true);
        setMode('set');
      });
    return () => {
      alive = false;
    };
  }, [uid]);

  useEffect(() => {
    if (mode === 'unlocked') setEverUnlocked(true);
  }, [mode]);

  const unlock = useCallback(() => {
    setDigits('');
    setFirstPin('');
    setError(null);
    setChanging(false);
    setIntent('none');
    setMode('unlocked');
  }, []);

  // Show the "create a new PIN" screen (used after the current PIN was verified, or when enabling).
  const startSet = useCallback(() => {
    setDigits('');
    setFirstPin('');
    setError(null);
    setChanging(true);
    setMode('set');
  }, []);

  // Changing the PIN: ask for the current PIN first.
  const changePin = useCallback(() => {
    setDigits('');
    setFirstPin('');
    setError(null);
    setChanging(false);
    setIntent('change');
    setMode('enter');
  }, []);

  const cancelChange = useCallback(() => {
    unlock();
  }, [unlock]);

  const enablePin = useCallback(() => {
    setIntent('enable');
    startSet();
  }, [startSet]);

  const disablePin = useCallback(() => {
    // Ask for the current PIN so nobody can switch the lock off on an unlocked phone.
    setDigits('');
    setFirstPin('');
    setError(null);
    setChanging(false);
    setIntent('disable');
    setMode('enter');
  }, []);

  const ctx = useMemo(
    () => ({ changePin, pinEnabled, enablePin, disablePin }),
    [changePin, pinEnabled, enablePin, disablePin],
  );

  // Lock again when the app comes back after being away for a while.
  useEffect(() => {
    if (!uid) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') {
        leftAt.current = Date.now();
        return;
      }
      if (next === 'active' && leftAt.current !== null) {
        const away = Date.now() - leftAt.current;
        leftAt.current = null;
        if (away >= LOCK_AFTER_MS && pinEnabledRef.current) {
          setIntent('none');
          setDigits('');
          setFirstPin('');
          setError(null);
          setMode((m) => (m === 'unlocked' || changing ? 'enter' : m));
          setChanging(false);
        }
      }
    });
    return () => sub.remove();
  }, [uid, changing]);

  // While locked, the back button must not reach the screens underneath.
  useEffect(() => {
    if (!uid || mode === 'unlocked' || !everUnlocked) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (intent !== 'none') cancelChange();
      return true;
    });
    return () => sub.remove();
  }, [uid, mode, everUnlocked, intent, cancelChange]);

  const submit = useCallback(
    async (pin: string) => {
      if (!uid) return;
      setBusy(true);
      try {
        if (mode === 'set') {
          setFirstPin(pin);
          setDigits('');
          setError(null);
          setMode('confirm');
          return;
        }
        if (mode === 'confirm') {
          if (pin !== firstPin) {
            setFirstPin('');
            setDigits('');
            setError('PINs do not match. Try again.');
            setMode('set');
            return;
          }
          await SecureStore.setItemAsync(pinKey(uid), await hashPin(uid, pin));
          await SecureStore.setItemAsync(enabledKey(uid), '1');
          await SecureStore.deleteItemAsync(failKey(uid));
          setPinEnabled(true);
          unlock();
          return;
        }
        if (mode === 'enter') {
          const saved = await SecureStore.getItemAsync(pinKey(uid));
          if (saved && saved === (await hashPin(uid, pin))) {
            await SecureStore.deleteItemAsync(failKey(uid));
            if (intent === 'change') {
              // Current PIN verified: now let the user pick a new one.
              startSet();
              return;
            }
            if (intent === 'disable') {
              // Correct PIN entered: switch the lock off and forget the PIN.
              await clearSavedPin(rawUid);
              await SecureStore.setItemAsync(enabledKey(uid), '0');
              setPinEnabled(false);
            }
            unlock();
            return;
          }
          const fails = Number((await SecureStore.getItemAsync(failKey(uid))) ?? '0') + 1;
          if (fails >= MAX_FAILS) {
            await clearSavedPin(rawUid);
            await signOut();
            return;
          }
          await SecureStore.setItemAsync(failKey(uid), String(fails));
          setDigits('');
          setError(`Wrong PIN. ${MAX_FAILS - fails} tries left.`);
        }
      } finally {
        setBusy(false);
      }
    },
    [uid, rawUid, mode, firstPin, intent, signOut, unlock, startSet],
  );

  function press(d: string) {
    if (busy || digits.length >= PIN_LENGTH) return;
    const next = digits + d;
    setDigits(next);
    if (next.length === PIN_LENGTH) submit(next);
  }

  async function forgot() {
    await clearSavedPin(rawUid);
    await signOut();
  }

  if (!uid) return <>{children}</>;

  const title =
    mode === 'set'
      ? changing && intent !== 'enable'
        ? 'Set a new PIN'
        : 'Create a 4-digit PIN'
      : mode === 'confirm'
        ? 'Confirm your PIN'
        : intent === 'disable'
          ? 'Turn off PIN lock'
          : intent === 'change'
            ? 'Change PIN'
            : 'Enter your PIN';
  const subtitle =
    mode === 'set'
      ? 'Use this PIN to open KadaBook next time.'
      : mode === 'confirm'
        ? 'Enter the same PIN again.'
        : intent === 'disable'
          ? 'Enter your current PIN to turn the lock off.'
          : intent === 'change'
            ? 'Enter your current PIN first.'
            : 'Enter your PIN to continue.';

  const pinScreen = (
    <Screen>
      <View style={styles.wrap}>
        <AppLogo size={56} />
        <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>
        <View style={styles.dots}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { borderColor: colors.brand },
                i < digits.length && { backgroundColor: colors.brand },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.error, { color: colors.expenseText }]}>{error ?? ' '}</Text>
        <View style={styles.pad}>
          {KEYS.map((k, index) => (
            <Pressable
              key={index}
              disabled={!k || busy}
              onPress={() => (k === 'back' ? setDigits((v) => v.slice(0, -1)) : press(k))}
              style={({ pressed }) => [
                styles.key,
                { backgroundColor: k ? colors.keypad : 'transparent' },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={[styles.keyText, { color: colors.ink }]}>{k === 'back' ? '⌫' : k}</Text>
            </Pressable>
          ))}
        </View>
        {mode === 'enter' && intent === 'none' ? (
          <Pressable onPress={forgot} style={styles.link}>
            <Text style={{ color: colors.brand, fontFamily: fonts.semibold, fontSize: 14 }}>
              Forgot PIN? Sign in with email
            </Text>
          </Pressable>
        ) : null}
        {intent !== 'none' ? (
          <Pressable onPress={cancelChange} style={styles.link}>
            <Text style={{ color: colors.brand, fontFamily: fonts.semibold, fontSize: 14 }}>Cancel</Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );

  // First unlock after opening the app: show only the PIN screen, nothing underneath.
  if (!everUnlocked && mode !== 'unlocked') {
    return mode === 'loading' ? <Screen>{null}</Screen> : pinScreen;
  }

  // Later locks keep the app mounted underneath, so the user returns to the same screen.
  const locked = mode !== 'unlocked';
  return (
    <PinLockContext.Provider value={ctx}>
      <View style={styles.fill}>
        <View
          style={styles.fill}
          importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'}
          accessibilityElementsHidden={locked}
        >
          {children}
        </View>
        {locked ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.white }]}>
            {mode === 'loading' ? <Screen>{null}</Screen> : pinScreen}
          </View>
        ) : null}
      </View>
    </PinLockContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  wrap: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 24,
    gap: 10,
  },
  title: {
    marginTop: 8,
    fontFamily: fonts.bold,
    fontSize: 22,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 18,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  error: {
    minHeight: 20,
    fontFamily: fonts.semibold,
    fontSize: 13,
    textAlign: 'center',
  },
  pad: {
    width: 264,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginTop: 8,
  },
  key: {
    width: 76,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontFamily: fonts.semibold,
    fontSize: 24,
  },
  link: {
    marginTop: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
});
