import { ReactNode, useState } from 'react';
import { Image, ImageBackground, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import { FadeUp } from '../components/FadeUp';
import { LoginForm } from '../components/LoginForm';
import { CloudIcon, GlobeIcon, LaurelBranch, ReportsIcon, SalesIcon, ShopIcon, StockIcon, UsersIcon } from '../components/LoginIcons';
import { timings } from '../animation/timings';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/LocaleContext';
import { useFloatLoop } from '../hooks/useFloatLoop';
import { useIconPress } from '../hooks/useIconPress';
import { useLogoEntrance } from '../hooks/useLogoEntrance';
import { useResponsive } from '../lib/useResponsive';
import type { AuthStackParamList } from '../navigation/types';
import { fonts } from '../theme/fonts';

/** Design was tuned against a ~393dp-wide phone; scale the hero art to match the real device. */
const BASE_WIDTH = 393;

const background = require('../../assets/login-screen-bg.png');
const logo = require('../../assets/KadaBookLogo.png');
const shop = require('../../assets/my-shop-image-remove-bg.png');
const AnimatedImage = Animated.createAnimatedComponent(Image);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { signIn } = useAuth();
  const { locale, setLocale } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const floatStyle = useFloatLoop();
  const logoStyle = useLogoEntrance();
  const langPress = useIconPress(0.92);
  const nextLocale = locale === 'en' ? 'ta' : locale === 'ta' ? 'si' : 'en';
  async function login(identity: string, password: string) { setError(null); setBusy(true); try { await signIn(identity, password); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not sign in.'); } finally { setBusy(false); } }

  const { width, height: screenHeight } = useWindowDimensions();
  const { contentMaxWidth, isTablet } = useResponsive();
  // Scale the hero art off the content's *effective* width (capped on tablets), not the raw
  // device width, so a tablet's centered column doesn't inflate the logo/illustration further.
  const effectiveWidth = Math.min(width, contentMaxWidth ?? width);
  const scale = Math.min(Math.max(effectiveWidth / BASE_WIDTH, 0.86), 1.18);

  // Percentage heights ('100%'/minHeight:'100%') don't reliably resolve through a ScrollView's
  // content chain (especially on web, where the background Image then falls back to its own
  // intrinsic pixel size). Measure the real content height instead and size the background to
  // the larger of that or the screen, so it always covers exactly the scrollable area.
  const [contentHeight, setContentHeight] = useState(0);
  const bgHeight = Math.max(screenHeight, contentHeight);

  return <View style={styles.screen}><StatusBar style="light" />
    <ScrollView style={styles.scrollOuter} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" bounces={false} showsVerticalScrollIndicator={false} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
      {/* Background is a child of the scroll content (not a fixed wrapper around it), so it
          grows to exactly the content's real height on every device instead of a fixed
          viewport size that falls short when the content needs to scroll. */}
      <ImageBackground source={background} resizeMode="cover" style={[styles.background, { height: bgHeight }]}>
        <View onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)} style={[styles.inner, { paddingTop: 28 * scale, paddingBottom: 34 * scale }, isTablet && { maxWidth: contentMaxWidth, alignSelf: 'center' }]}>
          <View style={styles.topbar}><View /><AnimatedPressable accessibilityRole="button" accessibilityLabel="Change language" onPress={() => setLocale(nextLocale)} onPressIn={langPress.onPressIn} onPressOut={langPress.onPressOut} style={[styles.language, langPress.style]}><GlobeIcon /><Text style={styles.languageText}>{locale.toUpperCase()}</Text><Text style={styles.chevron}>⌄</Text></AnimatedPressable></View>
          <Animated.View style={[styles.brandBlock, logoStyle]}><Image source={logo} resizeMode="contain" style={[styles.logo, { width: 86 * scale, height: 78 * scale }]} /><Text style={styles.wordmark}>Kada<Text style={styles.wordmarkAccent}>Book</Text></Text><Text style={styles.tagline}>Digital Accounting, Simplified for All Shops</Text></Animated.View>
          <AnimatedImage source={shop} resizeMode="contain" style={[styles.shop, { height: 196 * scale, marginBottom: -12 * scale }, floatStyle]} />
          <FadeUp delay={timings.copyDelayMs} style={styles.cardWrap}><LinearGradient colors={['rgba(255,255,255,0.96)', 'rgba(243,248,255,0.94)']} style={styles.card}>
            <View style={styles.welcomeRow}><UsersIcon /><Text style={styles.welcome}>Welcome to <Text style={styles.welcomeAccent}>KadaBook</Text></Text></View>
            <Text style={styles.subcopy}>Manage your shop, sales, expenses and reports{`\n`}anytime, anywhere.</Text>
            <LoginForm busy={busy} error={error} onLogin={login} onForgot={() => navigation.navigate('ForgotPassword')} onCreate={() => navigation.navigate('SignUp')} />
            <View style={styles.features}><Feature icon={<SalesIcon />} label={`Sales &\nBilling`} /><Feature icon={<StockIcon />} label={`Stock\nManagement`} /><Feature icon={<ReportsIcon />} label={`Reports &\nAnalytics`} /><Feature icon={<CloudIcon />} label={`Cloud\nSync`} /></View>
          </LinearGradient></FadeUp>
          <View style={styles.footer}><ShopIcon /><View style={styles.footerTextRow}><LaurelBranch /><Text style={styles.footerText}>Manage Your Shop{`\n`}Anytime, Anywhere</Text><LaurelBranch flip /></View></View>
        </View>
      </ImageBackground>
    </ScrollView>
  </View>;
}
function Feature({ icon, label }: { icon: ReactNode; label: string }) { return <View style={styles.feature}><View style={styles.featureIconWrap}>{icon}</View><Text style={styles.featureText}>{label}</Text></View>; }
const styles = StyleSheet.create({
  screen:{flex:1,width:'100%',backgroundColor:'#0755D8'},scrollOuter:{flex:1,width:'100%'},scrollContent:{flexGrow:1,minHeight:'100%',width:'100%'},background:{width:'100%'},inner:{width:'100%',paddingHorizontal:18},topbar:{width:'100%',height:38,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},language:{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:14,height:38,backgroundColor:'rgba(255,255,255,0.82)',borderRadius:20,shadowColor:'#123E92',shadowOpacity:.16,shadowRadius:9,elevation:3},languageText:{color:'#07367F',fontFamily:fonts.bold,fontSize:14},chevron:{color:'#07367F',fontFamily:fonts.bold,fontSize:18,marginTop:-4},brandBlock:{width:'100%',alignItems:'center',marginTop:2},logo:{width:86,height:78},wordmark:{marginTop:-4,color:'#092C69',fontFamily:fonts.bold,fontSize:38,lineHeight:43,letterSpacing:-1.5},wordmarkAccent:{color:'#0867F1'},tagline:{marginTop:1,color:'#092A61',fontFamily:fonts.semibold,fontSize:13,textAlign:'center'},shop:{width:'100%',height:196,alignSelf:'center',marginTop:0,marginBottom:-12},cardWrap:{width:'100%'},card:{borderRadius:30,paddingHorizontal:18,paddingTop:25,paddingBottom:15,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,0.78)',shadowColor:'#003F9E',shadowOpacity:.15,shadowRadius:18,elevation:7},welcomeRow:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},welcome:{color:'#09265E',fontFamily:fonts.bold,fontSize:23,textAlign:'center',letterSpacing:-.5},welcomeAccent:{color:'#075FE5'},subcopy:{marginTop:5,color:'#5D7195',fontFamily:fonts.regular,fontSize:13.5,lineHeight:19,textAlign:'center'},features:{marginTop:19,flexDirection:'row',justifyContent:'space-between',borderTopWidth:1,borderTopColor:'rgba(31,100,214,.13)',paddingTop:14},feature:{flex:1,alignItems:'center',minHeight:58},featureIconWrap:{height:23,justifyContent:'center',alignItems:'center',marginBottom:5},featureText:{color:'#122B59',fontFamily:fonts.semibold,fontSize:10.5,lineHeight:13,textAlign:'center',marginTop:2},footer:{width:'100%',alignItems:'center',marginTop:20,gap:8},footerTextRow:{flexDirection:'row',alignItems:'center',gap:10},footerText:{color:'#FFFFFF',fontFamily:fonts.semibold,fontSize:14,lineHeight:18,textAlign:'center'},
});
