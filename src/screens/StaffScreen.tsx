import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Chip, Input, Label, Sheet } from '../components/kitchen/KitchenUi';
import { Toast, useToast } from '../components/Toast';
import { FillButton, Header, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useBooks } from '../context/BooksContext';
import { useTheme } from '../context/ThemeContext';
import { usingCloud } from '../data/services';
import type { StaffMember } from '../data/types';
import { createStaffAccount, updateStaffMember } from '../firebase/client';
import { formatDay, formatTime } from '../lib/format';
import { ROLE_HELP, ROLE_LABEL, useRole } from '../lib/roles';
import type { AppStackParamList } from '../navigation/types';
import { fonts } from '../theme/fonts';

type StaffRoleChoice = 'manager' | 'cashier';

/** Owner only: staff logins with a role, switched on or off. */
export function StaffScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { books, logAudit } = useBooks();
  const { can } = useRole();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRoleChoice>('cashier');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<StaffMember | null>(null);

  const members = useMemo(
    () => [...books.staff].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)),
    [books.staff],
  );
  const shopUid = user?.uid ?? '';

  if (!can('manageStaff')) {
    return (
      <Screen>
        <Header title="Staff" onBack={() => navigation.goBack()} />
        <Text style={[styles.locked, { color: colors.muted }]}>Only the shop owner can manage staff.</Text>
      </Screen>
    );
  }

  async function add() {
    setBusy(true);
    setError(null);
    try {
      if (!usingCloud) throw new Error('Staff logins need the cloud (Firebase) version of KadaBook.');
      await createStaffAccount(shopUid, { name, identity: login, password, role });
      logAudit('Staff added', `${name.trim()} as ${ROLE_LABEL[role]} (${login.trim()})`);
      toast.show('success', `${name.trim()} can now sign in with ${login.trim()}`);
      setAdding(false);
      setName('');
      setLogin('');
      setPassword('');
      setRole('cashier');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add the staff member.');
    } finally {
      setBusy(false);
    }
  }

  async function change(member: StaffMember, patch: { role?: StaffRoleChoice; active?: boolean }) {
    try {
      await updateStaffMember(shopUid, member.id, patch);
      const what =
        patch.active !== undefined ? (patch.active ? 'switched on' : 'switched off') : `role → ${ROLE_LABEL[patch.role ?? 'cashier']}`;
      logAudit('Staff changed', `${member.name}: ${what}`);
      toast.show('success', `${member.name} ${what}`);
      setEditing((m) => (m && m.id === member.id ? { ...m, ...patch } : m));
    } catch (caught) {
      toast.show('error', caught instanceof Error ? caught.message : 'Could not update.');
    }
  }

  const lastSeen = (member: StaffMember) => {
    const entry = books.audit.find((a) => a.actorUid === member.id);
    return entry ? `Last action ${formatDay(entry.createdAt)} ${formatTime(entry.createdAt)}` : 'No activity yet';
  };

  return (
    <Screen>
      <Header title="Staff & roles" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.ownerCard, { backgroundColor: colors.gradientTop }]}>
          <View style={[styles.avatar, { backgroundColor: colors.brand }]}>
            <Text style={[styles.avatarText, { color: colors.onFill }]}>★</Text>
          </View>
          <View style={styles.flex}>
            <Text style={[styles.name, { color: colors.ink }]}>You · Owner</Text>
            <Text style={[styles.sub, { color: colors.muted }]}>{user?.phone ?? user?.email}</Text>
          </View>
        </View>

        {(['manager', 'cashier'] as StaffRoleChoice[]).map((r) => (
          <View key={r} style={styles.helpRow}>
            <Text style={[styles.roleTag, { backgroundColor: r === 'manager' ? colors.gradientTop : colors.keypad, color: colors.ink }]}>{ROLE_LABEL[r]}</Text>
            <Text style={[styles.sub, styles.flex, { color: colors.muted }]}>{ROLE_HELP[r]}</Text>
          </View>
        ))}

        {members.length === 0 ? (
          <Text style={[styles.empty, { color: colors.muted }]}>No staff yet. Add a cashier so they bill with their own login.</Text>
        ) : null}
        {members.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => setEditing(m)}
            style={[styles.card, { backgroundColor: colors.white, borderColor: colors.hairline, opacity: m.active ? 1 : 0.55 }]}
          >
            <View style={[styles.avatar, { backgroundColor: m.active ? colors.sale : colors.line }]}>
              <Text style={[styles.avatarText, { color: colors.onFill }]}>{(m.name.trim()[0] ?? '?').toUpperCase()}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>{m.name}</Text>
              <Text style={[styles.sub, { color: colors.muted }]} numberOfLines={1}>
                {m.login ?? ''} · {m.active ? lastSeen(m) : 'Switched off'}
              </Text>
            </View>
            <Text style={[styles.roleTag, { backgroundColor: m.role === 'manager' ? colors.gradientTop : colors.keypad, color: colors.ink }]}>
              {ROLE_LABEL[m.role]}
            </Text>
          </Pressable>
        ))}

        <FillButton label="＋ Add staff login" onPress={() => setAdding(true)} />
        <Pressable onPress={() => navigation.navigate('AuditLog')}>
          <Text style={[styles.link, { color: colors.brand }]}>Open audit log ›</Text>
        </Pressable>
      </ScrollView>

      <Sheet
        visible={adding}
        title="Add staff login"
        subtitle="They sign in on their own phone with these details"
        onClose={() => setAdding(false)}
        actionLabel="Create login"
        onAction={add}
        busy={busy}
        error={error}
      >
        <Label>NAME</Label>
        <Input value={name} onChangeText={(v) => setName(v.slice(0, 60))} placeholder="e.g. Kavi" />
        <Label>PHONE OR EMAIL (THEIR LOGIN)</Label>
        <Input value={login} onChangeText={setLogin} placeholder="0771234567" autoCapitalize="none" keyboardType="email-address" />
        <Label>PASSWORD</Label>
        <Input value={password} onChangeText={setPassword} placeholder="At least 6 characters" secureTextEntry autoCapitalize="none" />
        <Label>ROLE</Label>
        <View style={styles.row}>
          {(['cashier', 'manager'] as StaffRoleChoice[]).map((r) => (
            <Chip key={r} label={ROLE_LABEL[r]} on={role === r} onPress={() => setRole(r)} />
          ))}
        </View>
        <Text style={[styles.sub, { color: colors.muted }]}>{ROLE_HELP[role]}</Text>
      </Sheet>

      <Sheet visible={editing !== null} title={editing?.name ?? ''} subtitle={editing?.login} onClose={() => setEditing(null)}>
        {editing ? (
          <>
            <Label>ROLE</Label>
            <View style={styles.row}>
              {(['cashier', 'manager'] as StaffRoleChoice[]).map((r) => (
                <Chip key={r} label={ROLE_LABEL[r]} on={editing.role === r} onPress={() => editing.role !== r && change(editing, { role: r })} />
              ))}
            </View>
            <View style={[styles.switchRow, { borderColor: colors.hairline }]}>
              <View style={styles.flex}>
                <Text style={[styles.name, { color: colors.ink }]}>Can sign in</Text>
                <Text style={[styles.sub, { color: colors.muted }]}>
                  Switch off when someone leaves. They are signed out and blocked straight away by the server.
                </Text>
              </View>
              <Switch value={editing.active} onValueChange={(v) => change(editing, { active: v })} trackColor={{ true: colors.sale, false: colors.line }} />
            </View>
            <Text style={[styles.sub, { color: colors.muted }]}>
              Forgot password? Switch this login off and add them again with a new password.
            </Text>
          </>
        ) : null}
      </Sheet>
      <Toast toast={toast.toast} onHide={toast.hide} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: 16, gap: 10, paddingBottom: 40 },
  locked: { padding: 24, textAlign: 'center', fontFamily: fonts.regular, fontSize: 14 },
  ownerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 14 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.bold, fontSize: 16 },
  name: { fontFamily: fonts.semibold, fontSize: 15 },
  sub: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },
  roleTag: { fontFamily: fonts.semibold, fontSize: 11, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  helpRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  empty: { fontFamily: fonts.regular, fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  row: { flexDirection: 'row', gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, paddingTop: 12, marginTop: 4 },
  link: { fontFamily: fonts.semibold, fontSize: 14, textAlign: 'center', paddingVertical: 8 },
});
