import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  ImageBackground,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { AccessBlockedModal } from '../components/GateModals';
import { AnimatedIconPress } from '../components/AnimatedIconPress';
import {
  BackIcon,
  BoxDuoIcon,
  ChevronRightIcon,
  CloseIcon,
  ExpenseIcon,
  GridDuoIcon,
  LayersIcon,
  ProductIcon,
  ScanIcon,
  SearchIcon,
  TagIcon,
  UtensilsIcon,
} from '../components/Icons';
import { ErrorText, FillButton, IconField, Screen } from '../components/ui';
import { Designable } from '../devtools/designMode/Designable';
import { productsLayout } from '../designConfig/products';
import { useAuth } from '../context/AuthContext';
import { useBooks } from '../context/BooksContext';
import { useI18n } from '../context/LocaleContext';
import { useShopGate } from '../context/ShopGateContext';
import { useTheme } from '../context/ThemeContext';
import { productSellingPrice } from '../lib/booksNormalize';
import { confirmDelete } from '../lib/confirm';
import { formatRs } from '../lib/format';
import { effectiveSellKind, sellKindLabel, type SellKind } from '../lib/productSell';
import { usesKitchenStock } from '../lib/shopType';
import { lowStockProducts } from '../lib/stockCart';
import { FREE_PRODUCT_LIMIT } from '../lib/tiers';
import { useTier } from '../lib/useTier';
import { useKitchen } from '../context/KitchenContext';
import { MaterialSelect } from '../components/kitchen/KitchenUi';
import { formatQty, isSellable } from '../lib/kitchenOps';
import { itemKind } from '../lib/stockEngine';
import type { AppStackParamList, TabParamList } from '../navigation/types';
import type { ColorPalette } from '../theme/palettes';
import { useStyleSheet } from '../theme/useStyleSheet';
import { fonts } from '../theme/fonts';

const appbarBg = require('../../assets/appbar-bg.png');

type Product = ReturnType<typeof useBooks>['books']['products'][number];
type Payload = {
  name: string;
  sellingPrice: number;
  purchasePrice: number;
  stock: number;
  unit: string;
  category: string;
  barcode?: string;
  reorderLevel?: number;
  sellKind: SellKind;
  stockItemId: string;
  portionQty: number;
};

const UNITS = ['pcs', 'kg', 'g', 'l', 'ml', 'pack', 'box'];

function digitsOnly(value: string) {
  return value.replace(/[^\d]/g, '');
}

