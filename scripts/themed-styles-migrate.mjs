import fs from 'fs';
import path from 'path';

const root = path.join(import.meta.dirname, '..');

function migrateScreen(rel) {
  const p = path.join(root, rel);
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes("from '../theme/colors'") && !s.includes('from "../theme/colors"')) return false;
  if (!s.includes('StyleSheet.create')) return false;

  s = s.replace(/import \{ colors \} from '\.\.\/theme\/colors';\r?\n/, '');
  if (!s.includes('useStyleSheet')) {
    s = s.replace(
      /import \{ fonts \} from '\.\.\/theme\/fonts';/,
      "import type { ColorPalette } from '../theme/palettes';\nimport { useStyleSheet } from '../theme/useStyleSheet';\nimport { fonts } from '../theme/fonts';",
    );
  }

  const base = path.basename(rel, '.tsx').replace(/Screen$/, '');
  const fn = `${base.charAt(0).toLowerCase()}${base.slice(1)}Styles`;

  s = s.replace(/const styles = StyleSheet\.create\(\{/, `function ${fn}(c: ColorPalette) {\n  return {`);
  s = s.replace(/\}\);\s*$/, '};\n}\n');

  const fnStart = s.indexOf(`function ${fn}`);
  if (fnStart === -1) throw new Error(`No function ${fn} in ${rel}`);
  const fnEnd = s.indexOf('};\n}', fnStart) + 4;
  let block = s.slice(fnStart, fnEnd);
  block = block.replace(/\bcolors\./g, 'c.');
  block = block.replace(
    'color: c.white,\n    backgroundColor: c.danger',
    'color: c.onFill,\n    backgroundColor: c.danger',
  );
  block = block.replace(/color: c\.white/g, 'color: c.onFill');
  s = s.slice(0, fnStart) + block + s.slice(fnEnd);

  if (!s.includes('const styles = useStyleSheet')) {
    const hook =
      /export function \w+\(\) \{\r?\n(\s*const navigation = useNavigation)/;
    if (hook.test(s)) {
      s = s.replace(hook, (m, g1) => `export function ${m.match(/function (\w+)/)[1]}() {\n  const styles = useStyleSheet(${fn});\n${g1}`);
    } else {
      s = s.replace(
        /export function (\w+)\(\) \{\r?\n/,
        `export function $1() {\n  const styles = useStyleSheet(${fn});\n`,
      );
    }
  }

  s = s.replace(/, StyleSheet,/, ',');
  s = s.replace(/StyleSheet, /, '');
  fs.writeFileSync(p, s);
  return true;
}

const files = [
  'src/screens/NewSaleScreen.tsx',
  'src/screens/MoreScreen.tsx',
  'src/screens/SalesScreen.tsx',
  'src/screens/ProductsScreen.tsx',
  'src/screens/ReportsScreen.tsx',
  'src/screens/ListsScreen.tsx',
  'src/screens/AddExpenseScreen.tsx',
  'src/screens/AuthScreens.tsx',
  'src/screens/NotificationsScreen.tsx',
  'src/components/TodaySalesHistory.tsx',
  'src/components/LoginForm.tsx',
  'src/components/LoginButton.tsx',
  'src/components/AppLoading.tsx',
];

for (const f of files) {
  try {
    if (migrateScreen(f)) console.log('ok', f);
  } catch (e) {
    console.error('fail', f, e.message);
  }
}
