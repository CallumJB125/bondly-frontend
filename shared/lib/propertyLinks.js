// SA property search links — Property24 and Private Property
//
// p24: verified city-level base URL (null = falls back to province page)
// pp:  verified city-level base URL (null = falls back to province page)
//
// Province-level fallbacks always work without area IDs:
//   P24:  https://www.property24.com/for-sale/{province-slug}/{province-id}
//   PP:   https://www.privateproperty.co.za/for-sale/{province-slug}   (no ID needed)

// Property24 province-level base URLs (IDs verified via HTTP — not sequential)
const P24_PROVINCE = {
  'Gauteng':       'https://www.property24.com/for-sale/gauteng/1',
  'KwaZulu-Natal': 'https://www.property24.com/for-sale/kwazulu-natal/2',
  'Free State':    'https://www.property24.com/for-sale/free-state/3',
  'Mpumalanga':    'https://www.property24.com/for-sale/mpumalanga/5',
  'North West':    'https://www.property24.com/for-sale/north-west/6',
  'Eastern Cape':  'https://www.property24.com/for-sale/eastern-cape/7',
  'Northern Cape': 'https://www.property24.com/for-sale/northern-cape/8',
  'Western Cape':  'https://www.property24.com/for-sale/western-cape/9',
  'Limpopo':       'https://www.property24.com/for-sale/limpopo/14',
};

// Private Property province URLs — slug-only 404s, numeric IDs required (verified via HTTP)
const PP_PROVINCE = {
  'KwaZulu-Natal': 'https://www.privateproperty.co.za/for-sale/kwazulu-natal/2',
  'Gauteng':       'https://www.privateproperty.co.za/for-sale/gauteng/3',
  'Western Cape':  'https://www.privateproperty.co.za/for-sale/western-cape/4',
  'Northern Cape': 'https://www.privateproperty.co.za/for-sale/northern-cape/5',
  'Free State':    'https://www.privateproperty.co.za/for-sale/free-state/6',
  'Eastern Cape':  'https://www.privateproperty.co.za/for-sale/eastern-cape/7',
  'Limpopo':       'https://www.privateproperty.co.za/for-sale/limpopo/8',
  'North West':    'https://www.privateproperty.co.za/for-sale/north-west/9',
  'Mpumalanga':    'https://www.privateproperty.co.za/for-sale/mpumalanga/10',
};

