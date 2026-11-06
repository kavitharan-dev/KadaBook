import { ReactNode, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import { AuthScreenFrame } from '../components/AuthScreenFrame';
import { FadeUp } from '../components/FadeUp';
import { LoginForm } from '../components/LoginForm';
import { CloudIcon, GlobeIcon, LaurelBranch, ReportsIcon, SalesIcon, ShopIcon, StockIcon, UsersIcon } from '../components/LoginIcons';
import { timings } from '../animation/timings';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/LocaleContext';
import { Designable } from '../devtools/designMode/Designable';
import { loginLayout } from '../designConfig/login';
import { useFloatLoop } from '../hooks/useFloatLoop';
import { useIconPress } from '../hooks/useIconPress';
import { useLogoEntrance } from '../hooks/useLogoEntrance';
import type { AuthStackParamList } from '../navigation/types';
import { fonts } from '../theme/fonts';

const background = require('../../assets/auth/auth-bg.png');
const logo = require('../../assets/logo-main.png');
const shop = require('../../assets/auth/login-myshop-img.png');
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

  return (
    <AuthScreenFrame
      bg={background}
      topRight={
        <AnimatedPressable accessibilityRole="button" accessibilityLabel="Change language" onPress={() => setLocale(nextLocale)} onPressIn={langPress.onPressIn} onPressOut={langPress.onPressOut} style={[styles.language, langPress.style]}>
          <GlobeIcon /><Text style={styles.languageText}>{locale.toUpperCase()}</Text><Text style={styles.chevron}>⌄</Text>
        </AnimatedPressable>
      }
    >
      {(scale) => <>
        <Animated.View style={[styles.brandBlock, logoStyle]}>
          <Designable screen="login" id="logo" base={loginLayout.logo} resizeKeys={['width', 'height']} offsetKey="marginTop" scale={scale}>
            {(v) => <Image source={logo} resizeMode="contain" style={[styles.logo, { width: v.width * scale, height: v.height * scale, marginTop: v.marginTop * scale }]} />}
          </Designable>
          <Text style={styles.wordmark}>Kada<Text style={styles.wordmarkAccent}>Book</Text></Text>
          <Text style={styles.tagline}>Digital Accounting, Simplified for All Shops</Text>
        </Animated.View>
        <Designable screen="login" id="shop" base={loginLayout.shop} offsetKey="height" scale={scale}>
          {(v) => <AnimatedImage source={shop} resizeMode="contain" style={[styles.shop, { height: v.height * scale, marginBottom: v.marginBottom * scale }, floatStyle]} />}
        </Designable>
        <FadeUp delay={timings.copyDelayMs} style={styles.cardWrap}>
          <Designable screen="login" id="card" base={loginLayout.card} offsetKey="paddingTop">
            {(v) => (
              <LinearGradient colors={['rgba(255,255,255,0.96)', 'rgba(243,248,255,0.94)']} style={[styles.card, { paddingTop: v.paddingTop, paddingBottom: v.paddingBottom }]}>
                <View style={styles.welcomeRow}><UsersIcon /><Text style={styles.welcome}>Welcome to <Text style={styles.welcomeAccent}>KadaBook</Text></Text></View>
                <Text style={styles.subcopy}>Manage your shop, sales, expenses and reports{`\n`}anytime, anywhere.</Text>
                <LoginForm busy={busy} error={error} onLogin={login} onForgot={() => navigation.navigate('ForgotPassword')} onCreate={() => navigation.navigate('SignUp')} buttonHeight={loginLayout.button.height} />
                <View style={styles.features}><Feature icon={<SalesIcon />} label={`Sales &\nBilling`} /><Feature icon={<StockIcon />} label={`Stock\nManagement`} /><Feature icon={<ReportsIcon />} label={`Reports &\nAnalytics`} /><Feature icon={<CloudIcon />} label={`Cloud\nSync`} /></View>
              </LinearGradient>
            )}
          </Designable>
        </FadeUp>
        <Designable screen="login" id="footer" base={loginLayout.footer} offsetKey="marginTop">
          {(v) => (
            <View style={[styles.footer, { marginTop: v.marginTop }]}>
              <ShopIcon /><View style={styles.footerTextRow}><LaurelBranch /><Text style={styles.footerText}>Manage Your Shop{`\n`}Anytime, Anywhere</Text><LaurelBranch flip /></View>
            </View>
          )}
        </Designable>
      </>}
    </AuthScreenFrame>
  );
}
function Feature({ icon, label }: { icon: ReactNode; label: string }) { return <View style={styles.feature}><View style={styles.featureIconWrap}>{icon}</View><Text style={styles.featureText}>{label}</Text></View>; }
const styles = StyleSheet.create({
  language:{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:14,height:38,backgroundColor:'rgba(255,255,255,0.82)',borderRadius:20,shadowColor:'#123E92',shadowOpacity:.16,shadowRadius:9,elevation:3},languageText:{color:'#07367F',fontFamily:fonts.bold,fontSize:14},chevron:{color:'#07367F',fontFamily:fonts.bold,fontSize:18,marginTop:-4},brandBlock:{width:'100%',alignItems:'center',marginTop:0},logo:{width:132,height:121},wordmark:{marginTop:-8,color:'#092C69',fontFamily:fonts.bold,fontSize:36,lineHeight:41,letterSpacing:-1.5},wordmarkAccent:{color:'#0867F1'},tagline:{marginTop:0,color:'#092A61',fontFamily:fonts.semibold,fontSize:12.5,textAlign:'center'},shop:{width:'100%',alignSelf:'center',marginTop:0},cardWrap:{width:'100%'},card:{borderRadius:28,paddingHorizontal:18,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,0.78)',shadowColor:'#003F9E',shadowOpacity:.15,shadowRadius:18,elevation:7},welcomeRow:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},welcome:{color:'#09265E',fontFamily:fonts.bold,fontSize:21,textAlign:'center',letterSpacing:-.5},welcomeAccent:{color:'#075FE5'},subcopy:{marginTop:4,color:'#5D7195',fontFamily:fonts.regular,fontSize:13,lineHeight:18,textAlign:'center'},features:{marginTop:9,flexDirection:'row',justifyContent:'space-between',borderTopWidth:1,borderTopColor:'rgba(31,100,214,.13)',paddingTop:8},feature:{flex:1,alignItems:'center',minHeight:42},featureIconWrap:{height:21,justifyContent:'center',alignItems:'center',marginBottom:4},featureText:{color:'#122B59',fontFamily:fonts.semibold,fontSize:10,lineHeight:12,textAlign:'center',marginTop:1},footer:{width:'100%',alignItems:'center',gap:4},footerTextRow:{flexDirection:'row',alignItems:'center',gap:10},footerText:{color:'#FFFFFF',fontFamily:fonts.semibold,fontSize:13,lineHeight:17,textAlign:'center'},
});
