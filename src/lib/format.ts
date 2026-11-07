export function formatRs(amount: number) {
  return `Rs. ${Math.round(amount).toLocaleString('en-IN')}`;
}

/** Compact rupee amount for dashboard metrics: 1K, 1.5L, 1M, 1B, 1T. */
export function formatCompactRs(amount: number) {
  const rounded = Math.round(amount);
  const absolute = Math.abs(rounded);
  const units: readonly [number, string][] = [
    [1_000_000_000_000, 'T'],
    [1_000_000_000, 'B'],
    [1_000_000, 'M'],
    [100_000, 'L'],
    [1_000, 'K'],
  ];
  const unit = units.find(([value]) => absolute >= value);

  if (!unit) return `Rs. ${rounded.toLocaleString('en-IN')}`;

  const [divisor, suffix] = unit;
  const value = absolute / divisor;
  const compact = value >= 100 ? Math.round(value).toString() : value.toFixed(1).replace(/\.0$/, '');
  return `Rs. ${rounded < 0 ? '−' : ''}${compact}${suffix}`;
}

const SMALL_NUMBER_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
] as const;

const TENS_WORDS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'] as const;

function numberToEnglishWords(value: number): string {
  if (value < 20) return SMALL_NUMBER_WORDS[value];
  if (value < 100) {
    const ones = value % 10;
    return `${TENS_WORDS[Math.floor(value / 10)]}${ones ? `-${SMALL_NUMBER_WORDS[ones]}` : ''}`;
  }
  if (value < 1_000) {
    const remainder = value % 100;
    return `${SMALL_NUMBER_WORDS[Math.floor(value / 100)]} hundred${remainder ? ` ${numberToEnglishWords(remainder)}` : ''}`;
  }

  const scales: readonly [number, string][] = [
    [1_000_000_000_000, 'trillion'],
    [1_000_000_000, 'billion'],
    [1_000_000, 'million'],
    [1_000, 'thousand'],
  ];
  const scale = scales.find(([divisor]) => value >= divisor);
  if (!scale) return 'zero';

  const [divisor, name] = scale;
  const remainder = value % divisor;
  return `${numberToEnglishWords(Math.floor(value / divisor))} ${name}${remainder ? ` ${numberToEnglishWords(remainder)}` : ''}`;
}

/** Full English wording for the dashboard amount, e.g. "one thousand rupees". */
type AmountWordsLocale = 'en' | 'ta' | 'si';

const TAMIL_ONES = ['பூஜ்ஜியம்', 'ஒன்று', 'இரண்டு', 'மூன்று', 'நான்கு', 'ஐந்து', 'ஆறு', 'ஏழு', 'எட்டு', 'ஒன்பது'] as const;
const TAMIL_TEENS = ['பத்து', 'பதினொன்று', 'பன்னிரண்டு', 'பதிமூன்று', 'பதினான்கு', 'பதினைந்து', 'பதினாறு', 'பதினேழு', 'பதினெட்டு', 'பத்தொன்பது'] as const;
const TAMIL_TENS = ['', '', 'இருபது', 'முப்பது', 'நாற்பது', 'ஐம்பது', 'அறுபது', 'எழுபது', 'எண்பது', 'தொண்ணூறு'] as const;
const TAMIL_HUNDREDS = ['', 'நூறு', 'இருநூறு', 'முந்நூறு', 'நானூறு', 'ஐந்நூறு', 'அறுநூறு', 'எழுநூறு', 'எண்ணூறு', 'தொள்ளாயிரம்'] as const;

function tamilUnderThousand(value: number): string {
  if (value < 10) return TAMIL_ONES[value];
  if (value < 20) return TAMIL_TEENS[value - 10];
  if (value < 100) {
    const ones = value % 10;
    const tens = Math.floor(value / 10);
    return ones ? `${TAMIL_TENS[tens].replace(/து$/, 'த்து')} ${TAMIL_ONES[ones]}` : TAMIL_TENS[tens];
  }
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  const hundred = TAMIL_HUNDREDS[hundreds];
  return remainder ? `${hundred} ${tamilUnderThousand(remainder)}` : hundred;
}

const SINHALA_ONES = ['බිංදුව', 'එක', 'දෙක', 'තුන', 'හතර', 'පහ', 'හය', 'හත', 'අට', 'නවය'] as const;
const SINHALA_TEENS = ['දහය', 'එකොළහ', 'දොළහ', 'දහතුන', 'දහහතර', 'පහළොව', 'දහසය', 'දහහත', 'දහඅට', 'දහනවය'] as const;
const SINHALA_TENS = ['', '', 'විස්ස', 'තිහ', 'හතළිහ', 'පනහ', 'හැට', 'හැත්තෑව', 'අසූව', 'අනූව'] as const;
const SINHALA_HUNDREDS = ['', 'එකසිය', 'දෙසිය', 'තුන්සිය', 'හාරසිය', 'පන්සිය', 'හයසිය', 'හත්සිය', 'අටසිය', 'නවසිය'] as const;

