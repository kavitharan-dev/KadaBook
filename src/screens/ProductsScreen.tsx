import { useState, useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ErrorText, Field, FillButton, Screen } from '../components/ui';
import { AccessBlockedModal } from '../components/GateModals';
import { useShopGate } from '../context/ShopGateContext';
import { useBooks } from '../context/BooksContext';
import { useI18n } from '../context/LocaleContext';
import { productSellingPrice } from '../lib/booksNormalize';
import { confirmDelete } from '../lib/confirm';
import { formatRs } from '../lib/format';
import type { ColorPalette } from '../theme/palettes';
import { useStyleSheet } from '../theme/useStyleSheet';
import { useTheme } from '../context/ThemeContext';
import { fonts } from '../theme/fonts';

function digitsOnly(value: string) {
  return value.replace(/[^\d]/g, '');
}

export function ProductsScreen() {
  const styles = useStyleSheet(productsStyles);
  const { colors } = useTheme();
  const { books, addProduct, deleteProduct } = useBooks();
  const { canAccess } = useShopGate();
  const [blockedOpen, setBlockedOpen] = useState(false);
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [category, setCategory] = useState('General');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!canAccess('manageProducts')) {
      setBlockedOpen(true);
      return;
    }
    setBusy(true);
    try {
      await addProduct({
        name,
        sellingPrice: Number(sellingPrice),
        purchasePrice: Number(purchasePrice || 0),
        stock: Number(stock || 0),
        unit,
        category,
      });
      setName('');
      setSellingPrice('');
      setPurchasePrice('');
      setStock('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t((m) => m.productsTab.errorSave));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <AccessBlockedModal visible={blockedOpen} onClose={() => setBlockedOpen(false)} />
      <View style={styles.titleRow}>
        <Text style={styles.title}>{t((m) => m.productsTab.title)}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Field value={name} onChangeText={setName} placeholder={t((m) => m.productsTab.name)} />
        <Field
          value={sellingPrice}
          onChangeText={(value) => setSellingPrice(digitsOnly(value))}
          placeholder={t((m) => m.productsTab.sellingPrice)}
          keyboardType="number-pad"
        />
        <Field
          value={purchasePrice}
          onChangeText={(value) => setPurchasePrice(digitsOnly(value))}
          placeholder={t((m) => m.productsTab.purchasePrice)}
          keyboardType="number-pad"
        />
        <Field
          value={stock}
          onChangeText={(value) => setStock(digitsOnly(value))}
          placeholder={t((m) => m.productsTab.stock)}
          keyboardType="number-pad"
        />
        <Field value={unit} onChangeText={setUnit} placeholder={t((m) => m.productsTab.unit)} />
        <Field value={category} onChangeText={setCategory} placeholder={t((m) => m.productsTab.category)} />
        <FillButton label={t((m) => m.productsTab.add)} color={colors.product} onPress={save} busy={busy} />
        <ErrorText message={error} />
        {books.products.length === 0 ? (
          <Text style={styles.empty}>{t((m) => m.productsTab.empty)}</Text>
        ) : (
          books.products.map((product) => (
            <Pressable
              key={product.id}
              onLongPress={() =>
                confirmDelete({
                  title: t((m) => m.common.removeProduct, { name: product.name }),
                  message: t((m) => m.common.deleteBody),
                  cancel: t((m) => m.common.cancel),
                  deleteLabel: t((m) => m.common.delete),
                  onDelete: () => deleteProduct(product.id),
                })
              }
              style={styles.card}
            >
              <Text style={styles.cardName}>{product.name}</Text>
              <Text style={styles.cardMeta}>{product.category}</Text>
              <View style={styles.stats}>
                <Stat label={t((m) => m.productsTab.sellingPrice)} value={formatRs(productSellingPrice(product))} />
                <Stat label={t((m) => m.productsTab.purchasePrice)} value={formatRs(product.purchasePrice)} />
                <Stat label={t((m) => m.productsTab.stock)} value={String(product.stock)} />
                <Stat label={t((m) => m.productsTab.unit)} value={product.unit} />
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useStyleSheet(productsStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function productsStyles(c: ColorPalette) {
  return {
  titleRow: {
    minHeight: 56,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 19,
    color: c.ink,
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
    flexGrow: 1,
  },
  empty: {
    marginTop: 12,
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: 14,
    color: c.muted,
  },
  card: {
    borderWidth: 1,
    borderColor: c.hairline,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  cardName: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: c.ink,
  },
  cardMeta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.muted,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  stat: {
    width: '47%',
    flexGrow: 1,
    borderRadius: 10,
    backgroundColor: c.keypad,
    padding: 8,
    gap: 2,
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: c.muted,
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: c.ink,
  },
};
}
