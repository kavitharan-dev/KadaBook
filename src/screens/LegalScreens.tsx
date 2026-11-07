import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronRightIcon } from '../components/Icons';
import { Header, Screen } from '../components/ui';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../theme/palettes';
import { useStyleSheet } from '../theme/useStyleSheet';
import { fonts } from '../theme/fonts';

function LegalBody({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  const navigation = useNavigation();
  const styles = useStyleSheet(legalStyles);
  return (
    <Screen>
      <Header title={title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.updated}>Last updated: {updated}</Text>
        {children}
      </ScrollView>
    </Screen>
  );
}

function Para({ children }: { children: ReactNode }) {
  const styles = useStyleSheet(legalStyles);
  return <Text style={styles.para}>{children}</Text>;
}

function H({ children }: { children: ReactNode }) {
  const styles = useStyleSheet(legalStyles);
  return <Text style={styles.h}>{children}</Text>;
}

export function TermsScreen() {
  return (
    <LegalBody title="Terms & Conditions" updated="7 November 2026">
      <Para>
        These Terms govern your use of KadaBook, a shop accounting and billing app developed and operated by SMART
        PVT LTD ("we", "us", "the Company"). By creating an account or using the app, you agree to these Terms.
      </Para>

      <H>1. The service</H>
      <Para>
        KadaBook helps shop owners record sales, expenses, stock, credit/dues and staff activity, and generate
        reports and receipts. Some features work offline; others (cloud sync, WhatsApp reminders, reports across
        devices) need an internet connection.
      </Para>

      <H>2. Your account</H>
      <Para>
        You're responsible for the accuracy of the data you enter and for keeping your login and device PIN lock
        secure. Staff accounts you create under your shop act on your behalf — you're responsible for what they do
        in the app.
      </Para>

      <H>3. Plans and billing</H>
      <Para>
        KadaBook is offered on a trial, then paid plans (Basic / Standard) with optional add-ons, shown under
        Settings → Upgrade Plan. Activating or changing a plan is confirmed over WhatsApp with our team; we'll apply
        the change once payment is confirmed. Prices and included features may change — we'll show the current ones
        in the app before you confirm.
      </Para>

      <H>4. Your data</H>
      <Para>
        The business data you enter (sales, customers, stock, staff records) belongs to you. We store it to provide
        the service and don't sell it. You can export it at any time (Settings → Excel export & import) and request
        deletion by contacting us.
      </Para>

      <H>5. Acceptable use</H>
      <Para>
        Don't use KadaBook for anything unlawful, to store data you don't have the right to hold, or to try to
        disrupt or reverse-engineer the service.
      </Para>

      <H>6. Availability</H>
      <Para>
        We work to keep KadaBook available and your cloud data backed up, but we don't guarantee uninterrupted
        service — maintenance, connectivity issues or third-party outages (e.g. our cloud provider) can cause
        downtime.
      </Para>

      <H>7. Liability</H>
      <Para>
        KadaBook is provided "as is". To the extent permitted by law, SMART PVT LTD isn't liable for indirect
        losses (like lost profit) arising from use of the app. Nothing here limits liability where the law doesn't
        allow it.
      </Para>

      <H>8. Ending the service</H>
      <Para>
        You can stop using KadaBook and request account deletion at any time. We may suspend accounts that breach
        these Terms or have significantly overdue payment, after reasonable notice where practical.
      </Para>

      <H>9. Changes</H>
      <Para>
        We may update these Terms as the app grows. We'll show a notice in the app for material changes. Continuing
        to use KadaBook after a change means you accept the updated Terms.
      </Para>

      <H>10. Contact</H>
      <Para>Questions about these Terms? Reach us from Settings → Developed by, or via the shop's registered contact.</Para>
    </LegalBody>
  );
}

export function PrivacyScreen() {
  return (
    <LegalBody title="Privacy Policy" updated="7 November 2026">
      <Para>
        This Privacy Policy explains what data KadaBook (developed by SMART PVT LTD) collects, how it's used and
        how it's protected.
      </Para>

      <H>1. What we collect</H>
      <Para>
        • Account info: your name, phone number or email, and shop name.{'\n'}• Business data: sales, expenses,
        stock, credit/dues, staff and branch records you enter.{'\n'}• Device info: app version and basic diagnostics,
        used only to fix crashes and improve the app.
      </Para>

      <H>2. How we use it</H>
      <Para>
        To run the app — sync your data across your devices, generate reports and receipts, send the WhatsApp
        reminders you choose to send to your own customers, and provide support when you contact us. We don't use
        your business data for advertising.
      </Para>

      <H>3. Where it's stored</H>
      <Para>
        Your cloud-synced data is stored with our cloud database provider (Google Firebase). Anything you keep in
        PIN-lock-only / offline mode stays on your device unless you turn on cloud sync.
      </Para>

      <H>4. Sharing</H>
      <Para>
        We don't sell your data. We only share it with service providers that run the app for us (like our cloud
        host), or when required by law.
      </Para>

      <H>5. Your choices</H>
      <Para>
        Export your data anytime from Settings → Excel export & import. Ask us to delete your account and data by
        contacting us — see Settings → Developed by.
      </Para>

      <H>6. Security</H>
      <Para>
        We use authenticated cloud access and support an in-app PIN lock so you control who opens KadaBook on your
        device. No method of storage or transmission is 100% secure, but we work to protect your data.
      </Para>

      <H>7. Children</H>
      <Para>KadaBook is a business tool and isn't directed at children.</Para>

      <H>8. Changes</H>
      <Para>If this policy changes in a material way, we'll let you know in the app.</Para>
    </LegalBody>
  );
}

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: 'How do I close the day?',
    a: 'From the dashboard, tap "Close Day" at the bottom. It shows a summary of sales, expenses and cash before confirming — you can print or share it on WhatsApp first.',
  },
  {
    q: 'How do I turn on the PIN lock?',
    a: 'Settings → Security & team → PIN lock. Once on, the app asks for a 4-digit PIN every time it opens.',
  },
  {
    q: 'How do I change the app language?',
    a: 'Settings → Preferences → Language. English, Tamil and Sinhala are supported, and you can switch anytime.',
  },
  {
    q: 'How do I export my data?',
    a: 'Settings → Business tools → Excel export & import. You can export sales, expenses and stock to .xlsx, and bulk-import products the same way.',
  },
  {
    q: 'How do I add staff and set what they can do?',
    a: 'Settings → Security & team → Staff & roles. Add a cashier or manager login and choose which parts of the app they can use.',
  },
  {
    q: 'How do I collect customer dues?',
    a: 'Open Credit book from Settings → Business tools to track customer balances and send WhatsApp payment reminders.',
  },
  {
    q: 'How do I connect a Bluetooth receipt printer?',
    a: 'Settings → Business tools → Bluetooth printer. Switch the printer on first, then tap to print a test receipt.',
  },
  {
    q: 'What happens when my trial ends?',
    a: 'You can keep using KadaBook on a paid plan — go to Settings → Upgrade to activate one over WhatsApp. Your data stays safe either way.',
  },
  {
    q: 'Is my data safe if I lose my phone?',
    a: 'If cloud sync is on, your shop data stays backed up — just sign in on another device to pick up where you left off.',
  },
];