function sinhalaUnderThousand(value: number): string {
  if (value < 10) return SINHALA_ONES[value];
  if (value < 20) return SINHALA_TEENS[value - 10];
  if (value < 100) {
    const ones = value % 10;
    return ones ? `${SINHALA_TENS[Math.floor(value / 10)]} ${SINHALA_ONES[ones]}` : SINHALA_TENS[Math.floor(value / 10)];
  }
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  const hundred = SINHALA_HUNDREDS[hundreds];
  return remainder ? `${hundred} ${sinhalaUnderThousand(remainder)}` : hundred;
}

function localizedNumberWords(value: number, locale: Exclude<AmountWordsLocale, 'en'>): string {
  const underThousand = locale === 'ta' ? tamilUnderThousand : sinhalaUnderThousand;
  const scales: readonly [number, string, string][] = locale === 'ta'
    ? [
        [1_000_000_000_000, 'டிரில்லியன்', 'டிரில்லியன்'],
        [1_000_000_000, 'பில்லியன்', 'பில்லியன்'],
        [10_000_000, 'கோடி', 'கோடி'],
        [100_000, 'லட்சம்', 'லட்சம்'],
        [1_000, 'ஆயிரம்', 'ஆயிரம்'],
      ]
    : [
        [1_000_000_000_000, 'ට්‍රිලියන', 'ට්‍රිලියන'],
        [1_000_000_000, 'බිලියන', 'බිලියන'],
        [10_000_000, 'කෝටියක්', 'කෝටි'],
        [100_000, 'ලක්ෂයක්', 'ලක්ෂ'],
        [1_000, 'දහස', 'දහස්'],
      ];
  if (value < 1_000) return underThousand(value);

  const scale = scales.find(([divisor]) => value >= divisor);
  if (!scale) return underThousand(value);
  const [divisor, singular, plural] = scale;
  const count = Math.floor(value / divisor);
  const remainder = value % divisor;
  if (locale === 'ta' && divisor === 1_000) {
    const thousands = count === 1 ? 'ஆயிரம்' : `${localizedNumberWords(count, locale)} ஆயிரம்`;
    if (!remainder) return thousands;
    const connector = thousands.endsWith('ம்') ? `${thousands.slice(0, -2)}த்து` : 'ஆயிரத்து';
    return `${connector} ${localizedNumberWords(remainder, locale)}`;
  }
  if (locale === 'si' && divisor === 1_000) {
    if (count === 1 && remainder) {
      const remainderWords = localizedNumberWords(remainder, locale);
      return `එක්දහස් ${remainderWords}${remainder % 100 === 0 ? 'යක්' : ''}`;
    }
    const thousands = count === 1 ? 'දහසක්' : `${localizedNumberWords(count, locale)} දහස්`;
    return `${thousands}${remainder ? ` ${localizedNumberWords(remainder, locale)}` : ''}`;
  }
  const countWords = count === 1 && locale === 'ta' ? 'ஒரு' : count === 1 && locale === 'si' ? 'එක්' : localizedNumberWords(count, locale);
  const scaleWord = count === 1 ? singular : plural;
  return `${countWords} ${scaleWord}${remainder ? ` ${localizedNumberWords(remainder, locale)}` : ''}`;
}

/** Full localized wording for the dashboard amount. */
export function formatRupeesInWords(amount: number, locale: AmountWordsLocale = 'en') {
  const rounded = Math.round(amount);
  if (!Number.isFinite(rounded)) return locale === 'ta' ? 'பூஜ்ஜியம் ரூபாய்' : locale === 'si' ? 'බිංදුව රුපියල්' : 'zero rupees';
  const absolute = Math.abs(rounded);
  if (locale === 'en') return `${rounded < 0 ? 'minus ' : ''}${numberToEnglishWords(absolute)} rupees`;
  const prefix = rounded < 0 ? (locale === 'ta' ? 'மைனஸ் ' : 'ඍණ ') : '';
  return `${prefix}${localizedNumberWords(absolute, locale)}${locale === 'ta' ? ' ரூபாய்' : ' රුපියල්'}`;
}

export function formatDay(ts: number) {
  return new Date(ts).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Same as formatDay but without the weekday — for tight spaces like a plan status chip. */
export function formatShortDay(ts: number) {
  return new Date(ts).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(ts: number) {
  const date = new Date(ts);
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const hours = date.getHours();
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12.toString().padStart(2, '0')}:${minutes} ${suffix}`;
}

export function startOfDay(ts: number) {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function isSameDay(ts: number, day: number) {
  return startOfDay(ts) === startOfDay(day);
}

export function sum(rows: { amount: number }[]) {
  return rows.reduce((total, row) => total + row.amount, 0);
}
