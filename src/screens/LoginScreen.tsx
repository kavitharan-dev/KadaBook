import { ReactNode, useState } from 'react';
import { Image, ImageBackground, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import type { AuthStackParamList } from '../navigation/types';
import { fonts } from '../theme/fonts';

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

  return <View style={styles.screen}><StatusBar style="light" /><ImageBackground source={background} resizeMode="cover" style={styles.background}>
    <ScrollView style={styles.scrollOuter} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" bounces={false} showsVerticalScrollIndicator={false} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
      <View style={styles.topbar}><View /><AnimatedPressable accessibilityRole="button" accessibilityLabel="Change language" onPress={() => setLocale(nextLocale)} onPressIn={langPress.onPressIn} onPressOut={langPress.onPressOut} style={[styles.language, langPress.style]}><GlobeIcon /><Text style={styles.languageText}>{locale.toUpperCase()}</Text><Text style={styles.chevron}>⌄</Text></AnimatedPressable></View>
      <Animated.View style={[styles.brandBlock, logoStyle]}><Image source={logo} resizeMode="contain" style={styles.logo} /><Text style={styles.wordmark}>Kada<Text style={styles.wordmarkAccent}>Book</Text></Text><Text style={styles.tagline}>Digital Accounting, Simplified for All Shops</Text></Animated.View>
      <AnimatedImage source={shop} resizeMode="contain" style={[styles.shop, floatStyle]} />
      <FadeUp delay={timings.copyDelayMs} style={styles.cardWrap}><LinearGradient colors={['rgba(255,255,255,0.96)', 'rgba(243,248,255,0.94)']} style={styles.card}>
        <View style={styles.welcomeRow}><UsersIcon /><Text style={styles.welcome}>Welcome to <Text style={styles.welcomeAccent}>KadaBook</Text></Text></View>
        <Text style={styles.subcopy}>Manage your shop, sales, expenses and reports{`\n`}anytime, anywhere.</Text>
        <LoginForm busy={busy} error={error} onLogin={login} onForgot={() => navigation.navigate('ForgotPassword')} onCreate={() => navigation.navigate('SignUp')} />
        <View style={styles.features}><Feature icon={<SalesIcon />} label={`Sales &\nBilling`} /><Feature icon={<StockIcon />} label={`Stock\nManagement`} /><Feature icon={<ReportsIcon />} label={`Reports &\nAnalytics`} /><Feature icon={<CloudIcon />} label={`Cloud\nSync`} /></View>
      </LinearGradient></FadeUp>
      <View style={styles.footer}><ShopIcon /><View style={styles.footerTextRow}><LaurelBranch /><Text style={styles.footerText}>Manage Your Shop{`\n`}Anytime, Anywhere</Text><LaurelBranch flip /></View></View>
    </ScrollView>
  </ImageBackground></View>;
}
function Feature({ icon, label }: { icon: ReactNode; label: string }) { return <View style={styles.feature}><View style={styles.featureIconWrap}>{icon}</View><Text style={styles.featureText}>{label}</Text></View>; }
const styles = StyleSheet.create({
  screen:{flex:1,width:'100%',backgroundColor:'#0755D8'},background:{flex:1,width:'100%'},scrollOuter:{flex:1,width:'100%'},scroll:{flexGrow:1,minHeight:'100%',width:'100%',paddingTop:52,paddingHorizontal:18,paddingBottom:34},topbar:{width:'100%',height:38,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},language:{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:14,height:38,backgroundColor:'rgba(255,255,255,0.82)',borderRadius:20,shadowColor:'#123E92',shadowOpacity:.16,shadowRadius:9,elevation:3},languageText:{color:'#07367F',fontFamily:fonts.bold,fontSize:14},chevron:{color:'#07367F',fontFamily:fonts.bold,fontSize:18,marginTop:-4},brandBlock:{width:'100%',alignItems:'center',marginTop:6},logo:{width:116,height:106},wordmark:{marginTop:-7,color:'#092C69',fontFamily:fonts.bold,fontSize:38,lineHeight:43,letterSpacing:-1.5},wordmarkAccent:{color:'#0867F1'},tagline:{marginTop:1,color:'#092A61',fontFamily:fonts.semibold,fontSize:13,textAlign:'center'},shop:{width:'108%',height:224,alignSelf:'center',marginTop:0,marginBottom:-15},cardWrap:{width:'100%'},card:{borderRadius:30,paddingHorizontal:18,paddingTop:25,paddingBottom:15,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,0.78)',shadowColor:'#003F9E',shadowOpacity:.15,shadowRadius:18,elevation:7},welcomeRow:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},welcome:{color:'#09265E',fontFamily:fonts.bold,fontSize:23,textAlign:'center',letterSpacing:-.5},welcomeAccent:{color:'#075FE5'},subcopy:{marginTop:5,color:'#5D7195',fontFamily:fonts.regular,fontSize:13.5,lineHeight:19,textAlign:'center'},features:{marginTop:19,flexDirection:'row',justifyContent:'space-between',borderTopWidth:1,borderTopColor:'rgba(31,100,214,.13)',paddingTop:14},feature:{flex:1,alignItems:'center',minHeight:58},featureIconWrap:{height:23,justifyContent:'center',alignItems:'center',marginBottom:5},featureText:{color:'#122B59',fontFamily:fonts.semibold,fontSize:10.5,lineHeight:13,textAlign:'center',marginTop:2},footer:{width:'100%',alignItems:'center',marginTop:20,gap:8},footerTextRow:{flexDirection:'row',alignItems:'center',gap:10},footerText:{color:'#FFFFFF',fontFamily:fonts.semibold,fontSize:14,lineHeight:18,textAlign:'center'},
});