export function FaqScreen() {
  const navigation = useNavigation();
  const styles = useStyleSheet(legalStyles);
  const { colors } = useTheme();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <Screen>
      <Header title="FAQ" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        {FAQ_ITEMS.map((item, index) => {
          const open = openIndex === index;
          return (
            <Pressable
              key={item.q}
              onPress={() => setOpenIndex(open ? null : index)}
              style={[styles.faqCard, { borderColor: colors.hairline }]}
            >
              <View style={styles.faqHead}>
                <Text style={styles.faqQ}>{item.q}</Text>
                <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
                  <ChevronRightIcon color={open ? colors.brand : colors.muted} size={20} />
                </View>
              </View>
              {open ? <Text style={styles.faqA}>{item.a}</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

function legalStyles(c: ColorPalette) {
  return {
    body: {
      padding: 16,
      paddingBottom: 32,
      gap: 10,
    },
    updated: {
      fontFamily: fonts.regular,
      fontSize: 12,
      color: c.muted,
      marginBottom: 6,
    },
    h: {
      marginTop: 10,
      fontFamily: fonts.bold,
      fontSize: 15,
      color: c.ink,
    },
    para: {
      fontFamily: fonts.regular,
      fontSize: 14,
      lineHeight: 21,
      color: c.ink,
    },
    faqCard: {
      borderWidth: 1,
      borderRadius: 14,
      padding: 14,
      gap: 8,
      backgroundColor: c.white,
    },
    faqHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    faqQ: {
      flex: 1,
      fontFamily: fonts.semibold,
      fontSize: 14.5,
      color: c.ink,
    },
    faqA: {
      fontFamily: fonts.regular,
      fontSize: 13,
      lineHeight: 19,
      color: c.muted,
    },
  };
}
