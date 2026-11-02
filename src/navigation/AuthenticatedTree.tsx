import { AppLoading } from '../components/AppLoading';
import { AnnouncementPopupHost } from '../components/GateModals';
import { PinLockGate } from '../components/PinLockGate';
import { BooksProvider } from '../context/BooksContext';
import { KitchenProvider } from '../context/KitchenContext';
import { ShopGateProvider, useShopGate } from '../context/ShopGateContext';
import { useI18n } from '../context/LocaleContext';
import {
  MaintenanceGateScreen,
  PendingGateScreen,
  RejectedGateScreen,
  SuspendedGateScreen,
  UpdateRequiredGateScreen,
} from '../screens/GateScreens';
import { AuthenticatedAppStack } from './AuthenticatedAppStack';

function ShopGateRoot() {
  const { gate } = useShopGate();
  const { t } = useI18n();
  if (gate === 'loading') {
    return <AppLoading message={t((m) => m.loading.checking)} />;
  }
  if (gate === 'maintenance') return <MaintenanceGateScreen />;
  if (gate === 'update_required') return <UpdateRequiredGateScreen />;
  if (gate === 'pending') return <PendingGateScreen />;
  if (gate === 'rejected') return <RejectedGateScreen />;
  if (gate === 'suspended') return <SuspendedGateScreen />;
  return (
    <BooksProvider>
      <KitchenProvider>
        <AnnouncementPopupHost />
        <AuthenticatedAppStack />
      </KitchenProvider>
    </BooksProvider>
  );
}

export function AuthenticatedTree() {
  // The account check runs in ShopGateProvider while the PIN screen is shown,
  // so there is no "Checking your account" screen after the PIN.
  return (
    <ShopGateProvider>
      <PinLockGate>
        <ShopGateRoot />
      </PinLockGate>
    </ShopGateProvider>
  );
}
