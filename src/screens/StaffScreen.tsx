import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BranchSelect, Chip, Input, Label, Sheet } from '../components/kitchen/KitchenUi';
import { Toast, useToast } from '../components/Toast';
import { FillButton, Header, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useBooks } from '../context/BooksContext';
import { useKitchen } from '../context/KitchenContext';
import { useShopGate } from '../context/ShopGateContext';
import { useTheme } from '../context/ThemeContext';
import { usingCloud } from '../data/services';
import { ALL_BRANCHES, type PermissionOverrides, type StaffMember } from '../data/types';
import { createStaffAccount, updateStaffMember } from '../firebase/client';
import { formatDay, formatTime } from '../lib/format';
import {
  branchBlocked,
  planLimits,
  quotaUpgradeWhatsAppMessage,
  staffSeatBlocked,
} from '../lib/planQuota';
import { ROLE_HELP, ROLE_LABEL, TICK_PERMISSIONS, roleCan, templateAllows, useRole, type Permission } from '../lib/roles';
import type { AppStackParamList } from '../navigation/types';
import { fonts } from '../theme/fonts';

type StaffRoleChoice = 'manager' | 'cashier';

const ALL_OPTION = { label: 'All branches', value: ALL_BRANCHES };

/** Owner only: branches, staff logins with a role and branch, and what each person may do. */
export function StaffScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { books, logAudit } = useBooks();
  const kitchen = useKitchen();
  const { can } = useRole();
  const { subscription, openRenewWhatsApp, profile } = useShopGate();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRoleChoice>('cashier');
  const [branchChoice, setBranchChoice] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  // The branch being added (id null) or renamed.
  const [branchForm, setBranchForm] = useState<{ id: string | null; name: string } | null>(null);
  const [branchBusy, setBranchBusy] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);

  const branches = kitchen.data.branches;
  const mainBranchId = branches.find((b) => b.isMain)?.id ?? branches[0]?.id;
  const members = useMemo(
    () => [...books.staff].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)),
    [books.staff],
  );
  const activeStaffCount = members.filter((m) => m.active).length;
  const limits = planLimits(subscription);
  const shopUid = user?.uid ?? '';

  function askUpgrade(kind: 'staff' | 'branch', current: number, limit: number) {
    const shopName = profile?.shopName ?? user?.shopName ?? '-';
    const phone = profile?.phone ?? user?.phone ?? '-';
    Alert.alert(
      kind === 'staff' ? 'Staff limit reached' : 'Branch limit reached',
      kind === 'staff'
        ? `Plan includes ${limit} staff login${limit === 1 ? '' : 's'}. Message admin to add more seats.`
        : `Plan includes ${limit} branch${limit === 1 ? '' : 'es'}. Message admin to add more.`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'WhatsApp admin',
          onPress: () =>
            openRenewWhatsApp(
              quotaUpgradeWhatsAppMessage({ kind, shopName, phone: String(phone), current, limit }),
            ),
        },
      ],
    );
  }

  if (!can('manageStaff')) {
    return (
      <Screen>
        <Header title="Staff" onBack={() => navigation.goBack()} />
        <Text style={[styles.locked, { color: colors.muted }]}>Only the shop owner can manage staff.</Text>
      </Screen>
    );
  }

  const branchLabel = (branchId?: string) => {
    if (!branchId || branchId === ALL_BRANCHES) return 'All branches';
    return branches.find((b) => b.id === branchId)?.name ?? 'Unknown branch';
  };

  /** A cashier belongs to exactly one branch. Managers may also cover all of them. */
  const needsBranch = (member: Pick<StaffMember, 'role' | 'branchId'>) =>
    branches.length > 1 && member.role === 'cashier' && (!member.branchId || member.branchId === ALL_BRANCHES);

  function openAdd() {
    const block = staffSeatBlocked(activeStaffCount, subscription);
    if (block) {
      askUpgrade('staff', activeStaffCount, block.limit);
      return;
    }
    setRole('cashier');
    setBranchChoice(mainBranchId);
    setError(null);
    setAdding(true);
  }

  function pickRole(next: StaffRoleChoice) {
    setRole(next);
    if (next === 'cashier' && branchChoice === ALL_BRANCHES) setBranchChoice(mainBranchId);
  }

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const block = staffSeatBlocked(activeStaffCount, subscription);
      if (block) {
        setAdding(false);
        askUpgrade('staff', activeStaffCount, block.limit);
        return;
      }
      if (!usingCloud) throw new Error('Staff logins need the cloud (Firebase) version of KadaBook.');
      if (needsBranch({ role, branchId: branchChoice })) throw new Error('Choose the branch this cashier works at.');
      await createStaffAccount(shopUid, { name, identity: login, password, role, branchId: branches.length > 1 ? branchChoice : undefined });
      logAudit('Staff added', `${name.trim()} as ${ROLE_LABEL[role]} at ${branchLabel(branchChoice)} (${login.trim()})`);
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

  async function change(member: StaffMember, patch: Partial<Pick<StaffMember, 'active' | 'branchId' | 'permissions'>> & { role?: StaffRoleChoice }, what: string) {
    try {
      await updateStaffMember(shopUid, member.id, patch);
      logAudit('Staff changed', `${member.name}: ${what}`);
      toast.show('success', `${member.name}: ${what}`);
      setEditing((m) => (m && m.id === member.id ? { ...m, ...patch } : m));
    } catch (caught) {
      toast.show('error', caught instanceof Error ? caught.message : 'Could not update.');
    }
  }

  function changeRole(member: StaffMember, next: StaffRoleChoice) {
    // Moving down to cashier needs one branch; the owner can change it right after.
    const moved = next === 'cashier' && needsBranch({ role: next, branchId: member.branchId }) ? mainBranchId : undefined;
    change(member, { role: next, ...(moved ? { branchId: moved } : {}) }, `role → ${ROLE_LABEL[next]}${moved ? `, ${branchLabel(moved)}` : ''}`);
  }

  function toggle(member: StaffMember, permission: Permission, label: string, on: boolean) {
    // Only differences from the template are stored, so later template changes still reach this person.
    const permissions: PermissionOverrides = { ...member.permissions };
    if (on === templateAllows(member.role, permission)) delete permissions[permission];
    else permissions[permission] = on;
    change(member, { permissions }, `${label} ${on ? 'on' : 'off'}`);
  }

  async function saveBranch() {
    if (!branchForm) return;
    setBranchBusy(true);
    setBranchError(null);
    try {
      if (branchForm.id) {
        await kitchen.renameBranch(branchForm.id, branchForm.name);
        logAudit('Branch renamed', branchForm.name.trim());
      } else {
        const block = branchBlocked(branches.length, subscription);
        if (block) {
          setBranchForm(null);
          askUpgrade('branch', branches.length, block.limit);
          return;
        }
        await kitchen.addBranch(branchForm.name);
        logAudit('Branch added', branchForm.name.trim());
      }
      setBranchForm(null);
    } catch (caught) {
      setBranchError(caught instanceof Error ? caught.message : 'Could not save the branch.');
    } finally {
      setBranchBusy(false);
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

        <Text style={[styles.section, { color: colors.ink }]}>Branches</Text>
        <Text style={[styles.sub, { color: colors.muted }]}>
          {branches.length === 0
            ? 'Owner account is your main shop. Add a main branch first, then sub-branches (e.g. Counter) for kitchen Send.'
            : '★ Main = this owner shop. Add a sub-branch so Kitchen can Send stock between locations.'}
        </Text>
        {branches.map((b) => (
          <View
            key={b.id}
            style={[styles.card, { backgroundColor: colors.white, borderColor: colors.hairline }]}
          >
            <Pressable
              style={styles.flex}
              onPress={() => {
                setBranchError(null);
                setBranchForm({ id: b.id, name: b.name });
              }}
            >
              <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>
                {b.isMain ? `★ ${b.name} · Main` : b.name}
              </Text>
              <Text style={[styles.sub, { color: colors.muted }]}>
                {b.isMain
                  ? `Owner · ${user?.phone ?? user?.email ?? 'this account'}`
                  : `${members.filter((m) => m.active && m.branchId === b.id).length} staff · Sub-branch`}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setBranchError(null);
                setBranchForm({ id: b.id, name: b.name });
              }}
            >
              <Text style={[styles.sub, { color: colors.brand }]}>Rename</Text>
            </Pressable>
            {!b.isMain && branches.length > 1 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${b.name}`}
                hitSlop={8}
                onPress={() => {
                  Alert.alert(
                    `Delete “${b.name}”?`,
                    'Stock at this branch will be removed. This cannot be undone.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => {
                          void (async () => {
                            try {
                              await kitchen.deleteBranch(b.id);
                              logAudit('Branch deleted', b.name);
                              toast.show('success', `${b.name} deleted`);
                            } catch (caught) {
                              toast.show(
                                'error',
                                caught instanceof Error ? caught.message : 'Could not delete branch.',
                              );
                            }
                          })();
                        },
                      },
                    ],
                  );
                }}
                style={[styles.deleteChip, { backgroundColor: colors.expenseWash }]}
              >
                <Text style={{ color: colors.danger, fontFamily: fonts.bold, fontSize: 14 }}>×</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={branches.length === 0 ? 'Add main branch' : 'Add sub-branch'}
          onPress={() => {
            const block = branchBlocked(branches.length, subscription);
            if (block) {
              askUpgrade('branch', branches.length, block.limit);
              return;
            }
            setBranchError(null);
            setBranchForm({ id: null, name: '' });
          }}
          style={styles.addBranchWrap}
        >
          <LinearGradient
            colors={['#1E40AF', '#1D5FE0', '#3B82F6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.addBranchBtn}
          >
            <Text style={styles.addBranchPlus}>＋</Text>
            <Text style={styles.addBranchLabel}>
              {branches.length === 0 ? 'Add main branch' : 'Add sub-branch'}
            </Text>
          </LinearGradient>
        </Pressable>
        {!limits.grandfather && limits.branches != null ? (
          <Text style={[styles.sub, { color: colors.muted }]}>
            Plan: {branches.length}/{limits.branches} branches
          </Text>
        ) : null}

        <Text style={[styles.section, { color: colors.ink }]}>Staff</Text>
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
              {branches.length > 1 ? (
                <Text style={[styles.sub, { color: m.active && needsBranch(m) ? colors.expenseText : colors.muted }]} numberOfLines={1}>
                  {m.active && needsBranch(m) ? 'Tap to choose a branch' : branchLabel(m.branchId)}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.roleTag, { backgroundColor: m.role === 'manager' ? colors.gradientTop : colors.keypad, color: colors.ink }]}>
              {ROLE_LABEL[m.role]}
            </Text>
          </Pressable>
        ))}

        {!limits.grandfather && limits.staffSeats != null ? (
          <Text style={[styles.sub, { color: colors.muted }]}>
            Plan: {activeStaffCount}/{limits.staffSeats} staff logins (active)
          </Text>
        ) : null}
        <FillButton label="＋ Add staff login" onPress={openAdd} />
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
            <Chip key={r} label={ROLE_LABEL[r]} on={role === r} onPress={() => pickRole(r)} />
          ))}
        </View>
        <Text style={[styles.sub, { color: colors.muted }]}>{ROLE_HELP[role]}</Text>
        {branches.length > 1 ? (
          <>
            <Label>BRANCH</Label>
            <BranchSelect
              branches={branches}
              value={branchChoice}
              onChange={setBranchChoice}
              allOption={role === 'manager' ? ALL_OPTION : undefined}
            />
          </>
        ) : null}
      </Sheet>

      <Sheet visible={editing !== null} title={editing?.name ?? ''} subtitle={editing?.login} onClose={() => setEditing(null)}>
        {editing ? (
          <>
            <Label>ROLE</Label>
            <View style={styles.row}>
              {(['cashier', 'manager'] as StaffRoleChoice[]).map((r) => (
                <Chip key={r} label={ROLE_LABEL[r]} on={editing.role === r} onPress={() => editing.role !== r && changeRole(editing, r)} />
              ))}
            </View>
            {branches.length > 1 ? (
              <>
                <Label>BRANCH</Label>
                <BranchSelect
                  branches={branches}
                  value={editing.branchId ?? (editing.role === 'manager' ? ALL_BRANCHES : undefined)}
                  onChange={(next) => change(editing, { branchId: next }, `branch → ${branchLabel(next)}`)}
                  allOption={editing.role === 'manager' ? ALL_OPTION : undefined}
                />
              </>
            ) : null}
            <Label>CAN DO</Label>
            {TICK_PERMISSIONS.map(({ key, label }) => (
              <View key={key} style={styles.tickRow}>
                <Text style={[styles.tickLabel, { color: colors.ink }]}>{label}</Text>
                <Switch
                  value={roleCan(editing.role, editing.permissions, key)}
                  onValueChange={(on) => toggle(editing, key, label, on)}
                  trackColor={{ true: colors.sale, false: colors.line }}
                />
              </View>
            ))}
            <View style={[styles.switchRow, { borderColor: colors.hairline }]}>
              <View style={styles.flex}>
                <Text style={[styles.name, { color: colors.ink }]}>Can sign in</Text>
                <Text style={[styles.sub, { color: colors.muted }]}>
                  Switch off when someone leaves. They are signed out and blocked straight away by the server.
                </Text>
              </View>
              <Switch
                value={editing.active}
                onValueChange={(v) => {
                  if (v && !editing.active) {
                    const block = staffSeatBlocked(activeStaffCount, subscription);
                    if (block) {
                      askUpgrade('staff', activeStaffCount, block.limit);
                      return;
                    }
                  }
                  change(editing, { active: v }, v ? 'switched on' : 'switched off');
                }}
                trackColor={{ true: colors.sale, false: colors.line }}
              />
            </View>
            <Text style={[styles.sub, { color: colors.muted }]}>
              Forgot password? Switch this login off and add them again with a new password.
            </Text>
          </>
        ) : null}
      </Sheet>

      <Sheet
        visible={branchForm !== null}
        title={
          branchForm?.id
            ? 'Rename branch'
            : branches.length === 0
              ? 'Add main branch'
              : 'Add sub-branch'
        }
        subtitle={
          branchForm?.id
            ? undefined
            : branches.length === 0
              ? 'Owner shop becomes the main branch. Kitchen stock starts here.'
              : 'Sub-branch for Send (e.g. Counter / Takeaway). Main stays the owner shop.'
        }
        onClose={() => setBranchForm(null)}
        actionLabel="Save"
        onAction={saveBranch}
        busy={branchBusy}
        error={branchError}
      >
        <Label>BRANCH NAME</Label>
        <Input
          value={branchForm?.name ?? ''}
          onChangeText={(v) => setBranchForm((form) => (form ? { ...form, name: v.slice(0, 40) } : form))}
          placeholder={branches.length === 0 ? 'e.g. Main kitchen' : 'e.g. Counter'}
        />
      </Sheet>
      <Toast toast={toast.toast} onHide={toast.hide} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: 16, gap: 10, paddingBottom: 40 },
  locked: { padding: 24, textAlign: 'center', fontFamily: fonts.regular, fontSize: 14 },
  section: { fontFamily: fonts.semibold, fontSize: 15, marginTop: 6 },
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
  tickRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  tickLabel: { fontFamily: fonts.regular, fontSize: 14, flexShrink: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, paddingTop: 12, marginTop: 4 },
  link: { fontFamily: fonts.semibold, fontSize: 14, textAlign: 'center', paddingVertical: 8 },
  deleteChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBranchWrap: {
    alignSelf: 'stretch',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#1D5FE0',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    marginTop: 4,
  },
  addBranchBtn: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addBranchPlus: { fontFamily: fonts.bold, fontSize: 22, color: '#FFFFFF', lineHeight: 26 },
  addBranchLabel: { fontFamily: fonts.bold, fontSize: 16, color: '#FFFFFF', letterSpacing: 0.2 },
});