export function ProductsScreen() {
  const styles = useStyleSheet(productsStyles);
  const navigation = useNavigation<CompositeNavigationProp<
    BottomTabNavigationProp<TabParamList, 'Products'>,
    NativeStackNavigationProp<AppStackParamList>
  >>();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const { books, addProduct, deleteProduct, updateProduct } = useBooks();
  const { canAccess, profile } = useShopGate();
  const kitchen = useKitchen();
  const { has } = useTier();
  const isKitchenShop = usesKitchenStock(profile?.shopType ?? user?.shopType);

  // The sheet lives in its own window, so lift it above the keyboard by hand.
  const { height: windowHeight } = useWindowDimensions();
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) =>
      setKbHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setKbHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const [blockedOpen, setBlockedOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [category, setCategory] = useState('General');
  const [barcode, setBarcode] = useState('');
  const [reorderLevel, setReorderLevel] = useState('');
  const [sellKind, setSellKind] = useState<SellKind>('simple');
  const [stockItemId, setStockItemId] = useState('');
  const [portion, setPortion] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sellableItems = useMemo(() => kitchen.data.materials.filter(isSellable), [kitchen.data.materials]);
  const branchStock = useMemo(
    () => (kitchen.activeBranchId ? kitchen.stockAt(kitchen.activeBranchId) : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kitchen.activeBranchId, kitchen.data.stock],
  );
  const chosenItem = sellableItems.find((m) => m.id === stockItemId);

  const lowIds = useMemo(() => {
    if (!isKitchenShop) {
      return new Set(lowStockProducts(books.products).map((p) => p.id));
    }
    // Fridge qty, not retail shelf stock (linked menu food often has shelf 0).
    return new Set(
      books.products
        .filter((p) => {
          if (!p.stockItemId) return false;
          const qty = branchStock[p.stockItemId] ?? 0;
          const portion = p.portionQty && p.portionQty > 0 ? p.portionQty : 1;
          const level = p.reorderLevel && p.reorderLevel > 0 ? p.reorderLevel : portion * 5;
          return qty > 0 && qty <= level;
        })
        .map((p) => p.id),
    );
  }, [books.products, isKitchenShop, branchStock]);
  const categories = useMemo(
    () =>
      Array.from(new Set(books.products.map((p) => (p.category || 'General').trim() || 'General'))).sort(),
    [books.products],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const recipes = kitchen.data.recipes;
    return books.products
      .filter((p) => {
        if (filter === 'low') return lowIds.has(p.id);
        if (filter === 'simple') return effectiveSellKind(p, recipes) === 'simple';
        if (filter === 'menu') return effectiveSellKind(p, recipes) === 'menu';
        if (filter !== 'all' && (p.category || 'General') !== filter) return false;
        return true;
      })
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.category ?? '').toLowerCase().includes(q) ||
          (p.barcode ?? '').toLowerCase().includes(q),
      )
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [books.products, search, filter, lowIds, kitchen.data.recipes]);

  function resetForm(p: Product | null) {
    setEditing(p);
    setName(p?.name ?? '');
    setSellingPrice(p ? String(productSellingPrice(p)) : '');
    setPurchasePrice(p ? String(p.purchasePrice ?? 0) : '');
    setStock(p ? String(p.stock ?? 0) : '');
    setUnit(p?.unit || 'pcs');
    setCategory(p?.category || (isKitchenShop ? 'Food' : 'General'));
    setBarcode(p?.barcode ?? '');
    setReorderLevel(p?.reorderLevel ? String(p.reorderLevel) : '');
    setSellKind(p ? effectiveSellKind(p, kitchen.data.recipes) : isKitchenShop ? 'menu' : 'simple');
    setStockItemId(p?.stockItemId ?? '');
    setPortion(p?.portionQty ? String(p.portionQty) : '');
    setError(null);
  }

  // Shop type can load after the sheet opens — don't leave new items stuck on Simple sell.
  useEffect(() => {
    if (!formOpen || editing || !isKitchenShop) return;
    setSellKind('menu');
    setCategory((prev) => (prev.trim() && prev.trim().toLowerCase() !== 'general' ? prev : 'Food'));
  }, [formOpen, editing, isKitchenShop]);

  function openAdd() {
    if (!canAccess('manageProducts')) {
      setBlockedOpen(true);
      return;
    }
    if (!has('unlimitedProducts') && books.products.length >= FREE_PRODUCT_LIMIT) {
      Alert.alert(
        'Product limit reached',
        `The Free plan allows ${FREE_PRODUCT_LIMIT} products. Upgrade to Pro for unlimited products.`,
      );
      return;
    }
    resetForm(null);
    setFormOpen(true);
  }

  function openEdit(p: Product) {
    if (!canAccess('manageProducts')) {
      setBlockedOpen(true);
      return;
    }
    resetForm(p);
    setFormOpen(true);
  }

  async function save() {
    setError(null);
    const price = Number(sellingPrice);
    if (!name.trim()) {
      setError('Enter the product name.');
      return;
    }
    if (!price || price <= 0) {
      setError('Enter the selling price.');
      return;
    }
    const isMenuFood = isKitchenShop && sellKind === 'menu';
    const linkedItem = isMenuFood ? sellableItems.find((m) => m.id === stockItemId) : undefined;
    const needsPortion = linkedItem ? itemKind(linkedItem) === 'direct' : false;
    if (needsPortion && !(Number(portion) > 0)) {
      setError(`Enter the portion size in ${linkedItem?.unit ?? 'g'}.`);
      return;
    }
    const cat = category.trim();
    const payload: Payload = {
      name: name.trim(),
      sellingPrice: price,
      purchasePrice: isMenuFood ? (editing?.purchasePrice ?? 0) : Number(purchasePrice || 0),
      // Kitchen food keeps its stock per branch on the linked item, not here.
      stock: isMenuFood ? (editing ? editing.stock : 0) : Number(stock || 0),
      unit: isMenuFood ? unit || 'pcs' : unit,
      // Never leave kitchen food on default "General" — Recipes uses Food/menu.
      category: isMenuFood ? (cat && cat.toLowerCase() !== 'general' ? cat : 'Food') : cat || 'General',
      barcode: isMenuFood ? editing?.barcode : barcode.trim() || undefined,
      reorderLevel: isMenuFood
        ? editing?.reorderLevel
        : reorderLevel.trim()
          ? Number(reorderLevel)
          : undefined,
      // Force the Firestore flag Recipes filters on.
      sellKind: isMenuFood ? 'menu' : 'simple',
      // Empty values clear an earlier link when a product is edited.
      stockItemId: linkedItem?.id ?? '',
      portionQty: needsPortion ? Number(portion) : 0,
    };
    setBusy(true);
    try {
      if (editing) {
        await updateProduct(editing.id, payload);
      } else {
        await addProduct(payload);
      }
      setFormOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t((m) => m.productsTab.errorSave));
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    if (!editing) return;
    const target = editing;
    confirmDelete({
      title: t((m) => m.common.removeProduct, { name: target.name }),
      message: t((m) => m.common.deleteBody),
      cancel: t((m) => m.common.cancel),
      deleteLabel: t((m) => m.common.delete),
      onDelete: () => {
        deleteProduct(target.id);
        setFormOpen(false);
      },
    });
  }

  // Kitchen shops sell menu food; retail keeps category filters only (no sell-kind chips).
  const chips: { key: string; label: string; Icon?: typeof GridDuoIcon }[] = [
    { key: 'all', label: 'All', Icon: GridDuoIcon },
    { key: 'low', label: `Low stock${lowIds.size ? ` (${lowIds.size})` : ''}`, Icon: BoxDuoIcon },
    ...categories.map((c) => ({ key: c, label: c, Icon: c.toLowerCase() === 'food' ? UtensilsIcon : undefined })),
  ];
  const itemCount = books.products.length;

  return (
    <Screen>
      <AccessBlockedModal visible={blockedOpen} onClose={() => setBlockedOpen(false)} />

      <Designable screen="products" id="hero" base={productsLayout.hero} offsetKey="marginTop">
        {(v) => (
          <ImageBackground
            source={appbarBg}
            resizeMode="cover"
            style={[styles.hero, { padding: v.padding, marginTop: v.marginTop, borderRadius: v.borderRadius }]}
          >
            <View style={styles.heroTop}>
              <AnimatedIconPress
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={() => navigation.navigate('Home')}
                hitSlop={6}
                style={styles.heroBack}
              >
                <BackIcon color="#FFFFFF" />
              </AnimatedIconPress>
              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle} numberOfLines={1}>
                  {isKitchenShop ? 'Menu' : t((m) => m.productsTab.title)}
                </Text>
                <Text style={styles.heroSubtitle} numberOfLines={1}>
                  {isKitchenShop ? 'Manage your food menu items' : 'Manage your products'}
                </Text>
              </View>
              <View style={styles.heroCountPill}>
                <Text style={styles.heroCountText} numberOfLines={1}>
                  {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
                </Text>
              </View>
            </View>
            <Designable screen="products" id="search" base={productsLayout.search} offsetKey="minHeight">
              {(sv) => (
                <View style={[styles.heroSearchWrap, { minHeight: sv.minHeight, borderRadius: sv.borderRadius }]}>
                  <SearchIcon color="rgba(255,255,255,0.85)" size={18} />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder={isKitchenShop ? 'Search menu...' : 'Search products...'}
                    placeholderTextColor="rgba(255,255,255,0.75)"
                    autoCapitalize="none"
                    underlineColorAndroid="transparent"
                    style={styles.heroSearchInput}
                  />
                </View>
              )}
            </Designable>
          </ImageBackground>
        )}
      </Designable>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
      >
        {chips.map((chip) => {
          const on = filter === chip.key;
          const Icon = chip.Icon;
          return (
            <Pressable
              key={chip.key}
              onPress={() => setFilter(chip.key)}
              style={[styles.chip, on && styles.chipOn]}
            >
              {Icon ? <Icon color={on ? colors.onFill : colors.muted} size={15} /> : null}
              <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={visible}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={styles.empty}>
            {books.products.length === 0
              ? isKitchenShop
                ? 'No food yet. Add burger, juice…'
                : t((m) => m.productsTab.empty)
              : 'No products match.'}
          </Text>
        }
        renderItem={({ item }) => {
          const low = lowIds.has(item.id);
          const kind = effectiveSellKind(item, kitchen.data.recipes);
          const isMenuItem = isKitchenShop && kind !== 'simple';
          return (
            <Pressable onPress={() => openEdit(item)} style={styles.row}>
              <View style={styles.rowThumb}>
                {isMenuItem ? (
                  <UtensilsIcon color={colors.brand} size={20} />
                ) : (
                  <ProductIcon color={colors.brand} size={20} />
                )}
              </View>
              <View style={styles.rowMain}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {!isKitchenShop
                    ? `${item.category || 'General'} · Stock ${item.stock} ${item.unit}`
                    : kind === 'simple'
                      ? `${sellKindLabel(kind)} · Stock ${item.stock} ${item.unit}`
                      : item.stockItemId
                        ? `Fridge ${formatQty(
                            branchStock[item.stockItemId] ?? 0,
                            kitchen.data.materials.find((m) => m.id === item.stockItemId)?.unit ?? item.unit,
                          )}`
                        : 'Menu only - no stock cut'
                }
                </Text>
              </View>
              <View style={styles.rowSide}>
                <View style={styles.rowPriceBadge}>
                  <Text style={styles.rowPrice}>{formatRs(productSellingPrice(item))}</Text>
                </View>
                {low ? (
                  <View style={styles.lowBadge}>
                    <Text style={styles.lowText}>Low stock</Text>
                  </View>
                ) : null}
              </View>
              <ChevronRightIcon color={colors.line} size={18} />
            </Pressable>
          );
        }}
      />

      <View style={styles.footer}>
        <FillButton
          label={isKitchenShop ? '+ Add Menu' : `+ ${t((m) => m.productsTab.add)}`}
          color={colors.brand}
          onPress={openAdd}
        />
      </View>

      <Modal visible={formOpen} animationType="slide" transparent onRequestClose={() => setFormOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={styles.backdropTap} onPress={() => setFormOpen(false)} />
          <View
            style={[
              styles.sheet,
              {
                marginBottom: kbHeight,
                maxHeight: Math.max(280, Math.min(windowHeight * 0.88, windowHeight - kbHeight - 72)),
              },
            ]}
          >
            <View style={styles.sheetGrabber} />
            <Designable screen="products" id="sheetHead" base={productsLayout.sheetHead} offsetKey="paddingTop">
              {(hv) => (
                <View style={[styles.sheetHead, { paddingTop: hv.paddingTop, paddingBottom: hv.paddingBottom }]}>
                  <Designable screen="products" id="sheetAvatar" base={productsLayout.sheetAvatar} resizeKeys={['width', 'height']}>
                    {(av) => (
                      <View
                        style={[
                          styles.sheetAvatar,
                          { width: av.width, height: av.height, borderRadius: av.borderRadius, backgroundColor: `${colors.brand}1F` },
                        ]}
                      >
                        {isKitchenShop && sellKind === 'menu' ? (
                          <UtensilsIcon color={colors.brand} size={22} />
                        ) : (
                          <ProductIcon color={colors.brand} size={22} />
                        )}
                      </View>
                    )}
                  </Designable>
                  <View style={styles.sheetHeadCopy}>
                    <Text style={styles.sheetTitle}>
                      {isKitchenShop && sellKind === 'menu'
                        ? editing
                          ? 'Edit Menu Item'
                          : 'Add Menu Item'
                        : editing
                          ? 'Edit Product'
                          : t((m) => m.productsTab.add)}
                    </Text>
                    <Text style={styles.sheetSubtitle} numberOfLines={1}>
                      {isKitchenShop && sellKind === 'menu'
                        ? 'Add a new food or menu item'
                        : 'Add a new product to your shop'}
                    </Text>
                  </View>
                  <AnimatedIconPress
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    onPress={() => setFormOpen(false)}
                    hitSlop={10}
                    style={[styles.sheetCloseBtn, { backgroundColor: colors.canvas }]}
                  >
                    <CloseIcon color={colors.muted} size={18} />
                  </AnimatedIconPress>
                </View>
              )}
            </Designable>
            <ScrollView
              contentContainerStyle={[styles.sheetBody, { paddingBottom: 28 + (kbHeight > 0 ? 24 : 0) }]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            >
              {/* Kitchen menu food: name, price, stock link only. Retail + kitchen simple keep full form. */}
              {isKitchenShop && sellKind === 'menu' && !editing ? (
                <Text style={styles.rowMeta}>Juice / sell price here. Recipe burger → Kitchen → + Food.</Text>
              ) : null}
              <IconField
                icon={
                  isKitchenShop && sellKind === 'menu' ? (
                    <UtensilsIcon color={colors.brand} size={18} />
                  ) : (
                    <ProductIcon color={colors.brand} size={18} />
                  )
                }
                iconTint={colors.brand}
                value={name}
                onChangeText={setName}
                placeholder={isKitchenShop && sellKind === 'menu' ? 'Food name (e.g. Burger)' : t((m) => m.productsTab.name)}
              />
              {isKitchenShop && sellKind === 'menu' ? (
                <IconField
                  icon={<TagIcon color="#15803D" size={18} />}
                  iconTint="#15803D"
                  value={sellingPrice}
                  onChangeText={(v) => setSellingPrice(digitsOnly(v))}
                  placeholder="Selling price (Rs.)"
                  keyboardType="number-pad"
                />
              ) : null}
              {isKitchenShop && sellKind === 'menu' ? (
                <>
                  <View style={styles.labelRow}>
                    <LayersIcon color="#7C3AED" size={15} />
                    <Text style={styles.label}>Link stock (optional)</Text>
                  </View>
                  <MaterialSelect materials={sellableItems} value={stockItemId} onChange={setStockItemId} stock={branchStock} />
                  {stockItemId ? (
                    <Pressable onPress={() => setStockItemId('')} hitSlop={8}>
                      <Text style={styles.profit}>Clear link</Text>
                    </Pressable>
                  ) : null}
                  {chosenItem && itemKind(chosenItem) === 'direct' ? (
                    <IconField
                      icon={<LayersIcon color="#7C3AED" size={18} />}
                      iconTint="#7C3AED"
                      value={portion}
                      onChangeText={(v) => setPortion(v.replace(/[^\d.]/g, '').slice(0, 8))}
                      placeholder={`Portion size in ${chosenItem.unit} (e.g. 150)`}
                      keyboardType="decimal-pad"
                    />
                  ) : null}
                  {editing ? (
                    <Text style={styles.profit}>
                      {chosenItem
                        ? `Stock now: ${formatQty(branchStock[chosenItem.id] ?? 0, chosenItem.unit)}`
                        : 'No link — sales still work (e.g. juice).'}
                    </Text>
                  ) : null}
                </>
              ) : (
                <>
                  <View style={styles.twoCol}>
                    <View style={styles.col}>
                      <IconField
                        icon={<TagIcon color="#15803D" size={18} />}
                        iconTint="#15803D"
                        value={sellingPrice}
                        onChangeText={(v) => setSellingPrice(digitsOnly(v))}
                        placeholder={t((m) => m.productsTab.sellingPrice)}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={styles.col}>
                      <IconField
                        icon={<ExpenseIcon color="#EA580C" size={18} />}
                        iconTint="#EA580C"
                        value={purchasePrice}
                        onChangeText={(v) => setPurchasePrice(digitsOnly(v))}
                        placeholder={t((m) => m.productsTab.purchasePrice)}
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>
                  {Number(sellingPrice) > 0 && Number(purchasePrice) > 0 ? (
                    <Text style={styles.profit}>
                      Profit per item: {formatRs(Number(sellingPrice) - Number(purchasePrice))}
                    </Text>
                  ) : null}
                  <IconField
                    icon={<BoxDuoIcon color="#7C3AED" size={18} />}
                    iconTint="#7C3AED"
                    value={stock}
                    onChangeText={(v) => setStock(digitsOnly(v))}
                    placeholder={t((m) => m.productsTab.stock)}
                    keyboardType="number-pad"
                  />
                  <Text style={styles.label}>{t((m) => m.productsTab.unit)}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipScroll}
                    contentContainerStyle={styles.chipRow}
                  >
                    {UNITS.map((u) => {
                      const on = unit === u;
                      return (
                        <Pressable key={u} onPress={() => setUnit(u)} style={[styles.chip, on && styles.chipOn]}>
                          <Text style={[styles.chipText, on && styles.chipTextOn]}>{u}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  <View style={styles.barcodeRow}>
                    <IconField
                      icon={<ScanIcon color={colors.brand} size={18} />}
                      iconTint={colors.brand}
                      value={barcode}
                      onChangeText={setBarcode}
                      placeholder="Barcode"
                      autoCapitalize="none"
                      containerStyle={styles.barcodeField}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t((m) => m.sale.scanBarcode)}
                      onPress={() => setScannerOpen(true)}
                      style={[styles.scanBtn, { backgroundColor: colors.brand }]}
                    >
                      <ScanIcon color={colors.onFill} size={20} />
                      <Text style={[styles.scanBtnText, { color: colors.onFill }]}>{t((m) => m.sale.scanBarcode)}</Text>
                    </Pressable>
                  </View>
                  <IconField
                    icon={<BoxDuoIcon color="#DC2626" size={18} />}
                    iconTint="#DC2626"
                    value={reorderLevel}
                    onChangeText={(v) => setReorderLevel(digitsOnly(v))}
                    placeholder="Reorder when stock is at"
                    keyboardType="number-pad"
                  />
                  <IconField
                    icon={<GridDuoIcon color="#0369A1" size={18} />}
                    iconTint="#0369A1"
                    value={category}
                    onChangeText={setCategory}
                    placeholder={t((m) => m.productsTab.category)}
                  />
                </>
              )}
              <FillButton
                label={
                  isKitchenShop && sellKind === 'menu'
                    ? editing
                      ? 'Save Menu Item'
                      : 'Add Menu Item'
                    : editing
                      ? 'Save changes'
                      : t((m) => m.productsTab.add)
                }
                color={colors.brand}
                onPress={save}
                busy={busy}
              />
              <ErrorText message={error} />
              {editing ? (
                <Pressable onPress={remove} style={styles.deleteBtn}>
                  <Text style={styles.deleteText}>{t((m) => m.common.delete)}</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <BarcodeScannerModal
        visible={scannerOpen}
        title={t((m) => m.sale.scanBarcode)}
        hint={t((m) => m.sale.scanHint)}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => {
          setBarcode(code);
          setScannerOpen(false);
        }}
      />
    </Screen>
  );
}

function productsStyles(c: ColorPalette) {
  return {
    hero: {
      marginHorizontal: 16,
      marginTop: 10,
      marginBottom: 4,
      borderRadius: 24,
      padding: 18,
      gap: 16,
      overflow: 'hidden',
    },
    heroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    heroBack: {
      width: 38,
      height: 38,
      borderRadius: 13,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroCopy: {
      flex: 1,
      gap: 2,
    },
    heroTitle: {
      fontFamily: fonts.bold,
      fontSize: 21,
      color: '#FFFFFF',
    },
    heroSubtitle: {
      fontFamily: fonts.regular,
      fontSize: 12,
      color: 'rgba(255,255,255,0.85)',
    },
    heroCountPill: {
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    heroCountText: {
      fontFamily: fonts.semibold,
      fontSize: 12,
      color: '#FFFFFF',
    },
    heroSearchWrap: {
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    heroSearchInput: {
      flex: 1,
      height: '100%',
      fontFamily: fonts.regular,
      fontSize: 14,
      color: '#FFFFFF',
    },
    barcodeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    barcodeField: {
      flex: 1,
    },
    scanBtn: {
      minHeight: 52,
      minWidth: 88,
      borderRadius: 12,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    scanBtnText: {
      fontFamily: fonts.semibold,
      fontSize: 13,
    },
    chipScroll: {
      flexGrow: 0,
    },
    chipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    chip: {
      minHeight: 36,
      borderRadius: 18,
      paddingHorizontal: 14,
      backgroundColor: c.keypad,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    chipOn: {
      backgroundColor: c.brand,
    },
    chipText: {
      fontFamily: fonts.semibold,
      fontSize: 13,
      color: c.ink,
    },
    chipTextOn: {
      color: c.onFill,
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    empty: {
      marginTop: 28,
      textAlign: 'center',
      fontFamily: fonts.regular,
      fontSize: 14,
      color: c.muted,
    },
    row: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.rowLine,
      paddingVertical: 8,
    },
    rowThumb: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: `${c.brand}1A`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowMain: {
      flex: 1,
      gap: 2,
    },
    rowName: {
      fontFamily: fonts.semibold,
      fontSize: 15,
      color: c.ink,
    },
    rowMeta: {
      fontFamily: fonts.regular,
      fontSize: 12,
      color: c.muted,
    },
    rowSide: {
      alignItems: 'flex-end',
      gap: 4,
    },
    rowPriceBadge: {
      borderRadius: 10,
      backgroundColor: `${c.brand}14`,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    rowPrice: {
      fontFamily: fonts.bold,
      fontSize: 14,
      color: c.brand,
    },
    lowBadge: {
      borderRadius: 8,
      backgroundColor: c.expenseWash,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    lowText: {
      fontFamily: fonts.semibold,
      fontSize: 11,
      color: c.expenseText,
    },
    footer: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 8,
    },
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    backdropTap: {
      flex: 1,
    },
    sheet: {
      maxHeight: '88%',
      backgroundColor: c.white,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    sheetGrabber: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.line,
      marginTop: 10,
    },
    sheetHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 10,
    },
    sheetAvatar: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetHeadCopy: {
      flex: 1,
      gap: 2,
    },
    sheetTitle: {
      fontFamily: fonts.bold,
      fontSize: 18,
      color: c.ink,
    },
    sheetSubtitle: {
      fontFamily: fonts.regular,
      fontSize: 12,
      color: c.muted,
    },
    sheetCloseBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetBody: {
      paddingHorizontal: 16,
      paddingBottom: 28,
      gap: 12,
    },
    twoCol: {
      flexDirection: 'row',
      gap: 10,
    },
    col: {
      flex: 1,
    },
    profit: {
      fontFamily: fonts.semibold,
      fontSize: 13,
      color: c.saleText,
    },
    label: {
      fontFamily: fonts.semibold,
      fontSize: 12,
      color: c.muted,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    deleteBtn: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteText: {
      fontFamily: fonts.semibold,
      fontSize: 14,
      color: c.expenseText,
    },
  };
}