// Full location list — 50+ cities/towns across all 9 provinces
// Entries with null p24/pp fall back to province-level (still filtered by price)
export const LOCATIONS = [
  // ── GAUTENG ──────────────────────────────────────────────────────────────
  { city: 'Johannesburg',    province: 'Gauteng',       p24: 'https://www.property24.com/for-sale/johannesburg/gauteng/100', pp: 'https://www.privateproperty.co.za/for-sale/gauteng/johannesburg/33' },
  { city: 'Pretoria',        province: 'Gauteng',       p24: 'https://www.property24.com/for-sale/pretoria/gauteng/1',       pp: 'https://www.privateproperty.co.za/for-sale/gauteng/pretoria/28' },
  { city: 'Sandton',         province: 'Gauteng',       p24: null, pp: null },
  { city: 'Centurion',       province: 'Gauteng',       p24: null, pp: null },
  { city: 'Midrand',         province: 'Gauteng',       p24: null, pp: null },
  { city: 'Fourways',        province: 'Gauteng',       p24: null, pp: null },
  { city: 'Soweto',          province: 'Gauteng',       p24: null, pp: null },
  { city: 'East Rand',       province: 'Gauteng',       p24: null, pp: null },
  { city: 'Roodepoort',      province: 'Gauteng',       p24: null, pp: null },
  { city: 'Krugersdorp',     province: 'Gauteng',       p24: null, pp: null },
  { city: 'Benoni',          province: 'Gauteng',       p24: null, pp: null },
  { city: 'Boksburg',        province: 'Gauteng',       p24: null, pp: null },

  // ── WESTERN CAPE ─────────────────────────────────────────────────────────
  { city: 'Cape Town',       province: 'Western Cape',  p24: 'https://www.property24.com/for-sale/cape-town/western-cape/432', pp: 'https://www.privateproperty.co.za/for-sale/western-cape/cape-town/55' },
  { city: 'Stellenbosch',    province: 'Western Cape',  p24: null, pp: null },
  { city: 'Somerset West',   province: 'Western Cape',  p24: null, pp: null },
  { city: 'Paarl',           province: 'Western Cape',  p24: null, pp: null },
  { city: 'George',          province: 'Western Cape',  p24: null, pp: null },
  { city: 'Knysna',          province: 'Western Cape',  p24: null, pp: null },
  { city: 'Hermanus',        province: 'Western Cape',  p24: null, pp: null },
  { city: 'Bellville',       province: 'Western Cape',  p24: null, pp: null },
  { city: 'Strand',          province: 'Western Cape',  p24: null, pp: null },
  { city: 'Mossel Bay',      province: 'Western Cape',  p24: null, pp: null },
  { city: 'Swellendam',      province: 'Western Cape',  p24: null, pp: null },
  { city: 'Franschhoek',     province: 'Western Cape',  p24: null, pp: null },

  // ── KWAZULU-NATAL ────────────────────────────────────────────────────────
  { city: 'Durban',          province: 'KwaZulu-Natal', p24: 'https://www.property24.com/for-sale/durban/kwazulu-natal/169', pp: 'https://www.privateproperty.co.za/for-sale/kwazulu-natal/durban/16' },
  { city: 'Umhlanga',        province: 'KwaZulu-Natal', p24: null, pp: null },
  { city: 'Ballito',         province: 'KwaZulu-Natal', p24: null, pp: null },
  { city: 'Pietermaritzburg',province: 'KwaZulu-Natal', p24: null, pp: null },
  { city: 'Richards Bay',    province: 'KwaZulu-Natal', p24: null, pp: null },
  { city: 'Westville',       province: 'KwaZulu-Natal', p24: null, pp: null },
  { city: 'Amanzimtoti',     province: 'KwaZulu-Natal', p24: null, pp: null },
  { city: 'Hillcrest',       province: 'KwaZulu-Natal', p24: null, pp: null },
  { city: 'Newcastle',       province: 'KwaZulu-Natal', p24: null, pp: null },

  // ── EASTERN CAPE ─────────────────────────────────────────────────────────
  { city: 'Gqeberha',        province: 'Eastern Cape',  p24: 'https://www.property24.com/for-sale/eastern-cape/2', pp: 'https://www.privateproperty.co.za/for-sale/eastern-cape/nelson-mandela-bay/port-elizabeth-gqeberha/67' },
  { city: 'Port Elizabeth',  province: 'Eastern Cape',  p24: 'https://www.property24.com/for-sale/eastern-cape/2', pp: 'https://www.privateproperty.co.za/for-sale/eastern-cape/nelson-mandela-bay/port-elizabeth-gqeberha/67' },
  { city: 'East London',     province: 'Eastern Cape',  p24: null, pp: null },
  { city: 'Jeffreys Bay',    province: 'Eastern Cape',  p24: null, pp: null },
  { city: 'Mthatha',         province: 'Eastern Cape',  p24: null, pp: null },
  { city: 'Grahamstown',     province: 'Eastern Cape',  p24: null, pp: null },

  // ── FREE STATE ───────────────────────────────────────────────────────────
  { city: 'Bloemfontein',    province: 'Free State',    p24: null, pp: null },
  { city: 'Welkom',          province: 'Free State',    p24: null, pp: null },
  { city: 'Sasolburg',       province: 'Free State',    p24: null, pp: null },
  { city: 'Parys',           province: 'Free State',    p24: null, pp: null },

  // ── LIMPOPO ──────────────────────────────────────────────────────────────
  { city: 'Polokwane',       province: 'Limpopo',       p24: null, pp: null },
  { city: 'Tzaneen',         province: 'Limpopo',       p24: null, pp: null },
  { city: 'Mokopane',        province: 'Limpopo',       p24: null, pp: null },
  { city: 'Lephalale',       province: 'Limpopo',       p24: null, pp: null },

  // ── MPUMALANGA ───────────────────────────────────────────────────────────
  { city: 'Nelspruit',       province: 'Mpumalanga',    p24: null, pp: null },
  { city: 'Mbombela',        province: 'Mpumalanga',    p24: null, pp: null },
  { city: 'Witbank',         province: 'Mpumalanga',    p24: null, pp: null },
  { city: 'Secunda',         province: 'Mpumalanga',    p24: null, pp: null },
  { city: 'Middelburg',      province: 'Mpumalanga',    p24: null, pp: null },
  { city: 'White River',     province: 'Mpumalanga',    p24: null, pp: null },

  // ── NORTH WEST ───────────────────────────────────────────────────────────
  { city: 'Rustenburg',      province: 'North West',    p24: null, pp: null },
  { city: 'Potchefstroom',   province: 'North West',    p24: null, pp: null },
  { city: 'Klerksdorp',      province: 'North West',    p24: null, pp: null },
  { city: 'Brits',           province: 'North West',    p24: null, pp: null },
  { city: 'Hartbeespoort',   province: 'North West',    p24: null, pp: null },

  // ── NORTHERN CAPE ────────────────────────────────────────────────────────
  { city: 'Kimberley',       province: 'Northern Cape', p24: null, pp: null },
  { city: 'Upington',        province: 'Northern Cape', p24: null, pp: null },
  { city: 'Springbok',       province: 'Northern Cape', p24: null, pp: null },
];

const roundTo50k = n => Math.ceil(n / 50000) * 50000;

export function buildLinks(location, maxBond) {
  const lo = roundTo50k(maxBond * 0.75);
  const hi = roundTo50k(maxBond);
  const priceP24 = `PriceFrom=${lo}&PriceTo=${hi}`;
  const pricePP  = `fp=${lo}&tp=${hi}`;

  const p24Base = location.p24 || P24_PROVINCE[location.province] || 'https://www.property24.com/for-sale/south-africa/0';
  const ppBase  = location.pp  || PP_PROVINCE[location.province]  || 'https://www.privateproperty.co.za/for-sale/south-africa/1';

  return {
    lo, hi,
    p24: `${p24Base}?${priceP24}`,
    pp:  `${ppBase}?${pricePP}`,
    citySpecific: !!(location.p24 && location.pp),
  };
}
